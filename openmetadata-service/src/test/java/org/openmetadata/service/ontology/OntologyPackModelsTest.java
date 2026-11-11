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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.apache.commons.codec.digest.DigestUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot.Entry;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot.Snapshot;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;
import org.openmetadata.service.rdf.RdfSerializationFormat;
import org.openmetadata.service.rdf.SafeRdfModelParser;

class OntologyPackModelsTest {
  private static final int CACHE_ENTRY_BYTES = 16 * 1024;
  private static final String FIXTURE_PATH = "ontology-cache-fixture.ttl";
  private static final String FIXTURE =
      """
      @prefix ex: <https://example.org/cache#> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      ex:Parent a owl:Class; rdfs:label "Parent" .
      ex:Child a owl:Class; rdfs:subClassOf ex:Parent; ex:unknown "unhandled" .
      ex:related a owl:ObjectProperty; rdfs:domain ex:Child; rdfs:range ex:Parent .
      """;
  private final OntologyPackCatalog catalog = OntologyPackCatalog.bundled();
  private final OntologyPackModels models =
      new OntologyPackModels(new OntologyPackContentLoader(getClass().getClassLoader()));
  private final Ontology root =
      new Ontology()
          .withId(UUID.randomUUID())
          .withName("library")
          .withFullyQualifiedName("library");
  private final Snapshot emptySnapshot =
      new Snapshot(
          new OntologyState().withOntologyId(root.getId()).withWorkingRevision(0L),
          List.of(new Entry(MemberKind.ONTOLOGY, root)));

