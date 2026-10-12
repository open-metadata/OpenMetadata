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
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Verifies that {@code GET /v1/permissions/task/{id}} evaluates task-scoped SpEL conditions
 * ({@code isTaskAssignee()} / {@code isTaskFiler()}) when resolving per-entity task permissions.
 *
 * <p>This guards the fix in {@code PermissionsResource} which builds a {@code TaskResourceContext}
 * for the {@code task} resource. With a generic {@code ResourceContext} the task's assignees and
 * createdBy are never loaded, so those conditions silently evaluate to false and every user is
 * denied {@code ResolveTask} — hiding the DAR approve/reject buttons for legitimate approvers.
 */
@Execution(ExecutionMode.CONCURRENT)
public class TaskPermissionsIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @Test
  void resolveTaskPermission_allowedForAssignee_deniedForFiler() throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String prefix = "tp_" + UUID.randomUUID().toString().substring(0, 8);

    Team team = createApproverTeam(admin, prefix);
    User filer = createUserInTeam(admin, prefix + "_filer", team);
    User assignee = createUserInTeam(admin, prefix + "_assignee", team);

    // The filer creates the task and assigns BOTH users, mirroring a DAR requester who is also an
    // assignee. So createdBy == filer, and both users are assignees.
    Task task =
        clientFor(filer)
            .tasks()
            .create(
                new CreateTask()
                    .withName(prefix + "_task")
                    .withDescription("task permission IT")
                    .withCategory(TaskCategory.Approval)
                    .withType(TaskEntityType.GlossaryApproval)
                    .withAssignees(List.of(assignee.getName(), filer.getName())));

    // Assignee who did not file the task: isTaskAssignee() -> ResolveTask ALLOW.
    assertResolveTaskAccess(clientFor(assignee), task.getId(), Permission.Access.ALLOW);

    // Filer who is also an assignee: isTaskFiler() deny beats the assignee allow -> DENY.
    assertResolveTaskAccess(clientFor(filer), task.getId(), Permission.Access.DENY);
  }

  private void assertResolveTaskAccess(
      OpenMetadataClient client, UUID taskId, Permission.Access expected) throws Exception {
    ResourcePermission permission = getPermissionForEntity(client, "task", taskId);
    assertNotNull(permission);
    assertEquals("task", permission.getResource());
    Permission.Access actual =
        permission.getPermissions().stream()
            .filter(p -> p.getOperation() == MetadataOperation.RESOLVE_TASK)
            .map(Permission::getAccess)
            .findFirst()
            .orElse(null);
    assertEquals(expected, actual, "Unexpected ResolveTask access for task " + taskId);
  }

  private ResourcePermission getPermissionForEntity(
      OpenMetadataClient client, String resource, UUID entityId) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/permissions/" + resource + "/" + entityId, null);
    return OBJECT_MAPPER.readValue(response, ResourcePermission.class);
  }

  private Team createApproverTeam(OpenMetadataClient admin, String prefix) {
    List<Rule> rules =
        List.of(
            rule(prefix + "_view", "All", MetadataOperation.VIEW_ALL, null, Rule.Effect.ALLOW),
            rule(prefix + "_create", "task", MetadataOperation.CREATE, null, Rule.Effect.ALLOW),
            rule(
                prefix + "_resolve_allow",
                "task",
                MetadataOperation.RESOLVE_TASK,
                "isTaskAssignee() || isTaskReviewer()",
                Rule.Effect.ALLOW),
            rule(
                prefix + "_resolve_deny",
                "task",
                MetadataOperation.RESOLVE_TASK,
                "isTaskFiler()",
                Rule.Effect.DENY));
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(prefix + "_policy")
                    .withDescription("Task resolve permission IT policy")
                    .withRules(rules));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(prefix + "_role")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    CreateTeam createTeam = new CreateTeam();
    createTeam.setName(prefix + "_team");
    createTeam.setTeamType(CreateTeam.TeamType.GROUP);
    createTeam.setDefaultRoles(List.of(role.getId()));
    return admin.teams().create(createTeam);
  }

  private Rule rule(
      String name,
      String resource,
      MetadataOperation operation,
      String condition,
      Rule.Effect effect) {
    Rule rule =
        new Rule()
            .withName(name)
            .withResources(List.of(resource))
            .withOperations(List.of(operation))
            .withEffect(effect);
    if (condition != null) {
      rule.withCondition(condition);
    }
    return rule;
  }

  private User createUserInTeam(OpenMetadataClient admin, String name, Team team) {
    CreateUser createUser = new CreateUser();
    createUser.setName(name);
    createUser.setEmail(name + "@test.openmetadata.org");
    createUser.setTeams(List.of(team.getId()));
    return admin.users().create(createUser);
  }

  private OpenMetadataClient clientFor(User user) {
    return SdkClients.createClient(user.getName(), user.getEmail(), new String[] {});
  }
}
