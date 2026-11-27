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
 * Hard-deleting an entity must also remove the Task 2.0 artifacts that are about it.
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
  void hardDelete_removesOpenTasksAboutTheEntity(TestNamespace ns) {
    Glossary glossary = createGlossary(ns);
    GlossaryTerm term = createTermWithReviewer(glossary, "orphan_task_target");
    String termFqn = term.getFullyQualifiedName();

    Task approvalTask = waitForOpenTaskAbout(termFqn);
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
  void softDelete_keepsTasksAboutTheEntity(TestNamespace ns) {
    Glossary glossary = createGlossary(ns);
    GlossaryTerm term = createTermWithReviewer(glossary, "soft_delete_task_target");
    String termFqn = term.getFullyQualifiedName();

    Task approvalTask = waitForOpenTaskAbout(termFqn);
    assertNotNull(approvalTask.getId(), "Expected an open approval task about " + termFqn);

    SdkClients.adminClient()
        .glossaryTerms()
        .delete(term.getId().toString(), Map.of("hardDelete", "false", "recursive", "true"));

    // A soft delete keeps the row and its relationships, so the task stays recoverable.
    Task afterSoftDelete = SdkClients.adminClient().tasks().get(approvalTask.getId().toString());
    assertNotNull(afterSoftDelete, "A soft delete must not remove the task about the entity");
  }

  @Test
  void hardDeleteUser_assignedToLiveAndSoftDeletedTasks_updatesLiveAndKeepsSoftDeleted(
      TestNamespace ns) {
    User deletedUser = createUser(ns, "delboth");
    User survivingUser = createUser(ns, "keepboth");
    Glossary glossary = createGlossary(ns);
    List<String> assignees =
        List.of(deletedUser.getFullyQualifiedName(), survivingUser.getFullyQualifiedName());
    Task liveTask = createTask(ns, glossary, "live_user_task", assignees, null);
    Task deletedTask = createTask(ns, glossary, "del_user_task", assignees, null);
    softDeleteTask(deletedTask.getId());

    hardDelete("users", deletedUser.getId());

    assertLiveTaskUpdatedWithAssignees(liveTask, List.of(survivingUser.getId()));
    assertSoftDeletedTaskKeepsAssignees(deletedTask.getId(), List.of(survivingUser.getId()));
  }

  @Test
  void hardDeleteTeam_assignedToLiveAndSoftDeletedTasks_cleansUpAssignees(TestNamespace ns) {
    Team deletedTeam = createGroupTeam(ns, "delteam");
    Team reviewerTeam = createGroupTeam(ns, "revteam");
    User survivingUser = createUser(ns, "keepteamco");
    Glossary glossary = createGlossary(ns);
    List<String> assignees =
        List.of(deletedTeam.getFullyQualifiedName(), survivingUser.getFullyQualifiedName());
    List<String> mixedReviewers =
        List.of(reviewerTeam.getFullyQualifiedName(), survivingUser.getFullyQualifiedName());
    Task liveTask = createTask(ns, glossary, "live_team_task", assignees, mixedReviewers);
    Task deletedTask = createTask(ns, glossary, "del_team_task", assignees, null);
    softDeleteTask(deletedTask.getId());

    hardDelete("teams", deletedTeam.getId());

    assertLiveTaskUpdatedWithAssignees(liveTask, List.of(survivingUser.getId()));
    assertSoftDeletedTaskKeepsAssignees(deletedTask.getId(), List.of(survivingUser.getId()));
  }

  @Test
  void hardDeleteUser_whoIsTheOnlyAssignee_handsTheTaskToTheAssetOwner(TestNamespace ns) {
    User deletedUser = createUser(ns, "soleu");
    User owner = createUser(ns, "ownu");
    Glossary glossary = createGlossaryOwnedBy(ns, owner);
    Task task =
        createTask(
            ns, glossary, "sole_user_task", List.of(deletedUser.getFullyQualifiedName()), null);

    hardDelete("users", deletedUser.getId());

    assertLiveTaskUpdatedWithAssignees(task, List.of(owner.getId()));
  }

  @Test
  void hardDeleteUser_whoOwnsTheAssetAndIsTheOnlyAssignee_leavesTheTaskUnassigned(
      TestNamespace ns) {
    User deletedUser = createUser(ns, "ownsu");
    Glossary glossary = createGlossaryOwnedBy(ns, deletedUser);
    Task task =
        createTask(
            ns, glossary, "own_user_task", List.of(deletedUser.getFullyQualifiedName()), null);

    hardDelete("users", deletedUser.getId());

    assertLiveTaskUpdatedWithAssignees(task, List.of());
  }

  @Test
  void hardDeleteTeam_whoIsTheOnlyAssigneeOfAClosedTask_leavesTheTaskAlone(TestNamespace ns) {
    Team deletedTeam = createGroupTeam(ns, "closedteam");
    User owner = createUser(ns, "ownc");
    Glossary glossary = createGlossaryOwnedBy(ns, owner);
    Task task =
        createTask(
            ns, glossary, "closed_team_task", List.of(deletedTeam.getFullyQualifiedName()), null);
    SdkClients.adminClient().tasks().close(task.getId().toString());
    Task closed =
        SdkClients.adminClient()
            .tasks()
            .get(task.getId().toString(), TaskRepository.FIELD_ASSIGNEES);

    hardDelete("teams", deletedTeam.getId());

    Task after =
        SdkClients.adminClient()
            .tasks()
            .get(task.getId().toString(), TaskRepository.FIELD_ASSIGNEES);
    assertEquals(closed.getStatus(), after.getStatus());
    assertEquals(List.of(), extractIds(after.getAssignees()));
  }

  private Glossary createGlossary(TestNamespace ns) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.shortPrefix("edtc"))
            .withDescription("Glossary for entity-delete task cleanup test");
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private Glossary createGlossaryOwnedBy(TestNamespace ns, User owner) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.shortPrefix("edtc") + ns.uniqueShortId())
            .withDescription("Glossary for entity-delete task cleanup test")
            .withOwners(List.of(owner.getEntityReference()));
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private GlossaryTerm createTermWithReviewer(Glossary glossary, String name) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term whose open task must be cleaned up on delete")
            .withReviewers(List.of(SharedEntities.get().USER1.getEntityReference()));
    return SdkClients.adminClient().glossaryTerms().create(create);
  }

  private User createUser(TestNamespace ns, String label) {
    String name = label + ns.uniqueShortId();
    CreateUser create = new CreateUser().withName(name).withEmail(name + "@test.om.org");
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(create));
  }

  private Team createGroupTeam(TestNamespace ns, String label) {
    CreateTeam create = new CreateTeam().withName(ns.prefix(label)).withTeamType(TeamType.GROUP);
    return ns.trackRoot(Entity.TEAM, SdkClients.adminClient().teams().create(create));
  }

  private Task createTask(
      TestNamespace ns,
      Glossary glossary,
      String label,
      List<String> assigneeFqns,
      List<String> reviewerFqns) {
    String about = String.format("<#E::%s::%s>", Entity.GLOSSARY, glossary.getFullyQualifiedName());
    CreateTask create =
        new CreateTask()
            .withName(ns.prefix(label))
            .withDescription("Task for assignee hard-delete cleanup test")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(about)
            .withAssignees(assigneeFqns)
            .withReviewers(reviewerFqns);
    Task created = SdkClients.adminClient().tasks().create(create);
    // Re-fetch so the version reflects the synchronous postCreate workflow initialization.
    return SdkClients.adminClient()
        .tasks()
        .get(created.getId().toString(), TaskRepository.FIELD_ASSIGNEES);
  }

  private void softDeleteTask(UUID taskId) {
    SdkClients.adminClient().tasks().delete(taskId.toString(), Map.of("hardDelete", "false"));
  }

  private void hardDelete(String collection, UUID id) {
    Map<String, String> params = Map.of("hardDelete", "true", "recursive", "true");
    if ("users".equals(collection)) {
      SdkClients.adminClient().users().delete(id.toString(), params);
    } else {
      SdkClients.adminClient().teams().delete(id.toString(), params);
    }
  }

  private void assertLiveTaskUpdatedWithAssignees(Task initialTask, List<UUID> expectedIds) {
    Task live =
        SdkClients.adminClient()
            .tasks()
            .get(initialTask.getId().toString(), TaskRepository.FIELD_ASSIGNEES);
    assertEquals(TaskEntityStatus.Open, live.getStatus());
    assertFalse(Boolean.TRUE.equals(live.getDeleted()));
    assertTrue(
        live.getVersion() > initialTask.getVersion(),
        "Stripping a deleted assignee must bump the live task version");
    assertAssigneesChangeRecorded(live.getChangeDescription(), initialTask.getVersion());
    assertEquals(expectedIds, extractIds(live.getAssignees()));
  }

  private void assertAssigneesChangeRecorded(
      ChangeDescription changeDescription, Double expectedPreviousVersion) {
    assertNotNull(changeDescription, "Expected a changeDescription for the assignee removal");
    assertEquals(expectedPreviousVersion, changeDescription.getPreviousVersion());
    boolean assigneesUpdated =
        changeDescription.getFieldsUpdated().stream()
            .map(FieldChange::getName)
            .anyMatch(TaskRepository.FIELD_ASSIGNEES::equals);
    assertTrue(assigneesUpdated, "Expected fieldsUpdated to record the assignees removal");
  }

  private void assertSoftDeletedTaskKeepsAssignees(UUID taskId, List<UUID> expectedIds) {
    ApiException notFound =
        assertThrows(
            ApiException.class, () -> SdkClients.adminClient().tasks().get(taskId.toString()));
    assertEquals(HTTP_NOT_FOUND, notFound.getStatusCode());
    Task deleted =
        SdkClients.adminClient()
            .tasks()
            .get(taskId.toString(), TaskRepository.FIELD_ASSIGNEES, "all");
    assertTrue(Boolean.TRUE.equals(deleted.getDeleted()));
    assertEquals(expectedIds, extractIds(deleted.getAssignees()));
  }

  private static List<UUID> extractIds(List<EntityReference> refs) {
    return refs == null ? List.of() : refs.stream().map(EntityReference::getId).toList();
  }

  private Task waitForOpenTaskAbout(String aboutFqn) {
    Awaitility.await("wait for the open approval task about " + aboutFqn)
        .atMost(TASK_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertFalse(
                    listOpenTasksAbout(aboutFqn).isEmpty(),
                    "No open approval task was created for " + aboutFqn));
    return listOpenTasksAbout(aboutFqn).get(0);
  }

  private List<Task> listOpenTasksAbout(String aboutFqn) {
    Map<String, String> filters =
        Map.of("limit", "100", "status", TaskEntityStatus.Open.value(), "aboutEntity", aboutFqn);
    ListResponse<Task> response = SdkClients.adminClient().tasks().listWithFilters(filters);
    return response.getData() == null ? List.of() : response.getData();
  }
}
