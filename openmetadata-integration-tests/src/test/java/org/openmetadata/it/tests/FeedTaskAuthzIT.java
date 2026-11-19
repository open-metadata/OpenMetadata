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
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateTaskDetails;
import org.openmetadata.schema.api.feed.CreateThread;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.schema.utils.JsonDiff;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for per-entity authorization of task threads created via the Feed API
 * (`POST /v1/feed` with `type=Task` and `PATCH /v1/feed/{id}`).
 *
 * <p>Validates the {@code CreateTask} / {@code EditTask} operations are enforced against the
 * <em>target</em> entity referenced by the thread's {@code about} field — not against the
 * {@code task} resource — so policy authors can write per-entity conditional rules
 * (e.g. {@code isOwner()}).
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class FeedTaskAuthzIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void post_taskAsAdmin_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    Thread task = createTaskAsAdmin(table, "Admin can file tasks");
    assertNotNull(task.getId());
    assertEquals(ThreadType.Task, task.getType());
  }

  @Test
  void patch_taskAsAdmin_200(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    Thread original = createTaskAsAdmin(table, "Patch me");
    String originalJson = MAPPER.writeValueAsString(original);

    Thread updated = MAPPER.readValue(originalJson, Thread.class);
    updated.setMessage("Patched message");

    Thread result = patchThreadAsAdmin(original.getId(), originalJson, updated);
    assertEquals("Patched message", result.getMessage());
  }

  @Test
  void post_taskWithDenyCreateTask_403(TestNamespace ns) {
    Table table = createTestTableUnchecked(ns);
    OpenMetadataClient denied = createUserWithDenyRule("denyCreate", MetadataOperation.CREATE_TASK);

    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    CreateThread create = taskRequest(about, "should be denied");

    assertThrows(
        ForbiddenException.class,
        () -> denied.getHttpClient().execute(HttpMethod.POST, "/v1/feed", create, Thread.class),
        "User with DENY CreateTask must not create task threads");
  }

  @Test
  void patch_taskWithDenyEditTask_403(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    Thread original = createTaskAsAdmin(table, "Patch should fail for restricted user");
    String originalJson = MAPPER.writeValueAsString(original);

    OpenMetadataClient denied = createUserWithDenyRule("denyEdit", MetadataOperation.EDIT_TASK);

    Thread updated = MAPPER.readValue(originalJson, Thread.class);
    updated.setMessage("Should not stick");
    String updatedJson = MAPPER.writeValueAsString(updated);
    JsonNode patch = JsonDiff.of(MAPPER.readTree(originalJson), MAPPER.readTree(updatedJson));

    assertThrows(
        ForbiddenException.class,
        () ->
            denied
                .getHttpClient()
                .execute(HttpMethod.PATCH, "/v1/feed/" + original.getId(), patch, Thread.class),
        "User with DENY EditTask must not patch task threads");
  }

  @Test
  void put_resolveAsTeamAssignee_needsWhatAnAssigneeNeeds(TestNamespace ns) throws Exception {
    RestrictedUser member =
        createRestrictedUser("teamAssignee", MetadataOperation.EDIT_GLOSSARY_TERMS);
    User profileOwner = createProfileOwner();
    Thread profileTask =
        createDescriptionTask(
            String.format("<#E::user::%s::description>", profileOwner.getFullyQualifiedName()),
            member.team().getEntityReference());

    assertThrows(
        ForbiddenException.class,
        () -> resolve(member.client(), profileTask, "Profile text from a task"),
        "A team assignee needs EditAll on another user's profile, as a user assignee does");
    assertEquals(
        "Original profile text",
        SdkClients.adminClient().users().get(profileOwner.getId().toString()).getDescription());

    Table table = createTestTable(ns);
    Thread tableTask =
        createDescriptionTask(
            String.format("<#E::table::%s::description>", table.getFullyQualifiedName()),
            member.team().getEntityReference());
    resolve(member.client(), tableTask, "Table text from a task");
    assertEquals(TaskStatus.Closed, getTask(tableTask).getTask().getStatus());
  }

  @Test
  void put_resolveTagTask_needsTheOperationOfEachLabel(TestNamespace ns) throws Exception {
    RestrictedUser assignee =
        createRestrictedUser("tagLabels", MetadataOperation.EDIT_GLOSSARY_TERMS);
    Table table = createTestTable(ns);
    TagLabel classificationTag =
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED);
    TagLabel glossaryTerm =
        new TagLabel()
            .withTagFQN("%s.term".formatted(ns.prefix("glossary")))
            .withSource(TagLabel.TagSource.GLOSSARY)
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED);
    Thread tagTask =
        createThreadAsAdmin(
            new CreateThread()
                .withMessage("Please update tags")
                .withAbout(String.format("<#E::table::%s>", table.getFullyQualifiedName()))
                .withType(ThreadType.Task)
                .withTaskDetails(
                    new CreateTaskDetails()
                        .withType(TaskType.RequestTag)
                        .withAssignees(List.of(assignee.user().getEntityReference()))
                        .withOldValue("[]")
                        .withSuggestion(JsonUtils.pojoToJson(List.of(classificationTag)))));

    assertThrows(
        ForbiddenException.class,
        () -> resolve(assignee.client(), tagTask, JsonUtils.pojoToJson(List.of(glossaryTerm))),
        "Applying a glossary term needs EditGlossaryTerms, as a PATCH of the same change does");
    assertEquals(TaskStatus.Open, getTask(tagTask).getTask().getStatus());

    resolve(assignee.client(), tagTask, JsonUtils.pojoToJson(List.of(classificationTag)));
    assertEquals(TaskStatus.Closed, getTask(tagTask).getTask().getStatus());
  }

  private User createProfileOwner() {
    String userName = "profileowner_" + UUID.randomUUID().toString().substring(0, 8);
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(userName)
                .withEmail(userName + "@test.om.org")
                .withDescription("Original profile text"));
  }

  private Thread createDescriptionTask(String about, EntityReference assignee) throws Exception {
    return createThreadAsAdmin(
        new CreateThread()
            .withMessage("Please update description")
            .withAbout(about)
            .withType(ThreadType.Task)
            .withTaskDetails(
                new CreateTaskDetails()
                    .withType(TaskType.UpdateDescription)
                    .withAssignees(List.of(assignee))
                    .withOldValue("old description")
                    .withSuggestion("new description")));
  }

  private Thread createThreadAsAdmin(CreateThread create) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/feed", create, Thread.class);
  }

  private void resolve(OpenMetadataClient client, Thread task, String newValue) throws Exception {
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/feed/tasks/%d/resolve".formatted(task.getTask().getId()),
            new ResolveTask().withNewValue(newValue),
            Thread.class);
  }

  private Thread getTask(Thread task) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/feed/tasks/%d".formatted(task.getTask().getId()),
            null,
            Thread.class);
  }

  private Thread createTaskAsAdmin(Table table, String message) throws Exception {
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/feed", taskRequest(about, message), Thread.class);
  }

  private CreateThread taskRequest(String about, String message) {
    User admin = SdkClients.adminClient().users().getByName("admin");
    EntityReference assignee = admin.getEntityReference();
    CreateTaskDetails taskDetails =
        new CreateTaskDetails()
            .withType(TaskType.RequestDescription)
            .withAssignees(List.of(assignee))
            .withOldValue("old")
            .withSuggestion("new");
    return new CreateThread()
        .withMessage(message)
        .withAbout(about)
        .withType(ThreadType.Task)
        .withTaskDetails(taskDetails);
  }

  private Thread patchThreadAsAdmin(UUID threadId, String originalJson, Thread updated)
      throws Exception {
    String updatedJson = MAPPER.writeValueAsString(updated);
    JsonNode patch = JsonDiff.of(MAPPER.readTree(originalJson), MAPPER.readTree(updatedJson));
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PATCH, "/v1/feed/" + threadId, patch, Thread.class);
  }

  private record RestrictedUser(OpenMetadataClient client, User user, Team team) {}

  private OpenMetadataClient createUserWithDenyRule(String label, MetadataOperation deniedOp) {
    return createRestrictedUser(label, deniedOp).client();
  }

  private RestrictedUser createRestrictedUser(String label, MetadataOperation deniedOp) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String shortId = UUID.randomUUID().toString().substring(0, 8);
    String prefix = "fta_" + label + "_" + shortId;

    Rule denyRule = new Rule();
    denyRule.setName(prefix + "_rule");
    denyRule.setResources(List.of("All"));
    denyRule.setOperations(List.of(deniedOp));
    denyRule.setEffect(Rule.Effect.DENY);

    CreatePolicy createPolicy =
        new CreatePolicy()
            .withName(prefix + "_policy")
            .withDescription("Test policy denying " + deniedOp.value())
            .withRules(List.of(denyRule));
    Policy policy = admin.policies().create(createPolicy);

    CreateRole createRole =
        new CreateRole()
            .withName(prefix + "_role")
            .withPolicies(List.of(policy.getFullyQualifiedName()));
    Role role = admin.roles().create(createRole);

    CreateTeam createTeam = new CreateTeam();
    createTeam.setName(prefix + "_team");
    createTeam.setTeamType(CreateTeam.TeamType.GROUP);
    createTeam.setDefaultRoles(List.of(role.getId()));
    Team team = admin.teams().create(createTeam);

    String userName = prefix + "u";
    String email = userName + "@test.openmetadata.org";
    CreateUser createUser = new CreateUser();
    createUser.setName(userName);
    createUser.setEmail(email);
    createUser.setTeams(List.of(team.getId()));
    User user = admin.users().create(createUser);

    return new RestrictedUser(SdkClients.createClient(email, email, new String[] {}), user, team);
  }

  private Table createTestTable(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix("schema"))
            .in(database.getFullyQualifiedName())
            .execute();
    return TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
  }

  private Table createTestTableUnchecked(TestNamespace ns) {
    try {
      return createTestTable(ns);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }
}
