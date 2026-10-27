package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.apache.commons.codec.digest.DigestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageProcessingStatus;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.clients.llm.LlmConfigHolder;
import org.openmetadata.service.context.center.AiProvider;
import org.openmetadata.service.context.center.AiProviderHolder;
import org.openmetadata.service.context.center.ContextMemoryExtractionJobHandler;
import org.openmetadata.service.context.center.ContextMemoryReconciler;
import org.openmetadata.service.context.center.DocumentMemoryExtractor;
import org.openmetadata.service.context.center.PageContextProcessingEngine;
import org.openmetadata.service.context.center.PageContextProcessingEngineHolder;
import org.openmetadata.service.context.center.SemanticMemoryDuplicateFinder;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.jobs.GenericBackgroundWorker;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.llm.CompletionOptions;
import org.openmetadata.service.llm.CompletionResult;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.llm.LLMCompletionClient;
import org.openmetadata.service.llm.LLMCompletionException;
import org.openmetadata.service.llm.NoopCompletionClient;

/** Persistent sources and queue rows, scripting only the document-provider boundary. */
@Isolated("Installs the document provider and page worker for the embedded server")
@ExtendWith(TestNamespaceExtension.class)
class ContextMemoryExtractionIT {
  private static final String PAGES = "v1/contextCenter/pages";
  private static final String FILES = "v1/contextCenter/drive/files";
  private final AtomicInteger calls = new AtomicInteger();
  private AiProvider previousProvider;
  private boolean partial;
  private DocumentMemoryExtractor extractor;
  private GenericBackgroundWorker worker;
  private TestNamespace namespace;
  private final Set<UUID> trackedMemories = new HashSet<>();

  @BeforeEach
  void installScriptedProvider(TestNamespace ns) {
    namespace = ns;
    worker = TestSuiteBootstrap.findManagedObject(GenericBackgroundWorker.class).orElseThrow();
    worker.stop();
    previousProvider = AiProviderHolder.get();
    extractor =
        (text, source, type) -> {
          calls.incrementAndGet();
          List<ContextMemory> pills =
              text.isBlank() ? List.of() : List.of(pill(text, source, type));
          return new DocumentMemoryExtractor.DeriveResult(pills, partial ? 2 : 1, 1);
        };
    AiProviderHolder.setForTesting(() -> extractor);
    LLMClientHolder.setForTesting(new NoopCompletionClient());
    installPageWorker(Duration.ofHours(1).toMillis());
  }

  @AfterEach
  void restoreProviders(TestNamespace ns) {
    try {
      NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
    } finally {
      AiProviderHolder.setForTesting(previousProvider);
      PageContextProcessingEngineHolder.setForTesting(null);
      LLMClientHolder.initialize(LlmConfigHolder.get());
      if (worker != null) worker.start();
    }
  }

  @Test
  void autosavesCoalesceAndARebuiltWorkerSkipsAnUnchangedArticle(TestNamespace ns)
      throws Exception {
    Page page = page(ns, "First definition");
    JobDAO jobs = Entity.getJobDAO();
    String key = ContextMemoryExtractionJobHandler.Args.page(page.getId()).jobKey();
    Long queued = jobs.findPendingMemoryJobId(key);
    assertNotNull(queued, "the REST create must enqueue durable extraction work");
    page = edit(page, "Latest definition");
    page = edit(page, "Final definition");
    assertEquals(queued, jobs.findPendingMemoryJobId(key));
    assertEquals(1, jobs.countInFlightMemoryJobs(key, true));

    runPage(queued);
    ContextMemory published = extracted(page.getEntityReference()).getFirst();
    assertSource(published, page.getEntityReference(), ContextMemorySourceType.PAGE_EXTRACTION);
    assertEquals("Final definition", published.getAnswer());
    assertEquals(ContextMemoryStatus.APPROVED, published.getEntityStatus());
    assertEquals(PageProcessingStatus.Processed, readPage(page).getProcessingStatus());
    assertEquals(1, readPage(page).getExtractionStats().getChunksProcessed());
    installPageWorker(0);
    new ContextMemoryExtractionJobHandler().runJob(jobs.fetchJobById(queued).orElseThrow());
    assertEquals(1, calls.get(), "a rebuilt worker reads the persisted successful source hash");
    assertEquals(published.getId(), extracted(page.getEntityReference()).getFirst().getId());
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
    assertGone(PAGES + "/" + page.getId());
    assertGone("v1/contextCenter/memories/" + published.getId());
  }

