/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.approval;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.governance.OverrideChangeRequest;
import org.openmetadata.schema.api.governance.WithdrawChangeRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeLifecycleEvent;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestPreview;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.governance.changeRequest.DecisionType;
import org.openmetadata.schema.governance.changeRequest.LifecycleEventType;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GovernanceDAOs.ApprovalDecisionDAO;
import org.openmetadata.service.jdbi3.GovernanceDAOs.ChangeLifecycleEventDAO;
import org.openmetadata.service.jdbi3.GovernanceDAOs.ChangeRequestDAO;
import org.openmetadata.service.jdbi3.GovernanceDAOs.ChangeRevisionDAO;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.PostCommitActionQueue;

/**
 * Unit tests for the change request aggregate operations that do not need a running workflow:
 * administrator override, withdrawal, ending a request, preview and the history reads. The DAOs are
 * mocked, and the entity repository runs each transaction body inline.
 */
class ChangeRequestServiceTest {
  private static final String REQUESTER = "alice";
  private static final String ADMIN = "admin";

  private MockedStatic<Entity> entity;
  private MockedStatic<ChangeApplyService> apply;
  private MockedStatic<ChangeRequestTasks> tasks;
  private ChangeRequestDAO requests;
  private ChangeRevisionDAO revisions;
  private ApprovalDecisionDAO decisions;
  private ChangeLifecycleEventDAO events;
  private EntityRepository<?> repository;

  @BeforeEach
  void setUp() {
    CollectionDAO dao = mock(CollectionDAO.class);
    requests = mock(ChangeRequestDAO.class);
    revisions = mock(ChangeRevisionDAO.class);
    decisions = mock(ApprovalDecisionDAO.class);
    events = mock(ChangeLifecycleEventDAO.class);
    when(dao.changeRequestDAO()).thenReturn(requests);
    when(dao.changeRevisionDAO()).thenReturn(revisions);
    when(dao.approvalDecisionDAO()).thenReturn(decisions);
    when(dao.changeLifecycleEventDAO()).thenReturn(events);

    repository = mock(EntityRepository.class);
    EntityDAO<?> entityDao = mock(EntityDAO.class);
    when(repository.getDao()).thenAnswer(invocation -> entityDao);
    when(entityDao.findJsonByIdForUpdate(any(), any())).thenReturn("{}");
    when(repository.executeInTransaction(any()))
        .thenAnswer(invocation -> invocation.<Supplier<?>>getArgument(0).get());

    entity = mockStatic(Entity.class);
    entity.when(Entity::getCollectionDAO).thenReturn(dao);
    entity.when(() -> Entity.getEntityRepository(anyString())).thenAnswer(i -> repository);
    apply = mockStatic(ChangeApplyService.class);
    tasks = mockStatic(ChangeRequestTasks.class);
  }

  @AfterEach
  void tearDown() {
    tasks.close();
    apply.close();
    entity.close();
  }

  private ChangeRequest stored(ChangeRequestStatus status, int revisionNumber) {
    UUID id = UUID.randomUUID();
    ChangeRevision revision =
        new ChangeRevision()
            .withId(UUID.randomUUID())
            .withChangeRequestId(id)
            .withRevisionNumber(revisionNumber)
            .withDigest("digest-" + revisionNumber);
    ChangeRequest request =
        new ChangeRequest()
            .withId(id)
            .withEntityType(Entity.GLOSSARY)
            .withEntityId(UUID.randomUUID())
            .withEntityFullyQualifiedName("g")
            .withRequestedBy(REQUESTER)
            .withStatus(status)
            .withActiveRevisionId(revision.getId())
            .withActiveRevisionNumber(revisionNumber)
            .withTaskId(UUID.randomUUID());
    when(requests.findById(id)).thenReturn(request);
    when(requests.findByIdForUpdate(id)).thenReturn(request);
    when(revisions.findById(revision.getId())).thenReturn(revision);
    return request;
  }

