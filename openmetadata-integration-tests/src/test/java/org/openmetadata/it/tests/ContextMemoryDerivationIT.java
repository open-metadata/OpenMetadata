package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.DerivationEvidence;
import org.openmetadata.schema.entity.context.MemoryDerivation;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.AutomationProposal;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.GlossaryApprovalPayload;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.clients.llm.LlmConfigHolder;
import org.openmetadata.service.context.center.AiProvider;
import org.openmetadata.service.context.center.AiProviderHolder;
import org.openmetadata.service.context.center.DocumentMemoryExtractor;
import org.openmetadata.service.context.center.MemoryDerivations;
import org.openmetadata.service.context.center.MemoryGlossaryDerivationJobHandler;
import org.openmetadata.service.context.center.MemoryGlossaryDeriver;
import org.openmetadata.service.events.ChangeEventHandler;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jobs.GenericBackgroundWorker;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.llm.NoopCompletionClient;
import org.openmetadata.service.resources.context.ContextMemoryResource.MemoryDerivationList;
import org.openmetadata.service.resources.glossary.GlossaryTermMapper;

/**
 * Publication queues a real job and the worker's handler runs it; only the AI provider's deriver is
 * scripted, writing the term, its creation event and its evidence the way a provider must. The
 * event starts the glossary approval workflow, which opens the proposal's approval request.
 */
@Isolated("Replaces the embedded server's AI provider and pauses its background worker")
@ExtendWith(TestNamespaceExtension.class)
class ContextMemoryDerivationIT {
  private static final String FILES = "v1/contextCenter/drive/files";
  private static final String PAGES = "v1/contextCenter/pages";
  private static final String DERIVATIONS = "/v1/contextCenter/memories/derivations";
  private static final String AGENT = "Scripted Glossary Agent";
  private static final double CONFIDENCE = 0.91;
  private static final String REASON = "Defines a durable customer segment";
  private static final String ADMIN = "admin";

  private final List<List<UUID>> deriverCalls = new ArrayList<>();
  private GenericBackgroundWorker worker;
  private AiProvider previousProvider;
  private Glossary glossary;

  @BeforeEach
  void pauseWorkerAndInstallDeriver(TestNamespace ns) {
    worker = TestSuiteBootstrap.findManagedObject(GenericBackgroundWorker.class).orElseThrow();
    worker.stop();
    previousProvider = AiProviderHolder.get();
    glossary = glossary(ns);
    AiProviderHolder.setForTesting(provider(Optional.of(this::derive)));
    LLMClientHolder.setForTesting(new NoopCompletionClient());
  }

  @AfterEach
  void restoreProvider(TestNamespace ns) {
    try {
      NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
    } finally {
      AiProviderHolder.setForTesting(previousProvider);
      LLMClientHolder.initialize(LlmConfigHolder.get());
      if (worker != null) worker.start();
    }
  }

  @Test
  void fileAndArticleMemoriesBecomeProposalsUnderReviewThatKeepTheirEvidence(TestNamespace ns)
      throws Exception {
    ContextFile file = orgWideFile(ns);
    Page article = article(ns);
    ContextMemory published = publish(ns, "published", file, file.getEntityReference());
    ContextMemory anchoredElsewhere =
        publish(ns, "anchoredElsewhere", file, glossary.getEntityReference());
    ContextMemory fromArticle = publish(ns, "fromArticle", file, article.getEntityReference());

    BackgroundJob job = claimBatch(file);
    assertEquals(
        List.of(published.getId(), anchoredElsewhere.getId(), fromArticle.getId()),
        JsonUtils.convertValue(job.getJobArgs(), MemoryGlossaryDerivationJobHandler.Args.class)
            .memoryIds(),
        "the memories of one file share a single delayed job");
    new MemoryGlossaryDerivationJobHandler().runJob(job);

    assertEquals(
        List.of(List.of(published.getId(), fromArticle.getId())),
        deriverCalls,
        "a memory anchored to an asset reaches no deriver; an org-wide file or an article does");
    List<EntityReference> terms = completedTerms(job);
    assertEquals(2, terms.size());
    EntityReference term = terms.getFirst();
    assertProposalUnderReview(term);
    assertEquals(
        List.of(term.getId()),
        memories()
            .get(published.getId().toString(), "derivedEntities")
            .getDerivedEntities()
            .stream()
            .map(EntityReference::getId)
            .toList());
    assertEvidence(term, published);

    ContextMemory edited =
        editAnswer(published, "A qualified customer has completed eight paid orders.");
    assertEquals(ContextMemoryStatus.APPROVED, edited.getEntityStatus());
    assertEquals(
        0,
        Entity.getJobDAO().countInFlightMemoryGlossaryJobs(published.getId().toString()),
        "a memory that already defines a term queues no second derivation");
  }

