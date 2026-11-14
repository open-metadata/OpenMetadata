package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.apache.commons.codec.digest.DigestUtils;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.ApproveExtractedMemories;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.context.ExtractedMemoryApproval;
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
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.clients.llm.LlmConfigHolder;
import org.openmetadata.service.context.center.AiProvider;
import org.openmetadata.service.context.center.AiProviderHolder;
import org.openmetadata.service.context.center.ContextMemoryExtractionJobHandler;
import org.openmetadata.service.context.center.ContextMemoryExtractor;
import org.openmetadata.service.context.center.ContextMemoryReconciler;
import org.openmetadata.service.context.center.DocumentMemoryExtractor;
import org.openmetadata.service.context.center.DuplicateMatch;
import org.openmetadata.service.context.center.KnowledgePill;
import org.openmetadata.service.context.center.PageContextProcessingEngine;
import org.openmetadata.service.context.center.PageContextProcessingEngineHolder;
import org.openmetadata.service.context.center.SemanticMemoryDuplicateFinder;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.jobs.BackgroundJobTypes;
import org.openmetadata.service.jobs.GenericBackgroundWorker;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.llm.CompletionOptions;
import org.openmetadata.service.llm.CompletionResult;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.llm.LLMCompletionClient;
import org.openmetadata.service.llm.LLMCompletionException;
import org.openmetadata.service.llm.NoopCompletionClient;
import org.openmetadata.service.util.RequestEntityCache;

/** Persistent sources and queue rows, scripting only the document-provider boundary. */
@Isolated("Installs the document provider and page worker for the embedded server")
@ExtendWith(TestNamespaceExtension.class)
class ContextMemoryExtractionIT {
  private static final String PAGES = "v1/contextCenter/pages";
  private static final String FILES = "v1/contextCenter/drive/files";
  private static final String APPROVAL = "/v1/contextCenter/memories/extractedApproval";
  private static final String MEMORIES = "v1/contextCenter/memories";
  private static final String SOURCE_FIELDS = "owners,primaryEntity,relatedEntities,sourceEntity";
  // Facts share too few words with one another to rank as each other's candidates.
  private static final Fact KAFKA_OWNER =
      new Fact(
          "Which squad maintains the Kafka ingestion cluster?",
          "Squad Orion maintains the Kafka ingestion cluster.");
  private static final Fact PAYROLL =
      new Fact("How often does payroll run?", "Payroll runs every second Friday.");
  private static final Fact PAYROLL_REWORDED =
      new Fact("How frequently does payroll run?", "Payroll runs on alternate Fridays.");
  private static final Fact VACATION =
      new Fact(
          "How many vacation days do employees get?", "Employees get 25 vacation days per year.");
  private static final Fact VACATION_REPLACED =
      new Fact(VACATION.question(), "Employees get 30 vacation days per year.");
  private static final Fact RECOVERY_SITE =
      new Fact(
          "Which city hosts the disaster recovery site?",
          "The disaster recovery site is in Lisbon.");
  private static final Fact BRAND_COLOR =
      new Fact("Which color does company branding use?", "Company branding uses teal.");
  private static final Fact BILLING_DAY =
      new Fact("When is the customer billed?", "Customers are billed on the 5th of each month.");
  private static final Fact BILLING_DAY_MOVED =
      new Fact(BILLING_DAY.question(), "Customers are billed on the 10th of each month.");
  private final AtomicInteger calls = new AtomicInteger();
  private AiProvider previousProvider;
  private boolean partial;
  private DocumentMemoryExtractor extractor;
  private Runnable duringDerivation = () -> {};
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
          duringDerivation.run();
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

