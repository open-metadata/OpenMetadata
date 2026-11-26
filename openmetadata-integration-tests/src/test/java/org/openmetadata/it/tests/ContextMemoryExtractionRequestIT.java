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

package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Proxy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.apache.commons.codec.digest.DigestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.ExtractionAvailability;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
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
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageProcessingStatus;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.entity.data.QuickLink;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
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
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.jobs.GenericBackgroundWorker;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.llm.NoopCompletionClient;
import org.openmetadata.service.resources.drive.ContextFileResource;
import org.openmetadata.service.search.SearchRepository;

/**
 * A document's owners, an owning team's members and admins extract or retry its memories, one run
 * at a time, and anyone signed in reads whether extraction is available. Jobs run by hand: the
 * background worker is paused so each request's state can be read before its run.
 */
@Isolated("Replaces the embedded server's AI provider and pauses its background worker")
@ExtendWith(TestNamespaceExtension.class)
class ContextMemoryExtractionRequestIT {
  private static final String FILES = "v1/contextCenter/drive/files";
  private static final String FOLDERS = "v1/contextCenter/drive/folders";
  private static final String PAGES = "v1/contextCenter/pages";
  private static final String AVAILABILITY = "v1/contextCenter/memories/extractionAvailability";
  private static final String NEVER_EXTRACTED = "neverExtracted";
  private static final String OWNERS_OR_ADMINS =
      "Only the document's owners or an admin can extract its memories.";
  private static final String ALREADY_REQUESTED =
      "This document's memories are already queued or being extracted.";
  private static final String NOT_EXTRACTABLE =
      "Only a document that failed or whose memories were never extracted can be extracted.";
  private static final String PARTIAL_RUN =
      "Knowledge pill extraction did not process every source chunk";
  private static final String QUEUE_FAILED = "Memory extraction could not be queued.";
  private static final Duration SEARCH_TIMEOUT = Duration.ofSeconds(60);
  private static final ExtractionAvailability AVAILABLE =
      new ExtractionAvailability().withAvailable(true);

  private final AtomicReference<ExtractionAvailability> availability =
      new AtomicReference<>(AVAILABLE);
  private final AtomicBoolean partialRuns = new AtomicBoolean();
  private final Set<UUID> trackedMemories = new HashSet<>();
  private final List<UUID> folders = new ArrayList<>();
  private AiProvider previousProvider;
  private DocumentMemoryExtractor extractor;
  private GenericBackgroundWorker worker;
  private TestNamespace namespace;
  private SearchClient search;

  private record Reply(int status, String body) {}

  @BeforeEach
  void installScriptedProvider(TestNamespace ns) {
    namespace = ns;
    worker = TestSuiteBootstrap.findManagedObject(GenericBackgroundWorker.class).orElseThrow();
    worker.stop();
    previousProvider = AiProviderHolder.get();
    DocumentMemoryExtractor extractor =
        (text, source, type) ->
            new DocumentMemoryExtractor.DeriveResult(
                List.of(pill(text, source, type)), partialRuns.get() ? 2 : 1, 1);
    AiProviderHolder.setForTesting(
        new AiProvider() {
          @Override
          public DocumentMemoryExtractor documentExtractor() {
            return extractor;
          }

          @Override
          public ExtractionAvailability extractionAvailability() {
            return availability.get();
          }
        });
    LLMClientHolder.setForTesting(new NoopCompletionClient());
    this.extractor = extractor;
    installPageWorker(jobs());
    search = new SearchClient(OssTestServer.defaultHandle());
  }

  private void installPageWorker(JobDAO queue) {
    PageContextProcessingEngineHolder.setForTesting(
        new PageContextProcessingEngine(
            (KnowledgePageRepository) Entity.getEntityRepository(Entity.PAGE),
            extractor,
            new ContextMemoryReconciler(memoryRepository()),
            queue,
            0L));
  }

