package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.apache.commons.codec.digest.DigestUtils;
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
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.entity.context.MemoryDispute;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageProcessingStatus;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
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
  private static final String MEMORIES = "v1/contextCenter/memories";
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
    assertEquals(Set.of(first.getId(), second.getId()), sourceIds(pill));
    RestClient.admin().delete(FILES, second.getId());
    assertTrue(extracted(second.getEntityReference()).isEmpty());
    assertArchived(ns, pill);
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
    assertGone(FILES + "/" + first.getId());
    assertGone(FILES + "/" + second.getId());
    assertGone("v1/contextCenter/memories/" + pill.getId());
  }

  @Test
  void archivedDocumentNoLongerShowsAsASource(TestNamespace ns) throws Exception {
    String text = "Shared source " + ns.shortPrefix();
    ContextFile original = file(ns, "kept-original", text);
    runFile(original);
    ContextFile copy = file(ns, "archived-copy", text);
    runFile(copy);
    ContextMemory shared = extracted(copy.getEntityReference()).getFirst();
    awaitChips(ns, shared, original, Set.of(copy.getId()));

    RestClient.admin().delete(FILES, copy.getId());

    awaitChips(ns, shared, original, Set.of());
    assertEquals(
        Set.of(original.getId(), copy.getId()),
        sourceIds(shared),
        "the archived copy keeps its link so restoring it can bring the memory back");
    permanentlyDelete(copy);
    awaitChips(ns, shared, original, Set.of());
    assertEquals(Set.of(original.getId()), sourceIds(shared));
  }

  @Test
  void permanentlyDeletingTheAnchorMovesItsSharedMemoryToTheCopy(TestNamespace ns)
      throws Exception {
    String text = "Moved anchor " + ns.shortPrefix();
    ContextFile original = file(ns, "deleted-original", text);
    runFile(original);
    ContextFile copy = file(ns, "surviving-copy", text);
    runFile(copy);
    ContextMemory shared = extracted(original.getEntityReference()).getFirst();
    awaitChips(ns, shared, original, Set.of(copy.getId()));

    permanentlyDelete(original);

    awaitChips(ns, shared, copy, Set.of());
    assertEquals(Set.of(copy.getId()), sourceIds(shared));
  }

  /** The run's own memories are never created; the ones the file had go to the Archive with it. */
  @Test
  void archivingDuringExtractionLeavesNoLiveOrphans(TestNamespace ns) throws Exception {
    ContextFile file = file(ns, "archived-mid-run", "Mid-run definition " + ns.shortPrefix());
    ContextMemory earlier =
        persistedPill(file, "What did the earlier content define?", "Earlier " + ns.shortPrefix());
    ns.trackRoot(Entity.CONTEXT_MEMORY, earlier.getId());
    duringDerivation =
        () -> assertDoesNotThrow(() -> RestClient.admin().delete(FILES, file.getId()));

    runFileJobToItsEnd(file);

    assertTrue(extracted(file.getEntityReference()).isEmpty(), "no live memory is left behind");
    assertEquals(List.of(earlier.getId()), memoriesLinkedTo(file));
    assertArchived(ns, earlier);
  }

  @Test
  void uploadIdenticalToAnArchivedDocumentDoesNotReuseItsMemories(TestNamespace ns)
      throws Exception {
    String text = "Archived original " + ns.shortPrefix();
    ContextFile original = file(ns, "archived-original", text);
    runFile(original);
    ContextMemory archived = extracted(original.getEntityReference()).getFirst();
    RestClient.admin().delete(FILES, original.getId());

    ContextFile copy = file(ns, "later-copy", text);
    runFile(copy);

    ContextMemory fresh = extracted(copy.getEntityReference()).getFirst();
    assertNotEquals(archived.getId(), fresh.getId());
    assertEquals(2, calls.get(), "the copy is extracted rather than served from the Archive");
    assertSource(fresh, copy.getEntityReference(), ContextMemorySourceType.FILE_EXTRACTION);
    assertEquals(Set.of(original.getId()), sourceIds(archived));
    assertArchived(ns, archived);
  }

  /** The same memories come back with a person's edit and their usage, and nothing is re-extracted. */
  @Test
  void restoringAnArchivedDocumentBringsBackItsMemories(TestNamespace ns) throws Exception {
    ContextFile file = file(ns, "restored", "Restored definition " + ns.shortPrefix());
    runFile(file);
    ContextMemory memory = extracted(file.getEntityReference()).getFirst();
    ContextMemory edited = editAnswer(memory, "Edited by a person " + ns.shortPrefix());
    Entity.getCollectionDAO()
        .contextMemoryDAO()
        .recordUsage(memory.getId(), System.currentTimeMillis());
    ContextMemory beforeArchive = readMemory(memory);
    ContextFile fileBeforeArchive = readFile(file);
    RestClient.admin().delete(FILES, file.getId());
    assertArchived(ns, memory);

    RestClient.admin().restore(FILES, file.getId(), ContextFile.class);

    assertEquals(List.of(memory.getId()), ids(extracted(file.getEntityReference())));
    ContextMemory restored = readMemory(memory);
    assertEquals(beforeArchive.getEntityStatus(), restored.getEntityStatus());
    assertEquals(edited.getAnswer(), restored.getAnswer());
    assertEquals(beforeArchive.getUsageCount(), restored.getUsageCount());
    ContextFile restoredFile = readFile(file);
    assertEquals(fileBeforeArchive.getMemoryCount(), restoredFile.getMemoryCount());
    assertEquals(fileBeforeArchive.getProcessingStatus(), restoredFile.getProcessingStatus());
    assertNull(Entity.getJobDAO().findPendingMemoryJobId(fileJobKey(file)), "nothing re-extracts");
    assertEquals(1, calls.get());
    awaitChips(ns, memory, file, Set.of());
  }

  @Test
  void restoringANonLastCopyShowsItsMemoriesAgain(TestNamespace ns) throws Exception {
    String text = "Restored copy " + ns.shortPrefix();
    ContextFile original = file(ns, "kept-original", text);
    runFile(original);
    ContextFile copy = file(ns, "restored-copy", text);
    runFile(copy);
    ContextMemory shared = extracted(copy.getEntityReference()).getFirst();
    RestClient.admin().delete(FILES, copy.getId());
    awaitChips(ns, shared, original, Set.of());

    RestClient.admin().restore(FILES, copy.getId(), ContextFile.class);

    awaitChips(ns, shared, original, Set.of(copy.getId()));
    assertEquals(List.of(shared.getId()), ids(extracted(copy.getEntityReference())));
    assertEquals(1, readFile(copy).getMemoryCount());
  }

  /** The org-wide copy that took the anchor keeps it, and the restored file is a source again. */
  @Test
  void restoringTheFormerAnchorLeavesTheAnchorOnAnOrgWideCopy(TestNamespace ns) throws Exception {
    String text = "Former anchor " + ns.shortPrefix();
    ContextFile original = file(ns, "former-anchor", text);
    runFile(original);
    ContextFile copy = file(ns, "org-wide-copy", text);
    runFile(copy);
    ContextMemory shared = extracted(original.getEntityReference()).getFirst();
    RestClient.admin().delete(FILES, original.getId());
    awaitChips(ns, shared, copy, Set.of());

    RestClient.admin().restore(FILES, original.getId(), ContextFile.class);

    awaitChips(ns, shared, copy, Set.of(original.getId()));
    assertEquals(copy.getId(), storedAnchor(shared).getId());
  }

  /**
   * A private copy holds the anchor only while no org-wide source is live, and is never named among
   * the memory's related entities.
   */
  @Test
  void restoringAnOrgWideFileTakesTheAnchorBackFromAPrivateCopy(TestNamespace ns) throws Exception {
    String text = "Anchor back " + ns.shortPrefix();
    ContextFile original = file(ns, "org-wide-original", text);
    runFile(original);
    ContextFile copy = file(ns, "private-copy", text, privately());
    runFile(copy);
    ContextMemory shared = extracted(original.getEntityReference()).getFirst();
    awaitChips(ns, shared, original, Set.of());
    RestClient.admin().delete(FILES, original.getId());
    awaitChips(ns, shared, copy, Set.of());

    RestClient.admin().restore(FILES, original.getId(), ContextFile.class);

    awaitChips(ns, shared, original, Set.of());
    assertEquals(original.getId(), storedAnchor(shared).getId());
    assertEquals(Set.of(original.getId(), copy.getId()), sourceIds(shared));
  }

  /**
   * Permanently deleting the archived anchor moves the memory's anchor edge to the other archived
   * copy, but its stored anchor still names the deleted file until that copy is restored.
   */
  @Test
  void restoringAfterTheArchivedAnchorIsDeletedRepairsTheStoredAnchor(TestNamespace ns)
      throws Exception {
    String text = "Anchor moved in the Archive " + ns.shortPrefix();
    ContextFile kept = file(ns, "kept-copy", text);
    runFile(kept);
    ContextFile deleted = file(ns, "deleted-copy", text);
    runFile(deleted);
    ContextMemory shared = extracted(kept.getEntityReference()).getFirst();
    RestClient.admin().delete(FILES, kept.getId());
    RestClient.admin().delete(FILES, deleted.getId());
    permanentlyDelete(deleted);
    assertArchived(ns, shared);

    RestClient.admin().restore(FILES, kept.getId(), ContextFile.class);

    awaitChips(ns, shared, kept, Set.of());
    assertEquals(kept.getId(), storedAnchor(shared).getId());
  }

  /**
   * Archiving the org-wide anchor after an org-wide copy leaves the anchor on a private copy, whose
   * owners alone see the memory. Restoring the org-wide copy, until then a related source, gives
   * its readers the memory back.
   */
  @Test
  void restoringAnOrgWideCopyTakesTheAnchorFromAPrivateOneForItsReaders(TestNamespace ns)
      throws Exception {
    String text = "Readers of the copy " + ns.shortPrefix();
    ContextFile anchor = file(ns, "org-wide-anchor", text);
    runFile(anchor);
    ContextFile copy = file(ns, "org-wide-copy", text);
    runFile(copy);
    ContextFile privateCopy = file(ns, "private-copy", text, privately());
    runFile(privateCopy);
    ContextMemory shared = extracted(anchor.getEntityReference()).getFirst();
    RestClient.admin().delete(FILES, copy.getId());
    RestClient.admin().delete(FILES, anchor.getId());
    awaitChips(ns, shared, privateCopy, Set.of());
    assertEquals(
        403,
        assertThrows(OpenMetadataException.class, () -> readAsAnotherUser(shared)).getStatusCode());

    RestClient.admin().restore(FILES, copy.getId(), ContextFile.class);

    awaitChips(ns, shared, copy, Set.of());
    assertEquals(shared.getId(), readAsAnotherUser(shared).getId());
  }

  /**
   * Archiving and restoring the disputed memory's file moves its anchor twice, which changes who may
   * read it but not what it says: a review detected before is still decided after.
   */
  @Test
  void aReviewDetectedBeforeAnArchiveAndRestoreIsDecidedAfterThem(TestNamespace ns)
      throws Exception {
    String text = "Disputed definition " + ns.shortPrefix();
    ContextFile original = file(ns, "disputed-original", text);
    runFile(original);
    ContextFile privateCopy = file(ns, "disputed-copy", text, privately());
    runFile(privateCopy);
    ContextMemory disputed = extracted(original.getEntityReference()).getFirst();
    ContextMemory reviewed = heldInReviewAgainst(ns, disputed);
    Long contentClock = readMemory(disputed).getLastContentUpdatedAt();
    RestClient.admin().delete(FILES, original.getId());
    awaitChips(ns, disputed, privateCopy, Set.of());
    RestClient.admin().restore(FILES, original.getId(), ContextFile.class);
    awaitChips(ns, disputed, original, Set.of());

    Task decided =
        SdkClients.adminClient()
            .tasks()
            .resolve(
                openReviewOf(reviewed).toString(),
                new ResolveTask()
                    .withTransitionId("approve")
                    .withResolutionType(TaskResolutionType.Approved));

    assertEquals(TaskEntityStatus.Approved, decided.getStatus());
    ContextMemory superseded = readMemory(disputed);
    assertEquals(ContextMemoryStatus.SUPERSEDED, superseded.getEntityStatus());
    assertEquals(contentClock, superseded.getLastContentUpdatedAt());
  }

  /** A person moving the anchor changes what the memory is about, so its content clock moves. */
  @Test
  void aPersonMovingTheAnchorMovesTheContentClock(TestNamespace ns) throws Exception {
    ContextFile file = file(ns, "first-anchor", "Anchored definition " + ns.shortPrefix());
    runFile(file);
    ContextFile other = file(ns, "second-anchor", "Other definition " + ns.shortPrefix());
    ContextMemory memory = extracted(file.getEntityReference()).getFirst();
    ContextMemory before =
        RestClient.admin().getById(MEMORIES, memory.getId(), "primaryEntity", ContextMemory.class);

    ContextMemory moved =
        RestClient.admin()
            .patch(
                MEMORIES,
                memory.getId(),
                JsonUtils.pojoToJson(before),
                JsonUtils.deepCopy(before, ContextMemory.class)
                    .withPrimaryEntity(other.getEntityReference()),
                ContextMemory.class);

    assertEquals(
        other.getId(),
        RestClient.admin()
            .getById(MEMORIES, memory.getId(), "primaryEntity", ContextMemory.class)
            .getPrimaryEntity()
            .getId());
    assertTrue(moved.getLastContentUpdatedAt() > before.getLastContentUpdatedAt());
  }

  /**
   * The original turning private moves its memories' anchor to the org-wide copy, whose readers see
   * nothing naming the original; its admins still see them, and opened again it is a source again.
   */
  @Test
  void aCopyKeepsReusedMemoriesWhenTheOriginalTurnsPrivate(TestNamespace ns) throws Exception {
    extractor = twoFacts();
    String text = "Turned private " + ns.shortPrefix();
    ContextFile original = file(ns, "original-turned-private", text);
    runFile(original);
    ContextFile copy = fileOwnedBy(ns, "org-wide-copy", text, null);
    runFile(copy);
    List<ContextMemory> shared = extracted(original.getEntityReference());
    assertEquals(2, shared.size());
    assertEquals(Set.copyOf(ids(shared)), Set.copyOf(ids(extracted(copy.getEntityReference()))));

    share(original, privately());

    for (OpenMetadataClient reader : List.of(SdkClients.user2Client(), SdkClients.user3Client())) {
      shared.forEach(memory -> assertReadAnchoredOn(reader, memory, copy, original));
      assertListedFrom(reader, copy, ids(shared), original);
      assertEquals(2, memoryCountAs(reader, copy));
    }
    assertListedFrom(SdkClients.adminClient(), original, ids(shared), null);
    assertEquals(2, readFile(original).getMemoryCount());
    shared.forEach(memory -> assertEquals(copy.getId(), storedAnchor(memory).getId()));

    share(original, orgWide());

    shared.forEach(memory -> awaitChips(ns, memory, copy, Set.of(original.getId())));
  }

  /**
   * With no org-wide source left, the private copy gets its own copy of each memory, saying the same
   * in the same stage; toggling the original makes no more, and a restricted-to-restricted edit none.
   */
  @Test
  void restrictedCopiesGetTheirOwnCopiesWhenNoOrgWideSourceRemains(TestNamespace ns)
      throws Exception {
    extractor = twoFacts();
    String text = "No org-wide source left " + ns.shortPrefix();
    ContextFile original = file(ns, "original-keeps-its-own", text);
    runFile(original);
    ContextFile copy = fileOwnedBy(ns, "private-copy", text, privately());
    runFile(copy);
    List<ContextMemory> originals = extracted(original.getEntityReference());
    assertEquals(Set.copyOf(ids(originals)), Set.copyOf(ids(extracted(copy.getEntityReference()))));

    share(original, privately());

    List<ContextMemory> copies = extracted(copy.getEntityReference());
    assertCopiesOf(originals, copies, copy);
    assertEquals(
        Set.copyOf(ids(originals)), Set.copyOf(ids(extracted(original.getEntityReference()))));
    copies.forEach(
        memory -> assertReadAnchoredOn(SdkClients.user2Client(), memory, copy, original));
    originals.forEach(memory -> assertHiddenFrom(SdkClients.user2Client(), memory));
    assertEquals(2, readFile(original).getMemoryCount());
    assertEquals(2, readFile(copy).getMemoryCount());
    assertEquals(1, calls.get(), "a copy is made without extracting anything");

    share(original, orgWide());
    share(original, privately());
    List<Double> versions = versionsOf(originals);
    share(original, sharedWith(SharedEntities.get().USER3_REF));

    assertEquals(Set.copyOf(ids(copies)), Set.copyOf(ids(extracted(copy.getEntityReference()))));
    assertEquals(
        Set.copyOf(ids(originals)), Set.copyOf(ids(extracted(original.getEntityReference()))));
    assertEquals(
        versions, versionsOf(originals), "a restricted file shared otherwise moves nothing");
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
    long id = claimFileJob(file);
    new ContextMemoryExtractionJobHandler().runJob(jobs.fetchJobById(id).orElseThrow());
    assertEquals(
        ProcessingStatus.Processed,
        fileRepository()
            .get(null, file.getId(), fileRepository().getFields(""), Include.NON_DELETED, false)
            .getProcessingStatus());
    long now = System.currentTimeMillis();
    jobs.completeJob(id, BackgroundJob.Status.COMPLETED.name(), "{}", "extracted", 1, 1, now, now);
  }

  /** Runs the file's job as the worker would, whether it completes or fails. */
  private void runFileJobToItsEnd(ContextFile file) {
    JobDAO jobs = Entity.getJobDAO();
    long id = claimFileJob(file);
    BackgroundJob.Status outcome = BackgroundJob.Status.COMPLETED;
    try {
      new ContextMemoryExtractionJobHandler().runJob(jobs.fetchJobById(id).orElseThrow());
    } catch (BackgroundJobException failed) {
      outcome = BackgroundJob.Status.FAILED;
    }
    jobs.updateJobStatus(id, outcome);
  }

  private long claimFileJob(ContextFile file) {
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
    return id;
  }

  /** The Archive's permanent delete, which runs asynchronously. */
  private void permanentlyDelete(ContextFile file) {
    try (Response response =
        RestClient.admin().rawDelete(FILES + "/" + file.getId() + "?hardDelete=true")) {
      assertEquals(202, response.getStatus());
    }
    await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(() -> assertGone(FILES + "/" + file.getId()));
  }

  private static MemoryShareConfig privately() {
    return new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE);
  }

  /** The memory as read by a user who owns none of the files. */
  private static ContextMemory readAsAnotherUser(ContextMemory memory) {
    return SdkClients.user2Client()
        .getHttpClient()
        .execute(HttpMethod.GET, "/" + MEMORIES + "/" + memory.getId(), null, ContextMemory.class);
  }

  private static MemoryShareConfig orgWide() {
    return new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY);
  }

  private static MemoryShareConfig sharedWith(EntityReference reader) {
    return new MemoryShareConfig()
        .withVisibility(MemoryVisibility.SHARED)
        .withSharedWith(List.of(new MemorySharedPrincipal().withPrincipal(reader)));
  }

  private List<Double> versionsOf(List<ContextMemory> memories) throws Exception {
    List<Double> versions = new ArrayList<>();
    for (ContextMemory memory : memories) {
      versions.add(readMemory(memory).getVersion());
    }
    return versions;
  }

  /** Every document states two facts, so a copy shares more than one memory. */
  private DocumentMemoryExtractor twoFacts() {
    return (text, source, type) -> {
      calls.incrementAndGet();
      List<ContextMemory> pills =
          List.of(
              pill(text, source, type),
              pill(text, source, type).withQuestion("Which other fact does this source state?"));
      return new DocumentMemoryExtractor.DeriveResult(pills, 1, 1);
    };
  }

  /** A file owned by the shared user that {@link SdkClients#user2Client()} signs in as. */
  private ContextFile fileOwnedBy(
      TestNamespace ns, String label, String text, MemoryShareConfig shareConfig) throws Exception {
    return file(ns, label, text, shareConfig, List.of(SharedEntities.get().USER2_REF));
  }

  /** An admin changes who may read the file, as the share dialog does. */
  private static void share(ContextFile file, MemoryShareConfig shareConfig) throws Exception {
    ContextFile current =
        RestClient.admin().getById(FILES, file.getId(), "owners", ContextFile.class);
    RestClient.admin()
        .patch(
            FILES,
            file.getId(),
            JsonUtils.pojoToJson(current),
            JsonUtils.deepCopy(current, ContextFile.class).withShareConfig(shareConfig),
            ContextFile.class);
  }

  /**
   * The reader may read the memory, anchored on and showing {@code anchor}. Neither the memory, its
   * latest change nor its latest version names {@code unnamed}; older versions may.
   */
  private static void assertReadAnchoredOn(
      OpenMetadataClient reader, ContextMemory memory, ContextFile anchor, ContextFile unnamed) {
    String path = "/" + MEMORIES + "/" + memory.getId();
    String read =
        reader
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, path + "?fields=sourceEntity,relatedEntities,primaryEntity", null);
    JsonNode readMemory = JsonUtils.readTree(read);
    assertEquals(anchor.getId().toString(), readMemory.path("primaryEntity").path("id").asText());
    assertEquals(anchor.getId().toString(), readMemory.path("sourceEntity").path("id").asText());
    assertFalse(relatedIds(readMemory).contains(unnamed.getId()));
    assertFalse(read.contains(unnamed.getName()), "the memory does not name " + unnamed.getName());
    JsonNode versions =
        JsonUtils.readTree(
            reader.getHttpClient().executeForString(HttpMethod.GET, path + "/versions", null));
    assertFalse(
        versions.path("versions").get(0).toString().contains(unnamed.getName()),
        "the latest version does not name " + unnamed.getName());
  }

  /** The document's memory panel, as the reader lists it, holds exactly {@code expected}. */
  private static void assertListedFrom(
      OpenMetadataClient reader, ContextFile document, List<UUID> expected, ContextFile unnamed) {
    String listed =
        reader
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/"
                    + MEMORIES
                    + "?sourceEntityId="
                    + document.getId()
                    + "&fields=owners,sourceEntity,derivedEntities&limit=50",
                null);
    Set<UUID> listedIds =
        StreamSupport.stream(JsonUtils.readTree(listed).path("data").spliterator(), false)
            .map(memory -> UUID.fromString(memory.path("id").asText()))
            .collect(Collectors.toSet());
    assertEquals(Set.copyOf(expected), listedIds);
    assertTrue(unnamed == null || !listed.contains(unnamed.getName()), "the panel names nothing");
  }

  private static int memoryCountAs(OpenMetadataClient reader, ContextFile file) {
    return reader
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/" + FILES + "/" + file.getId() + "?fields=memoryCount",
            null,
            ContextFile.class)
        .getMemoryCount();
  }

  private static void assertHiddenFrom(OpenMetadataClient reader, ContextMemory memory) {
    OpenMetadataException refused =
        assertThrows(
            OpenMetadataException.class,
            () ->
                reader
                    .getHttpClient()
                    .execute(
                        HttpMethod.GET,
                        "/" + MEMORIES + "/" + memory.getId(),
                        null,
                        ContextMemory.class));
    assertEquals(403, refused.getStatusCode());
  }

  /** One new memory per original, saying the same in the same stage, anchored on {@code file}. */
  private void assertCopiesOf(
      List<ContextMemory> originals, List<ContextMemory> copies, ContextFile file) {
    assertEquals(originals.size(), copies.size());
    for (ContextMemory original : originals) {
      ContextMemory copy =
          copies.stream()
              .filter(candidate -> original.getQuestion().equals(candidate.getQuestion()))
              .findFirst()
              .orElseThrow();
      assertNotEquals(original.getId(), copy.getId());
      assertEquals(original.getAnswer(), copy.getAnswer());
      assertEquals(original.getEntityStatus(), copy.getEntityStatus());
      assertSource(copy, file.getEntityReference(), original.getSourceType());
    }
  }

  /** A memory held in review for contradicting {@code disputed}, as reconciliation holds one. */
  private ContextMemory heldInReviewAgainst(TestNamespace ns, ContextMemory disputed)
      throws Exception {
    ContextMemory reviewed =
        RestClient.admin()
            .create(
                MEMORIES,
                new CreateContextMemory()
                    .withName(ns.prefix("reviewed"))
                    .withTitle(ns.prefix("reviewed"))
                    .withQuestion(disputed.getQuestion())
                    .withAnswer("A contradicting answer " + ns.shortPrefix()),
                ContextMemory.class);
    ns.trackRoot(Entity.CONTEXT_MEMORY, reviewed.getId());
    ContextMemory current = readMemory(reviewed);
    return RestClient.admin()
        .patch(
            MEMORIES,
            reviewed.getId(),
            JsonUtils.pojoToJson(current),
            JsonUtils.deepCopy(current, ContextMemory.class)
                .withEntityStatus(ContextMemoryStatus.DRAFT)
                .withDisputes(
                    List.of(
                        new MemoryDispute()
                            .withMemory(disputed.getEntityReference())
                            .withReason("The two answers differ"))),
            ContextMemory.class);
  }

  /** The id of the memory's open conflict review. */
  private static UUID openReviewOf(ContextMemory memory) {
    return SdkClients.adminClient()
        .tasks()
        .listWithFilters(
            Map.of(
                "aboutEntity", memory.getFullyQualifiedName(),
                "type", TaskEntityType.MemoryConflictReview.value(),
                "status", TaskEntityStatus.Open.value(),
                "fields", "about"))
        .getData()
        .stream()
        .filter(task -> memory.getId().equals(task.getAbout().getId()))
        .map(Task::getId)
        .findFirst()
        .orElseThrow();
  }

  /** A person's edit through the API, as the memory dialog makes it. */
  private ContextMemory editAnswer(ContextMemory memory, String answer) throws Exception {
    ContextMemory current = readMemory(memory);
    return RestClient.admin()
        .patch(
            MEMORIES,
            memory.getId(),
            JsonUtils.pojoToJson(current),
            JsonUtils.deepCopy(current, ContextMemory.class).withAnswer(answer),
            ContextMemory.class);
  }

  private ContextMemory readMemory(ContextMemory memory) throws Exception {
    return RestClient.admin().getById(MEMORIES, memory.getId(), "", ContextMemory.class);
  }

  private ContextFile readFile(ContextFile file) throws Exception {
    return RestClient.admin().getById(FILES, file.getId(), "memoryCount", ContextFile.class);
  }

  private static List<UUID> ids(List<ContextMemory> memories) {
    return memories.stream().map(ContextMemory::getId).toList();
  }

  private static String fileJobKey(ContextFile file) {
    return ContextMemoryExtractionJobHandler.Args.file(
            file.getId(), UUID.fromString(file.getHeadContentId()))
        .jobKey();
  }

  /** The anchor the memory's row stores; a read names the one its anchor edge points to. */
  private EntityReference storedAnchor(ContextMemory memory) {
    return memoryRepository().find(memory.getId(), Include.NON_DELETED, false).getPrimaryEntity();
  }

  /** Every file linked to the memory as a source, archived ones included. */
  private Set<UUID> sourceIds(ContextMemory memory) {
    return memoryRepository()
        .findFrom(
            memory.getId(),
            Entity.CONTEXT_MEMORY,
            Relationship.MENTIONED_IN,
            Entity.CONTEXT_FILE,
            Include.ALL)
        .stream()
        .map(EntityReference::getId)
        .collect(Collectors.toSet());
  }

  /** Every memory linked to the file, archived ones included. */
  private List<UUID> memoriesLinkedTo(ContextFile file) {
    return memoryRepository()
        .findTo(
            file.getId(),
            Entity.CONTEXT_FILE,
            Relationship.MENTIONED_IN,
            Entity.CONTEXT_MEMORY,
            Include.ALL)
        .stream()
        .map(EntityReference::getId)
        .toList();
  }

  /** Archived: only an include=all read finds it, and search lists it among deleted memories. */
  private void assertArchived(TestNamespace ns, ContextMemory memory) {
    String path = "v1/contextCenter/memories/" + memory.getId();
    assertNotFound(path);
    try (Response archived = RestClient.admin().rawGet(path + "?include=all")) {
      assertEquals(200, archived.getStatus());
      assertTrue(JsonUtils.readTree(archived.readEntity(String.class)).get("deleted").asBoolean());
    }
    await()
        .atMost(Duration.ofSeconds(60))
        .ignoreExceptions()
        .untilAsserted(() -> assertNotNull(listedMemory(ns, memory, Include.DELETED)));
    assertNull(listedMemory(ns, memory, Include.NON_DELETED));
  }

  /** Waits until the search-backed Memories page shows the memory's anchor and related sources. */
  private void awaitChips(
      TestNamespace ns, ContextMemory memory, ContextFile anchor, Set<UUID> related) {
    await()
        .atMost(Duration.ofSeconds(60))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              JsonNode listed = listedMemory(ns, memory, Include.NON_DELETED);
              assertNotNull(listed, "the memory is listed");
              assertEquals(
                  anchor.getId().toString(), listed.path("primaryEntity").path("id").asText());
              assertEquals(related, relatedIds(listed));
            });
  }

  /** The memory as the search-backed listing shows it, or null; an offset selects that listing. */
  private JsonNode listedMemory(TestNamespace ns, ContextMemory memory, Include include) {
    String path =
        "v1/contextCenter/memories?offset=0&limit=25&q="
            + ns.shortPrefix()
            + "&include="
            + include.value();
    try (Response response = RestClient.admin().rawGet(path)) {
      assertEquals(200, response.getStatus());
      JsonNode data = JsonUtils.readTree(response.readEntity(String.class)).path("data");
      return StreamSupport.stream(data.spliterator(), false)
          .filter(listed -> memory.getId().toString().equals(listed.path("id").asText()))
          .findFirst()
          .orElse(null);
    }
  }

  private static Set<UUID> relatedIds(JsonNode listed) {
    return StreamSupport.stream(listed.path("relatedEntities").spliterator(), false)
        .map(related -> UUID.fromString(related.path("id").asText()))
        .collect(Collectors.toSet());
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

  private ContextFile file(
      TestNamespace ns, String label, String text, MemoryShareConfig shareConfig) throws Exception {
    return file(ns, label, text, shareConfig, null);
  }

  private ContextFile file(
      TestNamespace ns,
      String label,
      String text,
      MemoryShareConfig shareConfig,
      List<EntityReference> owners)
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
                        .withShareConfig(shareConfig)
                        .withOwners(owners)
                        .withProcessingStatus(ProcessingStatus.ExtractingContext)
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

  private List<ContextMemory> extracted(EntityReference source) {
    List<ContextMemory> memories =
        memoryRepository().listExtractedMemories(source.getId(), source.getType());
    memories.stream()
        .filter(memory -> trackedMemories.add(memory.getId()))
        .forEach(memory -> namespace.trackRoot(Entity.CONTEXT_MEMORY, memory.getId()));
    return memories;
  }

  private void assertGone(String path) {
    assertNotFound(path + "?include=all");
  }

  private void assertNotFound(String path) {
    OpenMetadataException failure =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.adminClient()
                    .getHttpClient()
                    .execute(HttpMethod.GET, "/" + path, null, Object.class));
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
