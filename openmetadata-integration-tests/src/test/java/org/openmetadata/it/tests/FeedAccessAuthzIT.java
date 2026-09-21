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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.feed.CreateAnnouncement;
import org.openmetadata.schema.api.feed.CreateConversation;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Regression coverage for issue #18158 ("Users without access can fetch & perform patch on the
 * feed") retargeted at the resources that replaced {@code /v1/feed}: {@code /v1/conversations},
 * {@code /v1/announcements}, {@code /v1/tasks} and {@code /v1/activity}.
 *
 * <p>Two properties are asserted across the whole feed surface: a user who did not author a message
 * cannot rewrite it, and a user who cannot view an entity cannot read the feed attached to it.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class FeedAccessAuthzIT {
  private static final String ACTIVITY_PATH = "/v1/activity";
  private static final String ANNOUNCEMENTS_PATH = "/v1/announcements";
  private static final String CONVERSATIONS_PATH = "/v1/conversations";
  private static final String TASKS_PATH = "/v1/tasks";
  private static final String REWRITTEN = "Rewritten by a user who did not author this";
  private static final long ONE_DAY_MILLIS = 86_400_000L;

  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
  private static final RequestOptions PATCH_OPTIONS =
      RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  // ==================== Patch someone else's message ====================

  @Test
  void patchAnnouncementDescription_asNonAuthor_forbidden(TestNamespace ns) throws Exception {
    Announcement announcement = createAnnouncement(ns, createTestTable(ns, "ann-desc"));

    assertThrows(
        ForbiddenException.class,
        () ->
            patch(
                SdkClients.user2Client(),
                ANNOUNCEMENTS_PATH + "/" + announcement.getId(),
                replace("/description", REWRITTEN)),
        "A user who did not author the announcement must not rewrite its body");
  }

  @Test
  void patchAnnouncementDisplayName_asNonAuthor_forbidden(TestNamespace ns) throws Exception {
    Announcement announcement = createAnnouncement(ns, createTestTable(ns, "ann-name"));

    assertThrows(
        ForbiddenException.class,
        () ->
            patch(
                SdkClients.user2Client(),
                ANNOUNCEMENTS_PATH + "/" + announcement.getId(),
                replace("/displayName", REWRITTEN)),
        "A user who did not author the announcement must not rewrite its display name");
  }

  @Test
  void patchTaskDescription_asUnrelatedUser_forbidden(TestNamespace ns) throws Exception {
    Task task = createTask(ns);

    assertThrows(
        ForbiddenException.class,
        () ->
            patch(
                SdkClients.user2Client(),
                TASKS_PATH + "/" + task.getId(),
                replace("/description", REWRITTEN)),
        "A user unrelated to the task must not rewrite its body");
  }

  @Test
  void patchConversation_asNonAuthor_forbidden(TestNamespace ns) throws Exception {
    Conversation conversation =
        createConversation(entityLink(createTestTable(ns, "conv-patch")), "Author's message");

    assertThrows(
        ForbiddenException.class,
        () ->
            patch(
                SdkClients.user2Client(),
                CONVERSATIONS_PATH + "/" + conversation.getId(),
                replace("/message", REWRITTEN)),
        "A user who did not author the conversation must not rewrite its message");
  }

  // ==================== Fetch a feed you cannot view ====================

  @Test
  void getEntityActivity_callerDeniedViewOnTarget_forbidden(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns, "act-entity");
    OpenMetadataClient denied = clientDeniedViewOn(ns, "act-entity", "table");

    assertForbidden(
        () -> get(denied, ACTIVITY_PATH + "/entity/table/" + table.getId()),
        "Activity for a table the caller cannot view must not be readable");
  }

  @Test
  void getActivityByEntityLink_callerDeniedViewOnTarget_forbidden(TestNamespace ns)
      throws Exception {
    Table table = createTestTable(ns, "act-link");
    OpenMetadataClient denied = clientDeniedViewOn(ns, "act-link", "table");
    RequestOptions options =
        RequestOptions.builder().queryParam("entityLink", entityLink(table)).build();

    assertForbidden(
        () ->
            denied
                .getHttpClient()
                .executeForString(HttpMethod.GET, ACTIVITY_PATH + "/about", null, options),
        "Activity addressed by entityLink must honour the caller's view permission");
  }

  @Test
  void listConversationsByEntityLink_callerDeniedViewOnTarget_forbidden(TestNamespace ns)
      throws Exception {
    Table table = createTestTable(ns, "conv-link");
    createConversation(entityLink(table), "Conversation on a restricted table");
    OpenMetadataClient denied = clientDeniedViewOn(ns, "conv-link", "table");
    RequestOptions options =
        RequestOptions.builder().queryParam("entityLink", entityLink(table)).build();

    assertForbidden(
        () ->
            denied
                .getHttpClient()
                .executeForString(HttpMethod.GET, CONVERSATIONS_PATH, null, options),
        "Conversations on a table the caller cannot view must not be listable");
  }

  @Test
  void getConversationById_callerDeniedViewOnConversations_hidden(TestNamespace ns)
      throws Exception {
    Conversation conversation =
        createConversation(entityLink(createTestTable(ns, "conv-hidden")), "Hidden message");
    OpenMetadataClient denied = clientDeniedViewOn(ns, "conv-hidden", "conversation");

    ApiException hidden =
        assertThrows(
            ApiException.class, () -> get(denied, CONVERSATIONS_PATH + "/" + conversation.getId()));
    assertEquals(
        404, hidden.getStatusCode(), "Denied reads must hide the conversation's existence");
  }

  // ==================== Contract preserved for unresolvable links ====================

  @Test
  void listConversationsByEntityLink_unknownTarget_returnsEmptyPage() throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityLink", "<#E::table::no.such.service.db.schema.table>")
            .build();

    String json =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, CONVERSATIONS_PATH, null, options);

    assertTrue(
        MAPPER.readTree(json).get("data").isEmpty(),
        "A well-formed entityLink pointing at no entity must still page empty, not 404");
  }

  @Test
  void getActivityByEntityLink_unknownTarget_returnsEmptyPage() throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityLink", "<#E::table::no.such.service.db.schema.table>")
            .build();

    String json =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, ACTIVITY_PATH + "/about", null, options);

    assertTrue(
        MAPPER.readTree(json).get("data").isEmpty(),
        "A well-formed entityLink pointing at no entity must still page empty, not 404");
  }

  /**
   * A malformed link has always been rejected by MessageParser.EntityLink.parse inside
   * ConversationFilter and ActivityStreamRepository, so 400 is the pre-existing contract on both
   * endpoints rather than something the authorization checks introduced.
   */
  @Test
  void entityLinkFilters_malformedLink_stillBadRequest() {
    RequestOptions options =
        RequestOptions.builder().queryParam("entityLink", "not-a-link").build();

    assertBadRequest(
        () ->
            SdkClients.adminClient()
                .getHttpClient()
                .executeForString(HttpMethod.GET, CONVERSATIONS_PATH, null, options));
    assertBadRequest(
        () ->
            SdkClients.adminClient()
                .getHttpClient()
                .executeForString(HttpMethod.GET, ACTIVITY_PATH + "/about", null, options));
  }

  // ==================== Conditional writes still honoured ====================

  /**
   * Task PATCH authorizes through the AuthRequest overload so it can use TaskResourceContext. That
   * overload must still forward the request's If-Match header, or a client holding a stale ETag
   * silently overwrites a concurrent update instead of getting a 412.
   */
  @Test
  void patchTask_staleIfMatch_preconditionFailed(TestNamespace ns) {
    Task task = createTask(ns);

    ApiException failure =
        assertThrows(
            ApiException.class,
            () ->
                patchWithIfMatch(
                    TASKS_PATH + "/" + task.getId(),
                    replace("/description", "Stale write"),
                    "W/\"0.9\""));

    assertEquals(412, failure.getStatusCode(), "A stale If-Match must fail the precondition");
  }

  @Test
  void patchTask_currentIfMatch_succeeds(TestNamespace ns) throws Exception {
    Task task = createTask(ns);

    patchWithIfMatch(
        TASKS_PATH + "/" + task.getId(),
        replace("/description", "Conditional write"),
        "W/\"" + task.getVersion() + "\"");

    Task updated = SdkClients.adminClient().tasks().get(task.getId().toString());
    assertEquals("Conditional write", updated.getDescription());
  }

  // ==================== Query-param / comment variants of the view check ====================

  @Test
  void listActivityByEntityQueryParam_callerDeniedViewOnTarget_forbidden(TestNamespace ns)
      throws Exception {
    Table table = createTestTable(ns, "act-qp");
    OpenMetadataClient denied = clientDeniedViewOn(ns, "act-qp", "table");
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityType", "table")
            .queryParam("entityId", table.getId().toString())
            .build();

    assertForbidden(
        () -> denied.getHttpClient().executeForString(HttpMethod.GET, ACTIVITY_PATH, null, options),
        "Activity scoped by entityType+entityId must honour the caller's view permission");
  }

  @Test
  void addTaskComment_callerDeniedViewOnTarget_forbidden(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns, "task-comment");
    Task task = createTaskAbout(ns, table);
    OpenMetadataClient denied = clientDeniedViewOn(ns, "task-comment", "table");

    assertForbidden(
        () ->
            denied
                .getHttpClient()
                .executeForString(
                    HttpMethod.POST,
                    TASKS_PATH + "/" + task.getId() + "/comments",
                    "{\"message\":\"comment from a denied user\"}",
                    RequestOptions.builder().header("Content-Type", "application/json").build()),
        "A user who cannot view the task's target entity must not comment on / read the task");
  }

  // ==================== Helpers ====================

  private static String patchWithIfMatch(String path, String body, String ifMatch)
      throws Exception {
    RequestOptions options =
        RequestOptions.builder()
            .header("Content-Type", "application/json-patch+json")
            .header("If-Match", ifMatch)
            .build();
    return SdkClients.adminClient()
        .getHttpClient()
        .executeForString(HttpMethod.PATCH, path, body, options);
  }

  private static void assertBadRequest(ThrowingCall call) {
    assertThrows(InvalidRequestException.class, call::run, "Malformed entityLink must be a 400");
  }

  /**
   * A denied read may surface either as a 403 or, where the endpoint deliberately hides the
   * resource's existence, as a 404. Both are acceptable; a 2xx is not.
   */
  private static void assertForbidden(ThrowingCall call, String message) {
    OpenMetadataException failure = assertThrows(OpenMetadataException.class, call::run, message);
    if (failure instanceof ApiException apiException) {
      assertEquals(404, apiException.getStatusCode(), message + " — unexpected status");
      return;
    }
    assertTrue(
        failure instanceof ForbiddenException,
        message + " — expected ForbiddenException but got " + failure.getClass().getName());
  }

  @FunctionalInterface
  private interface ThrowingCall {
    void run() throws Exception;
  }

  private static String replace(String path, String value) throws Exception {
    return "[{\"op\":\"replace\",\"path\":\""
        + path
        + "\",\"value\":"
        + MAPPER.writeValueAsString(value)
        + "}]";
  }

  private static String patch(OpenMetadataClient client, String path, String body)
      throws Exception {
    return client.getHttpClient().executeForString(HttpMethod.PATCH, path, body, PATCH_OPTIONS);
  }

  private static String get(OpenMetadataClient client, String path) throws Exception {
    return client
        .getHttpClient()
        .executeForString(HttpMethod.GET, path, null, RequestOptions.builder().build());
  }

  private static Announcement createAnnouncement(TestNamespace ns, Table table) {
    long now = System.currentTimeMillis();
    return SdkClients.adminClient()
        .announcements()
        .create(
            new CreateAnnouncement()
                .withName(ns.prefix("announcement"))
                .withDescription("Announcement authored by admin")
                .withEntityLink(entityLink(table))
                .withStartTime(now)
                .withEndTime(now + ONE_DAY_MILLIS));
  }

  private static Task createTask(TestNamespace ns) {
    return SdkClients.adminClient()
        .tasks()
        .create(
            new CreateTask()
                .withName(ns.prefix("task"))
                .withDescription("Task authored by admin")
                .withCategory(TaskCategory.Approval)
                .withType(TaskEntityType.GlossaryApproval));
  }

  private static Task createTaskAbout(TestNamespace ns, Table table) {
    return SdkClients.adminClient()
        .tasks()
        .create(
            new CreateTask()
                .withName(ns.prefix("task-about"))
                .withDescription("Task about a table")
                .withCategory(TaskCategory.MetadataUpdate)
                .withType(TaskEntityType.DescriptionUpdate)
                .withAbout(entityLink(table)));
  }

  private static Conversation createConversation(String about, String message) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            CONVERSATIONS_PATH,
            new CreateConversation().withAbout(about).withMessage(message),
            Conversation.class);
  }

  private static String entityLink(Table table) {
    return "<#E::table::" + table.getFullyQualifiedName() + ">";
  }

  private static Table createTestTable(TestNamespace ns, String name) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create()
            .name(ns.prefix(name + "-db"))
            .in(service.getFullyQualifiedName())
            .execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix(name + "-schema"))
            .in(database.getFullyQualifiedName())
            .execute();
    return TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), name);
  }

  /**
   * Builds a user whose team carries a policy denying {@code ViewAll} on {@code resource}. Mirrors
   * the helper from the deleted FeedTaskAuthzIT — a deny rule is the only way to model the reporter's
   * scenario, because the seeded OrganizationPolicy grants ViewAll on every resource to everyone.
   */
  private static OpenMetadataClient clientDeniedViewOn(
      TestNamespace ns, String label, String resource) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String prefix = ns.shortPrefix("deny_" + label);

    Rule denyRule =
        new Rule()
            .withName(prefix + "_rule")
            .withResources(List.of(resource))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.DENY);
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(prefix + "_policy")
                    .withDescription("Denies ViewAll on " + resource)
                    .withRules(List.of(denyRule)));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(prefix + "_role")
                    .withDescription("Role carrying the " + resource + " deny policy")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    CreateTeam createTeam =
        new CreateTeam()
            .withName(prefix + "_team")
            .withDescription("Team carrying the " + resource + " deny role")
            .withTeamType(CreateTeam.TeamType.GROUP)
            .withDefaultRoles(List.of(role.getId()));
    Team team = admin.teams().create(createTeam);

    String email = prefix + "u@test.openmetadata.org";
    admin
        .users()
        .create(
            new CreateUser()
                .withName(prefix + "u")
                .withEmail(email)
                .withTeams(List.of(team.getId())));
    return SdkClients.createClient(email, email, new String[] {});
  }
}
