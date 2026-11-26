/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.rdf;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Arrays;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;

class OntologySparqlWorkerTest {
  @TempDir private Path temporaryDirectory;

  @Test
  void waitsForWorkerCapacityAndReleasesItAfterUse() throws Exception {
    final var held = OntologySparqlWorker.acquire(SparqlQueryLimits.TIMEOUT_MILLIS);
    final var task =
        new FutureTask<>(
            () -> {
              try (final var worker =
                  OntologySparqlWorker.acquire(SparqlQueryLimits.TIMEOUT_MILLIS)) {
                return true;
              }
            });
    final Thread waiter = Thread.ofVirtual().start(task);
    try {
      await()
          .atMost(Duration.ofSeconds(2))
          .until(() -> waiter.getState() == Thread.State.TIMED_WAITING || task.isDone());
      assertFalse(task.isDone(), "The second caller must wait for the occupied worker");
      held.close();
      assertTrue(task.get(10, TimeUnit.SECONDS));
      try (final var worker = OntologySparqlWorker.acquire(SparqlQueryLimits.TIMEOUT_MILLIS)) {
        assertThrows(
            SparqlQueryExecutionGuard.QueryTimeoutException.class,
            () -> OntologySparqlWorker.acquire(50));
      }
    } finally {
      held.close();
      waiter.interrupt();
      waiter.join(10_000);
    }
  }

  @Test
  void interruptedWaiterDoesNotReleaseTheOccupiedPermit() throws Exception {
    try (final var held = OntologySparqlWorker.acquire(SparqlQueryLimits.TIMEOUT_MILLIS)) {
      final var task =
          new FutureTask<>(
              () -> {
                assertThrows(
                    SparqlQueryExecutionGuard.QueryTimeoutException.class,
                    () -> OntologySparqlWorker.acquire(SparqlQueryLimits.TIMEOUT_MILLIS));
                return Thread.currentThread().isInterrupted();
              });
      final Thread waiter = Thread.ofVirtual().start(task);
      try {
        await()
            .atMost(Duration.ofSeconds(2))
            .until(() -> waiter.getState() == Thread.State.TIMED_WAITING || task.isDone());
        assertFalse(task.isDone());
        waiter.interrupt();
        assertTrue(task.get(10, TimeUnit.SECONDS));
        assertThrows(
            SparqlQueryExecutionGuard.QueryTimeoutException.class,
            () -> OntologySparqlWorker.acquire(50));
      } finally {
        waiter.interrupt();
        waiter.join(10_000);
      }
    }
  }

  @Test
  void queriesMultiMegabyteModelsWithDistinctNodes() throws Exception {
    final Model model = distinctNodeModel(80_000);
    assertTrue(serializedBytes(model) > 3 * 1024 * 1024);

    assertTrue(service(model).query(UUID.randomUUID(), request("ASK {}")).body().contains("true"));
    assertTrue(model.isClosed());
  }

  @ParameterizedTest
  @EnumSource(
      value = SparqlQuery.Inference.class,
      names = {"NONE", "RDFS", "OWL"})
  void queriesMultiMegabyteGlossariesWithInference(final SparqlQuery.Inference inference)
      throws Exception {
    final Model model = glossaryModel();
    assertTrue(serializedBytes(model) > 7 * 1024 * 1024);
    final String query =
        inference == SparqlQuery.Inference.NONE
            ? "ASK {}"
            : "ASK { <urn:glossary:concept:00000000> a <urn:glossary:Entry> }";

    assertTrue(
        service(model)
            .query(UUID.randomUUID(), request(query).withInference(inference))
            .body()
            .contains("true"));
    assertTrue(model.isClosed());
  }

  @Test
  void reportsOntologySizeWhenParsingExhaustsTheWorkerHeap() throws Exception {
    writeWorkerRequest(distinctNodeModel(80_000));
    // A smaller heap forces parsing to fail before the query deadline, without GC timing races.
    final ProcessBuilder builder =
        new ProcessBuilder(
                Path.of(System.getProperty("java.home"), "bin", "java").toString(),
                "-Xmx64m",
                "-XX:+UseSerialGC",
                "-XX:ActiveProcessorCount=1",
                "-XX:+ExitOnOutOfMemoryError",
                "-cp",
                System.getProperty("java.class.path"),
                OntologySparqlQueryService.Worker.class.getName(),
                temporaryDirectory.toString())
            .redirectOutput(ProcessBuilder.Redirect.DISCARD)
            .redirectError(ProcessBuilder.Redirect.DISCARD);
    builder.environment().clear();
    final Process process = builder.start();
    try {
      assertTrue(process.waitFor(60, TimeUnit.SECONDS));
      assertEquals(3, process.exitValue());
      final var failure = OntologySparqlWorker.memoryLimitFailure(temporaryDirectory);
      assertInstanceOf(SparqlQueryLimits.OntologyTooLargeException.class, failure);
      assertTrue(failure.getMessage().contains("ontology"), failure.getMessage());
      assertTrue(failure.getMessage().contains("loading"), failure.getMessage());
    } finally {
      process.destroyForcibly();
      assertTrue(process.waitFor(10, TimeUnit.SECONDS));
    }
  }