  private static OverrideChangeRequest override(int revision, String reason) {
    return new OverrideChangeRequest().withExpectedRevision(revision).withReason(reason);
  }

  private List<ChangeLifecycleEvent> recordedEvents(int times) {
    ArgumentCaptor<ChangeLifecycleEvent> captor =
        ArgumentCaptor.forClass(ChangeLifecycleEvent.class);
    verify(events, org.mockito.Mockito.times(times)).insert(captor.capture());
    return captor.getAllValues();
  }

  @Nested
  class Override {
    @Test
    void recordsAnOverrideDecisionAndEventThenApplies() {
      ChangeRequest request = stored(ChangeRequestStatus.PENDING, 2);
      ChangeRequest applied = new ChangeRequest().withStatus(ChangeRequestStatus.APPLIED);
      apply.when(() -> ChangeApplyService.approveAndApply(request.getId(), 2)).thenReturn(applied);
      when(events.lastSequence(request.getId())).thenReturn(3);

      assertSame(
          applied, ChangeRequestService.override(request.getId(), override(2, "hotfix"), ADMIN));

      ArgumentCaptor<ApprovalDecision> decision = ArgumentCaptor.forClass(ApprovalDecision.class);
      verify(decisions).insert(decision.capture());
      assertEquals(DecisionType.OVERRIDE, decision.getValue().getDecision());
      assertEquals(ADMIN, decision.getValue().getDecidedBy());
      assertEquals("hotfix", decision.getValue().getComment());
      assertEquals(2, decision.getValue().getRevisionNumber());
      assertEquals(request.getActiveRevisionId(), decision.getValue().getRevisionId());
      assertEquals("digest-2", decision.getValue().getDigest());

      ChangeLifecycleEvent event = recordedEvents(1).get(0);
      assertEquals(LifecycleEventType.OVERRIDDEN, event.getEventType());
      assertEquals(4, event.getSequence());
      assertEquals(ADMIN, event.getActor());
      assertEquals("hotfix", event.getReason());
    }

    @Test
    void closesTheReviewTaskWithTheReason() {
      ChangeRequest request = stored(ChangeRequestStatus.PENDING, 1);
      ChangeRequestService.override(request.getId(), override(1, "hotfix"), ADMIN);
      tasks.verify(
          () ->
              ChangeRequestTasks.closeTask(
                  request.getTaskId(), "Published by admin without review: hotfix"));
    }

    @Test
    void anApprovedButUnappliedRequestCanBeOverridden() {
      ChangeRequest request = stored(ChangeRequestStatus.APPROVED, 1);
      ChangeRequestService.override(request.getId(), override(1, "retry publish"), ADMIN);
      apply.verify(() -> ChangeApplyService.approveAndApply(request.getId(), 1));
    }

    @Test
    void requesterCannotOverrideTheirOwnRequest() {
      ChangeRequest request = stored(ChangeRequestStatus.PENDING, 1);
      assertThrows(
          ForbiddenException.class,
          () -> ChangeRequestService.override(request.getId(), override(1, "mine"), REQUESTER));
      verify(decisions, never()).insert(any());
      apply.verify(() -> ChangeApplyService.approveAndApply(any(), anyInt()), never());
    }

    @Test
    void staleRevisionConflictsAndRecordsNothing() {
      ChangeRequest request = stored(ChangeRequestStatus.PENDING, 2);
      ClientErrorException error =
          assertThrows(
              ClientErrorException.class,
              () -> ChangeRequestService.override(request.getId(), override(1, "old"), ADMIN));
      assertEquals(409, error.getResponse().getStatus());
      verify(decisions, never()).insert(any());
      verify(events, never()).insert(any());
      apply.verify(() -> ChangeApplyService.approveAndApply(any(), anyInt()), never());
    }