  @Test
  void aProviderWithoutADeriverQueuesNothing(TestNamespace ns) throws Exception {
    AiProviderHolder.setForTesting(provider(Optional.empty()));
    ContextFile file = orgWideFile(ns);

    ContextMemory published = publish(ns, "undeferred", file, file.getEntityReference());

    JobDAO jobs = Entity.getJobDAO();
    assertEquals(0, jobs.countInFlightMemoryGlossaryJobs(published.getId().toString()));
    assertNull(jobs.lockOpenMemoryGlossaryBatch(batchKey(file), 100, 0));
    assertTrue(deriverCalls.isEmpty());
  }

  @Test
  void nothingIsQueuedWhileMemoryExtractionIsOff(TestNamespace ns) throws Exception {
    LLMClientHolder.setForTesting(null);
    ContextFile file = orgWideFile(ns);

    ContextMemory published = publish(ns, "extractionOff", file, file.getEntityReference());

    JobDAO jobs = Entity.getJobDAO();
    assertEquals(0, jobs.countInFlightMemoryGlossaryJobs(published.getId().toString()));
    assertNull(jobs.lockOpenMemoryGlossaryBatch(batchKey(file), 100, 0));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void editsDuringDerivationKeepOneFollowUpForTheLatestContent(boolean fromFile, TestNamespace ns)
      throws Exception {
    ContextFile file = fromFile ? orgWideFile(ns) : null;
    ContextMemory published =
        publish(ns, "editedDuringDerivation", file, fromFile ? file.getEntityReference() : null);
    BackgroundJob running = claimMemoryJob(published);
    String latestAnswer = "A qualified customer has completed nine paid orders.";
    AiProviderHolder.setForTesting(
        provider(
            Optional.of(
                snapshots -> {
                  assertEquals(published.getAnswer(), snapshots.getFirst().getAnswer());
                  editAnswer(published, "A qualified customer has completed eight paid orders.");
                  BackgroundJob followUp = pendingMemoryJob(published);
                  editAnswer(published, latestAnswer);
                  assertEquals(followUp.getId(), pendingMemoryJob(published).getId());
                  assertEquals(
                      2,
                      Entity.getJobDAO()
                          .countInFlightMemoryGlossaryJobs(published.getId().toString()));
                  return List.of();
                })));

    new MemoryGlossaryDerivationJobHandler().runJob(running);
    assertTrue(completedTerms(running).isEmpty(), "the stale proposal is discarded");
    AiProviderHolder.setForTesting(provider(Optional.of(this::derive)));
    BackgroundJob followUp = claimMemoryJob(published);
    new MemoryGlossaryDerivationJobHandler().runJob(followUp);

    List<EntityReference> terms = completedTerms(followUp);
    assertEquals(1, terms.size());
    assertProposalUnderReview(terms.getFirst());
    assertEquals(
        latestAnswer,
        SdkClients.adminClient().glossaryTerms().get(terms.getFirst().getId()).getDescription());
    assertEquals(
        List.of(terms.getFirst().getId()),
        memories()
            .get(published.getId().toString(), "derivedEntities")
            .getDerivedEntities()
            .stream()
            .map(EntityReference::getId)
            .toList());
    assertEquals(
        0, Entity.getJobDAO().countInFlightMemoryGlossaryJobs(published.getId().toString()));
  }

  private BackgroundJob claimMemoryJob(ContextMemory memory) {
    BackgroundJob pending = pendingMemoryJob(memory);
    assertEquals(1, Entity.getJobDAO().claimPendingJob(pending.getId()));
    return Entity.getJobDAO().fetchJobById(pending.getId()).orElseThrow();
  }

  private BackgroundJob pendingMemoryJob(ContextMemory memory) {
    List<BackgroundJob> pending =
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery(
                            "SELECT id FROM background_jobs WHERE jobType = :jobType AND status = :status")
                        .bind("jobType", BackgroundJob.JobType.MEMORY_GLOSSARY_DERIVATION.name())
                        .bind("status", BackgroundJob.Status.PENDING.name())
                        .mapTo(Long.class)
                        .list())
            .stream()
            .map(id -> Entity.getJobDAO().fetchJobById(id).orElseThrow())
            .filter(
                job ->
                    JsonUtils.convertValue(
                            job.getJobArgs(), MemoryGlossaryDerivationJobHandler.Args.class)
                        .memoryIds()
                        .contains(memory.getId()))
            .toList();
    assertEquals(1, pending.size(), "the memory must have exactly one pending derivation");
    return pending.getFirst();
  }