  /** Another file's rewording links to the first file's fact; a replaced number never does. */
  @Test
  void oss_crossDocument_reusesRewordedFactsAndKeepsReplacedNumbers(TestNamespace ns)
      throws Exception {
    assumeTrue(
        Entity.getSearchRepository().getVectorIndexService() == null,
        "covers the memory index lookup that runs without vector search");
    ContextFile first = file(ns, "handbook", "Handbook " + ns.shortPrefix());
    ContextFile second = file(ns, "handbook-revised", "Revised handbook " + ns.shortPrefix());
    scriptFacts(
        Map.of(
            first.getId(),
            List.of(KAFKA_OWNER, PAYROLL, VACATION, RECOVERY_SITE),
            second.getId(),
            List.of(KAFKA_OWNER, PAYROLL_REWORDED, VACATION_REPLACED, BRAND_COLOR)));
    runFile(first);
    Map<String, ContextMemory> original = byQuestion(extracted(first.getEntityReference()));
    awaitSearchable(original.values());
    DuplicateJudge judge =
        new DuplicateJudge(Map.of(PAYROLL_REWORDED.question(), PAYROLL.question()));
    LLMClientHolder.setForTesting(judge);

    runFile(second);

    assertEquals(
        List.of(PAYROLL_REWORDED.question()),
        judge.judgedQuestions(),
        "only the rewording needs the judge: the verbatim fact links without it, the replaced"
            + " number never reaches it");
    Map<String, ContextMemory> linked = byQuestion(extracted(second.getEntityReference()));
    assertEquals(
        Set.of(
            KAFKA_OWNER.question(),
            PAYROLL.question(),
            VACATION.question(),
            BRAND_COLOR.question()),
        linked.keySet());
    assertEquals(
        original.get(KAFKA_OWNER.question()).getId(), linked.get(KAFKA_OWNER.question()).getId());
    assertEquals(original.get(PAYROLL.question()).getId(), linked.get(PAYROLL.question()).getId());
    assertNotEquals(
        original.get(VACATION.question()).getId(), linked.get(VACATION.question()).getId());
    assertEquals(VACATION_REPLACED.answer(), linked.get(VACATION.question()).getAnswer());
  }

  /**
   * A provider that supplies no judge never falls back to the built-in model, as Collate relies on:
   * another file's rewording is a new memory, while a verbatim fact still links.
   */
  @Test
  void aProviderWithoutAJudgeLinksOnlyVerbatimFacts(TestNamespace ns) throws Exception {
    assumeTrue(
        Entity.getSearchRepository().getVectorIndexService() == null,
        "covers the memory index lookup that runs without vector search");
    ContextFile first = file(ns, "handbook", "Handbook " + ns.shortPrefix());
    ContextFile second = file(ns, "handbook-revised", "Revised handbook " + ns.shortPrefix());
    scriptFacts(
        Map.of(
            first.getId(),
            List.of(KAFKA_OWNER, PAYROLL),
            second.getId(),
            List.of(KAFKA_OWNER, PAYROLL_REWORDED)));
    runFile(first);
    Map<String, ContextMemory> original = byQuestion(extracted(first.getEntityReference()));
    awaitSearchable(original.values());
    DuplicateJudge builtIn =
        new DuplicateJudge(Map.of(PAYROLL_REWORDED.question(), PAYROLL.question()));
    LLMClientHolder.setForTesting(builtIn);
    AiProviderHolder.setForTesting(providerWithoutAJudge());

    runFile(second);

    assertEquals(List.of(), builtIn.judgedQuestions(), "the provider supplies no judge");
    Map<String, ContextMemory> linked = byQuestion(extracted(second.getEntityReference()));
    assertEquals(Set.of(KAFKA_OWNER.question(), PAYROLL_REWORDED.question()), linked.keySet());
    assertEquals(
        original.get(KAFKA_OWNER.question()).getId(), linked.get(KAFKA_OWNER.question()).getId());
    assertFalse(
        ids(original.values()).contains(linked.get(PAYROLL_REWORDED.question()).getId()),
        "the rewording is a new memory");
  }

  /** Extracts as scripted and supplies no duplicate judge. */
  private AiProvider providerWithoutAJudge() {
    return new AiProvider() {
      @Override
      public DocumentMemoryExtractor documentExtractor() {
        return extractor;
      }

      @Override
      public Optional<LLMCompletionClient> duplicateJudge() {
        return Optional.empty();
      }
    };
  }