    @Test
    void endedRequestConflicts() {
      for (ChangeRequestStatus ended :
          List.of(
              ChangeRequestStatus.APPLIED,
              ChangeRequestStatus.REJECTED,
              ChangeRequestStatus.CONFLICTED,
              ChangeRequestStatus.WITHDRAWN,
              ChangeRequestStatus.CANCELLED)) {
        ChangeRequest request = stored(ended, 1);
        ClientErrorException error =
            assertThrows(
                ClientErrorException.class,
                () -> ChangeRequestService.override(request.getId(), override(1, "late"), ADMIN),
                ended.value());
        assertEquals(409, error.getResponse().getStatus(), ended.value());
      }
      verify(decisions, never()).insert(any());
    }

    @Test
    void revisionMovedWhileWaitingForTheLockConflicts() {
      ChangeRequest seen = stored(ChangeRequestStatus.PENDING, 1);
      ChangeRequest locked =
          new ChangeRequest()
              .withId(seen.getId())
              .withEntityType(seen.getEntityType())
              .withEntityId(seen.getEntityId())
              .withRequestedBy(REQUESTER)
              .withStatus(ChangeRequestStatus.PENDING)
              .withActiveRevisionNumber(2);
      when(requests.findByIdForUpdate(seen.getId())).thenReturn(locked);
      assertThrows(
          ClientErrorException.class,
          () -> ChangeRequestService.override(seen.getId(), override(1, "raced"), ADMIN));
      verify(decisions, never()).insert(any());
    }

    @Test
    void unknownRequestIsNotFound() {
      assertThrows(
          NotFoundException.class,
          () -> ChangeRequestService.override(UUID.randomUUID(), override(1, "x"), ADMIN));
    }
  }

  @Nested
  class Finish {
    @Test
    void cancellingRecordsTheActorAndClosesTheTask() {
      ChangeRequest request = stored(ChangeRequestStatus.PENDING, 1);
      ChangeRequest result =
          ChangeRequestService.finish(
              request.getId(), null, ChangeRequestStatus.CANCELLED, "Cancelled by admin", ADMIN);

      assertEquals(ChangeRequestStatus.CANCELLED, result.getStatus());
      verify(requests).update(request);
      ChangeLifecycleEvent event = recordedEvents(1).get(0);
      assertEquals(LifecycleEventType.CANCELLED, event.getEventType());
      assertEquals(ChangeRequestStatus.PENDING, event.getFromStatus());
      assertEquals(ChangeRequestStatus.CANCELLED, event.getToStatus());
      assertEquals(ADMIN, event.getActor());
      tasks.verify(() -> ChangeRequestTasks.closeTask(request.getTaskId(), "Cancelled by admin"));
    }

    @Test
    void rejectionIsRecordedBySystemAndLeavesTheTaskToTheWorkflow() {
      ChangeRequest request = stored(ChangeRequestStatus.PENDING, 1);
      ChangeRequestService.finish(request.getId(), 1, ChangeRequestStatus.REJECTED, "no");

      ChangeLifecycleEvent event = recordedEvents(1).get(0);
      assertEquals(LifecycleEventType.REJECTED, event.getEventType());
      assertNull(event.getActor());
      tasks.verify(() -> ChangeRequestTasks.closeTask(any(), any()), never());
    }

    @Test
    void endedRequestIsLeftAloneAndRecordsNothing() {
      ChangeRequest request = stored(ChangeRequestStatus.APPLIED, 1);
      ChangeRequest result =
          ChangeRequestService.finish(request.getId(), null, ChangeRequestStatus.CANCELLED, "x");
      assertEquals(ChangeRequestStatus.APPLIED, result.getStatus());
      verify(requests, never()).update(any());
      verify(events, never()).insert(any());
    }

