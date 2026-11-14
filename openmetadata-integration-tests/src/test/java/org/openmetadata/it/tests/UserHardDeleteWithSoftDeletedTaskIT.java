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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.service.Entity;

/**
 * Hard-deleting a User that is an assignee on a Task must strip the assignee edge. When the Task is
 * soft-deleted ({@code deleted=true}) the {@code TaskAssigneeCleanup} path used to throw
 * {@code EntityNotFoundException} because it discovered tasks with {@code Include.ALL} but fetched
 * them with the default {@code Include.NON_DELETED} lookup, rolling back the whole user hard-delete
 * transaction. These tests pin both the soft-deleted and the live-task regressions.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class UserHardDeleteWithSoftDeletedTaskIT {

  private static final String TASK_FIELDS = "assignees,about";

  @Test
  void hardDeleteUserAssignedToSoftDeletedTask_succeeds(TestNamespace ns) {
    Glossary glossary = createGlossary(ns);
    GlossaryTerm term = createTerm(ns, glossary, "soft_delete_target");
    User assignee = createUser(ns, "uhdst_user");

    Task task = createTask(ns, term, assignee, "soft_deleted_task");
    assertTaskHasAssignee(task, assignee);

    SdkClients.adminClient().tasks().delete(task.getId().toString(), Map.of("hardDelete", "false"));

    Task softDeleted =
        SdkClients.adminClient().tasks().get(task.getId().toString(), TASK_FIELDS, "all");
    assertTrue(softDeleted.getDeleted(), "Task must be soft-deleted before the user hard delete");

    SdkClients.adminClient()
        .users()
        .delete(assignee.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    assertUserGone(assignee.getId());

    Task surviving =
        SdkClients.adminClient().tasks().get(task.getId().toString(), TASK_FIELDS, "all");
    assertNotNull(surviving, "Soft-deleted task must survive the user hard delete");
    assertTrue(
        surviving.getDeleted(), "Task must still be soft-deleted after the user hard delete");
  }

  @Test
  void hardDeleteUserAssignedToLiveTask_stripsAssignee(TestNamespace ns) {
    Glossary glossary = createGlossary(ns);
    GlossaryTerm term = createTerm(ns, glossary, "live_target");
    User assignee = createUser(ns, "uhdl_user");

    Task task = createTask(ns, term, assignee, "live_task");
    assertTaskHasAssignee(task, assignee);

    SdkClients.adminClient()
        .users()
        .delete(assignee.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    assertUserGone(assignee.getId());

    Task after = SdkClients.adminClient().tasks().get(task.getId().toString(), TASK_FIELDS);
    boolean stillAssigned =
        after.getAssignees() != null
            && after.getAssignees().stream().anyMatch(ref -> assignee.getId().equals(ref.getId()));
    assertFalse(
        stillAssigned, "Hard-deleting the user must remove it from the live task's assignees");
  }

  private Glossary createGlossary(TestNamespace ns) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.shortPrefix("uhdst"))
            .withDescription("Glossary for user hard-delete task cleanup test");
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private GlossaryTerm createTerm(TestNamespace ns, Glossary glossary, String name) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(ns.prefix(name))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term used as the about entity for a task");
    return SdkClients.adminClient().glossaryTerms().create(create);
  }

  private User createUser(TestNamespace ns, String baseName) {
    String name = ns.shortPrefix(baseName);
    CreateUser create = new CreateUser().withName(name).withEmail(name + "@test.openmetadata.org");
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(create));
  }

  private Task createTask(TestNamespace ns, GlossaryTerm term, User assignee, String baseName) {
    String about =
        String.format("<#E::%s::%s>", Entity.GLOSSARY_TERM, term.getFullyQualifiedName());
    CreateTask create =
        new CreateTask()
            .withName(ns.prefix(baseName))
            .withDescription("Task with an assignee for user hard-delete cleanup")
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withAbout(about)
            .withAssignees(List.of(assignee.getFullyQualifiedName()));
    return SdkClients.adminClient().tasks().create(create);
  }

  private void assertTaskHasAssignee(Task task, User assignee) {
    assertNotNull(task.getAssignees(), "Task must have assignees");
    assertTrue(
        task.getAssignees().stream().anyMatch(ref -> assignee.getId().equals(ref.getId())),
        "Task must list the created user as an assignee");
  }

  private void assertUserGone(UUID userId) {
    Awaitility.await("user " + userId + " is hard-deleted")
        .atMost(java.time.Duration.ofSeconds(30))
        .pollInterval(java.time.Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              try {
                SdkClients.adminClient().users().get(userId.toString(), null, "all");
                fail("User " + userId + " should be hard-deleted but was returned");
              } catch (OpenMetadataException e) {
                assertEquals(404, e.getStatusCode(), "User must be gone after hard delete");
              }
            });
  }
}