  @Test
  void partialExtractionPreservesPublishedPillsAndRetryRecoversAfterWorkerRecreation(
      TestNamespace ns) throws Exception {
    Page page = page(ns, "Published definition");
    Long job =
        Entity.getJobDAO()
            .findPendingMemoryJobId(
                ContextMemoryExtractionJobHandler.Args.page(page.getId()).jobKey());
    runPage(job);
    ContextMemory original = extracted(page.getEntityReference()).getFirst();
    String successfulHash = readPage(page).getExtractionStats().getSourceHash();
    page = edit(page, "Revised definition");
    Long failedId = failExtraction(page);
    assertEquals(PageProcessingStatus.Failed, readPage(page).getProcessingStatus());
    assertEquals(successfulHash, readPage(page).getExtractionStats().getSourceHash());
    assertEquals(original.getAnswer(), extracted(page.getEntityReference()).getFirst().getAnswer());

    retryExtraction(page, failedId);
    ContextMemory revised = extracted(page.getEntityReference()).getFirst();
    assertSource(revised, page.getEntityReference(), ContextMemorySourceType.PAGE_EXTRACTION);
    assertEquals(original.getId(), revised.getId());
    assertEquals("Revised definition", revised.getAnswer());
    assertEquals(PageProcessingStatus.Processed, readPage(page).getProcessingStatus());
  }

  @Test
  void clearingAnArticleRemovesItsExtractedKnowledgeWithoutAnotherModelResult(TestNamespace ns)
      throws Exception {
    Page page = page(ns, "Temporary definition");
    runPage(
        Entity.getJobDAO()
            .findPendingMemoryJobId(
                ContextMemoryExtractionJobHandler.Args.page(page.getId()).jobKey()));
    assertEquals(1, extracted(page.getEntityReference()).size());
    page = edit(page, "");
    runPage(
        Entity.getJobDAO()
            .findPendingMemoryJobId(
                ContextMemoryExtractionJobHandler.Args.page(page.getId()).jobKey()));
    assertTrue(extracted(page.getEntityReference()).isEmpty());
    assertEquals(PageProcessingStatus.Processed, readPage(page).getProcessingStatus());
  }

  @Test
  void identicalFilesSharePersistedPillsUntilTheirLastSourceIsRemoved(TestNamespace ns)
      throws Exception {
    String text = "Same definition " + ns.shortPrefix();
    ContextFile first = file(ns, "first", text);
    runFile(first);
    ContextMemory pill = extracted(first.getEntityReference()).getFirst();
    assertSource(pill, first.getEntityReference(), ContextMemorySourceType.FILE_EXTRACTION);
    ContextFile second = file(ns, "copy", text);
    runFile(second);
    assertEquals(
        List.of(pill.getId()),
        extracted(second.getEntityReference()).stream().map(ContextMemory::getId).toList());
    assertEquals(
        1, calls.get(), "the second file reuses the persisted content hash and source links");
    RestClient.admin().delete(FILES, first.getId());
    assertEquals(
        List.of(pill.getId()),
        extracted(second.getEntityReference()).stream().map(ContextMemory::getId).toList());
    RestClient.admin().delete(FILES, second.getId());
    assertTrue(extracted(second.getEntityReference()).isEmpty());
    assertGone("v1/contextCenter/memories/" + pill.getId());
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
    assertGone(FILES + "/" + first.getId());
    assertGone(FILES + "/" + second.getId());
    assertGone("v1/contextCenter/memories/" + pill.getId());
  }

  @Test
  void invalidDuplicateResponsePreservesPersistedMemoriesAndSourceLinks(TestNamespace ns)
      throws Exception {
    ContextFile source = file(ns, "comparison-failure", "Source content");
    ContextFile other = file(ns, "other-source", "Other content");
    ContextMemory changed = persistedPill(source, "What is GDPR?", "Original definition.");
    persistedPill(
        source, "Which protocol carries billing alerts?", "PagerDuty pages the operator.");
    ContextMemory shared =
        persistedPill(source, "How long is data retained?", "Keep it for 90 days.");
    memoryRepository().linkExtractedMemory(shared.getId(), other.getEntityReference());
    ContextMemory reusable = persistedPill(other, "What is churn?", "The share of customers lost.");
    Map<UUID, String> originalSource = persistedAnswers(source);
    Map<UUID, String> originalOther = persistedAnswers(other);
    ContextMemory fresh =
        pill(
                "All data is encrypted.",
                source.getEntityReference(),
                ContextMemorySourceType.FILE_EXTRACTION)
            .withQuestion("How is storage secured?");
    ContextMemory reuse =
        pill(
                reusable.getAnswer(),
                source.getEntityReference(),
                ContextMemorySourceType.FILE_EXTRACTION)
            .withQuestion(reusable.getQuestion());
    ContextMemory failing =
        pill(
                "Use explicit consent.",
                source.getEntityReference(),
                ContextMemorySourceType.FILE_EXTRACTION)
            .withQuestion("How is consent collected?");
    AtomicInteger attempts = new AtomicInteger();
    LLMCompletionClient client = invalidJsonClient(attempts);
    ContextMemoryReconciler reconciler =
        new ContextMemoryReconciler(
            memoryRepository(),
            memory -> {
              if (memory.getId().equals(failing.getId())) {
                client.completeStructured(
                    "Return only a JSON array",
                    "Compare the supplied facts",
                    SemanticMemoryDuplicateFinder.MatchChoice.class);
              }
              return memory.getId().equals(reuse.getId()) ? reusable : null;
            });
    List<ContextMemory> derived =
        List.of(
            pill(
                    "Revised definition.",
                    source.getEntityReference(),
                    ContextMemorySourceType.FILE_EXTRACTION)
                .withQuestion(changed.getQuestion()),
            pill(
                    "Keep it for 30 days.",
                    source.getEntityReference(),
                    ContextMemorySourceType.FILE_EXTRACTION)
                .withQuestion(shared.getQuestion()),
            fresh,
            reuse,
            failing);

    assertThrows(
        LLMCompletionException.class,
        () -> reconciler.reconcile(source.getEntityReference(), Entity.CONTEXT_FILE, derived));

    assertEquals(2, attempts.get());
    assertEquals(originalSource, persistedAnswers(source));
    assertEquals(originalOther, persistedAnswers(other));
    assertGone("v1/contextCenter/memories/" + fresh.getId());
  }