  @AfterEach
  void restoreProviders(TestNamespace ns) throws Exception {
    try {
      NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
      for (UUID folder : folders) {
        RestClient.admin().hardDelete(FOLDERS, folder);
      }
    } finally {
      AiProviderHolder.setForTesting(previousProvider);
      PageContextProcessingEngineHolder.setForTesting(null);
      LLMClientHolder.initialize(LlmConfigHolder.get());
      if (worker != null) worker.start();
    }
  }

  @Test
  void ownerRetriesAFailedFile(TestNamespace ns) throws Exception {
    ContextFile file = file(ns, "failed", ProcessingStatus.ExtractingContext, ownerRef(), null);
    failMemoryRun(queuedMemoryRun(file));
    ContextFile failed = read(file);
    assertEquals(ProcessingStatus.Failed, failed.getProcessingStatus());
    assertEquals(PARTIAL_RUN, failed.getProcessingError());

    ContextFile requested = accepted(extract(asOwner(), FILES, file.getId()), ContextFile.class);

    assertEquals(ProcessingStatus.ExtractingContext, requested.getProcessingStatus());
    assertNull(requested.getProcessingError());
    assertEquals(Boolean.FALSE, requested.getNeverExtracted());
    assertEquals(
        failed.getExtractedText(), requested.getExtractedText(), "the kept text is reused");
    assertEquals(failed.getUpdatedBy(), requested.getUpdatedBy(), "stamped as its last editor");
    assertEquals(List.of(owner().getName()), ownerNames(requested));
    assertEquals(1, jobs().countInFlightMemoryJobs(fileJob(file), true));

    runQueued(fileJob(file));
    ContextFile retried = read(file);
    assertEquals(ProcessingStatus.Processed, retried.getProcessingStatus());
    assertNotNull(retried.getExtractionStats());
    assertEquals(1, extracted(file.getEntityReference()).size());
    assertRefused(extract(asOwner(), FILES, file.getId()), 409, NOT_EXTRACTABLE);
  }

  /** As an upload leaves a file while extraction is off: its text extracted, no memories. */
  @Test
  void ownerExtractsAFileUploadedWhileExtractionWasOff(TestNamespace ns) throws Exception {
    Folder folder = folder(ns);
    ContextFile file =
        file(ns, "uploaded-while-off", ProcessingStatus.Processed, ownerRef(), folder);
    assertNeverExtracted(file, folder, true);
    indexInTheOldShape(file);
    assertFalse(searchSource(file).has(NEVER_EXTRACTED), "a document indexed before the field");
    assertEquals(Boolean.TRUE, read(file).getNeverExtracted(), "a read derives it regardless");

    ContextFile requested = accepted(extract(asOwner(), FILES, file.getId()), ContextFile.class);

    assertEquals(ProcessingStatus.ExtractingContext, requested.getProcessingStatus());
    assertEquals(Boolean.FALSE, requested.getNeverExtracted());
    assertNeverExtracted(file, folder, false);
    runQueued(fileJob(file));
    assertEquals(ProcessingStatus.Processed, read(file).getProcessingStatus());
    assertNotNull(read(file).getExtractionStats());
    assertNeverExtracted(file, folder, false);
  }

  @Test
  void nonOwnerGets403(TestNamespace ns) throws Exception {
    ContextFile file = file(ns, "not-theirs", ProcessingStatus.Processed, ownerRef(), null);

    assertRefused(extract(asNonOwner(), FILES, file.getId()), 403, OWNERS_OR_ADMINS);

    assertEquals(ProcessingStatus.Processed, read(file).getProcessingStatus());
    assertEquals(Boolean.TRUE, read(file).getNeverExtracted());
    assertEquals(0, jobs().countInFlightMemoryJobs(fileJob(file), true));
  }