  /**
   * Under a reviewing provider, another file stating the same facts links to the memories still
   * awaiting review, and that file's owner lists and approves them from it: one memory, one review.
   */
  @Test
  void collate_style_waitingMemoriesAreReusedAcrossDocuments(TestNamespace ns) throws Exception {
    assumeTrue(
        Entity.getSearchRepository().getVectorIndexService() == null,
        "covers the memory index lookup that runs without vector search");
    String handbook = "Handbook " + ns.shortPrefix();
    String revised = "Revised handbook " + ns.shortPrefix();
    ContextFile first = file(ns, "a-handbook", handbook, null);
    ContextFile second = file(ns, "b-handbook", revised, SharedEntities.get().USER1_REF);
    List<Fact> facts = List.of(KAFKA_OWNER, PAYROLL, VACATION, RECOVERY_SITE);
    extractor =
        new ContextMemoryExtractor(
            new FactsModel(Map.of(handbook, facts, revised, facts)),
            ContextMemoryStatus.UNPROCESSED);
    runFile(first);
    List<ContextMemory> waiting = extracted(first.getEntityReference());
    assertEquals(Set.of(ContextMemoryStatus.UNPROCESSED), statuses(waiting));
    awaitIndexedIn(first.getEntityReference(), waiting, ContextMemoryStatus.UNPROCESSED);
    DuplicateJudge judge = new DuplicateJudge(Map.of());
    LLMClientHolder.setForTesting(judge);

    runFile(second);

    assertEquals(List.of(), judge.judgedQuestions(), "the same facts link without the judge");
    assertEquals(ids(waiting), ids(extracted(second.getEntityReference())));
    ListParams panel =
        new ListParams()
            .setLimit(50)
            .setFields("sourceEntity")
            .addFilter("sourceEntityId", second.getId().toString());
    assertEquals(
        ids(waiting),
        ids(memories(SdkClients.user1Client()).list(panel).getData()),
        "the second file's owner lists them, though the first file reads as their source");
    assertEquals(
        4,
        approve(SdkClients.user1Client(), second, preview(SdkClients.user1Client(), second))
            .getApproved());
    assertEquals(
        Set.of(ContextMemoryStatus.APPROVED),
        statuses(extracted(first.getEntityReference())),
        "the decision covers the first file too");
  }

  /**
   * OSS: another file's new value for a fact a person rejected waits for review, and only an admin
   * decides it: the second file's owner cannot approve it from that file.
   */
  @Test
  void oss_aValueBesideAnotherDocumentsRejectedFactWaitsForAnAdmin(TestNamespace ns)
      throws Exception {
    assumeTrue(
        Entity.getSearchRepository().getVectorIndexService() == null,
        "covers the memory index lookup that runs without vector search");
    ContextFile first = file(ns, "a-billing", "Billing " + ns.shortPrefix(), null);
    ContextFile second =
        file(
            ns, "b-billing", "Revised billing " + ns.shortPrefix(), SharedEntities.get().USER1_REF);
    scriptFacts(
        Map.of(first.getId(), List.of(BILLING_DAY), second.getId(), List.of(BILLING_DAY_MOVED)));
    runFile(first);
    ContextMemory rejected = reject(extracted(first.getEntityReference()).getFirst());
    awaitIndexedIn(first.getEntityReference(), List.of(rejected), ContextMemoryStatus.REJECTED);

    runFile(second);

    ContextMemory held = extracted(second.getEntityReference()).getFirst();
    assertNotEquals(rejected.getId(), held.getId());
    assertEquals(BILLING_DAY_MOVED.answer(), held.getAnswer());
    assertEquals(Set.of(ContextMemoryStatus.UNPROCESSED), statuses(List.of(held)));
    ExtractedMemoryApproval preview = preview(SdkClients.user1Client(), second);
    assertEquals(List.of(), preview.getApprovable(), "the second file's owner cannot approve it");
    assertEquals(
        List.of(held.getId()),
        preview.getNeedsDecision().stream().map(EntityReference::getId).toList());
  }

  /**
   * OSS: a fact a person rejected, which another file states again, links to the rejected memory
   * through the real repository and stays rejected: the second file takes the decision.
   */
  @Test
  void oss_aRejectedFactAnotherFileStatesStaysRejected(TestNamespace ns) throws Exception {
    assumeTrue(
        Entity.getSearchRepository().getVectorIndexService() == null,
        "covers the memory index lookup that runs without vector search");
    ContextFile first = file(ns, "a-payroll", "Payroll " + ns.shortPrefix(), null);
    ContextFile second =
        file(
            ns, "b-payroll", "Revised payroll " + ns.shortPrefix(), SharedEntities.get().USER1_REF);
    scriptFacts(Map.of(first.getId(), List.of(PAYROLL), second.getId(), List.of(PAYROLL)));
    runFile(first);
    ContextMemory rejected = reject(extracted(first.getEntityReference()).getFirst());
    awaitIndexedIn(first.getEntityReference(), List.of(rejected), ContextMemoryStatus.REJECTED);
    DuplicateJudge judge = new DuplicateJudge(Map.of());
    LLMClientHolder.setForTesting(judge);

    runFile(second);

    assertEquals(Set.of(rejected.getId()), ids(extracted(second.getEntityReference())));
    assertEquals(Set.of(ContextMemoryStatus.REJECTED), statuses(List.of(rejected)));
    assertEquals(List.of(), judge.judgedQuestions(), "the same fact links without the judge");
  }