    @Test
    void revisionMismatchIsANoOp() {
      ChangeRequest request = stored(ChangeRequestStatus.PENDING, 3);
      ChangeRequest result =
          ChangeRequestService.finish(request.getId(), 2, ChangeRequestStatus.REJECTED, "stale");
      assertEquals(ChangeRequestStatus.PENDING, result.getStatus());
      verify(events, never()).insert(any());
    }
  }

  @Nested
  class Withdraw {
    @Test
    void requesterWithdrawsAndIsRecordedAsActor() {
      ChangeRequest request = stored(ChangeRequestStatus.PENDING, 1);
      ChangeRequestService.withdraw(
          request.getId(), new WithdrawChangeRequest().withExpectedRevision(1), REQUESTER);

      ChangeLifecycleEvent event = recordedEvents(1).get(0);
      assertEquals(LifecycleEventType.WITHDRAWN, event.getEventType());
      assertEquals(REQUESTER, event.getActor());
      assertEquals("Withdrawn by the requester", event.getReason());
    }

    @Test
    void someoneElseCannotWithdraw() {
      ChangeRequest request = stored(ChangeRequestStatus.PENDING, 1);
      assertThrows(
          ForbiddenException.class,
          () ->
              ChangeRequestService.withdraw(
                  request.getId(), new WithdrawChangeRequest().withExpectedRevision(1), "bob"));
      verify(events, never()).insert(any());
    }

    @Test
    void withdrawingAMovedRevisionConflicts() {
      ChangeRequest request = stored(ChangeRequestStatus.PENDING, 2);
      ClientErrorException error =
          assertThrows(
              ClientErrorException.class,
              () ->
                  ChangeRequestService.withdraw(
                      request.getId(),
                      new WithdrawChangeRequest().withExpectedRevision(1),
                      REQUESTER));
      assertEquals(409, error.getResponse().getStatus());
    }
  }

  @Nested
  class Preview {
    private final JsonPatch patch = Json.createPatchBuilder().replace("/description", "x").build();

    @Test
    void heldEditReportsTheReviewingWorkflowAndOps() {
      UUID entityId = UUID.randomUUID();
      UUID workflowId = UUID.randomUUID();
      List<MutationOp> ops = List.of(new MutationOp().withField("description").withGated(true));
      StagedChange staged =
          new StagedChange(Entity.GLOSSARY, entityId, "g", 0.1, REQUESTER, null, workflowId, ops);
      when(repository.previewPatch(entityId, REQUESTER, patch)).thenReturn(Optional.of(staged));

      ChangeRequestPreview preview =
          ChangeRequestService.preview(Entity.GLOSSARY, entityId, patch, REQUESTER);

      assertTrue(preview.getRequiresApproval());
      assertEquals(workflowId, preview.getWorkflowDefinitionId());
      assertEquals(ops, preview.getOps());
      assertEquals(Entity.GLOSSARY, preview.getEntityType());
      assertEquals(entityId, preview.getEntityId());
      verify(requests, never()).insert(any());
    }

    @Test
    void publishedEditRequiresNoApproval() {
      UUID entityId = UUID.randomUUID();
      when(repository.previewPatch(entityId, REQUESTER, patch)).thenReturn(Optional.empty());

      ChangeRequestPreview preview =
          ChangeRequestService.preview(Entity.GLOSSARY, entityId, patch, REQUESTER);

      assertFalse(preview.getRequiresApproval());
      assertNull(preview.getWorkflowDefinitionId());
      assertTrue(preview.getOps().isEmpty());
    }
  }

  @Nested
  class History {
    @Test
    void readsComeFromTheirOwnTables() {
      UUID id = UUID.randomUUID();
      List<ChangeRevision> revisionList = List.of(new ChangeRevision().withRevisionNumber(1));
      List<ApprovalDecision> decisionList =
          List.of(new ApprovalDecision().withDecision(DecisionType.APPROVE));
      List<ChangeLifecycleEvent> eventList =
          List.of(new ChangeLifecycleEvent().withEventType(LifecycleEventType.SUBMITTED));
      when(revisions.listByRequest(id)).thenReturn(revisionList);
      when(decisions.listByRequest(id)).thenReturn(decisionList);
      when(events.listByRequest(id)).thenReturn(eventList);

      assertSame(revisionList, ChangeRequestService.revisions(id));
      assertSame(decisionList, ChangeRequestService.decisions(id));
      assertSame(eventList, ChangeRequestService.events(id));
    }