  /** An admin may extract even a private file it does not own, still as its last editor. */
  @Test
  void adminCanExtractAnyFile(TestNamespace ns) throws Exception {
    ContextFile file = file(ns, "private", ProcessingStatus.Processed, ownerRef(), null);
    ContextFile edited = editedByItsOwner(file);
    assertEquals(owner().getName(), edited.getUpdatedBy());

    ContextFile requested =
        accepted(extract(RestClient.admin(), FILES, file.getId()), ContextFile.class);

    assertEquals(ProcessingStatus.ExtractingContext, requested.getProcessingStatus());
    assertEquals(owner().getName(), requested.getUpdatedBy(), "never stamped as the caller");
    assertEquals(1, jobs().countInFlightMemoryJobs(fileJob(file), true));
  }

  @Test
  void aMemberOfTheOwningTeamExtractsAFile(TestNamespace ns) throws Exception {
    User member = teamMember(ns);
    EntityReference team = member.getTeams().getFirst();
    ContextFile file = file(ns, "team-owned", ProcessingStatus.Processed, team, null);

    ContextFile requested = accepted(extract(as(member), FILES, file.getId()), ContextFile.class);

    assertEquals(ProcessingStatus.ExtractingContext, requested.getProcessingStatus());
  }

  @Test
  void aSecondRequestWhileQueuedGets409(TestNamespace ns) throws Exception {
    ContextFile file = file(ns, "requested-twice", ProcessingStatus.Processed, ownerRef(), null);
    accepted(extract(asOwner(), FILES, file.getId()), ContextFile.class);

    assertRefused(extract(asOwner(), FILES, file.getId()), 409, ALREADY_REQUESTED);
    assertRefused(extract(RestClient.admin(), FILES, file.getId()), 409, ALREADY_REQUESTED);

    assertEquals(1, jobs().countInFlightMemoryJobs(fileJob(file), true), "a single job");
  }

  /** Neither a chat attachment, Failed without a snapshot, nor a file without one is a 500. */
  @Test
  void extractWithoutASnapshotGets409(TestNamespace ns) throws Exception {
    ContextFile attachment = fileWithoutSnapshot(ns, "attachment", ProcessingStatus.Failed);
    ContextFile legacy = fileWithoutSnapshot(ns, "legacy", ProcessingStatus.Processed);

    assertRefused(extract(asOwner(), FILES, attachment.getId()), 409, NOT_EXTRACTABLE);
    assertRefused(extract(asOwner(), FILES, legacy.getId()), 409, NOT_EXTRACTABLE);
    assertEquals(ProcessingStatus.Failed, read(attachment).getProcessingStatus());
  }

  @Test
  void extractWhileUnavailableGets409WithReason(TestNamespace ns) throws Exception {
    ContextFile file = file(ns, "unavailable", ProcessingStatus.Processed, ownerRef(), null);
    availability.set(unavailable(ExtractionAvailability.Reason.ProviderUnavailable));

    assertRefused(
        extract(asOwner(), FILES, file.getId()),
        409,
        "Memory extraction is unavailable: ProviderUnavailable");

    assertEquals(Boolean.TRUE, read(file).getNeverExtracted());
    assertEquals(0, jobs().countInFlightMemoryJobs(fileJob(file), true));
  }

  @Test
  void ownerRetriesAFailedArticle(TestNamespace ns) throws Exception {
    Page page = article(ns, "failed", ownerRef());
    failMemoryRun(pageJob(page));
    Page failed = read(page);
    assertEquals(PageProcessingStatus.Failed, failed.getProcessingStatus());
    assertEquals(PARTIAL_RUN, failed.getProcessingError());

    Page requested = accepted(extract(asOwner(), PAGES, page.getId()), Page.class);

    assertEquals(PageProcessingStatus.Queued, requested.getProcessingStatus());
    assertNull(requested.getProcessingError(), "the failure's error goes with it");
    assertEquals(Boolean.FALSE, requested.getNeverExtracted());
    assertEquals(failed.getUpdatedBy(), requested.getUpdatedBy(), "stamped as its last editor");
    assertEquals(
        List.of(owner().getName()),
        requested.getOwners().stream().map(EntityReference::getName).toList());
    assertEquals(1, jobs().countInFlightMemoryJobs(pageJob(page), true));

    runQueued(pageJob(page));
    Page retried = read(page);
    assertEquals(PageProcessingStatus.Processed, retried.getProcessingStatus());
    assertNull(retried.getProcessingError());
    assertEquals(1, extracted(page.getEntityReference()).size());
  }