  private ContextMemory persistedPill(ContextFile file, String question, String answer) {
    ContextMemory memory =
        pill(answer, file.getEntityReference(), ContextMemorySourceType.FILE_EXTRACTION)
            .withQuestion(question);
    memoryRepository().create(null, memory);
    return memory;
  }

  private Map<UUID, String> persistedAnswers(ContextFile file) {
    return extracted(file.getEntityReference()).stream()
        .collect(Collectors.toMap(ContextMemory::getId, ContextMemory::getAnswer));
  }

  private LLMCompletionClient invalidJsonClient(AtomicInteger attempts) {
    return new LLMCompletionClient(1) {
      @Override
      protected CompletionResult doComplete(
          String systemPrompt, String userPrompt, CompletionOptions options) {
        attempts.incrementAndGet();
        return new CompletionResult("I cannot identify an equivalent fact.", 0, 0);
      }

      @Override
      public String getModelId() {
        return "invalid-json-test";
      }
    };
  }

  private void installPageWorker(long quietPeriod) {
    PageContextProcessingEngineHolder.setForTesting(
        new PageContextProcessingEngine(
            (KnowledgePageRepository) Entity.getEntityRepository(Entity.PAGE),
            extractor,
            new ContextMemoryReconciler(memoryRepository()),
            Entity.getJobDAO(),
            quietPeriod));
  }

  private Long failExtraction(Page page) {
    partial = true;
    JobDAO jobs = Entity.getJobDAO();
    Long id =
        jobs.findPendingMemoryJobId(
            ContextMemoryExtractionJobHandler.Args.page(page.getId()).jobKey());
    assertNotNull(id);
    assertEquals(1, jobs.claimPendingJob(id));
    installPageWorker(0);
    BackgroundJob job = jobs.fetchJobById(id).orElseThrow();
    assertThrows(
        BackgroundJobException.class, () -> new ContextMemoryExtractionJobHandler().runJob(job));
    jobs.updateJobStatus(id, BackgroundJob.Status.FAILED);
    assertEquals(BackgroundJob.Status.FAILED, jobs.fetchJobById(id).orElseThrow().getStatus());
    return id;
  }

  private void retryExtraction(Page page, Long failedId) {
    partial = false;
    installPageWorker(0);
    PageContextProcessingEngineHolder.get().schedule(page.getId());
    JobDAO jobs = Entity.getJobDAO();
    Long retriedId =
        jobs.findPendingMemoryJobId(
            ContextMemoryExtractionJobHandler.Args.page(page.getId()).jobKey());
    assertNotNull(retriedId);
    assertNotEquals(failedId, retriedId);
    runPage(retriedId);
    assertEquals(
        BackgroundJob.Status.COMPLETED, jobs.fetchJobById(retriedId).orElseThrow().getStatus());
  }

  private void runPage(Long id) {
    assertNotNull(id);
    assertEquals(1, Entity.getJobDAO().claimPendingJob(id));
    installPageWorker(0);
    BackgroundJob job = Entity.getJobDAO().fetchJobById(id).orElseThrow();
    new ContextMemoryExtractionJobHandler().runJob(job);
    long now = System.currentTimeMillis();
    Entity.getJobDAO()
        .completeJob(id, BackgroundJob.Status.COMPLETED.name(), "{}", "extracted", 1, 1, now, now);
  }

