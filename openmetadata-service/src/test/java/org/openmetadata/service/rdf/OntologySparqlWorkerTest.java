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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;

class OntologySparqlWorkerTest {
  @ParameterizedTest
  @ValueSource(ints = {-1, Integer.MAX_VALUE, 8})
  void refusesCorruptRequestLengthsBeforeAllocatingOrParsing(final int declaredLength)
      throws Exception {
    final byte[] header = ByteBuffer.allocate(Integer.BYTES).putInt(declaredLength).array();
    try (final var input = new DataInputStream(new ByteArrayInputStream(header))) {
      assertThrows(IOException.class, () -> OntologySparqlWorker.readRequest(input));
    }
  }

  @ParameterizedTest(name = "interruptCaller={0}")
  @ValueSource(booleans = {true, false})
  void failedExecutionReapsTheChildAndRemovesItsFilesBeforeReleasingCapacity(
      final boolean interruptCaller) throws Exception {
    final Model model = ModelFactory.createDefaultModel();
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