    @Test
    void activeRevisionsAreReadInOneQueryAndKeyedById() {
      ChangeRequest first = stored(ChangeRequestStatus.PENDING, 1);
      ChangeRequest second = stored(ChangeRequestStatus.PENDING, 1);
      ChangeRevision a = new ChangeRevision().withId(first.getActiveRevisionId());
      ChangeRevision b = new ChangeRevision().withId(second.getActiveRevisionId());
      when(revisions.findByIds(any())).thenReturn(List.of(a, b));

      Map<UUID, ChangeRevision> active =
          ChangeRequestService.activeRevisions(List.of(first, second, first));

      assertEquals(Map.of(a.getId(), a, b.getId(), b), active);
      verify(revisions)
          .findByIds(
              eq(
                  List.of(
                      first.getActiveRevisionId().toString(),
                      second.getActiveRevisionId().toString())));
    }

    @Test
    void noRequestsMeansNoQuery() {
      assertTrue(ChangeRequestService.activeRevisions(List.of()).isEmpty());
      verify(revisions, never()).findByIds(any());
    }
  }

  @Nested
  class AttachTask {
    @Test
    void openRequestAtTheReviewedRevisionIsLinked() {
      ChangeRequest request = stored(ChangeRequestStatus.PENDING, 2);
      UUID task = UUID.randomUUID();
      assertTrue(ChangeRequestService.attachTask(request.getId(), 2, task));
      assertEquals(task, request.getTaskId());
      verify(requests).update(request);
    }

    @Test
    void endedRequestIsNotLinkedSoItsTaskGetsClosed() {
      for (ChangeRequestStatus ended :
          List.of(
              ChangeRequestStatus.APPLIED,
              ChangeRequestStatus.REJECTED,
              ChangeRequestStatus.CONFLICTED,
              ChangeRequestStatus.WITHDRAWN,
              ChangeRequestStatus.CANCELLED)) {
        ChangeRequest request = stored(ended, 1);
        UUID previous = request.getTaskId();
        assertFalse(
            ChangeRequestService.attachTask(request.getId(), 1, UUID.randomUUID()), ended.value());
        assertEquals(previous, request.getTaskId(), ended.value());
      }
      verify(requests, never()).update(any());
    }

    @Test
    void supersededRevisionIsNotLinked() {
      ChangeRequest request = stored(ChangeRequestStatus.PENDING, 3);
      assertFalse(ChangeRequestService.attachTask(request.getId(), 2, UUID.randomUUID()));
      verify(requests, never()).update(any());
    }

    @Test
    void approvedButUnappliedRequestIsStillLinked() {
      ChangeRequest request = stored(ChangeRequestStatus.APPROVED, 1);
      assertTrue(ChangeRequestService.attachTask(request.getId(), 1, UUID.randomUUID()));
    }

    @Test
    void unknownRequestIsNotLinked() {
      assertFalse(ChangeRequestService.attachTask(UUID.randomUUID(), 1, UUID.randomUUID()));
    }
  }

  @Nested
  class SubmitCountsHeldEdit {
    private MockedStatic<AsyncService> async;
    private SimpleMeterRegistry meters;
    private final UUID entityId = UUID.randomUUID();

