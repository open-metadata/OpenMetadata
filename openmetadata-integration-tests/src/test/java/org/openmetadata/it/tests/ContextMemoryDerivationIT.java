package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.api.data.ApplyOntologyChangeSet;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyEditLeaseToken;
import org.openmetadata.schema.type.OntologyEditLock;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.clients.llm.LlmConfigHolder;
import org.openmetadata.service.jobs.GenericBackgroundWorker;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.llm.CompletionOptions;
import org.openmetadata.service.llm.CompletionResult;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.llm.LLMCompletionClient;
import org.openmetadata.service.ontology.OntologyMemoryDerivationJobHandler;

/** Publication queues a real job; only model completion is scripted before Studio apply over REST. */
@Isolated("Replaces the embedded server's completion provider")
@ExtendWith(TestNamespaceExtension.class)
class ContextMemoryDerivationIT {
  private GenericBackgroundWorker worker;
  private RdfConfiguration rdf;
  private Boolean previousAiEnabled;

  @BeforeEach
  void pauseWorkerAndEnableDerivation() {
    worker = TestSuiteBootstrap.findManagedObject(GenericBackgroundWorker.class).orElseThrow();
    worker.stop();
    rdf = OpenMetadataApplicationConfigHolder.getInstance().getRdfConfiguration();
    previousAiEnabled = rdf.getAiEnabled();
    rdf.setAiEnabled(true);
  }

  @AfterEach
  void restoreProviders(TestNamespace ns) {
    try {
      NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
    } finally {
      if (rdf != null) rdf.setAiEnabled(previousAiEnabled);
      LLMClientHolder.initialize(LlmConfigHolder.get());
      if (worker != null) worker.start();
    }
  }

  @Test
  void aPublishedMemoryProducesOneDurableProposalAndApplyingItKeepsItsEvidence(TestNamespace ns)
      throws Exception {
    Fixture fixture = fixture(ns);
    awaitGlossaryIndexed(fixture);
    LLMClientHolder.setForTesting(completions(fixture));
    ContextMemory memory = publish(ns, fixture);
    fixture.memoryId().set(memory.getId());
    BackgroundJob job = claimDerivation(memory, fixture.source());
    OntologyChangeSet draft = derive(ns, job, memory);
    assertRedeliveryReusesProposal(job, fixture.calls(), draft.getId());
    OntologyChangeSet applied = apply(draft);
    assertEvidenceSurvives(fixture, applied, memory);
    assertCleanupRemovesRoots(ns, fixture, memory, applied);
  }

  private Fixture fixture(TestNamespace ns) throws Exception {
    String termName = "qualified_" + ns.shortPrefix();
    seedOtherGlossaries(ns);
    Page source =
        ns.trackRoot(
            Entity.PAGE,
            RestClient.admin()
                .create(
                    "v1/contextCenter/pages",
                    new CreatePage()
                        .withName(ns.prefix("source"))
                        .withPageType(PageType.ARTICLE)
                        .withPage(new Article()),
                    Page.class));
    return new Fixture(
        glossary(ns, termName), source, termName, new AtomicReference<>(), new AtomicInteger());
  }

  private void seedOtherGlossaries(TestNamespace ns) {
    for (int i = 0; i < 60; i++) {
      GlossaryTestFactory.createWithName(ns, "a_prior_" + i);
    }
  }

