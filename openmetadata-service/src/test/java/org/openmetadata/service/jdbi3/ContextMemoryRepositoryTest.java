/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryDispute;
import org.openmetadata.schema.entity.context.MemoryOutcomes;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ComparedMemory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.context.review.ExtractedMemoryApprover;
import org.openmetadata.service.context.review.MemoryEvidenceHolds;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;

/**
 * ContextMemory is indexed whatever its {@code shareConfig.visibility}; privacy is enforced at
 * query time by {@link org.openmetadata.service.search.security.ContextMemorySearchVisibility}.
 * Excluding restricted memories at index time hid a user's own PRIVATE memories and the SHARED ones
 * they are a principal of from the search-backed {@code GET /contextCenter/memories} listing, so
 * these tests pin that no visibility is filtered out of the index.
 */
@Execution(ExecutionMode.SAME_THREAD)
class ContextMemoryRepositoryTest {

  private ContextMemoryRepository repository;
  private CollectionDAO daoCollection;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;

  @BeforeEach
  void setUp() {
    daoCollection = mock(CollectionDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(daoCollection.contextMemoryDAO()).thenReturn(mock(CollectionDAO.ContextMemoryDAO.class));
    when(daoCollection.relationshipDAO()).thenReturn(relationshipDAO);
    Entity.setCollectionDAO(daoCollection);
    Entity.setEntityRelationshipRepository(new EntityRelationshipRepository(daoCollection));
    repository = new ContextMemoryRepository(true);
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void serverWritesWithoutAPrincipalAreRefused() {
    assertThrows(
        AuthorizationException.class,
        () -> repository.prepare(new ContextMemory().withName("unstamped"), false));
    assertThrows(
        AuthorizationException.class,
        () -> repository.prepare(new ContextMemory().withName("unstamped"), true));
  }

  @Test
  void ossMemoriesAreApprovedWhenNoStageIsRequested() {
    repository = new ContextMemoryRepository();
    withWriters(
        () -> {
          ContextMemory memory = byWriter("alice", null);

          repository.prepare(memory, false);
          repository.assignInitialEntityStatus(memory);

          assertEquals(ContextMemoryStatus.APPROVED, memory.getEntityStatus());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"APPROVED", "DRAFT", "UNPROCESSED"})
  void ossPreservesAnExplicitlyRequestedStage(ContextMemoryStatus stage) {
    repository = new ContextMemoryRepository();
    withWriters(
        () -> {
          ContextMemory memory = byWriter("alice", stage);

          repository.prepare(memory, false);
          repository.assignInitialEntityStatus(memory);

          assertEquals(stage, memory.getEntityStatus());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = EntityRepository.Operation.class,
      names = {"PATCH", "PUT"})
  void ossOwnersMayApproveTheirPendingMemories(EntityRepository.Operation operation) {
    repository = new ContextMemoryRepository();
    withWriters(
        () ->
            assertEquals(
                ContextMemoryStatus.APPROVED,
                stageMove("alice", ContextMemoryStatus.APPROVED, null, operation)));
  }

  @Test
  void aReviewingDistributionDefaultsToUnprocessedForEveryWriter() {
    withWriters(
        () -> {
          for (String writer : List.of("alice", Entity.ADMIN_USER_NAME, "ai-bot")) {
            ContextMemory memory = byWriter(writer, null);

            repository.prepare(memory, false);
            repository.assignInitialEntityStatus(memory);

            assertEquals(ContextMemoryStatus.UNPROCESSED, memory.getEntityStatus(), writer);
            assertNull(memory.getLastReviewedAt());
          }
        });
  }

  /**
   * Item 18: a create by anyone but an admin or a bot starts Unprocessed, whatever it asked for,
   * and claims no review it never had.
   */
  @Test
  void aMemoryCreatedByANonAdminStartsUnprocessedWhateverItAskedFor() {
    User alice = new User().withId(UUID.randomUUID()).withName("alice");
    try (MockedStatic<SubjectContext> subjects = mockStatic(SubjectContext.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      subjects
          .when(() -> SubjectContext.getSubjectContext("alice"))
          .thenReturn(new SubjectContext(alice, null));
      entities
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "alice", Include.NON_DELETED))
          .thenReturn(
              new EntityReference().withId(alice.getId()).withName("alice").withType(Entity.USER));
      ContextMemory approved = byWriter("alice", ContextMemoryStatus.APPROVED);
      ContextMemory draft =
          byWriter("alice", ContextMemoryStatus.DRAFT).withStatusReason("Please review");

      repository.prepare(approved, false);
      repository.prepare(draft, false);

      assertEquals(ContextMemoryStatus.UNPROCESSED, approved.getEntityStatus());
      assertNull(approved.getLastReviewedAt(), "an unreviewed memory claims no review");
      assertEquals(ContextMemoryStatus.UNPROCESSED, draft.getEntityStatus());
      assertNull(draft.getStatusReason());
    }
  }

  /** Extraction (admin), reconciliation and governance (bots) keep the stage they write. */
  @Test
  void anAdminOrABotCreatesAMemoryInTheStageItAskedFor() {
    try (MockedStatic<SubjectContext> subjects = mockStatic(SubjectContext.class)) {
      subjects
          .when(() -> SubjectContext.getSubjectContext("root"))
          .thenReturn(new SubjectContext(new User().withName("root").withIsAdmin(true), null));
      subjects
          .when(() -> SubjectContext.getSubjectContext("governance-bot"))
          .thenReturn(
              new SubjectContext(new User().withName("governance-bot").withIsBot(true), null));
      for (String writer : List.of(Entity.ADMIN_USER_NAME, "root", "governance-bot")) {
        ContextMemory memory = byWriter(writer, ContextMemoryStatus.APPROVED);

        ContextMemoryRepository.startPendingUnlessPrivileged(memory);

        assertEquals(ContextMemoryStatus.APPROVED, memory.getEntityStatus(), writer);
      }
    }
  }

  /**
   * Review finding: a create asking for Draft with the evidence-hold text opened a review directly.
   * The rule trusts no requested hold; the server's own hold runs after it and still lands in Draft.
   */
  @Test
  void aRequestedHoldIsNotTrustedButTheServersOwnHoldLandsInDraft() {
    withWriters(
        () -> {
          UUID query = UUID.randomUUID();
          ContextMemory claimed =
              byWriter("alice", ContextMemoryStatus.DRAFT)
                  .withStatusReason(
                      "Supporting query "
                          + query
                          + " was deleted; review whether this memory still holds without it");
          ContextMemory citing = byWriter("alice", ContextMemoryStatus.APPROVED);

          ContextMemoryRepository.startPendingUnlessPrivileged(claimed);
          ContextMemoryRepository.startPendingUnlessPrivileged(citing);
          MemoryEvidenceHolds.holdIfCitingRetired(
              citing,
              List.of(
                  new EntityReference().withId(query).withType(Entity.QUERY).withDeleted(true)));

          assertEquals(ContextMemoryStatus.UNPROCESSED, claimed.getEntityStatus());
          assertNull(claimed.getStatusReason());
          assertEquals(ContextMemoryStatus.DRAFT, citing.getEntityStatus());
          assertTrue(citing.getStatusReason().contains(query.toString()));
        });
  }

  /**
   * Review finding: alice PATCHed her own memory to Draft with a dispute naming another of hers,
   * which opened a review assigned only to her, and approved it there.
   */
  @Test
  void aNonAdminCannotOpenAConflictReview() {
    withWriters(
        () -> {
          ContextMemory original =
              memory(MemoryVisibility.ENTITY)
                  .withUpdatedBy("admin")
                  .withUpdatedAt(101L)
                  .withEntityStatus(ContextMemoryStatus.UNPROCESSED);
          ContextMemory disputed =
              JsonUtils.deepCopy(original, ContextMemory.class)
                  .withUpdatedBy("alice")
                  .withEntityStatus(ContextMemoryStatus.DRAFT)
                  .withDisputes(List.of(dispute()));

          assertThrows(
              AuthorizationException.class,
              () ->
                  repository
                      .getUpdater(
                          original, disputed, EntityRepository.Operation.PATCH, ChangeSource.MANUAL)
                      .entitySpecificUpdate(false));
        });
  }

  /** The create variant: a new memory carrying disputes opens a review the moment it exists. */
  @Test
  void aNonAdminsCreateCannotCarryDisputes() {
    withWriters(
        () -> {
          ContextMemory created =
              byWriter("alice", ContextMemoryStatus.DRAFT).withDisputes(List.of(dispute()));

          assertThrows(AuthorizationException.class, () -> repository.prepare(created, false));
        });
  }

  /**
   * Reconciliation writes disputes as its bot, or as a restricted memory's owner with the bot
   * impersonating them, so both stay open, as does an admin.
   */
  @Test
  void aBotAnAdminOrABotWritingForAUserMayOpenAConflictReview() {
    withWriters(
        () -> {
          for (String writer : List.of("ai-bot", Entity.ADMIN_USER_NAME)) {
            ContextMemory memory =
                byWriter(writer, ContextMemoryStatus.DRAFT).withDisputes(List.of(dispute()));
            assertDoesNotThrow(
                () ->
                    ContextMemoryRepository.requireDisputesOpenedByAutomation(null, memory, null));
          }
          ContextMemory forAlice =
              byWriter("alice", ContextMemoryStatus.DRAFT).withDisputes(List.of(dispute()));
          assertDoesNotThrow(
              () ->
                  ContextMemoryRepository.requireDisputesOpenedByAutomation(
                      null, forAlice, "ai-bot"));
        });
  }

  private static MemoryDispute dispute() {
    return new MemoryDispute()
        .withMemory(new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_MEMORY))
        .withReason("States a different refund window");
  }

  /**
   * Review finding: a Data Steward's create started Unprocessed, then a PATCH of /entityStatus
   * approved it. Only an admin, a bot or a conflict review decision moves a memory into Approved.
   */
  @Test
  void aNonAdminsPatchIntoApprovedIsRefused() {
    withWriters(
        () ->
            assertThrows(
                AuthorizationException.class,
                () ->
                    stageMove(
                        "alice",
                        ContextMemoryStatus.APPROVED,
                        null,
                        EntityRepository.Operation.PATCH)));
  }

  /**
   * Review refuses an owner's own approval, so a document's owner approves its extracted memories
   * only because the approver writes as a review decision does, through governance-bot.
   */
  @Test
  void aDocumentOwnersApprovalPassesReviewOnlyAsTheApproverWritesIt() {
    String impersonatedBy = impersonatorOfAnApprovalBy("alice");

    withWriters(
        () -> {
          assertEquals(
              ContextMemoryStatus.APPROVED,
              stageMove(
                  "alice",
                  ContextMemoryStatus.APPROVED,
                  impersonatedBy,
                  EntityRepository.Operation.PATCH));
          assertThrows(
              AuthorizationException.class,
              () ->
                  stageMove(
                      "alice",
                      ContextMemoryStatus.APPROVED,
                      null,
                      EntityRepository.Operation.PATCH));
        });
  }

  /** Who the approver's write of one extracted pill names as impersonating {@code user}. */
  private String impersonatorOfAnApprovalBy(String user) {
    ContextMemory pill =
        memory(MemoryVisibility.ENTITY)
            .withSourceType(ContextMemorySourceType.FILE_EXTRACTION)
            .withEntityStatus(ContextMemoryStatus.UNPROCESSED)
            .withVersion(0.1)
            .withUpdatedAt(101L);
    EntityReference file =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    ContextMemoryRepository listing = mock(ContextMemoryRepository.class);
    ContextMemoryRepository writes = mock(ContextMemoryRepository.class);
    when(listing.listExtractedMemories(file.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of(pill));
    when(writes.patch(any(), any(UUID.class), any(), any(), any(), any(), any()))
        .thenReturn(new PatchResponse<>(Response.Status.OK, pill, EventType.ENTITY_UPDATED));
    try (MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entities.when(() -> Entity.getEntityRepository(Entity.CONTEXT_MEMORY)).thenReturn(writes);
      new ExtractedMemoryApprover(listing)
          .approve(
              file,
              List.of(new ComparedMemory().withId(pill.getId()).withContentUpdatedAt(101L)),
              user,
              false);
    }
    ArgumentCaptor<String> impersonatedBy = ArgumentCaptor.forClass(String.class);
    verify(writes)
        .patch(isNull(), eq(pill.getId()), eq(user), any(), any(), any(), impersonatedBy.capture());
    return impersonatedBy.getValue();
  }

  /** A PUT re-sends its create request, stage included: it keeps the stored stage, as the create. */
  @Test
  void aNonAdminsPutKeepsTheStoredStage() {
    withWriters(
        () ->
            assertEquals(
                ContextMemoryStatus.UNPROCESSED,
                stageMove(
                    "alice", ContextMemoryStatus.APPROVED, null, EntityRepository.Operation.PUT)));
  }

  /** A conflict review's resolver writes as themselves through governance-bot. */
  @Test
  void aConflictReviewDecisionAndAnAdminOrBotMayApprove() {
    withWriters(
        () -> {
          assertEquals(
              ContextMemoryStatus.APPROVED,
              stageMove(
                  "alice",
                  ContextMemoryStatus.APPROVED,
                  GOVERNANCE_BOT,
                  EntityRepository.Operation.PATCH));
          assertEquals(
              ContextMemoryStatus.APPROVED,
              stageMove(
                  Entity.ADMIN_USER_NAME,
                  ContextMemoryStatus.APPROVED,
                  null,
                  EntityRepository.Operation.PATCH));
          assertEquals(
              ContextMemoryStatus.APPROVED,
              stageMove(
                  "ai-bot", ContextMemoryStatus.APPROVED, null, EntityRepository.Operation.PATCH));
        });
  }

  /** Moves that ground nothing stay open: sending a memory to review or retiring it. */
  @Test
  void aNonAdminMayStillSendAMemoryToReviewOrRetireIt() {
    withWriters(
        () -> {
          assertEquals(
              ContextMemoryStatus.REJECTED,
              stageMove(
                  "alice", ContextMemoryStatus.REJECTED, null, EntityRepository.Operation.PATCH));
          assertEquals(
              ContextMemoryStatus.DRAFT,
              stageMove(
                  "alice", ContextMemoryStatus.DRAFT, null, EntityRepository.Operation.PATCH));
        });
  }

  /** Moves an Unprocessed memory to {@code target} as {@code writer} and returns its stage. */
  private ContextMemoryStatus stageMove(
      String writer,
      ContextMemoryStatus target,
      String impersonatedBy,
      EntityRepository.Operation operation) {
    ContextMemory original =
        memory(MemoryVisibility.ENTITY)
            .withUpdatedBy("admin")
            .withUpdatedAt(101L)
            .withEntityStatus(ContextMemoryStatus.UNPROCESSED);
    ContextMemory updated =
        JsonUtils.deepCopy(original, ContextMemory.class)
            .withUpdatedBy(writer)
            .withImpersonatedBy(impersonatedBy)
            .withEntityStatus(target);
    repository
        .getUpdater(original, updated, operation, ChangeSource.MANUAL)
        .updateEntityStatus(false);
    return updated.getEntityStatus();
  }

  private static void withWriters(Runnable assertions) {
    User alice = new User().withId(UUID.randomUUID()).withName("alice");
    User bot = new User().withId(UUID.randomUUID()).withName("ai-bot").withIsBot(true);
    try (MockedStatic<SubjectContext> subjects = mockStatic(SubjectContext.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      subjects
          .when(() -> SubjectContext.getSubjectContext("alice"))
          .thenReturn(new SubjectContext(alice, null));
      subjects
          .when(() -> SubjectContext.getSubjectContext("ai-bot"))
          .thenReturn(new SubjectContext(bot, null));
      entities
          .when(() -> Entity.findEntityByNameOrNull(Entity.USER, "alice", Include.ALL))
          .thenReturn(alice);
      entities
          .when(() -> Entity.findEntityByNameOrNull(Entity.USER, "ai-bot", Include.ALL))
          .thenReturn(bot);
      entities
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "alice", Include.NON_DELETED))
          .thenReturn(
              new EntityReference().withId(alice.getId()).withName("alice").withType(Entity.USER));
      for (String writer : List.of(Entity.ADMIN_USER_NAME, "ai-bot")) {
        entities
            .when(() -> Entity.getEntityReferenceByName(Entity.USER, writer, Include.NON_DELETED))
            .thenReturn(
                new EntityReference()
                    .withId(UUID.randomUUID())
                    .withName(writer)
                    .withType(Entity.USER));
      }
      assertions.run();
    }
  }

  private static ContextMemory byWriter(String writer, ContextMemoryStatus status) {
    return new ContextMemory()
        .withName("memory-" + UUID.randomUUID())
        .withQuestion("Which column holds the order total?")
        .withAnswer("orders.amount_usd")
        .withUpdatedBy(writer)
        .withUpdatedAt(1_760_000_000_000L)
        .withEntityStatus(status);
  }

  /** The anchor edge getPrimaryEntity reads: APPLIED_TO from anything, the older HAS but from a domain. */
  @Test
  void findAnchors_readsTheEdgeThatMakesAnEntityAMemorysAnchor() {
    UUID table = UUID.randomUUID();
    UUID legacy = UUID.randomUUID();
    UUID assignedDomain = UUID.randomUUID();
    UUID anchoringDomain = UUID.randomUUID();
    when(relationshipDAO.findMemoryAnchorEdges(anyList(), anyList()))
        .thenReturn(
            List.of(
                edge(table, Entity.TABLE, Relationship.APPLIED_TO),
                edge(table, Entity.TABLE, Relationship.HAS),
                edge(legacy, Entity.DASHBOARD, Relationship.HAS),
                edge(assignedDomain, Entity.DOMAIN, Relationship.HAS),
                edge(anchoringDomain, Entity.DOMAIN, Relationship.APPLIED_TO)));

    List<EntityReference> anchors =
        repository.findAnchors(List.of(table, legacy, assignedDomain, anchoringDomain));

    assertEquals(
        List.of(
            anchorRef(table, Entity.TABLE),
            anchorRef(legacy, Entity.DASHBOARD),
            anchorRef(anchoringDomain, Entity.DOMAIN)),
        anchors);
  }

  @Test
  void findAnchors_neverQueriesForNoCandidates() {
    assertTrue(repository.findAnchors(List.of()).isEmpty());
    verify(relationshipDAO, never()).findMemoryAnchorEdges(anyList(), anyList());
  }

  private static CollectionDAO.MemoryAnchorEdge edge(
      UUID fromId, String fromEntity, Relationship relation) {
    return new CollectionDAO.MemoryAnchorEdge(fromId, fromEntity, relation.ordinal());
  }

  private static EntityReference anchorRef(UUID id, String type) {
    return new EntityReference().withId(id).withType(type);
  }

  @Test
  void conditionalMemoryWritesPassBothVersionAndTimestampToTheDatabase() {
    ContextMemory memory = memory(MemoryVisibility.ENTITY).withVersion(0.3).withUpdatedAt(102L);
    CollectionDAO.ContextMemoryDAO memoryDao = daoCollection.contextMemoryDAO();
    when(memoryDao.updateWithVersionAndTimestamp(any(), any(), any(), eq("0.2"), eq(101L)))
        .thenReturn(0);

    assertThrows(
        PreconditionFailedException.class,
        () -> repository.storeEntityWithVersion(memory, true, 0.2, 101L));
    verify(memoryDao)
        .updateWithVersionAndTimestamp(eq(memory.getId()), any(), any(), eq("0.2"), eq(101L));
  }

  @Test
  void consolidatedEditsCannotReuseThePreviousModificationTimestamp() {
    ContextMemory original =
        memory(MemoryVisibility.ENTITY)
            .withUpdatedBy("admin")
            .withVersion(0.2)
            .withEntityStatus(ContextMemoryStatus.UNPROCESSED)
            .withUpdatedAt(101L);
    ContextMemory updated =
        JsonUtils.deepCopy(original, ContextMemory.class).withAnswer("Corrected claim");

    repository.getUpdater(original, updated, EntityRepository.Operation.PATCH, ChangeSource.MANUAL);

    assertEquals(102L, updated.getUpdatedAt());
    assertEquals(original.getVersion(), updated.getVersion());
  }

  @ParameterizedTest
  @EnumSource(
      value = EntityRepository.Operation.class,
      names = {"PATCH", "PUT"})
  void aWriteReturnsAndIndexesTheStoredTelemetryNotTheValuesItSent(
      EntityRepository.Operation operation) {
    MemoryOutcomes stored = new MemoryOutcomes().withAppliedCount(4).withCountedAt(90L);
    ContextMemory original =
        memory(MemoryVisibility.ENTITY)
            .withUpdatedBy("admin")
            .withUpdatedAt(101L)
            .withUsageCount(4)
            .withLastUsedAt(80L)
            .withOutcomes(stored);
    ContextMemory updated =
        JsonUtils.deepCopy(original, ContextMemory.class)
            .withUsageCount(999999)
            .withLastUsedAt(999L)
            .withOutcomes(new MemoryOutcomes().withAppliedCount(999999).withCountedAt(999L));

    repository.getUpdater(original, updated, operation, ChangeSource.MANUAL);

    assertEquals(4, updated.getUsageCount());
    assertEquals(80L, updated.getLastUsedAt());
    assertEquals(stored, updated.getOutcomes());
  }

  @ParameterizedTest
  @EnumSource(MemoryVisibility.class)
  void isSearchIndexable_trueForEveryVisibility(MemoryVisibility visibility) {
    assertTrue(repository.isSearchIndexable(memory(visibility)));
  }

  @Test
  void isSearchIndexable_trueWhenShareConfigMissing() {
    assertTrue(
        repository.isSearchIndexable(
            new ContextMemory().withId(UUID.randomUUID()).withName("mem")));
  }

  @ParameterizedTest
  @EnumSource(MemoryVisibility.class)
  void isVectorEmbeddable_trueForEveryVisibility(MemoryVisibility visibility) {
    assertTrue(repository.isVectorEmbeddable(memory(visibility)));
  }

  @Test
  void isVectorEmbeddable_trueWhenShareConfigMissing() {
    assertTrue(
        repository.isVectorEmbeddable(
            new ContextMemory().withId(UUID.randomUUID()).withName("mem")));
  }

  @Test
  void getReindexFilter_doesNotRestrictByVisibility() {
    assertTrue(repository.getReindexFilter().getQueryParams().isEmpty());
  }

  @Test
  void entityFacade_isSearchIndexable_trueForRestrictedMemories() {
    assertTrue(Entity.isSearchIndexable(memory(MemoryVisibility.ENTITY)));
    assertTrue(Entity.isSearchIndexable(memory(MemoryVisibility.PRIVATE)));
    assertTrue(Entity.isSearchIndexable(memory(MemoryVisibility.SHARED)));
  }

  @Test
  void entityFacade_isSearchIndexable_defaultsTrueForTypeWithoutRepository() {
    // A type with no registered repository (index-only / time-series sub-entities such as
    // pipelineStatus) must default to indexable instead of throwing EntityNotFoundException, so the
    // live index paths keep working for it.
    EntityInterface<?> repoLess = mock(EntityInterface.class);
    when(repoLess.getEntityReference())
        .thenReturn(new EntityReference().withType("typeWithoutRepository"));

    assertTrue(Entity.isSearchIndexable(repoLess));
  }

  @Test
  void entityFacade_isSearchIndexable_falseForMissingEntityOrReference() {
    assertFalse(Entity.isSearchIndexable(null));
    assertFalse(Entity.isSearchIndexable(mock(EntityInterface.class)));
  }

  @Test
  @SuppressWarnings("unchecked")
  void entityFacade_isSearchIndexable_defaultsTrueWhenOnlyTimeSeriesRepositoryExists()
      throws ReflectiveOperationException {
    String entityType = "testTimeSeries";
    Field repositoriesField = Entity.class.getDeclaredField("ENTITY_TS_REPOSITORY_MAP");
    repositoriesField.setAccessible(true);
    Map<String, EntityTimeSeriesRepository<?>> repositories =
        (Map<String, EntityTimeSeriesRepository<?>>) repositoriesField.get(null);
    repositories.put(entityType, mock(EntityTimeSeriesRepository.class));

    try {
      EntityInterface<?> timeSeriesEntity = mock(EntityInterface.class);
      when(timeSeriesEntity.getEntityReference())
          .thenReturn(new EntityReference().withType(entityType));

      assertTrue(Entity.hasEntityRepository(entityType));
      assertTrue(Entity.isSearchIndexable(timeSeriesEntity));
    } finally {
      repositories.remove(entityType);
    }
  }

  /**
   * A reused {@link ContextMemory} can legitimately carry more than one {@code MENTIONED_IN} source
   * edge, while its {@code sourceEntity}/{@code sourceFile} fields are singular {@link
   * EntityReference} projections over that multi-edge set. Both read paths must therefore apply
   * the *same* tiebreak, otherwise the plain JDBI list (and the reconciler's {@code applyDerived}
   * write fed by {@code listExtractedMemories}) can report -- and write -- a different source than
   * the detail GET, deleting a {@code MENTIONED_IN} edge during reconciliation.
   *
   * <p>The single {@code getSourceEntity} path (detail GET, update write-back) inherits the {@code
   * EntityUtil.compareEntityReference} (entity-name) sort from {@code
   * EntityRelationshipRepository.getEntityReferences} and returns the name-first source. This test
   * stubs the bulk {@code findFromBatch} rows in non-name (DB arrival) order and asserts the bulk
   * {@code batchFetchSources} path now returns the same name-first source instead of the first DB
   * row, so list vs detail agree and the reconciler's diff is empty.
   */
  @Test
  void batchFetchSources_picksNameFirstSourceLikeSinglePath() throws ReflectiveOperationException {
    UUID memoryId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    UUID alphaId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    UUID betaId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    ContextMemory memory = new ContextMemory().withId(memoryId).withName("reused-memory");
    EntityReference alphaSource =
        new EntityReference().withId(alphaId).withType(Entity.CONTEXT_FILE).withName("Alpha");
    EntityReference betaSource =
        new EntityReference().withId(betaId).withType(Entity.CONTEXT_FILE).withName("Beta");

    // Single-path records: findFrom returns both source rows; EntityRelationshipRepository
    // resolves and name-sorts them, so getSourceEntity returns "Alpha".
    List<CollectionDAO.EntityRelationshipRecord> singleRecords =
        List.of(
            CollectionDAO.EntityRelationshipRecord.builder()
                .id(alphaId)
                .type(Entity.CONTEXT_FILE)
                .build(),
            CollectionDAO.EntityRelationshipRecord.builder()
                .id(betaId)
                .type(Entity.CONTEXT_FILE)
                .build());
    // Bulk-path rows deliberately in non-name (DB arrival) order, with Beta first: this is the
    // order that made the old putIfAbsent bulk path disagree with the name-sorted single path.
    List<CollectionDAO.EntityRelationshipObject> bulkRecords =
        List.of(
            CollectionDAO.EntityRelationshipObject.builder()
                .fromId(betaId.toString())
                .toId(memoryId.toString())
                .fromEntity(Entity.CONTEXT_FILE)
                .toEntity(Entity.CONTEXT_MEMORY)
                .build(),
            CollectionDAO.EntityRelationshipObject.builder()
                .fromId(alphaId.toString())
                .toId(memoryId.toString())
                .fromEntity(Entity.CONTEXT_FILE)
                .toEntity(Entity.CONTEXT_MEMORY)
                .build());

    when(relationshipDAO.findFrom(
            eq(memoryId), eq(Entity.CONTEXT_MEMORY), eq(Relationship.MENTIONED_IN.ordinal())))
        .thenReturn(singleRecords);
    when(relationshipDAO.findFromBatch(
            anyList(), eq(Relationship.MENTIONED_IN.ordinal()), eq(Include.NON_DELETED)))
        .thenReturn(bulkRecords);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entityMock.when(() -> Entity.hasEntityRepository(eq(Entity.CONTEXT_FILE))).thenReturn(true);
      entityMock
          .when(
              () ->
                  Entity.getEntityReferencesByIds(
                      eq(Entity.CONTEXT_FILE), anyList(), any(Include.class)))
          .thenReturn(List.of(alphaSource, betaSource));

      Method getSourceEntity =
          ContextMemoryRepository.class.getDeclaredMethod("getSourceEntity", ContextMemory.class);
      getSourceEntity.setAccessible(true);
      EntityReference single = (EntityReference) getSourceEntity.invoke(repository, memory);

      Method batchFetchSources =
          ContextMemoryRepository.class.getDeclaredMethod("batchFetchSources", List.class);
      batchFetchSources.setAccessible(true);
      Map<UUID, EntityReference> bulk =
          (Map<UUID, EntityReference>) batchFetchSources.invoke(repository, List.of(memory));

      assertEquals(alphaId, single.getId(), "single path must pick the name-first source (Alpha)");
      assertTrue(bulk.containsKey(memoryId), "bulk path must resolve a source for the memory");
      assertEquals(
          alphaId,
          bulk.get(memoryId).getId(),
          "bulk path must pick the name-first source, matching the single path");
      assertEquals(
          single.getId(),
          bulk.get(memoryId).getId(),
          "list (bulk) and detail (single) must agree on sourceEntity id");
    }
  }

  /**
   * Archiving saves the file deleted before its memories are released, so the reload no longer
   * lists it and the update changes nothing: only the release itself can drop the stale chip.
   */
  @Test
  void releasingASoftDeletedRelatedSourceRefreshesTheMemorysSearchDocument() {
    EntityReference anchor = contextFile("Anchor");
    EntityReference archived = contextFile("Archived").withDeleted(true);
    ContextMemory reloaded =
        memory(MemoryVisibility.ENTITY)
            .withSourceEntity(anchor)
            .withPrimaryEntity(anchor)
            .withRelatedEntities(List.of());
    UUID memoryId = reloaded.getId();
    linkSources(memoryId, anchor, archived);
    ContextMemoryRepository memories = reparentingChangesNothing(reloaded);
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      entities
          .when(
              () ->
                  Entity.getEntityReferencesByIds(
                      eq(Entity.CONTEXT_FILE), anyList(), any(Include.class)))
          .thenAnswer(
              call -> resolveSources(call.getArgument(1), call.getArgument(2), anchor, archived));

      memories.releaseExtractedMemory(memoryId, archived);
    }

    ArgumentCaptor<EntityReference> refreshed = ArgumentCaptor.forClass(EntityReference.class);
    InOrder release = inOrder(relationshipDAO, dispatcher);
    verifyLinkDeleted(release, archived, memoryId, Relationship.MENTIONED_IN);
    verifyLinkDeleted(release, archived, memoryId, Relationship.RELATED_TO);
    release.verify(dispatcher).onEntityUpdated(refreshed.capture(), isNull());
    verifyNoMoreInteractions(dispatcher);
    assertEquals(memoryId, refreshed.getValue().getId());
    assertEquals(Entity.CONTEXT_MEMORY, refreshed.getValue().getType());
  }

  /** The hook runs after the file is saved deleted, so the memory's only source is not live. */
  @Test
  void archivingTheOnlySourceSoftDeletesTheMemoryAndKeepsItsLink() {
    EntityReference archived = contextFile("Archived").withDeleted(true);
    ContextMemory stored = memory(MemoryVisibility.ENTITY);
    UUID memoryId = stored.getId();
    sourceMentions(archived, stored);
    linkSources(memoryId, archived);
    ContextMemoryRepository memories = deletesRecorded(spy(repository));
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(entities, archived, stored.getEntityReference());

      memories.archiveExtractedMemories(archived.getId(), archived.getType());
    }

    verify(memories).delete(Entity.ADMIN_USER_NAME, memoryId, false, false);
    verify(memories, never()).delete(any(), any(UUID.class), anyBoolean(), eq(true));
    verify(relationshipDAO, never())
        .delete(any(UUID.class), anyString(), any(UUID.class), anyString(), anyInt());
    verifyNoInteractions(dispatcher);
  }