    @BeforeEach
    void setUpSubmission() {
      async = mockStatic(AsyncService.class);
      async.when(AsyncService::getInstance).thenReturn(mock(AsyncService.class));
      meters = new SimpleMeterRegistry();
      Metrics.addRegistry(meters);
      when(repository.getEntityClass()).thenAnswer(i -> Glossary.class);
      when(repository.getDao().findJsonByIdForUpdate(entityId, Include.NON_DELETED))
          .thenReturn(JsonUtils.pojoToJson(new Glossary().withId(entityId).withVersion(0.1)));
    }

    @AfterEach
    void tearDownSubmission() {
      PostCommitActionQueue.clear();
      Metrics.removeRegistry(meters);
      async.close();
    }

    private StagedChange staged() {
      return new StagedChange(
          Entity.GLOSSARY,
          entityId,
          "g",
          0.1,
          REQUESTER,
          null,
          UUID.randomUUID(),
          List.of(new MutationOp().withField("description").withGated(true)));
    }

    private double held() {
      var counter =
          meters
              .find("change_request_admission")
              .tags("entityType", Entity.GLOSSARY, "outcome", "held")
              .counter();
      return counter == null ? 0 : counter.count();
    }

    @Test
    void heldEditIsCountedWhenTheSubmissionCommits() {
      PostCommitActionQueue.begin();
      ChangeRequest request = ChangeRequestService.submit(staged());
      assertEquals(0, held(), "not counted before commit");

      PostCommitActionQueue.run(PostCommitActionQueue.drain());

      assertEquals(1, held());
      assertEquals(ChangeRequestStatus.PENDING, request.getStatus());
      ChangeLifecycleEvent submitted = recordedEvents(1).get(0);
      assertEquals(LifecycleEventType.SUBMITTED, submitted.getEventType());
      assertEquals(REQUESTER, submitted.getActor());
    }

    @Test
    void rolledBackSubmissionIsNotCounted() {
      PostCommitActionQueue.begin();
      ChangeRequestService.submit(staged());

      PostCommitActionQueue.clear();

      assertEquals(0, held());
    }

    @Test
    void entityMovedSinceTheEditConflictsAndCountsNothing() {
      when(repository.getDao().findJsonByIdForUpdate(entityId, Include.NON_DELETED))
          .thenReturn(JsonUtils.pojoToJson(new Glossary().withId(entityId).withVersion(0.2)));
      ClientErrorException error =
          assertThrows(ClientErrorException.class, () -> ChangeRequestService.submit(staged()));
      assertEquals(409, error.getResponse().getStatus());
      assertEquals(0, held());
      verify(requests, never()).insert(any());
    }
  }

  @Test
  void cancellingForDeletedEntitiesEndsEachOpenRequest() {
    ChangeRequest request = stored(ChangeRequestStatus.PENDING, 1);
    when(requests.listByEntitiesAndStatuses(any(), any())).thenReturn(List.of(request));

    ChangeRequestService.cancelForDeletedEntities(List.of(request.getEntityId()));

    verify(requests)
        .listByEntitiesAndStatuses(
            List.of(request.getEntityId().toString()), List.of("Pending", "Approved"));
    assertEquals(ChangeRequestStatus.CANCELLED, request.getStatus());
    assertEquals("g was deleted", request.getStatusReason());
    verify(repository.getDao()).findJsonByIdForUpdate(request.getEntityId(), Include.ALL);
  }

  @Test
  void cancellingSkipsEntitiesThatWereNeverStored() {
    ChangeRequestService.cancelForDeletedEntities(Arrays.asList(null, null));
    verify(requests, never()).listByEntitiesAndStatuses(any(), any());

    UUID stored = UUID.randomUUID();
    ChangeRequestService.cancelForDeletedEntities(Arrays.asList(null, stored));
    verify(requests)
        .listByEntitiesAndStatuses(List.of(stored.toString()), List.of("Pending", "Approved"));
  }

  @Test
  void cancellingForNoEntitiesQueriesNothing() {
    ChangeRequestService.cancelForDeletedEntities(List.of());
    verify(requests, never()).listByEntitiesAndStatuses(any(), any());
  }
}
