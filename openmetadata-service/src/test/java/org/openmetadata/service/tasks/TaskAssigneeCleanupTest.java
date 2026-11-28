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

package org.openmetadata.service.tasks;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

class TaskAssigneeCleanupTest {

  private static final String EXPECTED_CLEANUP_FIELDS =
      "assignees,about,createdBy,reviewers,watchers";
  private static final String LOCKED_JSON = "{}";

  private TaskRepository repository;
  private EntityDAO<Task> taskDao;
  private Fields cleanupFields;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    repository = mock(TaskRepository.class);
    taskDao = mock(EntityDAO.class);
    when(repository.getDao()).thenReturn(taskDao);
    when(repository.executeInTransaction(any()))
        .thenAnswer(invocation -> invocation.<Supplier<?>>getArgument(0).get());
    cleanupFields = new Fields(Set.of("assignees", "about", "createdBy", "reviewers", "watchers"));
    when(repository.getFields(EXPECTED_CLEANUP_FIELDS)).thenReturn(cleanupFields);
  }

  @Test
  void skipsSoftDeletedTaskReferences() {
    final UUID userId = UUID.randomUUID();
    final EntityReference deletedTaskRef = taskRef(UUID.randomUUID(), true);
    stubAssignedTasks(userId, Entity.USER, List.of(deletedTaskRef));

    try (final MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(repository);
      TaskAssigneeCleanup.removeAssignee(userId, Entity.USER);
    }

    verify(taskDao, never()).findJsonByIdForUpdate(any(), any());
    verify(repository, never()).update(any(), any(), any(), any(), any(), any());
    verify(repository, never()).deleteRelationship(any(), any(), any(), any(), any());
  }

  @Test
  void writesNothingWhenTheTaskIsGoneOnceLocked() {
    final UUID userId = UUID.randomUUID();
    final EntityReference racedRef = taskRef(UUID.randomUUID(), false);
    stubAssignedTasks(userId, Entity.USER, List.of(racedRef));
    when(taskDao.findJsonByIdForUpdate(racedRef.getId(), Include.NON_DELETED)).thenReturn(null);

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    verify(repository, never()).update(any(), any(), any(), any(), any(), any());
    verify(repository, never()).createOrUpdate(any(), any(), any(), any(), any());
  }

  @Test
  void continuesWithTheNextTaskWhenOneIsGoneOnceLocked() {
    final UUID userId = UUID.randomUUID();
    final EntityReference vanishedRef = taskRef(UUID.randomUUID(), false);
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final EntityReference survivor = entityRef(UUID.randomUUID(), Entity.USER, "bob");
    final Task lockedTask =
        taskWithAssignees(liveRef.getId(), entityRef(userId, Entity.USER, "alice"), survivor);
    stubAssignedTasks(userId, Entity.USER, List.of(vanishedRef, liveRef));
    when(taskDao.findJsonByIdForUpdate(vanishedRef.getId(), Include.NON_DELETED)).thenReturn(null);
    stubLockedTask(liveRef.getId(), lockedTask);

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    assertSavedAssignees(lockedTask, List.of(survivor));
  }

  @Test
  void writesTheTaskOnlyWhileHoldingItsRowLock() {
    final UUID userId = UUID.randomUUID();
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    stubAssignedTasks(userId, Entity.USER, List.of(liveRef));
    stubLockedTask(
        liveRef.getId(),
        taskWithAssignees(liveRef.getId(), entityRef(userId, Entity.USER, "alice")));
    final boolean[] inTransaction = {false};
    doAnswer(
            invocation -> {
              inTransaction[0] = true;
              try {
                return invocation.<Supplier<?>>getArgument(0).get();
              } finally {
                inTransaction[0] = false;
              }
            })
        .when(repository)
        .executeInTransaction(any());
    doAnswer(
            invocation -> {
              assertTrue(inTransaction[0], "the task was written outside the locking transaction");
              return null;
            })
        .when(repository)
        .update(any(), any(), any(), any(), any(), any());

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    final InOrder order = inOrder(taskDao, repository);
    order.verify(taskDao).findJsonByIdForUpdate(liveRef.getId(), Include.NON_DELETED);
    order.verify(repository).update(any(), any(), any(), any(), any(), any());
  }

  @Test
  void rewritesTheLockedRowNotAnEarlierRead() {
    final UUID userId = UUID.randomUUID();
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final Task lockedTask =
        taskWithAssignees(liveRef.getId(), entityRef(userId, Entity.USER, "alice"));
    stubAssignedTasks(userId, Entity.USER, List.of(liveRef));
    stubLockedTask(liveRef.getId(), lockedTask);

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    verify(taskDao).jsonToEntity(LOCKED_JSON, liveRef.getId());
    verify(repository, never())
        .get(any(), any(UUID.class), any(), any(Include.class), anyBoolean());
    verify(repository, never()).find(any(), any(), anyBoolean());
    verify(repository).setFieldsInternal(lockedTask, cleanupFields);
  }

  @Test
  void removesTargetAndSortsSurvivingAssigneesOnLiveTask() {
    final UUID userId = UUID.randomUUID();
    final EntityReference zara = entityRef(UUID.randomUUID(), Entity.USER, "zara");
    final EntityReference target = entityRef(userId, Entity.USER, "middle");
    final EntityReference alice = entityRef(UUID.randomUUID(), Entity.USER, "alice");
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final Task lockedTask = taskWithAssignees(liveRef.getId(), zara, target, alice);
    stubAssignedTasks(userId, Entity.USER, List.of(liveRef));
    stubLockedTask(liveRef.getId(), lockedTask);

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    assertSavedAssignees(lockedTask, List.of(alice, zara));
  }

  @Test
  void clearsToEmptyNonNullListWhenTargetIsSoleAssignee() {
    final UUID teamId = UUID.randomUUID();
    final EntityReference targetTeam = entityRef(teamId, Entity.TEAM, "analytics");
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final Task lockedTask = taskWithAssignees(liveRef.getId(), targetTeam);
    stubAssignedTasks(teamId, Entity.TEAM, List.of(liveRef));
    stubLockedTask(liveRef.getId(), lockedTask);

    TaskAssigneeCleanup.removeAssignee(repository, teamId, Entity.TEAM);

    final Task saved = captureSavedTask(lockedTask);
    assertNotNull(saved.getAssignees());
    assertTrue(saved.getAssignees().isEmpty());
  }

  @Test
  void leavesTaskUntouchedWhenIdMatchesButEntityTypeDiffers() {
    final UUID sharedId = UUID.randomUUID();
    final EntityReference teamAssignee = entityRef(sharedId, Entity.TEAM, "platform");
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final Task lockedTask = taskWithAssignees(liveRef.getId(), teamAssignee);
    stubAssignedTasks(sharedId, Entity.USER, List.of(liveRef));
    stubLockedTask(liveRef.getId(), lockedTask);

    TaskAssigneeCleanup.removeAssignee(repository, sharedId, Entity.USER);

    assertEquals(List.of(teamAssignee), lockedTask.getAssignees());
    verify(repository, never()).update(any(), any(), any(), any(), any(), any());
  }

  @Test
  void skipsUpdateWhenLiveTaskHasNoAssignees() {
    final UUID userId = UUID.randomUUID();
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    stubAssignedTasks(userId, Entity.USER, List.of(liveRef));
    stubLockedTask(liveRef.getId(), new Task().withId(liveRef.getId()).withAssignees(null));

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    verify(repository, never()).update(any(), any(), any(), any(), any(), any());
  }

  @Test
  void handsTaskThatLostItsLastAssigneeToTheAssetOwners() {
    final UUID userId = UUID.randomUUID();
    final EntityReference owner = entityRef(UUID.randomUUID(), Entity.USER, "owner");
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final Task lockedTask =
        taskWithAssignees(liveRef.getId(), entityRef(userId, Entity.USER, "alice"));
    stubAssignedTasks(userId, Entity.USER, List.of(liveRef));
    stubLockedTask(liveRef.getId(), lockedTask);
    stubOwnersFallback(owner);

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    assertSavedAssignees(lockedTask, List.of(owner));
  }

  @Test
  void neverHandsTheTaskBackToTheEntityBeingDeleted() {
    final UUID userId = UUID.randomUUID();
    final EntityReference deleted = entityRef(userId, Entity.USER, "alice");
    final EntityReference owner = entityRef(UUID.randomUUID(), Entity.USER, "owner");
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final Task lockedTask = taskWithAssignees(liveRef.getId(), deleted);
    stubAssignedTasks(userId, Entity.USER, List.of(liveRef));
    stubLockedTask(liveRef.getId(), lockedTask);
    stubOwnersFallback(deleted, owner);

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    assertSavedAssignees(lockedTask, List.of(owner));
  }

  @Test
  void leavesTaskUnassignedWhenTheOnlyOwnerIsTheEntityBeingDeleted() {
    final UUID userId = UUID.randomUUID();
    final EntityReference deleted = entityRef(userId, Entity.USER, "alice");
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final Task lockedTask = taskWithAssignees(liveRef.getId(), deleted);
    stubAssignedTasks(userId, Entity.USER, List.of(liveRef));
    stubLockedTask(liveRef.getId(), lockedTask);
    stubOwnersFallback(deleted);

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    assertTrue(captureSavedTask(lockedTask).getAssignees().isEmpty());
  }

  @Test
  void doesNotHandOverAFinishedTask() {
    final UUID userId = UUID.randomUUID();
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final Task lockedTask =
        taskWithAssignees(liveRef.getId(), entityRef(userId, Entity.USER, "alice"))
            .withStatus(TaskEntityStatus.Cancelled);
    stubAssignedTasks(userId, Entity.USER, List.of(liveRef));
    stubLockedTask(liveRef.getId(), lockedTask);

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    verify(repository, never()).setDefaultAssigneesFromEntityOwners(any());
    assertTrue(captureSavedTask(lockedTask).getAssignees().isEmpty());
  }

  @Test
  void doesNotHandOverWhileOtherAssigneesRemain() {
    final UUID userId = UUID.randomUUID();
    final EntityReference survivor = entityRef(UUID.randomUUID(), Entity.USER, "bob");
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final Task lockedTask =
        taskWithAssignees(liveRef.getId(), entityRef(userId, Entity.USER, "alice"), survivor);
    stubAssignedTasks(userId, Entity.USER, List.of(liveRef));
    stubLockedTask(liveRef.getId(), lockedTask);

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    verify(repository, never()).setDefaultAssigneesFromEntityOwners(any());
    assertSavedAssignees(lockedTask, List.of(survivor));
  }

  private void stubAssignedTasks(
      final UUID entityId, final String entityType, final List<EntityReference> refs) {
    when(repository.findTo(
            entityId, entityType, Relationship.ASSIGNED_TO, Entity.TASK, Include.ALL))
        .thenReturn(refs);
  }

  private void stubLockedTask(final UUID taskId, final Task lockedTask) {
    when(taskDao.findJsonByIdForUpdate(taskId, Include.NON_DELETED)).thenReturn(LOCKED_JSON);
    when(taskDao.jsonToEntity(LOCKED_JSON, taskId)).thenReturn(lockedTask);
  }

  private void stubOwnersFallback(final EntityReference... owners) {
    doAnswer(
            invocation -> {
              invocation.<Task>getArgument(0).setAssignees(new ArrayList<>(List.of(owners)));
              return null;
            })
        .when(repository)
        .setDefaultAssigneesFromEntityOwners(any());
  }

  private void assertSavedAssignees(
      final Task expectedOriginal, final List<EntityReference> expected) {
    final Task saved = captureSavedTask(expectedOriginal);
    assertEquals(expected, saved.getAssignees());
  }

  private Task captureSavedTask(final Task expectedOriginal) {
    final ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
    verify(repository)
        .update(
            isNull(),
            eq(expectedOriginal),
            captor.capture(),
            eq(Entity.ADMIN_USER_NAME),
            isNull(),
            eq(Set.of(TaskRepository.FIELD_ASSIGNEES)));
    return captor.getValue();
  }

  private static EntityReference taskRef(final UUID taskId, final boolean deleted) {
    return new EntityReference().withId(taskId).withType(Entity.TASK).withDeleted(deleted);
  }

  private static EntityReference entityRef(final UUID id, final String type, final String name) {
    return new EntityReference().withId(id).withType(type).withName(name);
  }

  private static Task taskWithAssignees(final UUID taskId, final EntityReference... assignees) {
    return new Task().withId(taskId).withAssignees(new ArrayList<>(List.of(assignees)));
  }
}