  @Test
  void aQueryThatExhaustsMemoryAfterLoadingIsNotAnOversizedOntology() {
    final var failure = OntologySparqlWorker.memoryLimitFailure(temporaryDirectory);

    assertEquals(SparqlQueryLimits.QueryLimitExceededException.class, failure.getClass());
  }

  private void writeWorkerRequest(final Model model) throws IOException {
    try (final var output =
        new DataOutputStream(Files.newOutputStream(temporaryDirectory.resolve("request")))) {
      final byte[] query = "ASK {}".getBytes(StandardCharsets.UTF_8);
      output.writeInt(query.length);
      output.write(query);
      output.writeUTF("");
      output.writeUTF("");
      output.writeInt(SparqlQueryLimits.TIMEOUT_MILLIS);
      output.writeInt(0);
      RDFDataMgr.write(output, model, RDFFormat.NTRIPLES_UTF8);
    } finally {
      model.close();
    }
  }

  private long serializedBytes(final Model model) throws IOException {
    final Path path = temporaryDirectory.resolve("ontology.nt");
    try (final OutputStream output = Files.newOutputStream(path)) {
      RDFDataMgr.write(output, model, RDFFormat.NTRIPLES_UTF8);
    }
    return Files.size(path);
  }

  private static Model distinctNodeModel(final int triples) {
    final Model model = ModelFactory.createDefaultModel();
    for (int index = 0; index < triples; index++) {
      final String suffix = Integer.toHexString(index);
      model.add(
          model.createResource("urn:s:" + suffix),
          model.createProperty("urn:p:" + suffix),
          model.createResource("urn:o:" + suffix));
    }
    return model;
  }

  private static Model glossaryModel() {
    final Model model = ModelFactory.createDefaultModel();
    final var concept = model.createResource("urn:glossary:Concept");
    concept.addProperty(RDFS.subClassOf, model.createResource("urn:glossary:Entry"));
    model.createResource("urn:glossary:concept:00000000").addProperty(RDF.type, concept);
    for (int index = 0; index < 12_000; index++) {
      model
          .createResource("urn:glossary:concept:%08x".formatted(index))
          .addProperty(
              model.createProperty("urn:glossary:type"),
              model.createResource("urn:glossary:Concept"))
          .addProperty(
              model.createProperty("urn:glossary:label"), "Business concept %08x".formatted(index))
          .addProperty(
              model.createProperty("urn:glossary:definition"),
              "Definition %08x: ".formatted(index)
                  + "Metadata describing a business concept and its usage. ".repeat(3))
          .addProperty(
              model.createProperty("urn:glossary:scheme"),
              model.createResource("urn:glossary:scheme"))
          .addProperty(
              model.createProperty("urn:glossary:broader"),
              model.createResource("urn:glossary:group:%08x".formatted(index / 100)))
          .addProperty(
              model.createProperty("urn:glossary:related"),
              model.createResource("urn:glossary:concept:%08x".formatted((index + 1) % 12_000)));
    }
    return model;
  }

  @ParameterizedTest
  @ValueSource(ints = {-1, Integer.MAX_VALUE, 8})
  void refusesCorruptRequestLengthsBeforeAllocatingOrParsing(final int declaredLength)
      throws Exception {
    final byte[] header = ByteBuffer.allocate(Integer.BYTES).putInt(declaredLength).array();
    try (final var input = new DataInputStream(new ByteArrayInputStream(header))) {
      assertThrows(IOException.class, () -> OntologySparqlWorker.readRequest(input));
    }
  }

  @ParameterizedTest
  @ValueSource(ints = {-1, Integer.MAX_VALUE})
  void refusesCorruptPrefixCounts(final int count) throws Exception {
    final byte[] frame = ByteBuffer.allocate(Integer.BYTES).putInt(count).array();
    final Model model = ModelFactory.createDefaultModel();
    try (final var input = new DataInputStream(new ByteArrayInputStream(frame))) {
      assertThrows(
          IOException.class,
          () -> OntologySparqlWorker.readModel(temporaryDirectory, input, model));
    } finally {
      model.close();
    }
  }