  @Test
  void ownerExtractsAnArticleWrittenWhileExtractionWasOff(TestNamespace ns) throws Exception {
    Page page = articleWrittenWhileOff(ns, "written-while-off");
    assertNull(read(page).getProcessingStatus());
    assertEquals(Boolean.TRUE, read(page).getNeverExtracted());

    Page requested = accepted(extract(asOwner(), PAGES, page.getId()), Page.class);

    assertEquals(PageProcessingStatus.Queued, requested.getProcessingStatus());
    assertEquals(Boolean.FALSE, requested.getNeverExtracted());
    assertEquals(Boolean.FALSE, read(page).getNeverExtracted());
    runQueued(pageJob(page));
    assertEquals(PageProcessingStatus.Processed, read(page).getProcessingStatus());
    assertEquals(Boolean.FALSE, read(page).getNeverExtracted());
    assertRefused(extract(asOwner(), PAGES, page.getId()), 409, NOT_EXTRACTABLE);
  }

  @Test
  void nonOwnerGets403ForAnArticle(TestNamespace ns) throws Exception {
    Page page = articleWrittenWhileOff(ns, "not-theirs");

    assertRefused(extract(asNonOwner(), PAGES, page.getId()), 403, OWNERS_OR_ADMINS);

    assertEquals(Boolean.TRUE, read(page).getNeverExtracted());
    assertEquals(0, jobs().countInFlightMemoryJobs(pageJob(page), true));
  }

  @Test
  void adminCanExtractAnyArticle(TestNamespace ns) throws Exception {
    Page page = articleWrittenWhileOff(ns, "admin-extracts");

    Page requested = accepted(extract(RestClient.admin(), PAGES, page.getId()), Page.class);

    assertEquals(PageProcessingStatus.Queued, requested.getProcessingStatus());
    assertEquals(1, jobs().countInFlightMemoryJobs(pageJob(page), true));
  }

  @Test
  void aMemberOfTheOwningTeamExtractsAnArticle(TestNamespace ns) throws Exception {
    User member = teamMember(ns);
    Page page = article(ns, "team-owned", member.getTeams().getFirst());
    failMemoryRun(pageJob(page));

    Page requested = accepted(extract(as(member), PAGES, page.getId()), Page.class);

    assertEquals(PageProcessingStatus.Queued, requested.getProcessingStatus());
  }

  @Test
  void aSecondRequestForAQueuedArticleGets409(TestNamespace ns) throws Exception {
    Page page = articleWrittenWhileOff(ns, "requested-twice");
    accepted(extract(asOwner(), PAGES, page.getId()), Page.class);

    assertRefused(extract(asOwner(), PAGES, page.getId()), 409, ALREADY_REQUESTED);

    assertEquals(1, jobs().countInFlightMemoryJobs(pageJob(page), true), "a single job");
  }

  /** A quick link has no body, so like a file without a snapshot it has nothing to extract. */
  @Test
  void aQuickLinkCannotBeExtracted(TestNamespace ns) throws Exception {
    Page link =
        RestClient.admin()
            .create(
                PAGES,
                new CreatePage()
                    .withName(ns.prefix("quick-link"))
                    .withPageType(PageType.QUICK_LINK)
                    .withPage(new QuickLink().withUrl(URI.create("https://open-metadata.org")))
                    .withOwners(List.of(ownerRef())),
                Page.class);
    ns.trackRoot(Entity.PAGE, link);

    assertRefused(extract(asOwner(), PAGES, link.getId()), 409, NOT_EXTRACTABLE);
  }

