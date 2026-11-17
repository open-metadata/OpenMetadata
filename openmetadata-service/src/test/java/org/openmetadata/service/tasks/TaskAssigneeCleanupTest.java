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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

class TaskAssigneeCleanupTest {

  private static final String EXPECTED_CLEANUP_FIELDS =
      "assignees,about,createdBy,reviewers,watchers,domains";

  private TaskRepository repository;
  private Fields cleanupFields;

  @BeforeEach
  void setUp() {
    repository = mock(TaskRepository.class);
    cleanupFields =
        new Fields(Set.of("assignees", "about", "createdBy", "reviewers", "watchers", "domains"));
    when(repository.getFields(EXPECTED_CLEANUP_FIELDS)).thenReturn(cleanupFields);
  }

  @Test
  void skipsLoadAndDeletesEdgeWhenTaskReferenceIsSoftDeleted() {
    final UUID userId = UUID.randomUUID();
    final EntityReference deletedTaskRef = taskRef(UUID.randomUUID(), true);
    stubAssignedTasks(userId, Entity.USER, List.of(deletedTaskRef));

    try (final MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(repository);
      TaskAssigneeCleanup.removeAssignee(userId, Entity.USER);
    }

    verify(repository)
        .deleteRelationship(
            userId, Entity.USER, deletedTaskRef.getId(), Entity.TASK, Relationship.ASSIGNED_TO);
    verify(repository, never())
        .get(any(), any(UUID.class), any(), any(Include.class), anyBoolean());
    verify(repository, never()).update(any(), any(), any(), any(), any(), any());
    verify(repository, never()).createOrUpdate(any(), any(), any(), any(), any());
  }

  @Test
  void deletesEdgeAndContinuesBatchWhenLiveTaskDeletedBeforeLoad() {
    final UUID userId = UUID.randomUUID();
    final EntityReference vanishedRef = taskRef(UUID.randomUUID(), false);
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final EntityReference survivor = entityRef(UUID.randomUUID(), Entity.USER, "bob");
    final Task liveTask =
        taskWithAssignees(liveRef.getId(), entityRef(userId, Entity.USER, "alice"), survivor);
    final Task originalLiveTask = new Task().withId(liveRef.getId());
    stubAssignedTasks(userId, Entity.USER, List.of(vanishedRef, liveRef));
    stubGetTaskThrowsNotFound(vanishedRef.getId());
    stubLiveTask(liveRef.getId(), liveTask, originalLiveTask);

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    verify(repository)
        .deleteRelationship(
            userId, Entity.USER, vanishedRef.getId(), Entity.TASK, Relationship.ASSIGNED_TO);
    assertSavedAssignees(originalLiveTask, List.of(survivor));
  }

  @Test
  void deletesEdgeWithoutResurrectingWhenTaskDeletedBetweenGetAndFind() {
    final UUID userId = UUID.randomUUID();
    final EntityReference racedRef = taskRef(UUID.randomUUID(), false);
    final Task loadedTask =
        taskWithAssignees(racedRef.getId(), entityRef(userId, Entity.USER, "alice"));
    stubAssignedTasks(userId, Entity.USER, List.of(racedRef));
    when(repository.get(
            isNull(), eq(racedRef.getId()), eq(cleanupFields), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(loadedTask);
    when(repository.find(racedRef.getId(), Include.NON_DELETED, false))
        .thenThrow(EntityNotFoundException.byMessage("deleted before update"));

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    verify(repository)
        .deleteRelationship(
            userId, Entity.USER, racedRef.getId(), Entity.TASK, Relationship.ASSIGNED_TO);
    verify(repository, never()).update(any(), any(), any(), any(), any(), any());
    verify(repository, never()).createOrUpdate(any(), any(), any(), any(), any());
  }

  @Test
  void removesTargetAndSortsSurvivingAssigneesOnLiveTask() {
    final UUID userId = UUID.randomUUID();
    final EntityReference zara = entityRef(UUID.randomUUID(), Entity.USER, "zara");
    final EntityReference target = entityRef(userId, Entity.USER, "middle");
    final EntityReference alice = entityRef(UUID.randomUUID(), Entity.USER, "alice");
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final Task liveTask = taskWithAssignees(liveRef.getId(), zara, target, alice);
    final Task originalTask = new Task().withId(liveRef.getId());
    stubAssignedTasks(userId, Entity.USER, List.of(liveRef));
    stubLiveTask(liveRef.getId(), liveTask, originalTask);

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    assertSavedAssignees(originalTask, List.of(alice, zara));
  }

  @Test
  void clearsToEmptyNonNullListWhenTargetIsSoleAssignee() {
    final UUID teamId = UUID.randomUUID();
    final EntityReference targetTeam = entityRef(teamId, Entity.TEAM, "analytics");
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final Task liveTask = taskWithAssignees(liveRef.getId(), targetTeam);
    final Task originalTask = new Task().withId(liveRef.getId());
    stubAssignedTasks(teamId, Entity.TEAM, List.of(liveRef));
    stubLiveTask(liveRef.getId(), liveTask, originalTask);

    TaskAssigneeCleanup.removeAssignee(repository, teamId, Entity.TEAM);

    final Task saved = captureSavedTask(originalTask);
    assertNotNull(saved.getAssignees());
    assertTrue(saved.getAssignees().isEmpty());
  }

  @Test
  void leavesTaskUntouchedWhenIdMatchesButEntityTypeDiffers() {
    final UUID sharedId = UUID.randomUUID();
    final EntityReference teamAssignee = entityRef(sharedId, Entity.TEAM, "platform");
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final Task liveTask = taskWithAssignees(liveRef.getId(), teamAssignee);
    stubAssignedTasks(sharedId, Entity.USER, List.of(liveRef));
    when(repository.get(
            isNull(), eq(liveRef.getId()), eq(cleanupFields), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(liveTask);

    TaskAssigneeCleanup.removeAssignee(repository, sharedId, Entity.USER);

    assertEquals(List.of(teamAssignee), liveTask.getAssignees());
    verify(repository, never()).update(any(), any(), any(), any(), any(), any());
  }

  @Test
  void skipsUpdateWhenLiveTaskHasNoAssignees() {
    final UUID userId = UUID.randomUUID();
    final EntityReference liveRef = taskRef(UUID.randomUUID(), false);
    final Task liveTask = new Task().withId(liveRef.getId()).withAssignees(null);
    stubAssignedTasks(userId, Entity.USER, List.of(liveRef));
    when(repository.get(
            isNull(), eq(liveRef.getId()), eq(cleanupFields), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(liveTask);

    TaskAssigneeCleanup.removeAssignee(repository, userId, Entity.USER);

    verify(repository, never()).update(any(), any(), any(), any(), any(), any());
  }

  private void stubAssignedTasks(
      final UUID entityId, final String entityType, final List<EntityReference> refs) {
    when(repository.findTo(
            entityId, entityType, Relationship.ASSIGNED_TO, Entity.TASK, Include.ALL))
        .thenReturn(refs);
  }

  private void stubLiveTask(final UUID taskId, final Task loadedTask, final Task originalTask) {
    when(repository.get(
            isNull(), eq(taskId), eq(cleanupFields), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(loadedTask);
    when(repository.find(taskId, Include.NON_DELETED, false)).thenReturn(originalTask);
  }

  private void stubGetTaskThrowsNotFound(final UUID taskId) {
    when(repository.get(
            isNull(), eq(taskId), eq(cleanupFields), eq(Include.NON_DELETED), eq(false)))
        .thenThrow(EntityNotFoundException.byMessage("concurrently deleted"));
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
