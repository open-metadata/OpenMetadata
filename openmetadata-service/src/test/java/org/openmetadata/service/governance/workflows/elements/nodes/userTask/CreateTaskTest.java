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

package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.Period;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TaskRepository;

class CreateTaskTest {

  @Test
  void testResolveExistingTaskAssigneesDefersToCurrentDatabaseAssignmentsDuringPendingStart() {
    EntityReference existingAssignee =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("shared_user2")
            .withFullyQualifiedName("shared_user2");
    EntityReference workflowAssignee =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("shared_user1")
            .withFullyQualifiedName("shared_user1");

    Task existingTask =
        new Task()
            .withId(UUID.randomUUID())
            .withWorkflowStageId(CreateTask.PENDING_WORKFLOW_START_STAGE_ID)
            .withAssignees(List.of(existingAssignee));

    List<EntityReference> resolved =
        CreateTask.resolveExistingTaskAssignees(
            existingTask, List.of(workflowAssignee), List.of(workflowAssignee));

    assertNull(resolved);
  }

  @Test
  void testResolveExistingTaskAssigneesPreservesDatabaseAssignmentsAfterMaterialization() {
    EntityReference existingAssignee =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("shared_user2")
            .withFullyQualifiedName("shared_user2");
    EntityReference workflowAssignee =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("shared_user1")
            .withFullyQualifiedName("shared_user1");

    Task existingTask =
        new Task()
            .withId(UUID.randomUUID())
            .withWorkflowStageId("review")
            .withAssignees(List.of(existingAssignee));

    List<EntityReference> resolved =
        CreateTask.resolveExistingTaskAssignees(
            existingTask, List.of(workflowAssignee), List.of(workflowAssignee));

    assertNull(resolved);
  }

  @Test
  void testResolveExistingTaskAssigneesUsesWorkflowAssigneesForWorkflowNativeTasks() {
    EntityReference workflowAssignee =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("shared_user1")
            .withFullyQualifiedName("shared_user1");

    Task existingTask =
        new Task().withId(UUID.randomUUID()).withWorkflowStageId("review").withAssignees(null);

    List<EntityReference> resolved =
        CreateTask.resolveExistingTaskAssignees(existingTask, List.of(workflowAssignee), null);

    assertEquals(List.of(workflowAssignee), resolved);
  }

  @Test
  void testShouldSkipDeletedWorkflowManagedDraftTaskWhenPendingDraftWasRemoved() {
    assertTrue(CreateTask.shouldSkipDeletedWorkflowManagedDraftTask(UUID.randomUUID(), true, null));
  }

  @Test
  void testShouldNotSkipTaskMaterializationForWorkflowNativeOrExistingTasks() {
    Task existingTask = new Task().withId(UUID.randomUUID());

    assertFalse(
        CreateTask.shouldSkipDeletedWorkflowManagedDraftTask(UUID.randomUUID(), false, null));
    assertFalse(CreateTask.shouldSkipDeletedWorkflowManagedDraftTask(null, true, null));
    assertFalse(
        CreateTask.shouldSkipDeletedWorkflowManagedDraftTask(
            UUID.randomUUID(), true, existingTask));
  }

  @Test
  void testFindExistingTaskWithRetryBridgesTransientDraftVisibilityGap() {
    UUID taskId = UUID.randomUUID();
    TaskRepository taskRepository = Mockito.mock(TaskRepository.class);
    Task existingTask = new Task().withId(taskId);

    when(taskRepository.find(taskId, Include.ALL))
        .thenThrow(EntityNotFoundException.byId(taskId.toString()))
        .thenReturn(existingTask);

    Task resolvedTask = CreateTask.findExistingTaskWithRetry(taskRepository, taskId, true);

    assertEquals(existingTask, resolvedTask);
    verify(taskRepository, times(2)).find(taskId, Include.ALL);
  }

  @Test
  void testFindExistingTaskWithRetryDoesSingleLookupForNonWorkflowManagedTasks() {
    UUID taskId = UUID.randomUUID();
    TaskRepository taskRepository = Mockito.mock(TaskRepository.class);
    Task existingTask = new Task().withId(taskId);

    when(taskRepository.find(taskId, Include.ALL)).thenReturn(existingTask);

    Task resolvedTask = CreateTask.findExistingTaskWithRetry(taskRepository, taskId, false);

    assertEquals(existingTask, resolvedTask);
    verify(taskRepository).find(taskId, Include.ALL);
  }