  /** An anchor on the private copy would hide the memory from the org-wide copy's readers. */
  @Test
  void archivingTheAnchorMovesItToAnOrgWideLiveSourceAndRefreshes() {
    EntityReference archived = contextFile("A").withDeleted(true);
    EntityReference restricted = contextFile("B");
    EntityReference orgWide = contextFile("C");
    ContextMemory stored =
        memory(MemoryVisibility.ENTITY)
            .withPrimaryEntity(archived)
            .withSourceEntity(restricted)
            .withRelatedEntities(List.of(restricted, orgWide));
    UUID memoryId = stored.getId();
    sourceMentions(archived, stored);
    linkSources(memoryId, archived, restricted, orgWide);
    ContextMemoryRepository memories = deletesRecorded(loads(stored, Include.NON_DELETED));
    doReturn(new PutResponse<>(Response.Status.OK, stored, EventType.ENTITY_UPDATED))
        .when(memories)
        .update(isNull(), any(), any(), eq(Entity.ADMIN_USER_NAME));
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(entities, archived, restricted, orgWide, stored.getEntityReference());
      sharedAs(entities, restricted, MemoryVisibility.PRIVATE);
      sharedAs(entities, orgWide, MemoryVisibility.ENTITY);

      memories.archiveExtractedMemories(archived.getId(), archived.getType());
    }

