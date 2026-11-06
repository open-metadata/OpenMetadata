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

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

/**
 * Admins and a document's owners approve its extracted memories in one request, which leaves two
 * values of one question for a decision
 * (ADR:2026-11-06-a-documents-extracted-memories-are-approved-from-the-document).
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ContextMemoryExtractedApprovalIT {
  private static final String APPROVAL = "/v1/contextCenter/memories/extractedApproval";
  private static final String PAGES = "v1/contextCenter/pages";

  @Test
  void anAdminApprovesAPendingFactAndLeavesTwoValuesOfOneQuestionAndADraft(TestNamespace ns) {
    EntityReference file = file(ns, "admin", null);
    ContextMemory window = stored(ns, file, "What is the refund window?", "30 days", pending());
    ContextMemory fifteen = stored(ns, file, "Commission rate?", "15%", pending());
    ContextMemory twenty = stored(ns, file, "Commission rate?", "20%", pending());
    ContextMemory draft =
        stored(ns, file, "Who approves refunds?", "Finance", ContextMemoryStatus.DRAFT);

    ExtractedMemoryApproval preview = preview(SdkClients.adminClient(), file);
    ExtractedMemoryApproval result = approve(SdkClients.adminClient(), file);

    assertEquals(1, preview.getApproved(), "a preview counts without writing");
    assertEquals(ContextMemoryStatus.APPROVED, status(window));
    assertEquals(1, result.getApproved());
    assertEquals(0, result.getFailed());
    assertEquals(Set.of(fifteen.getId(), twenty.getId()), ids(result.getNeedsDecision()));
    assertEquals(ContextMemoryStatus.UNPROCESSED, status(fifteen));
    assertEquals(ContextMemoryStatus.UNPROCESSED, status(twenty));
    assertEquals(ContextMemoryStatus.DRAFT, status(draft));
  }

  @Test
  void aPendingValueBesideAnApprovedOneOfTheSameQuestionNeedsADecision(TestNamespace ns) {
    EntityReference file = file(ns, "beside-approved", null);
    stored(ns, file, "Commission rate?", "15%", ContextMemoryStatus.APPROVED);
    ContextMemory twenty = stored(ns, file, "commission rate? ", "20%", pending());

    ExtractedMemoryApproval result = approve(SdkClients.adminClient(), file);

    assertEquals(0, result.getApproved());
    assertEquals(Set.of(twenty.getId()), ids(result.getNeedsDecision()));
    assertEquals(ContextMemoryStatus.UNPROCESSED, status(twenty));
  }

  @Test
  void aFilesOwnerApprovesItsExtractedMemories(TestNamespace ns) {
    EntityReference file = file(ns, "owned", shared().USER1_REF);
    ContextMemory window = stored(ns, file, "What is the refund window?", "30 days", pending());

    ExtractedMemoryApproval preview = preview(SdkClients.user1Client(), file);
    ExtractedMemoryApproval result = approve(SdkClients.user1Client(), file);

    assertEquals(1, preview.getApproved());
    assertEquals(1, result.getApproved());
    assertEquals(ContextMemoryStatus.APPROVED, status(window));
  }

  @Test
  void aPagesOwnerApprovesItsExtractedMemories(TestNamespace ns) throws Exception {
    EntityReference page = page(ns, shared().USER1_REF);
    ContextMemory window = stored(ns, page, "What is the refund window?", "30 days", pending());

    ExtractedMemoryApproval result = approve(SdkClients.user1Client(), page);

    assertEquals(1, result.getApproved());
    assertEquals(ContextMemoryStatus.APPROVED, status(window));
  }

  @Test
  void someoneWhoNeitherAdministersNorOwnsTheDocumentIsRefused(TestNamespace ns) {
    EntityReference file = file(ns, "foreign", shared().USER1_REF);
    ContextMemory window = stored(ns, file, "What is the refund window?", "30 days", pending());

    assertEquals(403, statusOf(() -> preview(SdkClients.user2Client(), file)));
    assertEquals(403, statusOf(() -> approve(SdkClients.user2Client(), file)));
    assertEquals(ContextMemoryStatus.UNPROCESSED, status(window));
  }

  @Test
  void onlyAContextFileOrAPageIsASource() {
    EntityReference table = new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE);

    assertEquals(400, statusOf(() -> approve(SdkClients.adminClient(), table)));
  }

  private static ExtractedMemoryApproval preview(
      OpenMetadataClient client, EntityReference source) {
    String query = "?sourceId=%s&sourceType=%s".formatted(source.getId(), source.getType());
    return client
        .getHttpClient()
        .execute(HttpMethod.GET, APPROVAL + query, null, ExtractedMemoryApproval.class);
  }

  private static ExtractedMemoryApproval approve(
      OpenMetadataClient client, EntityReference source) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            APPROVAL,
            new ApproveExtractedMemories().withSource(source),
            ExtractedMemoryApproval.class);
  }

  private static int statusOf(Executable request) {
    return assertThrows(OpenMetadataException.class, request).getStatusCode();
  }

  private static ContextMemoryStatus pending() {
    return ContextMemoryStatus.UNPROCESSED;
  }

  private static ContextMemoryStatus status(ContextMemory memory) {
    return memoryRepository()
        .get(null, memory.getId(), memoryRepository().getFields(""), Include.NON_DELETED, false)
        .getEntityStatus();
  }

  private static Set<UUID> ids(List<EntityReference> references) {
    return references.stream().map(EntityReference::getId).collect(Collectors.toSet());
  }

  /** A pill as extraction stores it: linked to its document, written by the engine as admin. */
  private static ContextMemory stored(
      TestNamespace ns,
      EntityReference source,
      String question,
      String answer,
      ContextMemoryStatus status) {
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