  @Test
  void testFindExistingTaskWithRetryReturnsNullAfterExhaustingWorkflowManagedLookup() {
    UUID taskId = UUID.randomUUID();
    TaskRepository taskRepository = Mockito.mock(TaskRepository.class);

    when(taskRepository.find(taskId, Include.ALL))
        .thenThrow(EntityNotFoundException.byId(taskId.toString()));

    Task resolvedTask = CreateTask.findExistingTaskWithRetry(taskRepository, taskId, true);

    assertNull(resolvedTask);
    verify(taskRepository, times(6)).find(taskId, Include.ALL);
  }

  @Test
  void testIsTerminalTaskStatusReturnsTrueForResolvedStates() {
    assertTrue(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Rejected));
    assertTrue(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Completed));
    assertTrue(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Cancelled));
    assertTrue(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Failed));
    assertTrue(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Revoked));
  }

  @Test
  void testIsTerminalTaskStatusReturnsFalseForOpenStates() {
    assertFalse(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Open));
    assertFalse(CreateTask.isTerminalTaskStatus(TaskEntityStatus.InProgress));
    assertFalse(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Pending));
    // Approved and Granted are non-terminal so the next-stage CreateTask listener
    // (e.g. Data Access Request's ApprovedAccess → GrantedAccess advancement) can
    // update status/workflowStageId/availableTransitions instead of preserving
    // stale state. See the DataAccessRequestTaskWorkflow.json edges.
    assertFalse(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Approved));
    assertFalse(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Granted));
    assertFalse(CreateTask.isTerminalTaskStatus(null));
  }

  @Test
  void testTaskRepositoryActiveStatusesMatchTerminalPredicate() {
    List<TaskEntityStatus> expected =
        java.util.Arrays.stream(TaskEntityStatus.values())
            .filter(s -> !CreateTask.isTerminalTaskStatus(s))
            .toList();
    assertEquals(
        expected,
        TaskRepository.NON_TERMINAL_TASK_STATUSES,
        () ->
            "TaskRepository.NON_TERMINAL_TASK_STATUSES drifted from CreateTask.isTerminalTaskStatus. "
                + "Add the new non-terminal status to NON_TERMINAL_TASK_STATUSES so the duplicate-DAR "
                + "guard keeps treating it as active.");
  }

  // ---- resolveEffectiveDueDate ----

  @Test
  void testResolveEffectiveDueDatePreservesRequestedDueDateForNonGrantedStatus() {
    Long requested = 999L;
    assertEquals(
        requested,
        CreateTask.resolveEffectiveDueDate(
            TaskEntityStatus.Approved, Map.of("duration", "P14D"), requested));
    assertEquals(
        requested,
        CreateTask.resolveEffectiveDueDate(
            TaskEntityStatus.Open, Map.of("duration", "P14D"), requested));
  }

  @Test
  void testResolveEffectiveDueDatePreservesRequestedDueDateWhenPayloadIsNull() {
    Long requested = 999L;
    assertEquals(
        requested, CreateTask.resolveEffectiveDueDate(TaskEntityStatus.Granted, null, requested));
  }

  @Test
  void testResolveEffectiveDueDatePreservesRequestedDueDateForNonMapPayload() {
    Long requested = 999L;
    assertEquals(
        requested,
        CreateTask.resolveEffectiveDueDate(TaskEntityStatus.Granted, "plain-string", requested));
    assertEquals(
        requested,
        CreateTask.resolveEffectiveDueDate(TaskEntityStatus.Granted, List.of("a"), requested));
    assertEquals(
        requested, CreateTask.resolveEffectiveDueDate(TaskEntityStatus.Granted, 42, requested));
  }

  @Test
  void testResolveEffectiveDueDatePreservesRequestedDueDateWhenDurationKeyAbsent() {
    Long requested = 999L;
    assertEquals(
        requested,
        CreateTask.resolveEffectiveDueDate(
            TaskEntityStatus.Granted, Map.of("accessType", "FullAccess"), requested));
  }

  @Test
  void testResolveEffectiveDueDatePreservesRequestedDueDateWhenDurationIsNonString() {
    Long requested = 999L;
    assertEquals(
        requested,
        CreateTask.resolveEffectiveDueDate(
            TaskEntityStatus.Granted, Map.of("duration", 14), requested));
  }

  @Test
  void testResolveEffectiveDueDatePreservesRequestedDueDateWhenDurationIsBlank() {
    Long requested = 999L;
    assertEquals(
        requested,
        CreateTask.resolveEffectiveDueDate(
            TaskEntityStatus.Granted, Map.of("duration", "   "), requested));
  }

  @Test
  void testResolveEffectiveDueDateComputesDayDuration() {
    long before = System.currentTimeMillis();
    Long result =
        CreateTask.resolveEffectiveDueDate(
            TaskEntityStatus.Granted, Map.of("duration", "P14D"), 0L);
    long after = System.currentTimeMillis();

    long fourteenDays = 14L * 24 * 60 * 60 * 1000;
    assertTrue(result >= before + fourteenDays);
    assertTrue(result <= after + fourteenDays);
  }

  @Test
  void testResolveEffectiveDueDateComputesHourDuration() {
    long before = System.currentTimeMillis();
    Long result =
        CreateTask.resolveEffectiveDueDate(
            TaskEntityStatus.Granted, Map.of("duration", "PT2H"), 0L);
    long after = System.currentTimeMillis();

    long twoHours = 2L * 60 * 60 * 1000;
    assertTrue(result >= before + twoHours);
    assertTrue(result <= after + twoHours);
  }

  @Test
  void testResolveEffectiveDueDateComputesMonthDuration() {
    long before = System.currentTimeMillis();
    Long result =
        CreateTask.resolveEffectiveDueDate(TaskEntityStatus.Granted, Map.of("duration", "P1M"), 0L);
    long after = System.currentTimeMillis();

    long expectedMin =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(before), ZoneOffset.UTC)
            .plus(Period.ofMonths(1))
            .toInstant()
            .toEpochMilli();
    long expectedMax =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(after), ZoneOffset.UTC)
            .plus(Period.ofMonths(1))
            .toInstant()
            .toEpochMilli();
    assertTrue(result >= expectedMin && result <= expectedMax);
  }

  @Test
  void testResolveEffectiveDueDateComputesYearDuration() {
    long before = System.currentTimeMillis();
    Long result =
        CreateTask.resolveEffectiveDueDate(TaskEntityStatus.Granted, Map.of("duration", "P1Y"), 0L);
    long after = System.currentTimeMillis();

    long expectedMin =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(before), ZoneOffset.UTC)
            .plus(Period.ofYears(1))
            .toInstant()
            .toEpochMilli();
    long expectedMax =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(after), ZoneOffset.UTC)
            .plus(Period.ofYears(1))
            .toInstant()
            .toEpochMilli();
    assertTrue(result >= expectedMin && result <= expectedMax);
  }

  @Test
  void testResolveEffectiveDueDateComputesCombinedPeriod() {
    long before = System.currentTimeMillis();
    Long result =
        CreateTask.resolveEffectiveDueDate(
            TaskEntityStatus.Granted, Map.of("duration", "P2Y3M"), 0L);
    long after = System.currentTimeMillis();

    long expectedMin =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(before), ZoneOffset.UTC)
            .plus(Period.of(2, 3, 0))
            .toInstant()
            .toEpochMilli();
    long expectedMax =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(after), ZoneOffset.UTC)
            .plus(Period.of(2, 3, 0))
            .toInstant()
            .toEpochMilli();
    assertTrue(result >= expectedMin && result <= expectedMax);
  }

  @Test
  void testResolveEffectiveDueDateFallsBackForUnparseableDuration() {
    Long requested = 999L;
    assertEquals(
        requested,
        CreateTask.resolveEffectiveDueDate(
            TaskEntityStatus.Granted, Map.of("duration", "not-a-duration"), requested));
  }

  // ---- resolveEffectiveExpirationDate ----

  @Test
  void testResolveEffectiveExpirationDateReturnsNullForNonGrantedStatus() {
    assertNull(
        CreateTask.resolveEffectiveExpirationDate(
            TaskEntityStatus.Approved, Map.of("duration", "P14D")));
    assertNull(
        CreateTask.resolveEffectiveExpirationDate(
            TaskEntityStatus.Open, Map.of("duration", "P14D")));
    assertNull(
        CreateTask.resolveEffectiveExpirationDate(
            TaskEntityStatus.Revoked, Map.of("duration", "P14D")));
  }

  @Test
  void testResolveEffectiveExpirationDateReturnsNullForNullPayload() {
    assertNull(CreateTask.resolveEffectiveExpirationDate(TaskEntityStatus.Granted, null));
  }

  @Test
  void testResolveEffectiveExpirationDateReturnsNullForNonMapPayload() {
    assertNull(CreateTask.resolveEffectiveExpirationDate(TaskEntityStatus.Granted, "plain"));
    assertNull(CreateTask.resolveEffectiveExpirationDate(TaskEntityStatus.Granted, 42));
    assertNull(CreateTask.resolveEffectiveExpirationDate(TaskEntityStatus.Granted, List.of("a")));
  }

  @Test
  void testResolveEffectiveExpirationDateReturnsNullWhenDurationMissingOrBlank() {
    assertNull(
        CreateTask.resolveEffectiveExpirationDate(
            TaskEntityStatus.Granted, Map.of("accessType", "FullAccess")));
    assertNull(
        CreateTask.resolveEffectiveExpirationDate(
            TaskEntityStatus.Granted, Map.of("duration", "  ")));
  }

  @Test
  void testResolveEffectiveExpirationDateReturnsNullForNonStringDuration() {
    assertNull(
        CreateTask.resolveEffectiveExpirationDate(
            TaskEntityStatus.Granted, Map.of("duration", 14)));
  }

  @Test
  void testResolveEffectiveExpirationDateReturnsNullForUnparseableDuration() {
    assertNull(
        CreateTask.resolveEffectiveExpirationDate(
            TaskEntityStatus.Granted, Map.of("duration", "not-a-duration")));
  }

  @Test
  void testResolveEffectiveExpirationDateComputesDayDuration() {
    long before = System.currentTimeMillis();
    Long result =
        CreateTask.resolveEffectiveExpirationDate(
            TaskEntityStatus.Granted, Map.of("duration", "P14D"));
    long after = System.currentTimeMillis();

    assertNotNull(result);
    long fourteenDays = 14L * 24 * 60 * 60 * 1000;
    assertTrue(result >= before + fourteenDays);
    assertTrue(result <= after + fourteenDays);
  }

  @Test
  void testResolveEffectiveExpirationDateComputesHourDuration() {
    long before = System.currentTimeMillis();
    Long result =
        CreateTask.resolveEffectiveExpirationDate(
            TaskEntityStatus.Granted, Map.of("duration", "PT2H"));
    long after = System.currentTimeMillis();

    assertNotNull(result);
    long twoHours = 2L * 60 * 60 * 1000;
    assertTrue(result >= before + twoHours);
    assertTrue(result <= after + twoHours);
  }

  @Test
  void testResolveEffectiveExpirationDateIsIdempotentWhenPayloadAlreadyHasIt() {
    // Re-entry into the Granted stage (or upstream-set value) must not overwrite the
    // existing expirationDate — that would silently extend access on every reload.
    Long existing = 1700000000000L;
    Long result =
        CreateTask.resolveEffectiveExpirationDate(
            TaskEntityStatus.Granted, Map.of("duration", "P14D", "expirationDate", existing));
    assertEquals(existing, result);
  }

  // ---- withGrantExpirationDate ----

  @Test
  void testWithGrantExpirationDateMergesIntoPayloadOnGranted() {
    Map<String, Object> payload =
        Map.of("accessType", "Masked", "duration", "P14D", "reason", "audit");
    Object result = CreateTask.withGrantExpirationDate(TaskEntityStatus.Granted, payload);

    assertTrue(result instanceof Map<?, ?>);
    Map<?, ?> mergedMap = (Map<?, ?>) result;
    assertEquals("Masked", mergedMap.get("accessType"));
    assertEquals("P14D", mergedMap.get("duration"));
    assertEquals("audit", mergedMap.get("reason"));
    Object expiration = mergedMap.get("expirationDate");
    assertNotNull(expiration);
    assertTrue(expiration instanceof Long);
    long expirationMillis = (Long) expiration;
    assertTrue(expirationMillis > System.currentTimeMillis());
  }

  @Test
  void testWithGrantExpirationDateReturnsSameRefWhenNotGranted() {
    Map<String, Object> payload = Map.of("duration", "P14D");
    assertSame(payload, CreateTask.withGrantExpirationDate(TaskEntityStatus.Approved, payload));
  }

  @Test
  void testWithGrantExpirationDateReturnsSameRefWhenNoDuration() {
    Map<String, Object> payload = Map.of("accessType", "FullAccess");
    assertSame(payload, CreateTask.withGrantExpirationDate(TaskEntityStatus.Granted, payload));
  }

  @Test
  void testWithGrantExpirationDateReturnsSameRefWhenPayloadAlreadyHasExpirationDate() {
    Map<String, Object> payload = Map.of("duration", "P14D", "expirationDate", 1700000000000L);
    assertSame(payload, CreateTask.withGrantExpirationDate(TaskEntityStatus.Granted, payload));
  }

  @Test
  void testWithGrantExpirationDateReturnsSameRefWhenPayloadNotMap() {
    assertSame("string", CreateTask.withGrantExpirationDate(TaskEntityStatus.Granted, "string"));
    assertNull(CreateTask.withGrantExpirationDate(TaskEntityStatus.Granted, null));
  }

  @Test
  void testWithGrantExpirationDateDoesNotMutateOriginalPayload() {
    // The payload comes in from the workflow runtime; mutating it could leak state into
    // subsequent listeners. Confirm we produce a fresh map and leave the input alone.
    Map<String, Object> payload = new java.util.HashMap<>();
    payload.put("duration", "P14D");
    Object result = CreateTask.withGrantExpirationDate(TaskEntityStatus.Granted, payload);

    assertFalse(payload.containsKey("expirationDate"));
    assertTrue(result instanceof Map<?, ?>);
    assertTrue(((Map<?, ?>) result).containsKey("expirationDate"));
  }

  @Test
  void testResolveEffectiveDueDateWithNullRequestedDueDateAndValidDurationReturnsComputedValue() {
    Long result =
        CreateTask.resolveEffectiveDueDate(
            TaskEntityStatus.Granted, Map.of("duration", "P14D"), null);
    assertNotNull(result);
    assertTrue(result > System.currentTimeMillis());
  }

  // ---- parseMillisFromIso8601Duration ----

  @Test
  void testParseMillisFromIso8601DurationHandlesDays() {
    long before = System.currentTimeMillis();
    Long result = CreateTask.parseMillisFromIso8601Duration("P7D", 0L);
    long after = System.currentTimeMillis();

    long sevenDays = 7L * 24 * 60 * 60 * 1000;
    assertTrue(result >= before + sevenDays && result <= after + sevenDays);
  }

  @Test
  void testParseMillisFromIso8601DurationHandlesHoursAndMinutes() {
    long before = System.currentTimeMillis();
    Long result = CreateTask.parseMillisFromIso8601Duration("PT1H30M", 0L);
    long after = System.currentTimeMillis();

    long ninetyMin = 90L * 60 * 1000;
    assertTrue(result >= before + ninetyMin && result <= after + ninetyMin);
  }

  @Test
  void testParseMillisFromIso8601DurationHandlesMonths() {
    long before = System.currentTimeMillis();
    Long result = CreateTask.parseMillisFromIso8601Duration("P3M", 0L);
    long after = System.currentTimeMillis();

    long expectedMin =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(before), ZoneOffset.UTC)
            .plus(Period.ofMonths(3))
            .toInstant()
            .toEpochMilli();
    long expectedMax =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(after), ZoneOffset.UTC)
            .plus(Period.ofMonths(3))
            .toInstant()
            .toEpochMilli();
    assertTrue(result >= expectedMin && result <= expectedMax);
  }

  @Test
  void testParseMillisFromIso8601DurationHandlesYearsAndMonths() {
    long before = System.currentTimeMillis();
    Long result = CreateTask.parseMillisFromIso8601Duration("P1Y6M", 0L);
    long after = System.currentTimeMillis();

    long expectedMin =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(before), ZoneOffset.UTC)
            .plus(Period.of(1, 6, 0))
            .toInstant()
            .toEpochMilli();
    long expectedMax =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(after), ZoneOffset.UTC)
            .plus(Period.of(1, 6, 0))
            .toInstant()
            .toEpochMilli();
    assertTrue(result >= expectedMin && result <= expectedMax);
  }

  @Test
  void testParseMillisFromIso8601DurationReturnsFallbackForInvalidInput() {
    Long fallback = 12345L;
    assertEquals(fallback, CreateTask.parseMillisFromIso8601Duration("not-a-duration", fallback));
    assertEquals(fallback, CreateTask.parseMillisFromIso8601Duration("", fallback));
  }

  @Test
  void testParseMillisFromIso8601DurationReturnsFallbackForNullFallback() {
    assertNull(CreateTask.parseMillisFromIso8601Duration("garbage", null));
  }

  // ---- isSupersedablePriorApprovalTask ----

  @Test
  void testIsSupersedableWhenPriorBelongsToEarlierRunOfSameWorkflow() {
    UUID workflowDefinitionId = UUID.randomUUID();
    Task prior =
        new Task()
            .withId(UUID.randomUUID())
            .withWorkflowDefinitionId(workflowDefinitionId)
            .withWorkflowInstanceId(UUID.randomUUID());

    assertTrue(
        CreateTask.isSupersedablePriorApprovalTask(prior, workflowDefinitionId, UUID.randomUUID()));
  }

  @Test
  void testIsNotSupersedableWhenNoPriorTaskExists() {
    assertFalse(
        CreateTask.isSupersedablePriorApprovalTask(null, UUID.randomUUID(), UUID.randomUUID()));
  }

  @Test
  void testIsNotSupersedableWhenPriorHasNoWorkflowInstance() {
    UUID workflowDefinitionId = UUID.randomUUID();
    Task prior =
        new Task().withId(UUID.randomUUID()).withWorkflowDefinitionId(workflowDefinitionId);

    assertFalse(
        CreateTask.isSupersedablePriorApprovalTask(prior, workflowDefinitionId, UUID.randomUUID()));
  }

  @Test
  void testIsNotSupersedableWhenPriorIsTheSameRun() {
    UUID workflowDefinitionId = UUID.randomUUID();
    UUID workflowInstanceId = UUID.randomUUID();
    Task prior =
        new Task()
            .withId(UUID.randomUUID())
            .withWorkflowDefinitionId(workflowDefinitionId)
            .withWorkflowInstanceId(workflowInstanceId);

    assertFalse(
        CreateTask.isSupersedablePriorApprovalTask(
            prior, workflowDefinitionId, workflowInstanceId));
  }

  @Test
  void testIsNotSupersedableAcrossDifferentWorkflowDefinitions() {
    Task prior =
        new Task()
            .withId(UUID.randomUUID())
            .withWorkflowDefinitionId(UUID.randomUUID())
            .withWorkflowInstanceId(UUID.randomUUID());

    assertFalse(
        CreateTask.isSupersedablePriorApprovalTask(prior, UUID.randomUUID(), UUID.randomUUID()));
  }

  @Test
  void testIsNotSupersedableWhenCurrentWorkflowDefinitionUnknown() {
    Task prior =
        new Task()
            .withId(UUID.randomUUID())
            .withWorkflowDefinitionId(UUID.randomUUID())
            .withWorkflowInstanceId(UUID.randomUUID());

    assertFalse(CreateTask.isSupersedablePriorApprovalTask(prior, null, UUID.randomUUID()));
  }

  @Test
  void testIsNotSupersedableWhenCurrentWorkflowInstanceUnknown() {
    UUID workflowDefinitionId = UUID.randomUUID();
    Task prior =
        new Task()
            .withId(UUID.randomUUID())
            .withWorkflowDefinitionId(workflowDefinitionId)
            .withWorkflowInstanceId(UUID.randomUUID());

    assertFalse(CreateTask.isSupersedablePriorApprovalTask(prior, workflowDefinitionId, null));
  }

  @Test
  void testIsNotSupersedableWhenPriorTaskIsTerminal() {
    UUID workflowDefinitionId = UUID.randomUUID();
    Task prior =
        new Task()
            .withId(UUID.randomUUID())
            .withWorkflowDefinitionId(workflowDefinitionId)
            .withWorkflowInstanceId(UUID.randomUUID())
            .withStatus(TaskEntityStatus.Cancelled);

    assertFalse(
        CreateTask.isSupersedablePriorApprovalTask(prior, workflowDefinitionId, UUID.randomUUID()));
  }

  @Test
  void testIsSupersedableWhenPriorTaskIsApprovedButNotYetTerminal() {
    UUID workflowDefinitionId = UUID.randomUUID();
    Task prior =
        new Task()
            .withId(UUID.randomUUID())
            .withWorkflowDefinitionId(workflowDefinitionId)
            .withWorkflowInstanceId(UUID.randomUUID())
            .withStatus(TaskEntityStatus.Approved);

    assertTrue(
        CreateTask.isSupersedablePriorApprovalTask(prior, workflowDefinitionId, UUID.randomUUID()));
  }
}