  /**
   * OSS: a person's correction holds the figure it replaced when another file states that figure.
   * The memory index finds a correction by the file it names, which a later write of the
   * correction, here linking a copy, still indexes.
   */
  @Test
  void oss_theFigureAPersonCorrectedWaitsForReviewWhenAnotherFileStatesIt(TestNamespace ns)
      throws Exception {
    assumeTrue(
        Entity.getSearchRepository().getVectorIndexService() == null,
        "covers the memory index lookup that runs without vector search");
    ContextFile first = file(ns, "a-billing", "Billing " + ns.shortPrefix(), null);
    ContextFile copy = file(ns, "c-billing-copy", "Billing copy " + ns.shortPrefix(), null);
    ContextFile second =
        file(
            ns, "b-billing", "Revised billing " + ns.shortPrefix(), SharedEntities.get().USER1_REF);
    scriptFacts(Map.of(first.getId(), List.of(BILLING_DAY), second.getId(), List.of(BILLING_DAY)));
    runFile(first);
    ContextMemory corrected =
        correct(
            extracted(first.getEntityReference()).getFirst(),
            "Customers are billed on the 15th of each month.");
    assertEquals(ContextMemorySourceType.MANUAL, corrected.getSourceType());
    memoryRepository().linkExtractedMemory(corrected.getId(), copy.getEntityReference());
    awaitIndexedIn(copy.getEntityReference(), List.of(corrected), ContextMemoryStatus.APPROVED);

    runFile(second);

    ContextMemory held = extracted(second.getEntityReference()).getFirst();
    assertNotEquals(corrected.getId(), held.getId());
    assertEquals(BILLING_DAY.answer(), held.getAnswer());
    assertEquals(Set.of(ContextMemoryStatus.UNPROCESSED), statuses(List.of(held)));
  }

  /**
   * OSS: a note a person wrote citing a file is a decision on its fact, so another file's other
   * figure for it waits for review. The memory index names the note's file from the source the
   * note was created with.
   */
  @Test
  void oss_aPersonsNoteCitingAFileHoldsAnotherFilesFigure(TestNamespace ns) throws Exception {
    assumeTrue(
        Entity.getSearchRepository().getVectorIndexService() == null,
        "covers the memory index lookup that runs without vector search");
    ContextFile cited = file(ns, "a-billing-policy", "Billing policy " + ns.shortPrefix(), null);
    ContextFile second =
        file(
            ns, "b-billing", "Revised billing " + ns.shortPrefix(), SharedEntities.get().USER1_REF);
    ContextMemory note =
        memories(SdkClients.user1Client())
            .create(
                new CreateContextMemory()
                    .withName(ns.prefix("billing-note"))
                    .withQuestion(BILLING_DAY.question())
                    .withAnswer("Customers are billed on the 15th of each month.")
                    .withSourceType(ContextMemorySourceType.MANUAL)
                    .withMemoryScope(ContextMemoryScope.ENTITY_SCOPED)
                    .withShareConfig(
                        new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY))
                    .withSourceEntity(cited.getEntityReference()));
    namespace.trackRoot(Entity.CONTEXT_MEMORY, note.getId());
    awaitSearchable(List.of(note));
    scriptFacts(Map.of(second.getId(), List.of(BILLING_DAY)));

    runFile(second);

