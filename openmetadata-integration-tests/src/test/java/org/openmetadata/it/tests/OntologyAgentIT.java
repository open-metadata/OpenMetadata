/*
 *  Copyright 2025 Collate
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

package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.configuration.AIDeletionPolicy;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.sdk.services.glossary.GlossaryService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.drive.ontology.OntologyAction;
import org.openmetadata.service.drive.ontology.OntologyDerivation;
import org.openmetadata.service.drive.ontology.OntologyReconciler;
import org.openmetadata.service.drive.ontology.OntologyVerdict;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.util.OntologyOwnership;

/**
 * Integration tests for the Ontology Agent lifecycle.
 *
 * <p>These tests are FULLY DETERMINISTIC: no LLM provider is needed. Rather than triggering the
 * actual agent derivation pipeline (which requires an LLM), we seed the derived state directly via
 * the in-process repository ({@code Entity.getEntityRepository}) — exactly replicating what the
 * reconciler's CREATE path produces — and then drive the rest of the lifecycle through the PUBLIC
 * REST API so the real cascade and adopt-on-touch hooks fire.
 *
 * <p><b>Scenario A</b> — CASCADE on hard delete: hard-delete a memory whose term is AUTOMATION-owned
 * → the term must disappear (404).
 *
 * <p><b>Scenario B</b> — Adopt-on-touch releases the term, survives delete: a human PATCH to the
 * term's description must flip {@code provider} to {@code user}; hard-delete the memory → the term
 * must survive.
 *
 * <p><b>Scenario C</b> — derivedFrom / derivedEntities projections: the 11a fields must expose the
 * edge in both directions.
 *
 * <p><b>Scenario D</b> — full pipeline with a stub LLM: SKIPPED because the
 * {@link org.openmetadata.service.drive.ontology.OntologyProcessingEngine} singleton is built once
 * with the server's quiet-period (default 5 min) and {@link
 * org.openmetadata.service.llm.LLMClientHolder} uses a static field. Resetting the singleton in an
 * integration environment that is already serving requests races with the production path: any memory
 * created concurrently by another test or background job could be ingested by the stub, producing
 * non-deterministic side-effects. Scenarios A, B, C cover the catalog-critical lifecycle end-to-end
 * through the public API hooks; the unit tests in ContextMemoryReconcilerTest and OntologyExtractorTest
 * cover the LLM derivation path with full determinism.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyAgentIT {

  // ═══════════════════════════════════════════════════════════════════
  // Scenario A — CASCADE hard delete removes the automation-owned term
  // ═══════════════════════════════════════════════════════════════════

  @Test
  void scenarioA_cascadeHardDelete_removesAutomationOwnedTerm(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    ContextMemory memory = createMemory(client, ns.prefix("mem-cascade"));
    Glossary glossary = createGlossary(client, ns.prefix("gl-cascade"));
    GlossaryTerm term = createAutomationTerm(ns.prefix("term-cascade"), glossary);
    seedDerivedFromEdge(term.getId(), memory.getId());

    hardDeleteMemory(client, memory.getId());

    await()
        .pollInterval(Duration.ofMillis(300))
        .atMost(Duration.ofSeconds(20))
        .untilAsserted(
            () -> {
              boolean gone = isGone(client, term.getId());
              assertTrue(
                  gone,
                  "Automation-owned term must be deleted (cascade) when memory is hard-deleted");
            });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Scenario B — Adopt-on-touch: human PATCH → provider=user → survives delete
  // ═══════════════════════════════════════════════════════════════════

  @Test
  void scenarioB_adoptOnTouch_termSurvivesMemoryDelete(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    ContextMemory memory = createMemory(client, ns.prefix("mem-adopt"));
    Glossary glossary = createGlossary(client, ns.prefix("gl-adopt"));
    GlossaryTerm term = createAutomationTerm(ns.prefix("term-adopt"), glossary);
    seedDerivedFromEdge(term.getId(), memory.getId());

    GlossaryTerm fetched = client.glossaryTerms().get(term.getId().toString());
    GlossaryTerm toUpdate = JsonUtils.deepCopy(fetched, GlossaryTerm.class);
    toUpdate.setDescription("Human-edited description triggering adoption");
    client.glossaryTerms().update(term.getId().toString(), toUpdate);

    GlossaryTerm afterPatch = client.glossaryTerms().get(term.getId().toString());
    assertEquals(
        ProviderType.USER,
        afterPatch.getProvider(),
        "provider must flip to USER after a human PATCH on an automation-owned term");

    hardDeleteMemory(client, memory.getId());

    await()
        .pollInterval(Duration.ofMillis(300))
        .atMost(Duration.ofSeconds(20))
        .untilAsserted(
            () -> {
              boolean alive = isAlive(client, term.getId());
              assertTrue(
                  alive, "Human-adopted term must survive when its source memory is deleted");
            });

    GlossaryService glossaryService = new GlossaryService(client.getHttpClient());
    client.glossaryTerms().delete(term.getId().toString(), hardDeleteParams());
    glossaryService.delete(glossary.getId().toString(), hardDeleteParams());
  }

  // ═══════════════════════════════════════════════════════════════════
  // Scenario C — derivedFrom / derivedEntities projections expose the edge
  // ═══════════════════════════════════════════════════════════════════

  @Test
  void scenarioC_projections_exposeDerivedEdgeInBothDirections(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    ContextMemory memory = createMemory(client, ns.prefix("mem-proj"));
    Glossary glossary = createGlossary(client, ns.prefix("gl-proj"));
    GlossaryTerm term = createAutomationTerm(ns.prefix("term-proj"), glossary);
    seedDerivedFromEdge(term.getId(), memory.getId());

    GlossaryTerm termWithDerivedFrom =
        client.glossaryTerms().get(term.getId().toString(), "derivedFrom");
    assertNotNull(
        termWithDerivedFrom.getDerivedFrom(), "derivedFrom must be populated on the term");
    assertEquals(
        memory.getId(),
        termWithDerivedFrom.getDerivedFrom().getId(),
        "derivedFrom must point to the seeded source memory");

    ContextMemoryService memoryService = new ContextMemoryService(client.getHttpClient());
    ContextMemory memoryWithDerived =
        memoryService.get(memory.getId().toString(), "derivedEntities");
    assertNotNull(
        memoryWithDerived.getDerivedEntities(), "derivedEntities must be populated on the memory");
    boolean termPresent =
        memoryWithDerived.getDerivedEntities().stream()
            .anyMatch(ref -> ref.getId().equals(term.getId()));
    assertTrue(termPresent, "derivedEntities must include the seeded term reference");

    GlossaryService glossaryService = new GlossaryService(client.getHttpClient());
    hardDeleteMemory(client, memory.getId());
    glossaryService.delete(glossary.getId().toString(), hardDeleteParams());
  }

  // ═══════════════════════════════════════════════════════════════════
  // Scenario E — axis-toggle: deriveMetrics=false skips metric CREATE,
  //              leaves pre-existing owned metric untouched (no mass-retire)
  //
  // Fully deterministic: passes the axis flags directly to reconcile(),
  // bypassing the settings cache to avoid race conditions in concurrent runs.
  //
  // Setup:  one AUTOMATION-owned metric seeded with a DERIVED_FROM edge.
  // Action: reconcile with deriveMetrics=false and CREATE verdict for metric.
  // Assert: metric axis gated → 0 new metrics created, 0 retired, owned metric alive.
  // ═══════════════════════════════════════════════════════════════════

  @Test
  void scenarioE_deriveMetricsDisabled_skipsMetricAndPreservesExistingOwnedMetric(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    ContextMemory memory = createMemory(client, ns.prefix("mem-toggle"));
    Metric existingOwnedMetric = createAutomationMetric(ns.prefix("owned-metric"));
    seedDerivedFromMetricEdge(existingOwnedMetric.getId(), memory.getId());

    OntologyReconciler reconciler = buildReconciler();
    OntologyVerdict createMetricVerdict =
        new OntologyVerdict(
            OntologyAction.CREATE,
            null,
            null,
            null,
            ns.prefix("new-m"),
            "NewM",
            "desc",
            "COUNT",
            null,
            null);
    OntologyVerdict skipTermVerdict =
        new OntologyVerdict(
            OntologyAction.SKIP, null, null, null, null, null, null, null, null, null);
    OntologyReconciler.ReconcileResult result =
        reconciler.reconcile(
            memory,
            new OntologyDerivation(skipTermVerdict, createMetricVerdict),
            null,
            AIDeletionPolicy.CASCADE,
            true,
            false);

    assertEquals(0, result.createdMetrics(), "metric axis disabled: no metrics must be created");
    assertEquals(0, result.retired(), "disabled axis must NOT retire pre-existing owned metric");
    boolean metricStillAlive = isMetricAlive(existingOwnedMetric.getId());
    assertTrue(
        metricStillAlive, "pre-existing owned metric must survive when metric axis is disabled");

    MetricRepository metricRepo = (MetricRepository) Entity.getEntityRepository(Entity.METRIC);
    metricRepo.delete(
        OntologyOwnership.ONTOLOGY_BOT_NAME, existingOwnedMetric.getId(), false, true);
    hardDeleteMemory(client, memory.getId());
  }

  // ═══════════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════════

  private ContextMemory createMemory(OpenMetadataClient client, String name) {
    ContextMemoryService svc = new ContextMemoryService(client.getHttpClient());
    CreateContextMemory req =
        new CreateContextMemory()
            .withName(name)
            .withQuestion("What is " + name + "?")
            .withAnswer("Answer for " + name + ".");
    return svc.create(req);
  }

  private Glossary createGlossary(OpenMetadataClient client, String name) {
    GlossaryService svc = new GlossaryService(client.getHttpClient());
    CreateGlossary req = new CreateGlossary().withName(name).withDescription("Test glossary");
    return svc.create(req);
  }

  /**
   * Creates a GlossaryTerm with {@code provider=AUTOMATION} via the in-process repository,
   * exactly replicating the path {@code OntologyReconciler.createTerm} takes. The public REST
   * {@code CreateGlossaryTerm} API does not expose {@code provider}, so we bypass it and call
   * {@code createInternal} directly — the same call the reconciler uses — so the stored JSON
   * carries {@code "provider":"automation"} and the cascade / adopt-on-touch hooks see the correct
   * value when they read back from the DB.
   */
  private GlossaryTerm createAutomationTerm(String name, Glossary glossary) {
    GlossaryTermRepository termRepo =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    GlossaryTerm term =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName(name)
            .withDescription("Automation-derived term for " + name)
            .withGlossary(glossary.getEntityReference())
            .withProvider(ProviderType.AUTOMATION)
            .withUpdatedBy(OntologyOwnership.ONTOLOGY_BOT_NAME)
            .withUpdatedAt(System.currentTimeMillis());
    return termRepo.createInternal(term);
  }

  private Metric createAutomationMetric(String name) {
    MetricRepository metricRepo = (MetricRepository) Entity.getEntityRepository(Entity.METRIC);
    Metric metric =
        new Metric()
            .withId(UUID.randomUUID())
            .withName(name)
            .withDescription("Automation-derived metric for " + name)
            .withProvider(ProviderType.AUTOMATION)
            .withUpdatedBy(OntologyOwnership.ONTOLOGY_BOT_NAME)
            .withUpdatedAt(System.currentTimeMillis());
    return metricRepo.createInternal(metric);
  }

  /**
   * Seeds the {@code DERIVED_FROM} edge that the Ontology Agent's CREATE path produces:
   * {@code from=term → to=memory} via {@link Relationship#DERIVED_FROM}.
   *
   * <p>This uses the in-process repository directly (the same call as
   * {@code OntologyReconciler.addDerivedFromEdge}) so the edge is queryable through the real
   * relationship table, and all subsequent REST calls (GET, DELETE) exercise the real hooks.
   */
  private void seedDerivedFromEdge(UUID termId, UUID memoryId) {
    GlossaryTermRepository termRepo =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    termRepo.addRelationship(
        termId,
        memoryId,
        Entity.GLOSSARY_TERM,
        Entity.CONTEXT_MEMORY,
        Relationship.DERIVED_FROM,
        false);
  }

  private void seedDerivedFromMetricEdge(UUID metricId, UUID memoryId) {
    MetricRepository metricRepo = (MetricRepository) Entity.getEntityRepository(Entity.METRIC);
    metricRepo.addRelationship(
        metricId, memoryId, Entity.METRIC, Entity.CONTEXT_MEMORY, Relationship.DERIVED_FROM, false);
  }

  private void hardDeleteMemory(OpenMetadataClient client, UUID memoryId) {
    ContextMemoryService svc = new ContextMemoryService(client.getHttpClient());
    svc.delete(memoryId.toString(), hardDeleteParams());
  }

  private Map<String, String> hardDeleteParams() {
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    return params;
  }

  private boolean isGone(OpenMetadataClient client, UUID termId) {
    try {
      GlossaryTermRepository termRepo =
          (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
      GlossaryTerm term = termRepo.find(termId, Include.ALL);
      return term == null || term.getDeleted() != null && term.getDeleted();
    } catch (Exception e) {
      return true;
    }
  }

  private boolean isAlive(OpenMetadataClient client, UUID termId) {
    try {
      GlossaryTermRepository termRepo =
          (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
      GlossaryTerm term = termRepo.find(termId, Include.NON_DELETED);
      return term != null && (term.getDeleted() == null || !term.getDeleted());
    } catch (Exception e) {
      return false;
    }
  }

  private boolean isMetricAlive(UUID metricId) {
    try {
      MetricRepository metricRepo = (MetricRepository) Entity.getEntityRepository(Entity.METRIC);
      Metric metric = metricRepo.find(metricId, Include.NON_DELETED);
      return metric != null && (metric.getDeleted() == null || !metric.getDeleted());
    } catch (Exception e) {
      return false;
    }
  }

  private OntologyReconciler buildReconciler() {
    GlossaryTermRepository termRepo =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    MetricRepository metricRepo = (MetricRepository) Entity.getEntityRepository(Entity.METRIC);
    GlossaryRepository glossaryRepo =
        (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
    return new OntologyReconciler(termRepo, metricRepo, glossaryRepo);
  }
}
