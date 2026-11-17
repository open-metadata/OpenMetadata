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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.ApproveExtractedMemories;
import org.openmetadata.schema.api.context.ExtractedMemoryApproval;
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
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.ComparedMemory;
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
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.util.RequestEntityCache;

/**
 * Admins and a document's owners approve, in one request, the extracted memories its preview
 * listed, leaving a second value of a question for a decision
 * (ADR:2026-11-06-a-documents-extracted-memories-are-approved-from-the-document).
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ContextMemoryExtractedApprovalIT {
  private static final String APPROVAL = "/v1/contextCenter/memories/extractedApproval";
  private static final String PAGES = "v1/contextCenter/pages";
  private static final String MEMORIES = "v1/contextCenter/memories";

  /** Asked by no other test, so a decision on it holds nothing a concurrent test approves. */
  private static final String RETAINER_DAY = "On which day is the Zephyrine retainer invoiced?";

  @Test
  void anAdminApprovesAPendingFactAndLeavesTwoValuesOfOneQuestionAndADraft(TestNamespace ns) {
    EntityReference file = file(ns, "admin", null);
    ContextMemory window = stored(ns, file, "What is the refund window?", "30 days", pending());
    ContextMemory fifteen = stored(ns, file, "Commission rate?", "15%", pending());
    ContextMemory twenty = stored(ns, file, "Commission rate?", "20%", pending());
    ContextMemory draft =
        stored(ns, file, "Who approves refunds?", "Finance", ContextMemoryStatus.DRAFT);

    ExtractedMemoryApproval preview = preview(SdkClients.adminClient(), file);
    assertEquals(ContextMemoryStatus.UNPROCESSED, status(window), "a preview writes nothing");
    ExtractedMemoryApproval result =
        approve(SdkClients.adminClient(), file, preview.getApprovable());

    assertEquals(Set.of(window.getId()), comparedIds(preview.getApprovable()));
    assertEquals(1, result.getApproved());
    assertEquals(0, result.getFailed());
    assertEquals(Set.of(fifteen.getId(), twenty.getId()), ids(result.getNeedsDecision()));
    assertEquals(ContextMemoryStatus.APPROVED, status(window));
    assertEquals(ContextMemoryStatus.UNPROCESSED, status(fifteen));
    assertEquals(ContextMemoryStatus.UNPROCESSED, status(twenty));
    assertEquals(ContextMemoryStatus.DRAFT, status(draft));
  }

  /** Approval takes only what the person was shown: a pill extracted after the preview waits. */
  @Test
  void aPillExtractedAfterThePreviewStaysPending(TestNamespace ns) {
    EntityReference file = file(ns, "extracted-since", null);
    ContextMemory window = stored(ns, file, "What is the refund window?", "30 days", pending());
    ExtractedMemoryApproval preview = preview(SdkClients.adminClient(), file);
    ContextMemory fee = stored(ns, file, "What is the refund fee?", "5%", pending());

    ExtractedMemoryApproval result =
        approve(SdkClients.adminClient(), file, preview.getApprovable());

    assertEquals(preview.getApprovable().size(), result.getApproved());
    assertEquals(0, result.getFailed());
    assertEquals(ContextMemoryStatus.APPROVED, status(window));
    assertEquals(ContextMemoryStatus.UNPROCESSED, status(fee));
  }

  @Test
  void aPendingValueBesideAnApprovedOneOfTheSameQuestionNeedsADecision(TestNamespace ns) {
    EntityReference file = file(ns, "beside-approved", null);
    stored(ns, file, "Commission rate?", "15%", ContextMemoryStatus.APPROVED);
    ContextMemory twenty = stored(ns, file, "commission rate? ", "20%", pending());

    ExtractedMemoryApproval result = approveAsPreviewed(SdkClients.adminClient(), file);

    assertEquals(0, result.getApproved());
    assertEquals(Set.of(twenty.getId()), ids(result.getNeedsDecision()));
    assertEquals(ContextMemoryStatus.UNPROCESSED, status(twenty));
  }

  @Test
  void aFilesOwnerApprovesItsExtractedMemories(TestNamespace ns) {
    EntityReference file = file(ns, "owned", shared().USER1_REF);
    ContextMemory window = stored(ns, file, "What is the refund window?", "30 days", pending());

    ExtractedMemoryApproval preview = preview(SdkClients.user1Client(), file);
    ExtractedMemoryApproval result =
        approve(SdkClients.user1Client(), file, preview.getApprovable());

    assertEquals(1, preview.getApproved());
    assertEquals(1, result.getApproved());
    assertEquals(ContextMemoryStatus.APPROVED, status(window));
  }

  /**
   * Another user's private copy links the original's memories by their source edges alone, so the
   * original's owner approves them as themselves: nothing they approve names a file they cannot
   * read, the copy sorting first by name included.
   */
  @Test
  void anOriginalsOwnerApprovesTheMemoriesAnotherUsersPrivateCopyAlsoStates(TestNamespace ns) {
    EntityReference original = file(ns, "b-original", shared().USER1_REF);
    EntityReference copy = privateFile(ns, "a-private-copy", shared().USER2_REF);
    ContextMemory window = stored(ns, original, "What is the refund window?", "30 days", pending());
    ContextMemory fee = stored(ns, original, "What is the refund fee?", "5%", pending());
    memoryRepository().linkExtractedMemory(window.getId(), copy);
    memoryRepository().linkExtractedMemory(fee.getId(), copy);

    ExtractedMemoryApproval preview = preview(SdkClients.user1Client(), original);
    ExtractedMemoryApproval result =
        approve(SdkClients.user1Client(), original, preview.getApprovable());

    assertEquals(Set.of(window.getId(), fee.getId()), comparedIds(preview.getApprovable()));
    assertEquals(2, result.getApproved());
    assertEquals(0, result.getFailed());
    assertEquals(ContextMemoryStatus.APPROVED, status(window));
    assertEquals(ContextMemoryStatus.APPROVED, status(fee));
  }

  /**
   * A decision in the document itself is that document's own rule to apply: beside the figure an
   * admin rejected there, the other figure the document states is its owner's to approve, as a
   * retired value no longer answers the question.
   */
  @Test
  void aDocumentsOwnerApprovesAFigureBesideTheOneRejectedInThatDocument(TestNamespace ns)
      throws Exception {
    EntityReference file = file(ns, "retainer-invoicing", shared().USER1_REF);
    ContextMemory fifth = stored(ns, file, RETAINER_DAY, "It is invoiced on the 5th.", pending());
    ContextMemory tenth = stored(ns, file, RETAINER_DAY, "It is invoiced on the 10th.", pending());
    reject(fifth);
    awaitIndexedIn(file, fifth, ContextMemoryStatus.REJECTED);

    ExtractedMemoryApproval preview = preview(SdkClients.user1Client(), file);
    ExtractedMemoryApproval result =
        approve(SdkClients.user1Client(), file, preview.getApprovable());

    assertEquals(Set.of(tenth.getId()), comparedIds(preview.getApprovable()));
    assertEquals(List.of(), preview.getNeedsDecision());
    assertEquals(1, result.getApproved());
    assertEquals(ContextMemoryStatus.APPROVED, status(tenth));
    assertEquals(ContextMemoryStatus.REJECTED, status(fifth));
  }

  @Test
  void aDocumentsOwnerCannotPreviewOrApproveALinkedMemoryMadePrivate(TestNamespace ns)
      throws Exception {
    EntityReference file = file(ns, "private-memory", shared().USER1_REF);
    ContextMemory memory =
        stored(ns, file, "Who signs off refunds?", "Finance", pending(), shared().USER2_REF);
    ExtractedMemoryApproval seen = preview(SdkClients.user1Client(), file);
    assertEquals(Set.of(memory.getId()), comparedIds(seen.getApprovable()));

    ContextMemory privateMemory =
        RestClient.admin()
            .patch(
                "v1/contextCenter/memories",
                memory.getId(),
                JsonUtils.pojoToJson(memory),
                JsonUtils.deepCopy(memory, ContextMemory.class)
                    .withShareConfig(
                        new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE)),
                ContextMemory.class);
    assertEquals(ContextMemorySourceType.FILE_EXTRACTION, privateMemory.getSourceType());
    assertEquals(
        403,
        statusOf(
            () ->
                SdkClients.user1Client()
                    .getHttpClient()
                    .execute(
                        HttpMethod.GET,
                        "/v1/contextCenter/memories/" + memory.getId(),
                        null,
                        ContextMemory.class)));

    ExtractedMemoryApproval hidden = preview(SdkClients.user1Client(), file);
    assertEquals(0, hidden.getApproved());
    assertEquals(List.of(), hidden.getApprovable());
    assertEquals(List.of(), hidden.getNeedsDecision());
    ExtractedMemoryApproval refused = approve(SdkClients.user1Client(), file, seen.getApprovable());
    assertEquals(0, refused.getApproved());
    assertEquals(1, refused.getFailed());
    assertEquals(List.of(), refused.getNeedsDecision());
    assertEquals(ContextMemoryStatus.UNPROCESSED, status(memory));
  }

  @Test
  void aPagesOwnerApprovesItsExtractedMemories(TestNamespace ns) throws Exception {
    EntityReference page = page(ns, shared().USER1_REF);
    ContextMemory window = stored(ns, page, "What is the refund window?", "30 days", pending());

    ExtractedMemoryApproval result = approveAsPreviewed(SdkClients.user1Client(), page);

    assertEquals(1, result.getApproved());
    assertEquals(ContextMemoryStatus.APPROVED, status(window));
  }

  @Test
  void someoneWhoNeitherAdministersNorOwnsTheDocumentIsRefused(TestNamespace ns) {
    EntityReference file = file(ns, "foreign", shared().USER1_REF);
    ContextMemory window = stored(ns, file, "What is the refund window?", "30 days", pending());

    List<ComparedMemory> shown = preview(SdkClients.adminClient(), file).getApprovable();

    assertEquals(403, statusOf(() -> preview(SdkClients.user2Client(), file)));
    assertEquals(403, statusOf(() -> approve(SdkClients.user2Client(), file, shown)));
    assertEquals(ContextMemoryStatus.UNPROCESSED, status(window));
  }

  @Test
  void aMemberOfTheTeamOwningTheDocumentApprovesItsExtractedMemories(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Team team =
        admin
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("document-owners"))
                    .withTeamType(CreateTeam.TeamType.GROUP));
    String name = "approver_" + UUID.randomUUID().toString().substring(0, 8);
    String email = name + "@test.openmetadata.org";
    admin
        .users()
        .create(new CreateUser().withName(name).withEmail(email).withTeams(List.of(team.getId())));
    EntityReference file = file(ns, "team-owned", team.getEntityReference());
    ContextMemory window = stored(ns, file, "What is the refund window?", "30 days", pending());

    ExtractedMemoryApproval result =
        approveAsPreviewed(SdkClients.createClient(email, email, new String[] {}), file);

    assertEquals(1, result.getApproved());
    assertEquals(ContextMemoryStatus.APPROVED, status(window));
  }

  /** Owning one of a document's memories decides that memory's sharing, not the document's. */
  @Test
  void owningALinkedMemoryDoesNotMakeSomeoneTheDocumentsOwner(TestNamespace ns) {
    EntityReference file = file(ns, "memory-owner", shared().USER1_REF);
    ContextMemory window =
        stored(ns, file, "What is the refund window?", "30 days", pending(), shared().USER2_REF);

    List<ComparedMemory> shown = preview(SdkClients.adminClient(), file).getApprovable();

    assertEquals(403, statusOf(() -> approve(SdkClients.user2Client(), file, shown)));
    assertEquals(ContextMemoryStatus.UNPROCESSED, status(window));
  }

  @Test
  void onlyAContextFileOrAPageIsASource() {
    EntityReference table = new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE);

    assertEquals(400, statusOf(() -> approve(SdkClients.adminClient(), table, List.of())));
  }

  @Test
  void aMissingDocumentIsNotFound() {
    EntityReference missing =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);

    assertEquals(404, statusOf(() -> preview(SdkClients.adminClient(), missing)));
    assertEquals(404, statusOf(() -> approve(SdkClients.adminClient(), missing, List.of())));
  }

  private static ExtractedMemoryApproval preview(
      OpenMetadataClient client, EntityReference source) {
    String query = "?sourceId=%s&sourceType=%s".formatted(source.getId(), source.getType());
    return client
        .getHttpClient()
        .execute(HttpMethod.GET, APPROVAL + query, null, ExtractedMemoryApproval.class);
  }

  private static ExtractedMemoryApproval approve(
      OpenMetadataClient client, EntityReference source, List<ComparedMemory> shown) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            APPROVAL,
            new ApproveExtractedMemories().withSource(source).withApprovable(shown),
            ExtractedMemoryApproval.class);
  }

  private static ExtractedMemoryApproval approveAsPreviewed(
      OpenMetadataClient client, EntityReference source) {
    return approve(client, source, preview(client, source).getApprovable());
  }

  private static int statusOf(Executable request) {
    return assertThrows(OpenMetadataException.class, request).getStatusCode();
  }

  /** An admin rejects the memory in its panel. */
  private static void reject(ContextMemory memory) throws Exception {
    ContextMemory current =
        RestClient.admin().getById(MEMORIES, memory.getId(), "", ContextMemory.class);
    RestClient.admin()
        .patch(
            MEMORIES,
            memory.getId(),
            JsonUtils.pojoToJson(current),
            JsonUtils.deepCopy(current, ContextMemory.class)
                .withEntityStatus(ContextMemoryStatus.REJECTED),
            ContextMemory.class);
  }

  /** Approval reads decisions from the memory index, which shows a write once refreshed. */
  private static void awaitIndexedIn(
      EntityReference anchor, ContextMemory memory, ContextMemoryStatus status) {
    ListParams anchored =
        new ListParams()
            .setLimit(50)
            .addFilter("assets", anchor.getId().toString())
            .addFilter("statuses", status.value());
    ContextMemoryService memories =
        new ContextMemoryService(SdkClients.adminClient().getHttpClient());
    Awaitility.await("the memory is searchable in its stage")
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(60))
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertTrue(
                    memories.list(anchored).getData().stream()
                        .anyMatch(listed -> listed.getId().equals(memory.getId()))));
  }

  private static ContextMemoryStatus pending() {
    return ContextMemoryStatus.UNPROCESSED;
  }

  /** Read as a new request reads: this thread's request cache keeps what it read before a write. */
  private static ContextMemoryStatus status(ContextMemory memory) {
    RequestEntityCache.clear();
    return memoryRepository()
        .get(null, memory.getId(), memoryRepository().getFields(""), Include.NON_DELETED, false)
        .getEntityStatus();
  }

  private static Set<UUID> ids(List<EntityReference> references) {
    return references.stream().map(EntityReference::getId).collect(Collectors.toSet());
  }

  private static Set<UUID> comparedIds(List<ComparedMemory> memories) {
    return memories.stream().map(ComparedMemory::getId).collect(Collectors.toSet());
  }

  /** A pill as extraction stores it: linked to its document, written by the engine as admin. */
  private static ContextMemory stored(
      TestNamespace ns,
      EntityReference source,
      String question,
      String answer,
      ContextMemoryStatus status) {
    return stored(ns, source, question, answer, status, null);
  }

  private static ContextMemory stored(
      TestNamespace ns,
      EntityReference source,
      String question,
      String answer,
      ContextMemoryStatus status,
      EntityReference owner) {
    String name = ns.prefix("pill-" + UUID.randomUUID());
    ContextMemory memory =
        new ContextMemory()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(name)
            .withTitle(question)
            .withQuestion(question)
            .withAnswer(answer)
            .withMemoryType(ContextMemoryType.NOTE)
            .withMemoryScope(ContextMemoryScope.ENTITY_SCOPED)
            .withEntityStatus(status)
            .withSourceType(sourceTypeOf(source))
            .withSourceEntity(source)
            .withPrimaryEntity(source)
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY))
            .withOwners(owner == null ? null : List.of(owner))
            .withUpdatedBy(Entity.ADMIN_USER_NAME)
            .withUpdatedAt(System.currentTimeMillis());
    memoryRepository().create(null, memory);
    ns.trackRoot(Entity.CONTEXT_MEMORY, memory.getId());
    return memory;
  }

  private static ContextMemorySourceType sourceTypeOf(EntityReference source) {
    return Entity.PAGE.equals(source.getType())
        ? ContextMemorySourceType.PAGE_EXTRACTION
        : ContextMemorySourceType.FILE_EXTRACTION;
  }

  private static EntityReference file(TestNamespace ns, String label, EntityReference owner) {
    return file(ns, label, owner, null);
  }

  /** A file only its owner may read. */
  private static EntityReference privateFile(
      TestNamespace ns, String label, EntityReference owner) {
    return file(ns, label, owner, new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));
  }

  private static EntityReference file(
      TestNamespace ns, String label, EntityReference owner, MemoryShareConfig sharing) {
    ContextFile file =
        fileRepository()
            .create(
                null,
                new ContextFile()
                    .withId(UUID.randomUUID())
                    .withName(ns.prefix(label))
                    .withHeadContentId(UUID.randomUUID().toString())
                    .withProcessingStatus(ProcessingStatus.Processed)
                    .withOwners(owner == null ? null : List.of(owner))
                    .withShareConfig(sharing)
                    .withUpdatedBy(Entity.ADMIN_USER_NAME)
                    .withUpdatedAt(System.currentTimeMillis()));
    return ns.trackRoot(Entity.CONTEXT_FILE, file).getEntityReference();
  }

  private static EntityReference page(TestNamespace ns, EntityReference owner) throws Exception {
    Page page =
        RestClient.admin()
            .create(
                PAGES,
                new CreatePage()
                    .withName(ns.prefix("article"))
                    .withPageType(PageType.ARTICLE)
                    .withPage(new Article())
                    .withOwners(List.of(owner)),
                Page.class);
    return ns.trackRoot(Entity.PAGE, page).getEntityReference();
  }

  private static SharedEntities shared() {
    return SharedEntities.get();
  }

  private static ContextMemoryRepository memoryRepository() {
    return (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
  }

  private static ContextFileRepository fileRepository() {
    return (ContextFileRepository) Entity.getEntityRepository(Entity.CONTEXT_FILE);
  }
}