  /** A queue that refuses the job answers 503 and leaves the article Failed, never Queued. */
  @Test
  void aQueueThatRefusesAnArticleAnswers503AndLeavesItFailedToRetry(TestNamespace ns)
      throws Exception {
    Page page = articleWrittenWhileOff(ns, "queue-refused");
    installPageWorker(refusingPageJobs());

    assertRefused(extract(asOwner(), PAGES, page.getId()), 503, QUEUE_FAILED);

    Page failed = read(page);
    assertEquals(PageProcessingStatus.Failed, failed.getProcessingStatus());
    assertEquals(QUEUE_FAILED, failed.getProcessingError());
    assertEquals(0, jobs().countInFlightMemoryJobs(pageJob(page), true));
    installPageWorker(jobs());
    Page retried = accepted(extract(asOwner(), PAGES, page.getId()), Page.class);
    assertEquals(PageProcessingStatus.Queued, retried.getProcessingStatus());
    assertNull(retried.getProcessingError());
    assertEquals(1, jobs().countInFlightMemoryJobs(pageJob(page), true));
  }

  /** An edit whose run the queue refuses leaves the article Failed to retry, not Queued for good. */
  @Test
  void anEditWhoseRunTheQueueRefusesLeavesTheArticleFailedToRetry(TestNamespace ns)
      throws Exception {
    Page page = articleWrittenWhileOff(ns, "edit-refused");
    installPageWorker(refusingPageJobs());

    bodyEditedByItsOwner(page);

    Page failed = read(page);
    assertEquals(PageProcessingStatus.Failed, failed.getProcessingStatus());
    assertEquals(QUEUE_FAILED, failed.getProcessingError());
    assertEquals(0, jobs().countInFlightMemoryJobs(pageJob(page), true));
    installPageWorker(jobs());
    Page retried = accepted(extract(asOwner(), PAGES, page.getId()), Page.class);
    assertEquals(PageProcessingStatus.Queued, retried.getProcessingStatus());
  }

  @Test
  void extractingAnArticleWhileUnavailableGets409WithReason(TestNamespace ns) throws Exception {
    Page page = articleWrittenWhileOff(ns, "unavailable");
    availability.set(unavailable(ExtractionAvailability.Reason.ExtractionDisabled));

    assertRefused(
        extract(asOwner(), PAGES, page.getId()),
        409,
        "Memory extraction is unavailable: ExtractionDisabled");

    assertNull(read(page).getProcessingStatus());
    assertEquals(0, jobs().countInFlightMemoryJobs(pageJob(page), true));
  }

  @Test
  void anyoneSignedInReadsWhetherExtractionIsAvailable() {
    assertReply(get(asNonOwner(), AVAILABILITY), 200, "{\"available\":true}");

    availability.set(unavailable(ExtractionAvailability.Reason.ExtractionDisabled));

    assertReply(
        get(asNonOwner(), AVAILABILITY),
        200,
        "{\"available\":false,\"reason\":\"ExtractionDisabled\"}");
  }

  @Test
  void anAnonymousCallerCannotReadWhetherExtractionIsAvailable() throws Exception {
    HttpResponse<String> response =
        HttpClient.newHttpClient()
            .send(
                HttpRequest.newBuilder(URI.create(SdkClients.getServerUrl() + "/" + AVAILABILITY))
                    .GET()
                    .build(),
                HttpResponse.BodyHandlers.ofString());

    assertReply(
        new Reply(response.statusCode(), response.body()),
        401,
        "{\"code\":401,\"message\":\"Not Authorized! Token not present\"}");
  }

  private Reply extract(RestClient caller, String collection, UUID id) {
    try (Response response = caller.rawPost(collection + "/" + id + "/extract", Map.of())) {
      return new Reply(response.getStatus(), response.readEntity(String.class));
    }
  }

  private static Reply get(RestClient caller, String path) {
    try (Response response = caller.rawGet(path)) {
      return new Reply(response.getStatus(), response.readEntity(String.class));
    }
  }

  private static <T> T accepted(Reply reply, Class<T> type) {
    assertEquals(200, reply.status(), reply.body());
    return JsonUtils.readValue(reply.body(), type);
  }