  private AiProvider provider(Optional<MemoryGlossaryDeriver> deriver) {
    DocumentMemoryExtractor extractor = previousProvider.documentExtractor();
    return new AiProvider() {
      @Override
      public DocumentMemoryExtractor documentExtractor() {
        return extractor;
      }

      @Override
      public Optional<MemoryGlossaryDeriver> memoryGlossaryDeriver() {
        return deriver;
      }
    };
  }

  // A provider writes its term as a bot with the automation provider, records its creation event
  // and links it through MemoryDerivations, which is the whole contract OpenMetadata asks of it.
  private List<EntityReference> derive(List<ContextMemory> memories) {
    deriverCalls.add(memories.stream().map(ContextMemory::getId).toList());
    return memories.stream().map(this::writeTerm).toList();
  }

  private EntityReference writeTerm(ContextMemory memory) {
    GlossaryTermRepository terms =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withGlossary(glossary.getFullyQualifiedName())
            .withName("qualified_" + memory.getId())
            .withDescription(memory.getAnswer())
            .withProvider(ProviderType.AUTOMATION);
    GlossaryTerm term =
        terms.create(
            null, new GlossaryTermMapper().createToEntity(create, Entity.INGESTION_BOT_NAME));
    new MemoryDerivations()
        .record(
            memory.getId(),
            term.getEntityReference(),
            new DerivationEvidence()
                .withAgent(AGENT)
                .withConfidence(CONFIDENCE)
                .withReasons(List.of(REASON))
                .withDerivedAt(System.currentTimeMillis()));
    // Linked before its creation event, so the request the workflow opens can name the agent.
    recordCreation(term);
    return term.getEntityReference();
  }