  private void runFile(ContextFile file) {
    JobDAO jobs = Entity.getJobDAO();
    ContextMemoryExtractionJobHandler.Args args =
        ContextMemoryExtractionJobHandler.Args.file(
            file.getId(), UUID.fromString(file.getHeadContentId()));
    long id =
        jobs.insertJob(
            BackgroundJob.JobType.CONTEXT_MEMORY_EXTRACTION,
            new ContextMemoryExtractionJobHandler(),
            JsonUtils.pojoToJson(args),
            Entity.ADMIN_USER_NAME,
            System.currentTimeMillis() + Duration.ofHours(1).toMillis());
    assertEquals(1, jobs.claimPendingJob(id));
    new ContextMemoryExtractionJobHandler().runJob(jobs.fetchJobById(id).orElseThrow());
    assertEquals(
        ProcessingStatus.Processed,
        fileRepository()
            .get(null, file.getId(), fileRepository().getFields(""), Include.NON_DELETED, false)
            .getProcessingStatus());
    long now = System.currentTimeMillis();
    jobs.completeJob(id, BackgroundJob.Status.COMPLETED.name(), "{}", "extracted", 1, 1, now, now);
  }

  private Page page(TestNamespace ns, String body) throws Exception {
    Page page =
        RestClient.admin()
            .create(
                PAGES,
                new CreatePage()
                    .withName(ns.prefix("article"))
                    .withPageType(PageType.ARTICLE)
                    .withPage(new Article())
                    .withDescription(body),
                Page.class);
    return ns.trackRoot(Entity.PAGE, page);
  }

  private Page edit(Page page, String body) throws Exception {
    return RestClient.admin()
        .patch(
            PAGES,
            page.getId(),
            JsonUtils.pojoToJson(page),
            JsonUtils.deepCopy(page, Page.class).withDescription(body),
            Page.class);
  }

  private Page readPage(Page page) throws Exception {
    return RestClient.admin().getById(PAGES, page.getId(), "", Page.class);
  }

  private ContextFile file(TestNamespace ns, String label, String text) throws Exception {
    ContextFile file =
        ns.trackRoot(
            Entity.CONTEXT_FILE,
            RestClient.admin()
                .create(
                    FILES, new CreateContextFile().withName(ns.prefix(label)), ContextFile.class));
    ContextFileContent content =
        new ContextFileContent()
            .withId(UUID.randomUUID())
            .withName(UUID.randomUUID().toString())
            .withContextFile(file.getEntityReference())
            .withChecksum(DigestUtils.sha256Hex(text))
            .withExtractedText(text)
            .withUpdatedBy(Entity.ADMIN_USER_NAME)
            .withUpdatedAt(System.currentTimeMillis())
            .withProcessingStatus(ProcessingStatus.Processed);
    fileRepository().getContentRepository().create(null, content);
    ContextFile updated =
        JsonUtils.deepCopy(file, ContextFile.class)
            .withHeadContentId(content.getId().toString())
            .withProcessingStatus(ProcessingStatus.ExtractingContext);
    fileRepository().update(null, file, updated, Entity.ADMIN_USER_NAME);
    return updated;
  }

  private List<ContextMemory> extracted(EntityReference source) {
    List<ContextMemory> memories =
        memoryRepository().listExtractedMemories(source.getId(), source.getType());
    memories.stream()
        .filter(memory -> trackedMemories.add(memory.getId()))
        .forEach(memory -> namespace.trackRoot(Entity.CONTEXT_MEMORY, memory.getId()));
    return memories;
  }

  private void assertGone(String path) {
    OpenMetadataException failure =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.adminClient()
                    .getHttpClient()
                    .execute(HttpMethod.GET, "/" + path + "?include=all", null, Object.class));
    assertEquals(404, failure.getStatusCode());
  }

  private void assertSource(
      ContextMemory memory, EntityReference source, ContextMemorySourceType type) {
    assertEquals(type, memory.getSourceType());
    assertEquals(source.getId(), memory.getSourceEntity().getId());
    assertEquals(source.getType(), memory.getSourceEntity().getType());
    assertEquals(source.getId(), memory.getPrimaryEntity().getId());
  }

  private ContextMemoryRepository memoryRepository() {
    return (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
  }

  private ContextFileRepository fileRepository() {
    return (ContextFileRepository) Entity.getEntityRepository(Entity.CONTEXT_FILE);
  }

  private ContextMemory pill(String text, EntityReference source, ContextMemorySourceType type) {
    String name = "pill-" + UUID.randomUUID();
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withTitle("Document definition")
        .withQuestion("What does this source define?")
        .withAnswer(text)
        .withMemoryType(ContextMemoryType.NOTE)
        .withMemoryScope(ContextMemoryScope.ENTITY_SCOPED)
        .withEntityStatus(ContextMemoryStatus.APPROVED)
        .withSourceType(type)
        .withSourceEntity(source)
        .withPrimaryEntity(source)
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY))
        .withUpdatedBy(Entity.ADMIN_USER_NAME)
        .withUpdatedAt(System.currentTimeMillis());
  }
}