  private Glossary glossary(TestNamespace ns, String termName) {
    // Keep this namespace-owned fixture in the selector's bounded fallback list.
    return ns.trackRoot(
        Entity.GLOSSARY,
        SdkClients.adminClient()
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName("0_memory_" + ns.shortPrefix())
                    .withDescription(
                        termName + ": a qualified customer has completed seven paid orders.")));
  }

  private void awaitGlossaryIndexed(Fixture fixture) {
    var search = Entity.getSearchRepository();
    var request =
        new SearchRequest()
            .withIndex(search.getIndexOrAliasName("glossary_search_index"))
            .withQuery(fixture.termName())
            .withSize(40);
    await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              var response = search.search(request, null);
              var ids =
                  JsonUtils.readTree((String) response.getEntity())
                      .path("hits")
                      .path("hits")
                      .findValuesAsText("id");
              assertTrue(ids.contains(fixture.glossary().getId().toString()));
            });
  }

  private ContextMemory publish(TestNamespace ns, Fixture fixture) {
    CreateContextMemory request =
        new CreateContextMemory()
            .withName(ns.prefix("published"))
            .withQuestion("What is " + fixture.termName() + "?")
            .withAnswer("A qualified customer has completed seven paid orders.")
            .withEntityStatus(ContextMemoryStatus.APPROVED)
            .withSourceType(ContextMemorySourceType.PAGE_EXTRACTION)
            .withSourceEntity(fixture.source().getEntityReference())
            .withPrimaryEntity(fixture.source().getEntityReference())
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
    return ns.trackRoot(Entity.CONTEXT_MEMORY, memories().create(request));
  }

  private BackgroundJob claimDerivation(ContextMemory memory, Page source) {
    JobDAO jobs = Entity.getJobDAO();
    Long queued = jobs.lockOpenOntologyMemoryBatch(Entity.PAGE + ":" + source.getId(), 100, 0);
    assertNotNull(queued, "publication must enqueue derivation through the repository lifecycle");
    assertEquals(1, jobs.claimPendingJob(queued));
    BackgroundJob job = jobs.fetchJobById(queued).orElseThrow();
    var args =
        JsonUtils.convertValue(job.getJobArgs(), OntologyMemoryDerivationJobHandler.Args.class);
    assertEquals(List.of(memory.getId()), args.memoryIds());
    return job;
  }

  private OntologyChangeSet derive(TestNamespace ns, BackgroundJob job, ContextMemory memory) {
    OntologyMemoryDerivationJobHandler.createDefault().runJob(job);
    BackgroundJob finished = Entity.getJobDAO().fetchJobById(job.getId()).orElseThrow();
    assertEquals(BackgroundJob.Status.COMPLETED, finished.getStatus());
    UUID id =
        JsonUtils.readValue(finished.getResult(), OntologyMemoryDerivationJobHandler.Result.class)
            .changeSetId();
    assertNotNull(id);
    OntologyChangeSet draft =
        ns.trackRoot(
            Entity.ONTOLOGY_CHANGE_SET,
            SdkClients.adminClient().ontologyChangeSets().get(id.toString()));
    assertEquals(OntologyChangeSetState.DRAFT, draft.getState());
    assertEquals(Set.of(memory.getId()), draft.getOperations().getFirst().getSourceMemoryIds());
    return draft;
  }

  private void assertRedeliveryReusesProposal(
      BackgroundJob job, AtomicInteger calls, UUID proposalId) {
    int callsAfterProposal = calls.get();
    OntologyMemoryDerivationJobHandler.createDefault().runJob(job);
    assertEquals(
        callsAfterProposal, calls.get(), "redelivery reuses the persisted draft for the job");
    BackgroundJob redelivered = Entity.getJobDAO().fetchJobById(job.getId()).orElseThrow();
    assertEquals(BackgroundJob.Status.COMPLETED, redelivered.getStatus());
    assertEquals(
        proposalId,
        JsonUtils.readValue(
                redelivered.getResult(), OntologyMemoryDerivationJobHandler.Result.class)
            .changeSetId());
  }

  private OntologyChangeSet apply(OntologyChangeSet draft) {
    OntologyEditLock lock =
        SdkClients.adminClient()
            .ontologyEditLocks()
            .acquire(
                new AcquireOntologyEditLock()
                    .withResourceType(Entity.ONTOLOGY_CHANGE_SET)
                    .withResourceId(draft.getId())
                    .withSessionId("memory-" + UUID.randomUUID())
                    .withLeaseSeconds(60));
    return SdkClients.adminClient()
        .ontologyChangeSets()
        .apply(
            draft.getId(),
            new ApplyOntologyChangeSet()
                .withLease(
                    new OntologyEditLeaseToken()
                        .withSessionId(lock.getSessionId())
                        .withVersion(lock.getVersion())));
  }

  private void assertEvidenceSurvives(
      Fixture fixture, OntologyChangeSet applied, ContextMemory memory) {
    var client = SdkClients.adminClient();
    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertNotNull(
        client
            .glossaryTerms()
            .getByName(fixture.glossary().getFullyQualifiedName() + "." + fixture.termName())
            .getId());
    assertEquals(
        Set.of(memory.getId()),
        client
            .ontologyChangeSets()
            .get(applied.getId().toString())
            .getOperations()
            .getFirst()
            .getSourceMemoryIds());
    ContextMemory linked = memories().get(memory.getId().toString(), "derivedEntities");
    assertTrue(linked.getDerivedEntities() == null || linked.getDerivedEntities().isEmpty());
  }

  private ContextMemoryService memories() {
    return new ContextMemoryService(SdkClients.adminClient().getHttpClient());
  }

  private void assertCleanupRemovesRoots(
      TestNamespace ns, Fixture fixture, ContextMemory memory, OntologyChangeSet applied) {
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
    assertGone("contextCenter/pages/" + fixture.source().getId());
    assertGone("contextCenter/memories/" + memory.getId());
    assertGone("ontologyChangeSets/" + applied.getId());
  }

  private void assertGone(String path) {
    OpenMetadataException failure =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.adminClient()
                    .getHttpClient()
                    .execute(HttpMethod.GET, "/v1/" + path + "?include=all", null, Object.class));
    assertEquals(404, failure.getStatusCode());
  }

  private LLMCompletionClient completions(Fixture fixture) {
    return new LLMCompletionClient(1) {
      @Override
      protected CompletionResult doComplete(
          String systemPrompt, String userPrompt, CompletionOptions options) {
        fixture.calls().incrementAndGet();
        String reply =
            systemPrompt.contains("glossaryId")
                ? glossaryChoice(fixture, userPrompt)
                : termChoice(fixture);
        return new CompletionResult(reply, 100, 30);
      }

      @Override
      public String getModelId() {
        return "scripted-memory-derivation";
      }
    };
  }

  private String glossaryChoice(Fixture fixture, String userPrompt) {
    assertTrue(
        userPrompt.contains(fixture.glossary().getId().toString()),
        "The scripted selection must choose a glossary the model actually received");
    return """
        [{"glossaryId":"%s","newGlossaryName":"fallback","newGlossaryDisplayName":"Fallback",
          "newGlossaryDescription":"Customer definitions","confidence":0.99,
          "rationale":"The supplied glossary governs these concepts"}]
        """
        .formatted(fixture.glossary().getId());
  }

  private String termChoice(Fixture fixture) {
    return """
        [{"sourceMemoryId":"%s","name":"%s","displayName":"Qualified customer",
          "description":"A customer with seven completed paid orders","confidence":0.99,
          "rationale":"The supplied memory defines a distinct business concept"}]
        """
        .formatted(fixture.memoryId().get(), fixture.termName());
  }

  private record Fixture(
      Glossary glossary,
      Page source,
      String termName,
      AtomicReference<UUID> memoryId,
      AtomicInteger calls) {}
}