  private Glossary glossary(TestNamespace ns) {
    return ns.trackRoot(
        Entity.GLOSSARY,
        SdkClients.adminClient()
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(ns.prefix("derived"))
                    .withDescription("Terms derived from published memories")));
  }

  private ContextFile orgWideFile(TestNamespace ns) throws Exception {
    return ns.trackRoot(
        Entity.CONTEXT_FILE,
        RestClient.admin()
            .create(
                FILES, new CreateContextFile().withName(ns.prefix("source")), ContextFile.class));
  }

  private ContextMemory publish(
      TestNamespace ns, String name, ContextFile source, EntityReference anchor) {
    CreateContextMemory request =
        new CreateContextMemory()
            .withName(ns.prefix(name))
            .withTitle("Qualified customer in " + name)
            .withQuestion("What is a qualified customer in " + name + "?")
            .withAnswer("A qualified customer in " + name + " has completed seven paid orders.")
            .withEntityStatus(ContextMemoryStatus.APPROVED)
            .withPrimaryEntity(anchor)
            .withShareConfig(
                new MemoryShareConfig()
                    .withVisibility(
                        source == null ? MemoryVisibility.PUBLIC : MemoryVisibility.ENTITY));
    if (source != null) {
      request
          .withSourceType(ContextMemorySourceType.FILE_EXTRACTION)
          .withSourceEntity(source.getEntityReference());
    }
    return ns.trackRoot(Entity.CONTEXT_MEMORY, memories().create(request));
  }

  private BackgroundJob claimBatch(ContextFile file) {
    JobDAO jobs = Entity.getJobDAO();
    Long queued = jobs.lockOpenMemoryGlossaryBatch(batchKey(file), 100, 0);
    assertNotNull(queued, "publication must enqueue derivation through the repository lifecycle");
    assertEquals(1, jobs.claimPendingJob(queued));
    return jobs.fetchJobById(queued).orElseThrow();
  }

  private static String batchKey(ContextFile file) {
    return Entity.CONTEXT_FILE + ":" + file.getId();
  }

  private List<EntityReference> completedTerms(BackgroundJob job) {
    BackgroundJob finished = Entity.getJobDAO().fetchJobById(job.getId()).orElseThrow();
    assertEquals(BackgroundJob.Status.COMPLETED, finished.getStatus());
    return JsonUtils.readValue(
            finished.getResult(), MemoryGlossaryDerivationJobHandler.Result.class)
        .terms();
  }

  private Page article(TestNamespace ns) throws Exception {
    return ns.trackRoot(
        Entity.PAGE,
        RestClient.admin()
            .create(
                PAGES,
                new CreatePage()
                    .withName(ns.prefix("article"))
                    .withPageType(PageType.ARTICLE)
                    .withPage(new Article()),
                Page.class));
  }

  // Outside a request no change event is recorded, and the event is what starts the approval
  // workflow, so the provider records it with the term.
  private static void recordCreation(GlossaryTerm term) {
    ChangeEvent created =
        ChangeEventHandler.entityChangeEvent(
            Entity.INGESTION_BOT_NAME, EventType.ENTITY_CREATED, term);
    Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(created));
  }

  // The test glossary has no reviewers or owners, so the proposal's request goes to the admins.
  private void assertProposalUnderReview(EntityReference reference) {
    Task request = awaitOpenApprovalTask(reference);
    GlossaryTerm term = SdkClients.adminClient().glossaryTerms().get(reference.getId().toString());
    assertEquals(EntityStatus.IN_REVIEW, term.getEntityStatus());
    assertEquals(ProviderType.AUTOMATION, term.getProvider());
    assertEquals(Entity.INGESTION_BOT_NAME, term.getUpdatedBy());
    assertTrue(
        request.getAssignees().stream().anyMatch(assignee -> ADMIN.equals(assignee.getName())),
        "assignees: " + request.getAssignees());
    assertNamesTheProposal(request);
  }

  // Every user reads tasks, so the request names the agent and its memory by id, never its reasons.
  private static void assertNamesTheProposal(Task request) {
    GlossaryApprovalPayload payload =
        JsonUtils.convertValue(request.getPayload(), GlossaryApprovalPayload.class);
    AutomationProposal proposal = payload.getProposal();
    assertEquals(ProviderType.AUTOMATION, proposal.getProvider());
    assertEquals(AGENT, proposal.getAgent());
    assertEquals(CONFIDENCE, proposal.getConfidence());
    assertEquals(1, proposal.getDerivedFrom().size());
    EntityReference memory = proposal.getDerivedFrom().getFirst();
    assertEquals(Entity.CONTEXT_MEMORY, memory.getType());
    assertNull(memory.getName());
    assertFalse(JsonUtils.pojoToJson(request.getPayload()).contains(REASON));
  }

  private static Task awaitOpenApprovalTask(EntityReference term) {
    Map<String, String> filters =
        Map.of(
            "limit",
            "10",
            "status",
            TaskEntityStatus.Open.value(),
            "aboutEntityIds",
            term.getId().toString(),
            "fields",
            "assignees,payload");
    return Awaitility.await("an approval request for " + term.getId())
        .atMost(Duration.ofMinutes(3))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> SdkClients.adminClient().tasks().listWithFilters(filters).getData(),
            tasks -> !tasks.isEmpty())
        .getFirst();
  }

  private void assertEvidence(EntityReference term, ContextMemory memory) {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityType", Entity.GLOSSARY_TERM)
            .queryParam("entityIds", term.getId().toString())
            .build();
    List<MemoryDerivation> derivations =
        JsonUtils.readValue(
                SdkClients.adminClient()
                    .getHttpClient()
                    .executeForString(HttpMethod.GET, DERIVATIONS, null, options),
                MemoryDerivationList.class)
            .getData();
    assertEquals(1, derivations.size());
    MemoryDerivation derivation = derivations.getFirst();
    assertEquals(memory.getId(), derivation.getMemory().getId());
    assertEquals(AGENT, derivation.getEvidence().getAgent());
    assertEquals(CONFIDENCE, derivation.getEvidence().getConfidence());
    assertEquals(List.of(REASON), derivation.getEvidence().getReasons());
  }

  private ContextMemory editAnswer(ContextMemory memory, String answer) {
    String patch = "[{\"op\":\"replace\",\"path\":\"/answer\",\"value\":\"" + answer + "\"}]";
    return memories().patch(memory.getId(), JsonUtils.readTree(patch));
  }

  private ContextMemoryService memories() {
    return new ContextMemoryService(SdkClients.adminClient().getHttpClient());
  }
}