    ContextMemory held = extracted(second.getEntityReference()).getFirst();
    assertEquals(BILLING_DAY.answer(), held.getAnswer());
    assertEquals(Set.of(ContextMemoryStatus.UNPROCESSED), statuses(List.of(held)));
  }

  /**
   * A reader of a file never learns which restricted copy also states its memories: not from the
   * memory, a listing of it, or its history, though the copy sorts first by name. A listing returns
   * only the fields asked for.
   */
  @Test
  void aReaderOfTheOriginalNeverSeesTheNameOfARestrictedCopy(TestNamespace ns) throws Exception {
    ContextFile original = file(ns, "b-original", "Original " + ns.shortPrefix(), null);
    EntityReference copy = privateFile(ns, "a-private-copy", SharedEntities.get().USER2_REF);
    ContextMemory memory = persistedPill(original, KAFKA_OWNER.question(), KAFKA_OWNER.answer());
    namespace.trackRoot(Entity.CONTEXT_MEMORY, memory.getId());
    memoryRepository().linkExtractedMemory(memory.getId(), copy);
    ListParams plain =
        new ListParams().setLimit(50).addFilter("sourceEntityId", original.getId().toString());
    ListParams card =
        new ListParams()
            .setLimit(50)
            .setFields("owners,sourceEntity,derivedEntities")
            .addFilter("sourceEntityId", original.getId().toString());

    for (ListParams params : List.of(plain, card)) {
      List<ContextMemory> listed = memories(SdkClients.user1Client()).list(params).getData();
      assertEquals(Set.of(memory.getId()), ids(listed));
      assertNamesNo(copy, JsonUtils.pojoToJson(listed));
    }
    String path = "/" + MEMORIES + "/" + memory.getId();
    assertNamesNo(copy, readAsUser1(path + "?fields=" + SOURCE_FIELDS));
    assertNamesNo(copy, readAsUser1(path + "/versions"));
    ContextMemory unasked = memories(SdkClients.user1Client()).list(plain).getData().getFirst();
    assertNull(unasked.getSourceEntity(), "a field the caller did not ask for");
    assertNull(unasked.getRelatedEntities(), "a field the caller did not ask for");
  }

  private static void assertNamesNo(EntityReference document, String response) {
    assertFalse(response.contains(document.getId().toString()), response);
    assertFalse(response.contains(document.getName()), response);
  }

  private static String readAsUser1(String path) {
    return SdkClients.user1Client().getHttpClient().executeForString(HttpMethod.GET, path, null);
  }

  @Test
  void fileProcessingKeepsMetadataEditedDuringDerivation(TestNamespace ns) throws Exception {
    ContextFile file = file(ns, "edited-file", "Definition " + ns.shortPrefix());
    duringDerivation =
        () ->
            assertDoesNotThrow(
                () -> {
                  ContextFile current =
                      RestClient.admin().getById(FILES, file.getId(), "", ContextFile.class);
                  RestClient.admin()
                      .patch(
                          FILES,
                          file.getId(),
                          JsonUtils.pojoToJson(current),
                          JsonUtils.deepCopy(current, ContextFile.class)
                              .withDescription("Current description")
                              .withShareConfig(
                                  new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE)),
                          ContextFile.class);
                });

    runFile(file);

    ContextFile stored = RestClient.admin().getById(FILES, file.getId(), "", ContextFile.class);
    assertEquals("Current description", stored.getDescription());
    assertEquals(MemoryVisibility.PRIVATE, stored.getShareConfig().getVisibility());
    assertEquals(ProcessingStatus.Processed, stored.getProcessingStatus());
    assertNotNull(stored.getExtractionStats().getSourceHash());
    assertEquals(1, calls.get());
  }

  @Test
  void pageProcessingKeepsBodyEditedDuringDerivation(TestNamespace ns) throws Exception {
    Page page = page(ns, "Original definition");
    duringDerivation = () -> assertDoesNotThrow(() -> edit(readPage(page), "Current definition"));

    runPage(
        Entity.getJobDAO()
            .findPendingMemoryJobId(
                ContextMemoryExtractionJobHandler.Args.page(page.getId()).jobKey()));

    Page stored = readPage(page);
    assertEquals("Current definition", stored.getDescription());
    assertEquals(PageProcessingStatus.Processed, stored.getProcessingStatus());
    assertEquals(
        DigestUtils.sha256Hex("Original definition"), stored.getExtractionStats().getSourceHash());
    assertEquals(1, calls.get());
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
              return memory.getId().equals(reuse.getId())
                  ? new DuplicateMatch.Equivalent(reusable)
                  : new DuplicateMatch.None();
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

  private void scriptFacts(Map<UUID, List<Fact>> factsBySource) {
    extractor =
        (text, source, type) -> {
          List<ContextMemory> pills =
              factsBySource.get(source.getId()).stream()
                  .map(fact -> pill(fact.answer(), source, type).withQuestion(fact.question()))
                  .toList();
          return new DocumentMemoryExtractor.DeriveResult(pills, 1, 1);
        };
  }

  private static Map<String, ContextMemory> byQuestion(List<ContextMemory> memories) {
    return memories.stream()
        .collect(Collectors.toMap(ContextMemory::getQuestion, Function.identity()));
  }

  /** The duplicate check reads the search index, which shows a new memory only once refreshed. */
  private static void awaitSearchable(Collection<ContextMemory> memories) {
    Awaitility.await("the first file's memories are searchable")
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(60))
        .ignoreExceptions()
        .untilAsserted(() -> memories.forEach(memory -> assertTrue(isSearchable(memory))));
  }

  /** Ordinary search admits Approved memories only, so another stage is awaited in the listing. */
  private static void awaitIndexedIn(
      EntityReference anchor, Collection<ContextMemory> memories, ContextMemoryStatus status) {
    ListParams anchored =
        new ListParams()
            .setLimit(50)
            .addFilter("assets", anchor.getId().toString())
            .addFilter("statuses", status.value());
    Awaitility.await("the first file's memories are searchable in their stage")
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(60))
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertEquals(
                    ids(memories),
                    ids(memories(SdkClients.adminClient()).list(anchored).getData())));
  }

  private static ContextMemoryService memories(OpenMetadataClient client) {
    return new ContextMemoryService(client.getHttpClient());
  }

  private static Set<UUID> ids(Collection<ContextMemory> memories) {
    return memories.stream().map(ContextMemory::getId).collect(Collectors.toSet());
  }

  /** Read as a new request reads: this thread's request cache keeps what it read before a write. */
  private Set<ContextMemoryStatus> statuses(Collection<ContextMemory> memories) {
    RequestEntityCache.clear();
    return memories.stream()
        .map(
            memory ->
                memoryRepository()
                    .get(
                        null,
                        memory.getId(),
                        memoryRepository().getFields(""),
                        Include.NON_DELETED,
                        false)
                    .getEntityStatus())
        .collect(Collectors.toSet());
  }

  private static ExtractedMemoryApproval preview(OpenMetadataClient client, ContextFile file) {
    EntityReference source = file.getEntityReference();
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            APPROVAL + "?sourceId=%s&sourceType=%s".formatted(source.getId(), source.getType()),
            null,
            ExtractedMemoryApproval.class);
  }

  private static ExtractedMemoryApproval approve(
      OpenMetadataClient client, ContextFile file, ExtractedMemoryApproval preview) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            APPROVAL,
            new ApproveExtractedMemories()
                .withSource(file.getEntityReference())
                .withApprovable(preview.getApprovable()),
            ExtractedMemoryApproval.class);
  }

  /** A person rejects the memory in its panel, as an admin. */
  private static ContextMemory reject(ContextMemory memory) throws Exception {
    ContextMemory current =
        RestClient.admin().getById(MEMORIES, memory.getId(), "", ContextMemory.class);
    return RestClient.admin()
        .patch(
            MEMORIES,
            memory.getId(),
            JsonUtils.pojoToJson(current),
            JsonUtils.deepCopy(current, ContextMemory.class)
                .withEntityStatus(ContextMemoryStatus.REJECTED),
            ContextMemory.class);
  }

  /** A person corrects the memory's figure in its panel, which makes the memory theirs (Manual). */
  private static ContextMemory correct(ContextMemory memory, String answer) throws Exception {
    ContextMemory current =
        RestClient.admin().getById(MEMORIES, memory.getId(), "", ContextMemory.class);
    return RestClient.admin()
        .patch(
            MEMORIES,
            memory.getId(),
            JsonUtils.pojoToJson(current),
            JsonUtils.deepCopy(current, ContextMemory.class).withAnswer(answer),
            ContextMemory.class);
  }

  /** Answers extraction as the model would: each document's facts, as one JSON array. */
  private static final class FactsModel extends LLMCompletionClient {
    private final Map<String, List<Fact>> factsByText;

    FactsModel(Map<String, List<Fact>> factsByText) {
      super(1);
      this.factsByText = factsByText;
    }

    @Override
    protected CompletionResult doComplete(
        String systemPrompt, String userPrompt, CompletionOptions options) {
      List<KnowledgePill> pills =
          factsByText.getOrDefault(userPrompt, List.of()).stream()
              .map(
                  fact ->
                      new KnowledgePill(
                          fact.question(), fact.question(), fact.answer(), null, "Faq"))
              .toList();
      return new CompletionResult(JsonUtils.pojoToJson(pills), 0, 0);
    }

    @Override
    public String getModelId() {
      return "facts-model-test";
    }
  }

  private static boolean isSearchable(ContextMemory memory) {
    String byId = "{\"query\":{\"term\":{\"id.keyword\":\"" + memory.getId() + "\"}}}";
    return SdkClients.adminClient()
        .search()
        .query("*")
        .index("context_memory_search_index")
        .queryFilter(byId)
        .execute()
        .contains(memory.getId().toString());
  }

  private record Fact(String question, String answer) {}

  /** Pairs each rewording with its original, as the model would, and records every fact judged. */
  private static final class DuplicateJudge extends LLMCompletionClient {
    private final Map<String, String> originalByRewording;
    private final List<String> judgedQuestions = new CopyOnWriteArrayList<>();

    DuplicateJudge(Map<String, String> originalByRewording) {
      super(1);
      this.originalByRewording = originalByRewording;
    }

    List<String> judgedQuestions() {
      return List.copyOf(judgedQuestions);
    }

    @Override
    protected CompletionResult doComplete(
        String systemPrompt, String userPrompt, CompletionOptions options) {
      JsonNode comparison = JsonUtils.readTree(userPrompt);
      String question = comparison.path("question").asText();
      judgedQuestions.add(question);
      return new CompletionResult(
          choice(comparison.path("candidates"), originalByRewording.get(question)), 0, 0);
    }

    private static String choice(JsonNode candidates, String originalQuestion) {
      String choice = "[]";
      for (JsonNode candidate : candidates) {
        if (candidate.path("question").asText().equals(originalQuestion)) {
          choice = "[{\"index\":" + candidate.path("index").asInt() + "}]";
        }
      }
      return choice;
    }

    @Override
    public String getModelId() {
      return "duplicate-judge-test";
    }
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
            BackgroundJobTypes.CONTEXT_MEMORY_EXTRACTION,
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
    return file(ns, label, text, null);
  }

  private ContextFile file(TestNamespace ns, String label, String text, EntityReference owner)
      throws Exception {
    UUID contentId = UUID.randomUUID();
    ContextFile file =
        ns.trackRoot(
            Entity.CONTEXT_FILE,
            fileRepository()
                .create(
                    null,
                    new ContextFile()
                        .withId(UUID.randomUUID())
                        .withName(ns.prefix(label))
                        .withHeadContentId(contentId.toString())
                        .withProcessingStatus(ProcessingStatus.ExtractingContext)
                        .withOwners(owner == null ? null : List.of(owner))
                        .withUpdatedBy(Entity.ADMIN_USER_NAME)
                        .withUpdatedAt(System.currentTimeMillis())));
    ContextFileContent content =
        new ContextFileContent()
            .withId(contentId)
            .withName(UUID.randomUUID().toString())
            .withContextFile(file.getEntityReference())
            .withChecksum(DigestUtils.sha256Hex(text))
            .withExtractedText(text)
            .withUpdatedBy(Entity.ADMIN_USER_NAME)
            .withUpdatedAt(System.currentTimeMillis())
            .withProcessingStatus(ProcessingStatus.Processed);
    fileRepository().getContentRepository().create(null, content);
    return file;
  }

  private EntityReference privateFile(TestNamespace ns, String label, EntityReference owner) {
    ContextFile file =
        fileRepository()
            .create(
                null,
                new ContextFile()
                    .withId(UUID.randomUUID())
                    .withName(ns.prefix(label))
                    .withHeadContentId(UUID.randomUUID().toString())
                    .withProcessingStatus(ProcessingStatus.Processed)
                    .withOwners(List.of(owner))
                    .withShareConfig(
                        new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE))
                    .withUpdatedBy(Entity.ADMIN_USER_NAME)
                    .withUpdatedAt(System.currentTimeMillis()));
    return ns.trackRoot(Entity.CONTEXT_FILE, file).getEntityReference();
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
