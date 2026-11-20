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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskRepository;

/**
 * Hard-deleting an entity must clean up Task 2.0 artifacts about it and assignee references on
 * both live and soft-deleted tasks.
 *
 * <p>In the pre-2.0 thread model a task was a {@code thread_entity} row, so the entity delete path's
 * {@code FeedRepository.deleteByAbout} removed it. Task 2.0 moved tasks into {@code task_entity} but
 * did not port that cleanup, so hard-deleting the target left an Open task behind whose {@code about}
 * no longer resolved — an orphan that could not be resolved, cancelled or cleared.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class EntityDeleteTaskCleanupIT {

  private static final Duration TASK_TIMEOUT = Duration.ofMinutes(5);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);
  private static final int HTTP_NOT_FOUND = 404;

  @Test
  void hardDelete_removesOpenTasksAboutTheEntity(final TestNamespace ns) {
    final Glossary glossary = createGlossary(ns);
    final GlossaryTerm term = createTermWithReviewer(glossary, "orphan_task_target");
    final String termFqn = term.getFullyQualifiedName();

    final Task approvalTask = waitForOpenTaskAbout(termFqn);
    assertNotNull(approvalTask.getId(), "Expected an open approval task about " + termFqn);

    SdkClients.adminClient()
        .glossaryTerms()
        .delete(term.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    Awaitility.await("open tasks about " + termFqn + " are removed after the term is hard-deleted")
        .atMost(TASK_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertTrue(
                    listOpenTasksAbout(termFqn).isEmpty(),
                    "Hard-deleting the term must delete the task about it, but it survived as an "
                        + "orphan with a dangling 'about'"));
  }

  @Test
  void softDelete_keepsTasksAboutTheEntity(final TestNamespace ns) {
    final Glossary glossary = createGlossary(ns);
    final GlossaryTerm term = createTermWithReviewer(glossary, "soft_delete_task_target");
    final String termFqn = term.getFullyQualifiedName();

    final Task approvalTask = waitForOpenTaskAbout(termFqn);
    assertNotNull(approvalTask.getId(), "Expected an open approval task about " + termFqn);

    SdkClients.adminClient()
        .glossaryTerms()
        .delete(term.getId().toString(), Map.of("hardDelete", "false", "recursive", "true"));

    // A soft delete keeps the row and its relationships, so the task stays recoverable.
    final Task afterSoftDelete =
        SdkClients.adminClient().tasks().get(approvalTask.getId().toString());
    assertNotNull(afterSoftDelete, "A soft delete must not remove the task about the entity");
  }

  @Test
  void hardDeleteUser_assignedToSoftDeletedTask_succeedsAndRestoredTaskDropsDeletedUser(
      final TestNamespace ns) {
    final User deletedUser = createTrackedUser(ns, "delu");
    final User survivingUser = createTrackedUser(ns, "keepu");
    final Glossary glossary = createGlossary(ns);
    final Task softDeletedTask =
        createTaskAssignedTo(
            ns,
            glossary,
            "soft_deleted_task",
            List.of(deletedUser.getFullyQualifiedName(), survivingUser.getFullyQualifiedName()));
    softDeleteTask(softDeletedTask.getId());

    hardDeleteUser(deletedUser.getId());

    restoreTask(softDeletedTask.getId());
    final Task restored =
        SdkClients.adminClient()
            .tasks()
            .get(softDeletedTask.getId().toString(), TaskRepository.FIELD_ASSIGNEES);
    assertFalse(Boolean.TRUE.equals(restored.getDeleted()));
    assertEquals(List.of(survivingUser.getId()), extractIds(restored.getAssignees()));
  }

  @Test
  void hardDeleteUser_assignedToBothLiveAndSoftDeletedTasks_updatesLiveAndKeepsSoftDeleted(
      final TestNamespace ns) {
    final User deletedUser = createTrackedUser(ns, "delboth");
    final User survivingUser = createTrackedUser(ns, "keepboth");
    final Glossary glossary = createGlossary(ns);
    final List<String> assignees =
        List.of(deletedUser.getFullyQualifiedName(), survivingUser.getFullyQualifiedName());
    final Task liveTask = createTaskAssignedTo(ns, glossary, "live_user_task", assignees);
    final Task deletedTask = createTaskAssignedTo(ns, glossary, "del_user_task", assignees);
    softDeleteTask(deletedTask.getId());

    hardDeleteUser(deletedUser.getId());

    assertLiveTaskUpdatedWithAssignees(liveTask, List.of(survivingUser.getId()));
    assertSoftDeletedTaskKeepsAssignees(deletedTask.getId(), List.of(survivingUser.getId()));
  }

  @Test
  void hardDeleteTeam_assignedToLiveAndSoftDeletedTasks_cleansUpAssigneesWithout404(
      final TestNamespace ns) {
    final Team deletedTeam = createTrackedGroupTeam(ns, "delteam");
    final Team reviewerTeam = createTrackedGroupTeam(ns, "revteam");
    final User survivingUser = createTrackedUser(ns, "keepteamco");
    final Glossary glossary = createGlossary(ns);
    final List<String> assignees =
        List.of(deletedTeam.getFullyQualifiedName(), survivingUser.getFullyQualifiedName());
    final List<String> mixedReviewers =
        List.of(reviewerTeam.getFullyQualifiedName(), survivingUser.getFullyQualifiedName());
    final Task liveTask =
        createTaskWithReviewers(ns, glossary, "live_team_task", assignees, mixedReviewers);
    final Task deletedTask = createTaskAssignedTo(ns, glossary, "del_team_task", assignees);
    softDeleteTask(deletedTask.getId());

    hardDeleteTeam(deletedTeam.getId());

    assertLiveTaskUpdatedWithAssignees(liveTask, List.of(survivingUser.getId()));
    assertSoftDeletedTaskKeepsAssignees(deletedTask.getId(), List.of(survivingUser.getId()));
  }

  private Glossary createGlossary(final TestNamespace ns) {
    final CreateGlossary create =
        new CreateGlossary()
            .withName(ns.shortPrefix("edtc"))
            .withDescription("Glossary for entity-delete task cleanup test");
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private GlossaryTerm createTermWithReviewer(final Glossary glossary, final String name) {
    final CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term whose open task must be cleaned up on delete")
            .withReviewers(List.of(SharedEntities.get().USER1.getEntityReference()));
    return SdkClients.adminClient().glossaryTerms().create(create);
  }

  private User createTrackedUser(final TestNamespace ns, final String label) {
    final String name = label + ns.uniqueShortId();
    final CreateUser create = new CreateUser().withName(name).withEmail(name + "@test.om.org");
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(create));
  }

  private Team createTrackedGroupTeam(final TestNamespace ns, final String label) {
    final CreateTeam create =
        new CreateTeam().withName(ns.prefix(label)).withTeamType(TeamType.GROUP);
    return ns.trackRoot(Entity.TEAM, SdkClients.adminClient().teams().create(create));
  }

  private Task createTaskAssignedTo(
      final TestNamespace ns,
      final Glossary glossary,
      final String label,
      final List<String> assigneeFqns) {
    return createTaskWithReviewers(ns, glossary, label, assigneeFqns, null);
  }

  private Task createTaskWithReviewers(
      final TestNamespace ns,
      final Glossary glossary,
      final String label,
      final List<String> assigneeFqns,
      final List<String> reviewerFqns) {
    final String about =
        String.format("<#E::%s::%s>", Entity.GLOSSARY, glossary.getFullyQualifiedName());
    final CreateTask create =
        new CreateTask()
            .withName(ns.prefix(label))
            .withDescription("Task for assignee hard-delete cleanup test")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(about)
            .withAssignees(assigneeFqns)
            .withReviewers(reviewerFqns);
    final Task created = SdkClients.adminClient().tasks().create(create);
    // Re-fetch persisted state so version reflects synchronous postCreate workflow initialization.
    return SdkClients.adminClient()
        .tasks()
        .get(created.getId().toString(), TaskRepository.FIELD_ASSIGNEES);
  }

  private void softDeleteTask(final UUID taskId) {
    SdkClients.adminClient().tasks().delete(taskId.toString(), Map.of("hardDelete", "false"));
  }

  private void restoreTask(final UUID taskId) {
    final TaskRepository repository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    repository.restoreEntity(Entity.ADMIN_USER_NAME, taskId);
  }

  private void hardDeleteUser(final UUID userId) {
    SdkClients.adminClient()
        .users()
        .delete(userId.toString(), Map.of("hardDelete", "true", "recursive", "true"));
  }

  private void hardDeleteTeam(final UUID teamId) {
    SdkClients.adminClient()
        .teams()
        .delete(teamId.toString(), Map.of("hardDelete", "true", "recursive", "true"));
  }

  private void assertLiveTaskUpdatedWithAssignees(
      final Task initialTask, final List<UUID> expectedIds) {
    final Task live =
        SdkClients.adminClient()
            .tasks()
            .get(initialTask.getId().toString(), TaskRepository.FIELD_ASSIGNEES);
    assertEquals(TaskEntityStatus.Open, live.getStatus());
    assertFalse(Boolean.TRUE.equals(live.getDeleted()));
    assertTrue(
        live.getVersion() > initialTask.getVersion(),
        "TaskAssigneeCleanup must update the live task version when stripping a deleted assignee");
    assertAssigneesChangeRecorded(live.getChangeDescription(), initialTask.getVersion());
    assertEquals(expectedIds, extractIds(live.getAssignees()));
  }

  private void assertAssigneesChangeRecorded(
      final ChangeDescription changeDescription, final Double expectedPreviousVersion) {
    assertNotNull(changeDescription, "Expected changeDescription from TaskAssigneeCleanup update");
    assertEquals(expectedPreviousVersion, changeDescription.getPreviousVersion());
    final boolean assigneesUpdated =
        changeDescription.getFieldsUpdated().stream()
            .map(FieldChange::getName)
            .anyMatch(TaskRepository.FIELD_ASSIGNEES::equals);
    assertTrue(assigneesUpdated, "Expected fieldsUpdated to record assignees removal");
  }

  private void assertSoftDeletedTaskKeepsAssignees(
      final UUID taskId, final List<UUID> expectedIds) {
    final ApiException notFound =
        assertThrows(
            ApiException.class, () -> SdkClients.adminClient().tasks().get(taskId.toString()));
    assertEquals(HTTP_NOT_FOUND, notFound.getStatusCode());
    final Task deleted =
        SdkClients.adminClient()
            .tasks()
            .get(taskId.toString(), TaskRepository.FIELD_ASSIGNEES, "all");
    assertTrue(Boolean.TRUE.equals(deleted.getDeleted()));
    assertEquals(expectedIds, extractIds(deleted.getAssignees()));
  }

  private static List<UUID> extractIds(final List<EntityReference> refs) {
    return refs == null ? List.of() : refs.stream().map(EntityReference::getId).toList();
  }

  private Task waitForOpenTaskAbout(final String aboutFqn) {
    Awaitility.await("wait for the open approval task about " + aboutFqn)
        .atMost(TASK_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertFalse(
                    listOpenTasksAbout(aboutFqn).isEmpty(),
                    "No open approval task was created for " + aboutFqn));
    return listOpenTasksAbout(aboutFqn).getFirst();
  }

  private List<Task> listOpenTasksAbout(final String aboutFqn) {
    final Map<String, String> filters =
        Map.of("limit", "100", "status", TaskEntityStatus.Open.value(), "aboutEntity", aboutFqn);
    final ListResponse<Task> response = SdkClients.adminClient().tasks().listWithFilters(filters);
    return response.getData() == null ? List.of() : response.getData();
  }
}