  private static void assertRefused(Reply reply, int status, String message) {
    assertReply(reply, status, JsonUtils.pojoToJson(Map.of("code", status, "message", message)));
  }

  private static void assertReply(Reply reply, int status, String body) {
    assertEquals(status, reply.status(), reply.body());
    assertEquals(JsonUtils.readTree(body), JsonUtils.readTree(reply.body()));
  }

  /** Where a file stands, as a read, its folder's newest-first listing and search all show it. */
  private void assertNeverExtracted(ContextFile file, Folder folder, boolean expected)
      throws Exception {
    assertEquals(expected, read(file).getNeverExtracted(), "a read");
    assertEquals(expected, listedIn(folder, file).getNeverExtracted(), "the orderBy listing");
    await()
        .atMost(SEARCH_TIMEOUT)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              JsonNode indexed = searchSource(file).get(NEVER_EXTRACTED);
              assertNotNull(indexed, "the search document carries the field");
              assertEquals(expected, indexed.asBoolean(), "the search document");
            });
  }

  private ContextFile listedIn(Folder folder, ContextFile file) throws Exception {
    String listing =
        FILES + "?folderId=" + folder.getId() + "&orderBy=DESC&limit=10&fields=" + NEVER_EXTRACTED;
    return RestClient.admin()
        .get(listing, ContextFileResource.ContextFileList.class)
        .getData()
        .stream()
        .filter(listed -> listed.getId().equals(file.getId()))
        .findFirst()
        .orElseThrow();
  }

  /** Rewrites the file's search document as an index built before the field existed holds it. */
  private void indexInTheOldShape(ContextFile file) {
    String index = searchHit(file).path("_index").asText();
    search.post(
        "/" + index + "/_update/" + file.getId() + "?refresh=true",
        "{\"script\":{\"source\":\"ctx._source.remove('" + NEVER_EXTRACTED + "')\"}}");
  }

  private JsonNode searchSource(ContextFile file) {
    return searchHit(file).path("_source");
  }

  private JsonNode searchHit(ContextFile file) {
    SearchRepository repository = Entity.getSearchRepository();
    String index =
        repository.getIndexMapping(Entity.CONTEXT_FILE).getIndexName(repository.getClusterAlias());
    String query = "{\"query\":{\"ids\":{\"values\":[\"" + file.getId() + "\"]}}}";
    return search.search(index, query).path("hits").path("hits").path(0);
  }

  /** Claims and runs the queued memory job for {@code jobKey}, as the paused worker would. */
  private void runQueued(String jobKey) throws Exception {
    long job = claimQueued(jobKey);
    new ContextMemoryExtractionJobHandler().runJob(jobs().fetchJobById(job).orElseThrow());
    long now = System.currentTimeMillis();
    jobs()
        .completeJob(job, BackgroundJob.Status.COMPLETED.name(), "{}", "extracted", 1, 1, now, now);
  }

  /** A run that leaves a chunk unprocessed fails the document, as an outage mid-run does. */
  private void failMemoryRun(String jobKey) {
    long job = claimQueued(jobKey);
    partialRuns.set(true);
    try {
      BackgroundJob claimed = jobs().fetchJobById(job).orElseThrow();
      assertThrows(
          BackgroundJobException.class,
          () -> new ContextMemoryExtractionJobHandler().runJob(claimed));
    } finally {
      partialRuns.set(false);
    }
    jobs().updateJobStatus(job, BackgroundJob.Status.FAILED);
  }

  private long claimQueued(String jobKey) {
    Long job = jobs().findPendingMemoryJobId(jobKey);
    assertNotNull(job, "a job is queued for " + jobKey);
    assertEquals(1, jobs().claimPendingJob(job));
    return job;
  }

  /** Queues a file's memory stage as text extraction does once the text is in. */
  private static String queuedMemoryRun(ContextFile file) {
    ContextMemoryExtractionJobHandler.Args args =
        ContextMemoryExtractionJobHandler.Args.file(
            file.getId(), UUID.fromString(file.getHeadContentId()));
    jobs()
        .enqueueFileMemoryJob(
            file.getId().toString(),
            args.jobKey(),
            JsonUtils.pojoToJson(args),
            Entity.ADMIN_USER_NAME,
            true);
    return args.jobKey();
  }

  /** The job queue as a database outage leaves it for page jobs: every enqueue fails. */
  private static JobDAO refusingPageJobs() {
    JobDAO queue = jobs();
    return (JobDAO)
        Proxy.newProxyInstance(
            JobDAO.class.getClassLoader(),
            new Class<?>[] {JobDAO.class},
            (proxy, method, args) -> {
              if ("enqueuePageMemoryJob".equals(method.getName())) {
                throw new IllegalStateException("The job queue is unavailable");
              }
              return method.invoke(queue, args);
            });
  }

  private static String fileJob(ContextFile file) {
    return ContextMemoryExtractionJobHandler.Args.file(
            file.getId(), UUID.fromString(file.getHeadContentId()))
        .jobKey();
  }

  private static String pageJob(Page page) {
    return ContextMemoryExtractionJobHandler.Args.page(page.getId()).jobKey();
  }

  /** A file as text extraction leaves it: its snapshot holds the text, its status what is next. */
  private ContextFile file(
      TestNamespace ns,
      String label,
      ProcessingStatus status,
      EntityReference owner,
      Folder folder) {
    String text = "Records for " + ns.shortPrefix() + " " + label + " are kept for 90 days.";
    UUID contentId = UUID.randomUUID();
    ContextFile file =
        stored(
            ns,
            new ContextFile()
                .withName(ns.prefix(label))
                .withHeadContentId(contentId.toString())
                .withProcessingStatus(status)
                .withExtractedText(text)
                .withOwners(List.of(owner))
                .withFolder(folder == null ? null : folder.getEntityReference()));
    fileRepository()
        .getContentRepository()
        .create(
            null,
            new ContextFileContent()
                .withId(contentId)
                .withName(UUID.randomUUID().toString())
                .withContextFile(file.getEntityReference())
                .withChecksum(DigestUtils.sha256Hex(text))
                .withExtractedText(text)
                .withProcessingStatus(ProcessingStatus.Processed)
                .withUpdatedBy(Entity.ADMIN_USER_NAME)
                .withUpdatedAt(System.currentTimeMillis()));
    return file;
  }

  /** As a Collate chat attachment is copied in: text, but no content snapshot behind it. */
  private ContextFile fileWithoutSnapshot(TestNamespace ns, String label, ProcessingStatus status) {
    return stored(
        ns,
        new ContextFile()
            .withName(ns.prefix(label))
            .withProcessingStatus(status)
            .withProcessingError(status == ProcessingStatus.Failed ? "Unreadable sheet" : null)
            .withExtractedText("Rows of " + label)
            .withOwners(List.of(ownerRef()))
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE)));
  }

  private ContextFile stored(TestNamespace ns, ContextFile file) {
    ContextFile created =
        fileRepository()
            .create(
                null,
                file.withId(UUID.randomUUID())
                    .withFileType(ContextFileType.Text)
                    .withUpdatedBy(Entity.ADMIN_USER_NAME)
                    .withUpdatedAt(System.currentTimeMillis()));
    return ns.trackRoot(Entity.CONTEXT_FILE, created);
  }

  /** The owner makes the file private, so the owner is its last editor and only they see it. */
  private ContextFile editedByItsOwner(ContextFile file) throws Exception {
    ContextFile current = RestClient.admin().getById(FILES, file.getId(), "", ContextFile.class);
    return asOwner()
        .patch(
            FILES,
            file.getId(),
            JsonUtils.pojoToJson(current),
            JsonUtils.deepCopy(current, ContextFile.class)
                .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE)),
            ContextFile.class);
  }

  private Folder folder(TestNamespace ns) throws Exception {
    Folder folder =
        RestClient.admin()
            .create(FOLDERS, new CreateFolder().withName(ns.prefix("folder")), Folder.class);
    folders.add(folder.getId());
    return folder;
  }

  private Page article(TestNamespace ns, String label, EntityReference owner) throws Exception {
    Page page =
        RestClient.admin()
            .create(
                PAGES,
                new CreatePage()
                    .withName(ns.prefix(label))
                    .withPageType(PageType.ARTICLE)
                    .withPage(new Article())
                    .withDescription(
                        "Refunds for " + ns.shortPrefix() + " " + label + " take 30 days.")
                    .withOwners(List.of(owner)),
                Page.class);
    return ns.trackRoot(Entity.PAGE, page);
  }

  private Page bodyEditedByItsOwner(Page page) throws Exception {
    Page current = RestClient.admin().getById(PAGES, page.getId(), "", Page.class);
    return asOwner()
        .patch(
            PAGES,
            page.getId(),
            JsonUtils.pojoToJson(current),
            JsonUtils.deepCopy(current, Page.class)
                .withDescription(current.getDescription() + " Edited."),
            Page.class);
  }

  /** Written while extraction was off: never queued, so no run has read its body. */
  private Page articleWrittenWhileOff(TestNamespace ns, String label) throws Exception {
    availability.set(unavailable(ExtractionAvailability.Reason.ExtractionDisabled));
    try {
      return article(ns, label, ownerRef());
    } finally {
      availability.set(AVAILABLE);
    }
  }

  private User teamMember(TestNamespace ns) {
    Team team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("document-owners"))
                    .withTeamType(CreateTeam.TeamType.GROUP));
    ns.trackRoot(Entity.TEAM, team.getId());
    String name = "extractor_" + UUID.randomUUID().toString().substring(0, 8);
    User member =
        SdkClients.adminClient()
            .users()
            .create(
                new CreateUser()
                    .withName(name)
                    .withEmail(name + "@test.openmetadata.org")
                    .withTeams(List.of(team.getId())));
    ns.trackRoot(Entity.USER, member.getId());
    return member.withTeams(List.of(team.getEntityReference()));
  }

  private ContextFile read(ContextFile file) throws Exception {
    return RestClient.admin().getById(FILES, file.getId(), NEVER_EXTRACTED, ContextFile.class);
  }

  private Page read(Page page) throws Exception {
    return RestClient.admin().getById(PAGES, page.getId(), NEVER_EXTRACTED, Page.class);
  }

  private List<ContextMemory> extracted(EntityReference source) {
    List<ContextMemory> memories =
        memoryRepository().listExtractedMemories(source.getId(), source.getType());
    memories.stream()
        .filter(memory -> trackedMemories.add(memory.getId()))
        .forEach(memory -> namespace.trackRoot(Entity.CONTEXT_MEMORY, memory.getId()));
    return memories;
  }

  private static List<String> ownerNames(ContextFile file) {
    return file.getOwners().stream().map(EntityReference::getName).toList();
  }

  private static User owner() {
    return SharedEntities.get().USER1;
  }

  private static EntityReference ownerRef() {
    return owner().getEntityReference();
  }

  private static RestClient asOwner() {
    return as(owner());
  }

  private static RestClient asNonOwner() {
    return as(SharedEntities.get().USER2);
  }

  private static RestClient as(User user) {
    return RestClient.forUser(user.getEmail(), new String[] {});
  }

  private static ExtractionAvailability unavailable(ExtractionAvailability.Reason reason) {
    return new ExtractionAvailability().withAvailable(false).withReason(reason);
  }

  private static JobDAO jobs() {
    return Entity.getJobDAO();
  }

  private static ContextMemoryRepository memoryRepository() {
    return (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
  }

  private static ContextFileRepository fileRepository() {
    return (ContextFileRepository) Entity.getEntityRepository(Entity.CONTEXT_FILE);
  }

  private static ContextMemory pill(
      String text, EntityReference source, ContextMemorySourceType type) {
    String name = "pill-" + UUID.randomUUID();
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withTitle("Document fact")
        .withQuestion("What does this document state?")
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