  @BeforeAll
  static void registerOntologyType() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put(Entity.ONTOLOGY, Entity.ONTOLOGY);
  }

  @Test
  void readingModulesOneByOneYieldsTheSamePlanAsTheJoinedBodyOfEveryBundledPack() {
    for (final var manifest : catalog.list()) {
      final List<OntologyPackModule> modules = manifest.getModules();
      final List<String> ids = modules.stream().map(OntologyPackModule::getId).toList();

      final List<OntologyChangeOperation> perModule = reconcilePerModule(modules);
      final List<OntologyChangeOperation> joined = reconcileJoined(manifest.getId(), ids);

      assertFalse(perModule.isEmpty(), manifest.getId());
      assertEquals(
          OntologyPackSlicePlan.sliceDigest(joined),
          OntologyPackSlicePlan.sliceDigest(perModule),
          manifest.getId());
    }
  }

  @Test
  void refusesAModuleWhoseChecksumDoesNotMatchTheCatalogue() {
    final OntologyPackModule tampered =
        JsonUtils.deepCopy(
                catalog.require("sosa-ssn").getModules().getFirst(), OntologyPackModule.class)
            .withSha256("0".repeat(64));

    assertThrows(IllegalStateException.class, () -> models.load(List.of(tampered)));
  }

  @Test
  void equivalentDependencyExpandedSelectionsReuseTheDocument() {
    final AtomicInteger reads = new AtomicInteger();
    final OntologyPackModels cached = countingModels(reads, 1024 * 1024);
    final var first = cached.select(catalog, "sosa-ssn", List.of("ssn"));
    final var equivalent = cached.select(catalog, "sosa-ssn", List.of("ssn", "sosa", "ssn"));

    assertEquals(cached.document(first), cached.document(equivalent));
    assertEquals(2, reads.get());
    assertEquals(
        16, cached.document(cached.select(catalog, "sosa-ssn", List.of("sosa"))).concepts().size());
    assertEquals(3, reads.get(), "a narrower module selection needs its own document");
  }

  @Test
  void concurrentMissesReadEachSelectedPayloadOnce() throws Exception {
    final AtomicInteger reads = new AtomicInteger();
    final OntologyPackModels cached = countingModels(reads, 1024 * 1024);
    final var selected = cached.select(catalog, "sosa-ssn", List.of("ssn"));
    final CountDownLatch ready = new CountDownLatch(4);
    final CountDownLatch start = new CountDownLatch(1);
    try (final var workers = Executors.newFixedThreadPool(4)) {
      final var results =
          IntStream.range(0, 4)
              .mapToObj(
                  ignored ->
                      workers.submit(
                          () -> {
                            ready.countDown();
                            assertTrue(start.await(10, TimeUnit.SECONDS));
                            return cached.document(selected);
                          }))
              .toList();
      assertTrue(ready.await(10, TimeUnit.SECONDS));
      start.countDown();
      final NativeOntologyDocument first = results.getFirst().get(30, TimeUnit.SECONDS);
      for (final var result : results) {
        assertEquals(first, result.get(30, TimeUnit.SECONDS));
      }
      assertNotSame(first, results.getLast().get(30, TimeUnit.SECONDS));
      assertEquals(2, reads.get());
    } finally {
      start.countDown();
    }
  }

  @Test
  void callerMutationsCannotChangeCachedDefinitionsOrSkippedStatements() {
    final AtomicInteger reads = new AtomicInteger();
    final OntologyPackModels cached = fixtureModels(FIXTURE, reads, 1024 * 1024);
    final var selected = fixtureSelection(FIXTURE, "1");
    final NativeOntologyDocument document = cached.document(selected);
    final String original = JsonUtils.pojoToJson(document);

    document.concepts().getFirst().setDisplayName("changed");
    document.properties().getFirst().getDomain().clear();
    document.axioms().getFirst().getExpressions().getFirst().setClassIri(URI.create("urn:changed"));
    document.skipped().getGroups().getFirst().setCount(-1);

    assertEquals(original, JsonUtils.pojoToJson(cached.document(selected)));
    assertEquals(1, reads.get());
  }

  @Test
  void reconciliationAndPlanMutationsLeaveTheSourceDocumentUntouched() {
    final OntologyPackModels cached = fixtureModels(FIXTURE, new AtomicInteger(), 1024 * 1024);
    final NativeOntologyDocument document = cached.document(fixtureSelection(FIXTURE, "1"));
    final String original = JsonUtils.pojoToJson(document);
    final var plan = new NativeOntologyRdfImporter().reconcileUnbounded(document, emptySnapshot);

    plan.getOperations().stream()
        .filter(operation -> operation.getConcept() != null)
        .findFirst()
        .orElseThrow()
        .getConcept()
        .setDisplayName("changed plan");

    assertEquals(original, JsonUtils.pojoToJson(document));
  }

  @Test
  void aWarmDocumentCannotBypassAMismatchedChecksum() {
    final AtomicInteger reads = new AtomicInteger();
    final OntologyPackModels cached = fixtureModels(FIXTURE, reads, 1024 * 1024);
    final var selected = fixtureSelection(FIXTURE, "1");
    cached.document(selected);
    final var tampered =
        JsonUtils.deepCopy(selected.modules().getFirst(), OntologyPackModule.class)
            .withSha256("0".repeat(64));
    final var invalid =
        new OntologyPackContentLoader.Selection(
            selected.manifest(), List.of(tampered), selected.format());

    assertThrows(IllegalStateException.class, () -> cached.document(invalid));
    assertThrows(IllegalStateException.class, () -> cached.document(invalid));
    assertEquals(3, reads.get(), "failed verification must not populate the cache");
    assertEquals(2, cached.document(selected).concepts().size());
    assertEquals(3, reads.get());
  }

  @Test
  void aChangedResourcePathCannotReuseAnotherVerifiedPayload() {
    final AtomicInteger reads = new AtomicInteger();
    final OntologyPackModels cached = fixtureModels(FIXTURE, reads, 1024 * 1024);
    final var selected = fixtureSelection(FIXTURE, "1");
    cached.document(selected);
    final var missing =
        JsonUtils.deepCopy(selected.modules().getFirst(), OntologyPackModule.class)
            .withResourcePath("missing-cache-fixture.ttl");

    assertThrows(
        IllegalStateException.class,
        () ->
            cached.document(
                new OntologyPackContentLoader.Selection(
                    selected.manifest(), List.of(missing), selected.format())));
  }

  @Test
  void aSmallBudgetEvictsDocumentsEvenWhenTheirPayloadsAreTiny() {
    final AtomicInteger reads = new AtomicInteger();
    final OntologyPackModels cached = fixtureModels(FIXTURE, reads, CACHE_ENTRY_BYTES);
    final var first = fixtureSelection(FIXTURE, "1");
    final var next = fixtureSelection(FIXTURE, "2");

    assertTrue(
        JsonUtils.pojoToJson(cached.document(first)).getBytes(StandardCharsets.UTF_8).length
            < CACHE_ENTRY_BYTES);
    cached.document(next);
    assertEquals(2, reads.get(), "a new pack version needs its own document");
    cached.document(first);
    cached.document(next);

    assertTrue(reads.get() > 2, "the budget cannot retain both minimum-weight entries");
  }

  @Test
  void documentsLargerThanTheBudgetAreNotRetained() {
    final AtomicInteger reads = new AtomicInteger();
    final String large =
        FIXTURE
            + "<https://example.org/cache#Large> a <http://www.w3.org/2002/07/owl#Class>; <http://www.w3.org/2000/01/rdf-schema#label> \""
            + "x".repeat(2 * CACHE_ENTRY_BYTES)
            + "\" .";
    final OntologyPackModels cached = fixtureModels(large, reads, CACHE_ENTRY_BYTES);
    final var selected = fixtureSelection(large, "1");

    assertTrue(
        JsonUtils.pojoToJson(cached.document(selected)).getBytes(StandardCharsets.UTF_8).length
            > CACHE_ENTRY_BYTES);
    assertEquals(3, cached.document(selected).concepts().size());
    assertEquals(2, reads.get());
  }

  @Test
  void theMinimumEntryWeightAlsoBoundsASingleTinyDocument() {
    final AtomicInteger reads = new AtomicInteger();
    final OntologyPackModels cached = fixtureModels(FIXTURE, reads, CACHE_ENTRY_BYTES - 1);
    final var selected = fixtureSelection(FIXTURE, "1");

    assertEquals(cached.document(selected), cached.document(selected));
    assertEquals(2, reads.get());
  }

  private OntologyPackModels countingModels(final AtomicInteger reads, final long cacheBytes) {
    final ClassLoader resources =
        new ClassLoader(getClass().getClassLoader()) {
          @Override
          public InputStream getResourceAsStream(final String name) {
            reads.incrementAndGet();
            return super.getResourceAsStream(name);
          }
        };
    return new OntologyPackModels(new OntologyPackContentLoader(resources), cacheBytes);
  }

  private OntologyPackModels fixtureModels(
      final String body, final AtomicInteger reads, final long cacheBytes) {
    final ClassLoader resources =
        new ClassLoader(getClass().getClassLoader()) {
          @Override
          public InputStream getResourceAsStream(final String name) {
            if (FIXTURE_PATH.equals(name)) {
              reads.incrementAndGet();
              return new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8));
            }
            return super.getResourceAsStream(name);
          }
        };
    return new OntologyPackModels(new OntologyPackContentLoader(resources), cacheBytes);
  }

  private static OntologyPackContentLoader.Selection fixtureSelection(
      final String body, final String version) {
    final var module =
        new OntologyPackModule()
            .withId("fixture")
            .withResourcePath(FIXTURE_PATH)
            .withFormat(OntologyPackModule.Format.TURTLE)
            .withSha256(DigestUtils.sha256Hex(body.getBytes(StandardCharsets.UTF_8)));
    final var manifest =
        new OntologyPackManifest()
            .withId("fixture")
            .withVersion(version)
            .withModules(List.of(module))
            .withBundled(true);
    return new OntologyPackContentLoader.Selection(manifest, List.of(module), "turtle");
  }

  private List<OntologyChangeOperation> reconcilePerModule(final List<OntologyPackModule> modules) {
    final var model = models.load(modules);
    try {
      return new NativeOntologyRdfImporter()
          .reconcileUnbounded(model, emptySnapshot)
          .getOperations();
    } finally {
      model.close();
    }
  }

  private List<OntologyChangeOperation> reconcileJoined(
      final String packId, final List<String> moduleIds) {
    final var selected = catalog.loadSelected(packId, moduleIds);
    final var model =
        new SafeRdfModelParser()
            .parseTrusted(
                selected.body(),
                RdfSerializationFormat.parse(selected.format()),
                DigestUtils.sha256Hex(selected.body().getBytes(StandardCharsets.UTF_8)));
    try {
      return new NativeOntologyRdfImporter()
          .reconcileUnbounded(model, emptySnapshot)
          .getOperations();
    } finally {
      model.close();
    }
  }
}