    ArgumentCaptor<ContextMemory> reanchored = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memories).update(isNull(), eq(stored), reanchored.capture(), eq(Entity.ADMIN_USER_NAME));
    assertEquals(orgWide.getId(), reanchored.getValue().getPrimaryEntity().getId());
    assertEquals(List.of(restricted.getId()), ids(reanchored.getValue().getRelatedEntities()));
    assertEquals(restricted.getId(), reanchored.getValue().getSourceEntity().getId());
    verify(relationshipDAO, never())
        .delete(eq(archived.getId()), anyString(), eq(memoryId), anyString(), anyInt());
    verify(memories, never()).delete(any(), any(UUID.class), anyBoolean(), anyBoolean());
    verify(dispatcher)
        .onEntityUpdated(argThat((EntityReference ref) -> memoryId.equals(ref.getId())), isNull());
  }

  /**
   * Permanently deleting one of two archived copies: the memory waits in the Archive for the other.
   * An update would restore it, so its anchor moves to that copy by its edges alone.
   */
  @Test
  void releasingAnArchivedMemoryMovesItsAnchorWithoutRestoringIt() {
    EntityReference released = contextFile("Released").withDeleted(true);
    EntityReference kept = contextFile("Kept").withDeleted(true);
    ContextMemory archived = memory(MemoryVisibility.ENTITY).withDeleted(true);
    UUID memoryId = archived.getId();
    linkSources(memoryId, released, kept);
    ContextMemoryRepository memories = deletesRecorded(loads(archived, Include.ALL));
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(entities, released, kept);

      memories.releaseExtractedMemory(memoryId, released);
    }

    verify(memories, never()).delete(any(), any(UUID.class), anyBoolean(), anyBoolean());
    verify(memories, never()).update(any(), any(), any(), any());
    verifyLinkAdded(kept, memoryId, Relationship.APPLIED_TO);
    InOrder release = inOrder(relationshipDAO);
    verifyLinkDeleted(release, kept, memoryId, Relationship.RELATED_TO);
    verifyLinkDeleted(release, released, memoryId, Relationship.MENTIONED_IN);
    verifyLinkDeleted(release, released, memoryId, Relationship.APPLIED_TO);
    verifyNoInteractions(dispatcher);
  }

  /**
   * Re-extraction drops a fact from its last live source while an archived copy still states it.
   * The memory is archived for that copy rather than deleted, and its anchor moves onto the copy.
   */
  @Test
  void releasingTheLastLiveSourceArchivesTheMemoryForItsArchivedCopy() {
    EntityReference released = contextFile("Live");
    EntityReference archivedCopy = contextFile("Archived").withDeleted(true);
    ContextMemory live = memory(MemoryVisibility.ENTITY);
    UUID memoryId = live.getId();
    linkSources(memoryId, released, archivedCopy);
    ContextMemoryRepository memories = deletesRecorded(loads(live, Include.ALL));
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      resolveReferences(entities, released, archivedCopy);

      assertTrue(memories.hasOtherSources(memoryId, released));
      memories.releaseExtractedMemory(memoryId, released);
    }

    verify(memories).delete(Entity.ADMIN_USER_NAME, memoryId, false, false);
    verify(memories, never()).delete(any(), any(UUID.class), anyBoolean(), eq(true));
    verify(memories, never()).update(any(), any(), any(), any());
    verifyLinkAdded(archivedCopy, memoryId, Relationship.APPLIED_TO);
    InOrder release = inOrder(relationshipDAO);
    verifyLinkDeleted(release, released, memoryId, Relationship.MENTIONED_IN);
    verifyLinkDeleted(release, released, memoryId, Relationship.APPLIED_TO);
    verifyNoInteractions(dispatcher);
  }

  /** Every file mentions the memory: the first is its anchor and the rest are related sources. */
  private void linkSources(UUID memoryId, EntityReference anchor, EntityReference... related) {
    when(relationshipDAO.findFrom(
            memoryId, Entity.CONTEXT_MEMORY, Relationship.MENTIONED_IN.ordinal()))
        .thenReturn(
            edgesFrom(
                Stream.concat(Stream.of(anchor), Stream.of(related))
                    .toArray(EntityReference[]::new)));
    when(relationshipDAO.findFrom(
            memoryId, Entity.CONTEXT_MEMORY, Relationship.APPLIED_TO.ordinal(), anchor.getType()))
        .thenReturn(edgesFrom(anchor));
    when(relationshipDAO.findFrom(
            memoryId, Entity.CONTEXT_MEMORY, Relationship.APPLIED_TO.ordinal()))
        .thenReturn(edgesFrom(anchor));
    when(relationshipDAO.findFrom(
            memoryId, Entity.CONTEXT_MEMORY, Relationship.RELATED_TO.ordinal(), anchor.getType()))
        .thenReturn(edgesFrom(related));
  }

  /** The source's MENTIONED_IN edge to the memory, as a lookup of the source's memories reads it. */
  private void sourceMentions(EntityReference source, ContextMemory memory) {
    when(relationshipDAO.findTo(
            source.getId(),
            source.getType(),
            Relationship.MENTIONED_IN.ordinal(),
            Entity.CONTEXT_MEMORY))
        .thenReturn(edgesFrom(memory.getEntityReference()));
  }

  /** The file as stored, shared as {@code visibility}. */
  private static void sharedAs(
      MockedStatic<Entity> entities, EntityReference file, MemoryVisibility visibility) {
    ContextFile stored =
        new ContextFile()
            .withId(file.getId())
            .withName(file.getName())
            .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
    entities
        .when(
            () ->
                Entity.getEntity(
                    argThat(
                        (EntityReference ref) -> ref != null && file.getId().equals(ref.getId())),
                    eq(""),
                    eq(Include.NON_DELETED)))
        .thenReturn(stored);
  }

  private static List<UUID> ids(List<EntityReference> references) {
    return references.stream().map(EntityReference::getId).toList();
  }

  /** The memory reads back as {@code stored} when loaded with {@code include}. */
  private ContextMemoryRepository loads(ContextMemory stored, Include include) {
    ContextMemoryRepository memories = spy(repository);
    doReturn(stored)
        .when(memories)
        .get(isNull(), eq(stored.getId()), any(), eq(include), eq(false));
    return memories;
  }

  /** Deletes are recorded, not run: the delete pipeline itself is covered by the ITs. */
  private static ContextMemoryRepository deletesRecorded(ContextMemoryRepository memories) {
    doReturn(new DeleteResponse<>(null, EventType.ENTITY_SOFT_DELETED))
        .when(memories)
        .delete(any(), any(UUID.class), anyBoolean(), anyBoolean());
    return memories;
  }

  /** Resolves every reference lookup from {@code references}, as the database would. */
  private static void resolveReferences(
      MockedStatic<Entity> entities, EntityReference... references) {
    entities
        .when(() -> Entity.getEntityReferencesByIds(anyString(), anyList(), any(Include.class)))
        .thenAnswer(call -> resolveSources(call.getArgument(1), call.getArgument(2), references));
  }

  private void verifyLinkAdded(EntityReference source, UUID memoryId, Relationship relationship) {
    verify(relationshipDAO)
        .insert(
            source.getId(),
            memoryId,
            source.getType(),
            Entity.CONTEXT_MEMORY,
            relationship.ordinal(),
            "",
            null);
  }

  /** The memory reloads as {@code reloaded}, and updating it to the same content writes nothing. */
  private ContextMemoryRepository reparentingChangesNothing(ContextMemory reloaded) {
    ContextMemoryRepository memories = loads(reloaded, Include.ALL);
    doReturn(new PutResponse<>(Response.Status.OK, reloaded, EventType.ENTITY_NO_CHANGE))
        .when(memories)
        .update(isNull(), any(), any(), eq(Entity.ADMIN_USER_NAME));
    return memories;
  }

  private void verifyLinkDeleted(
      InOrder order, EntityReference source, UUID memoryId, Relationship relationship) {
    order
        .verify(relationshipDAO)
        .delete(
            source.getId(),
            source.getType(),
            memoryId,
            Entity.CONTEXT_MEMORY,
            relationship.ordinal());
  }

  private static EntityReference contextFile(String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.CONTEXT_FILE)
        .withName(name);
  }

  private static List<CollectionDAO.EntityRelationshipRecord> edgesFrom(
      EntityReference... sources) {
    return Stream.of(sources)
        .map(
            source ->
                CollectionDAO.EntityRelationshipRecord.builder()
                    .id(source.getId())
                    .type(source.getType())
                    .build())
        .toList();
  }

  /** Resolves source ids as the database does, where a non-deleted lookup skips deleted ones. */
  private static List<EntityReference> resolveSources(
      List<UUID> ids, Include include, EntityReference... sources) {
    return Stream.of(sources)
        .filter(source -> ids.contains(source.getId()))
        .filter(
            source -> include != Include.NON_DELETED || !Boolean.TRUE.equals(source.getDeleted()))
        .toList();
  }

  private ContextMemory memory(MemoryVisibility visibility) {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("mem")
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }
}