  @ParameterizedTest
  @ValueSource(ints = {-1, Integer.MAX_VALUE, 8})
  void refusesCorruptPrefixLengths(final int length) throws Exception {
    final byte[] frame = ByteBuffer.allocate(2 * Integer.BYTES).putInt(1).putInt(length).array();
    final Model model = ModelFactory.createDefaultModel();
    try (final var input = new DataInputStream(new ByteArrayInputStream(frame))) {
      assertThrows(
          IOException.class,
          () -> OntologySparqlWorker.readModel(temporaryDirectory, input, model));
    } finally {
      model.close();
    }
  }

  @ParameterizedTest(name = "interruptCaller={0}")
  @ValueSource(booleans = {true, false})
  void failedExecutionReapsTheChildAndRemovesItsFilesBeforeReleasingCapacity(
      final boolean interruptCaller) throws Exception {
    final Model model = ModelFactory.createDefaultModel();
    if (!interruptCaller) {
      model
          .createResource("urn:subject")
          .addProperty(model.createProperty("urn:large"), "x".repeat(9 * 1024 * 1024));
    }
    final String values =
        IntStream.range(0, 1_000).mapToObj(Integer::toString).collect(Collectors.joining(" "));
    final String query =
        "SELECT (COUNT(*) AS ?count) WHERE { VALUES ?a { %s } VALUES ?b { %s } VALUES ?c { %s } }"
            .formatted(values, values, values);
    final var task =
        new FutureTask<>(() -> service(model).query(UUID.randomUUID(), request(query)));
    final Thread thread = Thread.ofVirtual().start(task);
    ProcessHandle worker = null;
    try {
      worker =
          await()
              .atMost(Duration.ofSeconds(10))
              .pollInterval(Duration.ofMillis(10))
              .until(OntologySparqlWorkerTest::queryChild, Objects::nonNull);
      final String[] arguments = processArguments(worker);
      final Path directory = Path.of(arguments[arguments.length - 1]);
      if (!interruptCaller) {
        assertTrue(Arrays.asList(arguments).contains("-Xmx256m"));
      }

      if (interruptCaller) {
        thread.interrupt();
      } else {
        worker.destroyForcibly();
      }
      final var failure =
          assertThrows(ExecutionException.class, () -> task.get(10, TimeUnit.SECONDS));

      final Class<? extends RuntimeException> expectedFailure =
          interruptCaller
              ? SparqlQueryExecutionGuard.QueryTimeoutException.class
              : IllegalStateException.class;
      assertInstanceOf(expectedFailure, failure.getCause());
      assertFalse(worker.isAlive());
      assertFalse(Files.exists(directory));
      assertTrue(model.isClosed());
      assertTrue(
          service(ModelFactory.createDefaultModel())
              .query(UUID.randomUUID(), request("ASK {}"))
              .body()
              .contains("true"));
    } finally {
      thread.interrupt();
      if (worker != null && worker.isAlive()) {
        worker.destroyForcibly();
      }
      thread.join(10_000);
    }
  }

  @Test
  void refusesOversizedInputAndReleasesAdmission() {
    final Model model = ModelFactory.createDefaultModel();
    final var value = model.createLiteral("x".repeat(64 * 1024));
    for (int index = 0; index < 513; index++) {
      model.add(model.createResource("urn:" + index), model.createProperty("urn:predicate"), value);
    }

    final var failure =
        assertThrows(
            SparqlQueryLimits.QueryLimitExceededException.class,
            () -> service(model).query(UUID.randomUUID(), request("ASK {}")));

    assertTrue(failure.getMessage().contains("input"), failure.getMessage());
    assertTrue(model.isClosed());
    try (final var worker = OntologySparqlWorker.acquire(SparqlQueryLimits.TIMEOUT_MILLIS)) {
      assertThrows(
          SparqlQueryExecutionGuard.QueryCapacityException.class,
          () -> OntologySparqlWorker.acquire(SparqlQueryLimits.TIMEOUT_MILLIS));
    }
  }

  private static ProcessHandle queryChild() {
    return ProcessHandle.current()
        .children()
        .filter(
            child ->
                Arrays.asList(processArguments(child))
                    .contains(OntologySparqlQueryService.Worker.class.getName()))
        .findFirst()
        .orElse(null);
  }

  private static String[] processArguments(final ProcessHandle process) {
    // Linux can omit ProcessHandle arguments when the test classpath is long.
    final Path commandLine = Path.of("/proc", Long.toString(process.pid()), "cmdline");
    if (Files.isReadable(commandLine)) {
      try {
        return Files.readString(commandLine).split("\u0000");
      } catch (IOException exception) {
        throw new UncheckedIOException(exception);
      }
    }
    return process.info().arguments().orElse(new String[0]);
  }

  private static OntologySparqlQueryService service(final Model model) {
    return new OntologySparqlQueryService(
        (id, includeRelations) -> model, new SparqlFederationGuard(null));
  }

  private static SparqlQuery request(final String query) {
    return new SparqlQuery().withQuery(query);
  }
}
