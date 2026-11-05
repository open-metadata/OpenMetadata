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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.DenyPolicyPrincipals;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.feed.CreateAnnouncement;
import org.openmetadata.schema.api.feed.CreateConversation;
import org.openmetadata.schema.api.feed.CreatePost;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ActivityEventType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
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
import org.openmetadata.service.Entity;

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

  // ==================== Activity across entities ====================

  /**
   * Activity addressed by actor rather than by entity used to skip the per-entity check, returning
   * old and new field values of changes to entities the caller cannot view. Those events are now
   * dropped from the feed; events on viewable entities stay.
   */
  @Test
  void actorAddressedActivity_dropsEventsOnEntitiesTheCallerCannotView(TestNamespace ns)
      throws Exception {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table restricted = createTable(schema, ns.prefix("act-restricted"), List.of(PII_SENSITIVE));
    Table open = createTable(schema, ns.prefix("act-open"), List.of());
    User actor = UserTestFactory.createUser(ns, "act-actor");
    UUID hiddenEvent = insertActivity(restricted, actor);
    UUID shownEvent = insertActivity(open, actor);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDeniedWhen(
            ns.shortPrefix("act_feed"),
            "table",
            MetadataOperation.VIEW_BASIC,
            "matchAnyTag('PII.Sensitive')");

    for (String path :
        List.of(
            ACTIVITY_PATH + "/user/" + actor.getId() + "?days=1",
            ACTIVITY_PATH + "?actorId=" + actor.getId() + "&days=1")) {
      List<String> deniedView = listedIds(denied, path);
      assertTrue(deniedView.contains(shownEvent.toString()), path + " lost a viewable event");
      assertFalse(deniedView.contains(hiddenEvent.toString()), path + " leaked a hidden event");
      assertTrue(
          listedIds(SdkClients.adminClient(), path).contains(hiddenEvent.toString()),
          path + " must still show admins every event");
    }
  }

  /**
   * A mention reaches the caller wherever it was written, so the mentions feed must not hand them
   * the change event on an entity they cannot view just because someone mentioned them under it.
   */
  @Test
  void mentionsFeed_dropsEventsOnEntitiesTheCallerCannotView(TestNamespace ns) throws Exception {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table restricted = createTable(schema, ns.prefix("mention-restricted"), List.of(PII_SENSITIVE));
    Table open = createTable(schema, ns.prefix("mention-open"), List.of());
    User actor = UserTestFactory.createUser(ns, "mention-actor");
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDeniedWhen(
            ns.shortPrefix("act_mention"),
            "table",
            MetadataOperation.VIEW_BASIC,
            "matchAnyTag('PII.Sensitive')");
    String mention = "<#E::user::" + loggedInUserName(denied) + "> please take a look";
    UUID hiddenEvent = insertActivity(restricted, actor);
    UUID shownEvent = insertActivity(open, actor);
    replyAsAdmin(hiddenEvent, mention);
    replyAsAdmin(shownEvent, mention);

    List<String> mentions = listedIds(denied, ACTIVITY_PATH + "/mentions?days=1");

    assertTrue(mentions.contains(shownEvent.toString()), "lost a mention on a viewable table");
    assertFalse(mentions.contains(hiddenEvent.toString()), "leaked a mention on a hidden table");
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
  void getMentionsByEntityLink_callerDeniedViewOnTarget_forbidden(TestNamespace ns)
      throws Exception {
    Table table = createTestTable(ns, "mentions-link");
    OpenMetadataClient denied = clientDeniedViewOn(ns, "mentions-link", "table");
    RequestOptions options =
        RequestOptions.builder().queryParam("entityLink", entityLink(table)).build();

    assertForbidden(
        () ->
            denied
                .getHttpClient()
                .executeForString(HttpMethod.GET, ACTIVITY_PATH + "/mentions", null, options),
        "Mentions narrowed to an entity must honour the caller's view permission");
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
  void readAnnouncement_callerDeniedViewOnTarget_forbidden(TestNamespace ns) throws Exception {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table restricted = createTable(schema, ns.shortPrefix("restricted"), List.of(PII_SENSITIVE));
    Announcement announcement = createAnnouncement(ns, restricted);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDeniedWhen(
            ns.shortPrefix("ann_read"),
            "table",
            MetadataOperation.VIEW_BASIC,
            "matchAnyTag('PII.Sensitive')");
    RequestOptions byLink =
        RequestOptions.builder().queryParam("entityLink", entityLink(restricted)).build();

    for (String path :
        List.of(
            ANNOUNCEMENTS_PATH + "/" + announcement.getId(),
            ANNOUNCEMENTS_PATH + "/name/" + announcement.getFullyQualifiedName(),
            ANNOUNCEMENTS_PATH + "/" + announcement.getId() + "/versions",
            ANNOUNCEMENTS_PATH + "/" + announcement.getId() + "/versions/0.1")) {
      assertForbidden(
          () -> get(denied, path), path + " must honour the view permission on its asset");
    }
    assertForbidden(
        () ->
            denied
                .getHttpClient()
                .executeForString(HttpMethod.GET, ANNOUNCEMENTS_PATH, null, byLink),
        "Announcements narrowed to an asset must honour the view permission on it");
  }

  @Test
  void listAnnouncements_hidesUnviewableAssets(TestNamespace ns) throws Exception {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table restricted = createTable(schema, ns.shortPrefix("hidden"), List.of(PII_SENSITIVE));
    Table open = createTable(schema, ns.shortPrefix("open"), List.of());
    Announcement hidden = createAnnouncement(ns, restricted);
    Announcement shown = createAnnouncement(ns, open);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDeniedWhen(
            ns.shortPrefix("ann_list"),
            "table",
            MetadataOperation.VIEW_BASIC,
            "matchAnyTag('PII.Sensitive')");

    List<String> deniedView = activeAnnouncementIds(denied);
    assertTrue(deniedView.contains(shown.getId().toString()), "lost a viewable announcement");
    assertFalse(
        deniedView.contains(hidden.getId().toString()), "listed an announcement on a hidden asset");
    assertTrue(
        activeAnnouncementIds(SdkClients.adminClient()).contains(hidden.getId().toString()),
        "admins must still see every announcement");
  }

  @Test
  void listAnnouncements_totalCountsOnlyViewable(TestNamespace ns) throws Exception {
    Domain domain =
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("ann-total"))
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Scopes the announcement total check"));
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    createAnnouncement(
        ns, inDomain(createTable(schema, ns.shortPrefix("tot_h"), List.of(PII_SENSITIVE)), domain));
    createAnnouncement(
        ns, inDomain(createTable(schema, ns.shortPrefix("tot_s"), List.of()), domain));
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDeniedWhen(
            ns.shortPrefix("ann_total"),
            "table",
            MetadataOperation.VIEW_BASIC,
            "matchAnyTag('PII.Sensitive')");

    assertEquals(
        1,
        announcementPage(denied, domain, null).path("paging").path("total").asInt(),
        "first page total counts only viewable announcements");
    assertEquals(
        2,
        announcementPage(SdkClients.adminClient(), domain, null)
            .path("paging")
            .path("total")
            .asInt(),
        "admins count every announcement");
  }

  @Test
  void readAnnouncement_afterAssetRename_checksAsset(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Glossary glossary =
        admin
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(ns.prefix("ann-renamed"))
                    .withDescription("Glossary that is renamed after its announcement")
                    .withTags(List.of(PII_SENSITIVE)));
    long now = System.currentTimeMillis();
    Announcement announcement =
        admin
            .announcements()
            .create(
                new CreateAnnouncement()
                    .withName(ns.prefix("announcement-renamed"))
                    .withDescription("Announcement on a glossary")
                    .withEntityLink("<#E::glossary::" + glossary.getFullyQualifiedName() + ">")
                    .withStartTime(now)
                    .withEndTime(now + ONE_DAY_MILLIS));
    patch(admin, "/v1/glossaries/" + glossary.getId(), replace("/name", ns.prefix("ann-moved")));
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDeniedWhen(
            ns.shortPrefix("ann_renamed"),
            "glossary",
            MetadataOperation.VIEW_BASIC,
            "matchAnyTag('PII.Sensitive')");

    assertForbidden(
        () -> get(denied, ANNOUNCEMENTS_PATH + "/" + announcement.getId()),
        "A rename of the asset must not lift the view check on its announcement");
    assertFalse(
        activeAnnouncementIds(denied).contains(announcement.getId().toString()),
        "A rename of the asset must not expose its announcement in lists");
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

  // ==================== Domain-only guard on a target that carries no domains ====================

  /**
   * A domain-only-access user is denied a task about a Domain, which has no domains field of its
   * own. The guard must evaluate the empty result, not fail resolving the unsupported field.
   */
  @Test
  void createTaskAboutDomain_asDomainOnlyUser_deniedWithoutFieldError(TestNamespace ns) {
    Domain domain =
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("feed-domain-guard"))
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Domain target for the domain-only guard regression"));
    OpenMetadataClient domainOnly = domainOnlyClient(domain);

    ForbiddenException denied =
        assertThrows(
            ForbiddenException.class,
            () ->
                domainOnly
                    .tasks()
                    .create(
                        new CreateTask()
                            .withName(ns.prefix("task-about-domain"))
                            .withDescription("Task about a domain")
                            .withCategory(TaskCategory.MetadataUpdate)
                            .withType(TaskEntityType.DescriptionUpdate)
                            .withAbout("<#E::domain::" + domain.getFullyQualifiedName() + ">")),
            "A domain-only user must be denied a task about a domainless target");
    assertFalse(
        denied.getMessage().contains("Invalid field name"),
        "Guard must evaluate the domainless target, not leak 'Invalid field name domains': "
            + denied.getMessage());
    assertTrue(
        denied.getMessage().toLowerCase().contains("no domain"),
        "Denial must be the clean domain-scope message: " + denied.getMessage());
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

  // ==================== Targets that carry no domains field ====================

  /**
   * Domain is the only entity type with no {@code domains} field of its own, so resolving a feed
   * target must not ask for that field by name - every conversation scoped to a domain used to fail
   * with 400 "Invalid field name domains" (issue #34274).
   */
  @Test
  void listConversationsByEntityLink_domainTarget_returnsConversation(TestNamespace ns)
      throws Exception {
    Domain domain =
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("feed-domain"))
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Domain target for feed regression coverage"));
    String about = "<#E::domain::" + domain.getFullyQualifiedName() + ">";
    Conversation conversation = createConversation(about, "Conversation on a domain");
    RequestOptions options = RequestOptions.builder().queryParam("entityLink", about).build();

    String json =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, CONVERSATIONS_PATH, null, options);

    assertEquals(
        conversation.getId().toString(),
        MAPPER.readTree(json).get("data").get(0).get("id").asText(),
        "Conversations on a domain must be listable, not rejected for an unsupported field");
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

  // ==================== Reads by id carry their target's check ====================

  @Test
  void conversationById_aboutATableTheCallerCannotView_isNotFound(TestNamespace ns)
      throws Exception {
    Table table = createTestTable(ns, "conv_by_id");
    Conversation conversation = createConversation(entityLink(table), "About a hidden table");
    OpenMetadataClient denied = clientDeniedViewOn(ns, "convbyid", Entity.TABLE);

    for (String path :
        List.of(
            CONVERSATIONS_PATH + "/" + conversation.getId(),
            CONVERSATIONS_PATH + "/" + conversation.getId() + "/replies")) {
      ApiException failure = assertThrows(ApiException.class, () -> get(denied, path), path);
      assertEquals(404, failure.getStatusCode(), path);
    }
  }

  @Test
  void taskById_aboutATableTheCallerCannotView_isRefused(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns, "task_by_id");
    Task task = createTaskAbout(ns, table);
    OpenMetadataClient denied = clientDeniedViewOn(ns, "taskbyid", Entity.TABLE);

    for (String path :
        List.of(
            TASKS_PATH + "/" + task.getId(),
            TASKS_PATH + "/" + task.getId() + "?fields=assignees",
            TASKS_PATH + "/" + task.getId() + "/versions")) {
      assertThrows(ForbiddenException.class, () -> get(denied, path), path);
    }
  }

  /**
   * The listings hand out what the read by id refuses unless they check each task's entity too: a
   * task about a table the caller may not view stays out of the listing by that table, the
   * assignee's inbox and the domain's tasks, while a task about a table they may view stays in.
   */
  @Test
  void taskListings_leaveOutTasksAboutEntitiesTheCallerCannotView(TestNamespace ns)
      throws Exception {
    assumeFalse(
        OssTestServer.isExternalMode(),
        "Signs the reader's token with the harness key, which a deployed cluster rejects");
    OpenMetadataClient admin = SdkClients.adminClient();
    Domain domain =
        ns.trackRoot(
            Entity.DOMAIN,
            admin
                .domains()
                .create(
                    new CreateDomain()
                        .withName(ns.prefix("task-list-domain"))
                        .withDomainType(CreateDomain.DomainType.AGGREGATE)
                        .withDescription("Domain of the tables the listed tasks are about")));
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table hiddenTable =
        createTableInDomain(schema, ns.prefix("list-hidden"), List.of(PII_SENSITIVE), domain);
    Table openTable = createTableInDomain(schema, ns.prefix("list-open"), List.of(), domain);
    User reader = readerDeniedTaggedTables(ns);
    String hidden = createTaskAssignedTo(ns, hiddenTable, reader, "hidden").getId().toString();
    String shown = createTaskAssignedTo(ns, openTable, reader, "shown").getId().toString();
    OpenMetadataClient asReader =
        SdkClients.createClient(reader.getName(), reader.getEmail(), new String[] {});
    String byAbout = TASKS_PATH + "?fields=about,payload,assignees&limit=100&aboutEntity=";

    assertEquals(List.of(), listedIds(asReader, byAbout + encode(hiddenTable)));
    assertEquals(List.of(shown), listedIds(asReader, byAbout + encode(openTable)));
    for (String path :
        List.of(
            TASKS_PATH + "/assigned?limit=100",
            "/v1/domains/"
                + URLEncoder.encode(domain.getFullyQualifiedName(), StandardCharsets.UTF_8)
                + "/tasks?limit=100")) {
      List<String> listed = listedIds(asReader, path);
      assertTrue(listed.contains(shown), path + " lost a task about a viewable table");
      assertFalse(listed.contains(hidden), path + " leaked a task about a hidden table");
    }
    assertEquals(List.of(hidden), listedIds(admin, byAbout + encode(hiddenTable)));
  }

  @Test
  void activityAboutALink_returnsOnlyEventsOfTheLinksEntityType(TestNamespace ns) throws Exception {
    String sharedName = "act_" + UUID.randomUUID().toString().substring(0, 8);
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName(sharedName, ns);
    User namesake =
        ns.trackRoot(
            Entity.USER,
            SdkClients.adminClient()
                .users()
                .create(
                    new CreateUser()
                        .withName(sharedName)
                        .withEmail(sharedName + "@test.openmetadata.org")));
    ActivityEvent serviceEvent =
        new ActivityEvent()
            .withId(UUID.randomUUID())
            .withEventType(ActivityEventType.ENTITY_UPDATED)
            .withEntity(service.getEntityReference())
            .withAbout("<#E::databaseService::" + sharedName + ">")
            .withActor(namesake.getEntityReference())
            .withTimestamp(System.currentTimeMillis())
            .withSummary("Updated " + sharedName);
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.POST,
            ACTIVITY_PATH + "/test-insert",
            MAPPER.writeValueAsString(serviceEvent),
            RequestOptions.builder().build());
    OpenMetadataClient denied = clientDeniedViewOn(ns, "actlink", Entity.DATABASE_SERVICE);

    List<String> ids =
        listedIds(
            denied,
            ACTIVITY_PATH
                + "/about?entityLink="
                + java.net.URLEncoder.encode(
                    "<#E::user::" + namesake.getName() + ">",
                    java.nio.charset.StandardCharsets.UTF_8));

    assertFalse(ids.contains(serviceEvent.getId().toString()), ids.toString());
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
                .withName(ns.shortPrefix("announcement-" + UUID.randomUUID()))
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

  private static final TagLabel PII_SENSITIVE =
      new TagLabel()
          .withTagFQN("PII.Sensitive")
          .withSource(TagLabel.TagSource.CLASSIFICATION)
          .withLabelType(TagLabel.LabelType.MANUAL)
          .withState(TagLabel.State.CONFIRMED);

  private static Table createTable(DatabaseSchema schema, String name, List<TagLabel> tags) {
    return SdkClients.adminClient().tables().create(tableRequest(schema, name, tags));
  }

  private static Table createTableInDomain(
      DatabaseSchema schema, String name, List<TagLabel> tags, Domain domain) {
    return SdkClients.adminClient()
        .tables()
        .create(
            tableRequest(schema, name, tags).withDomains(List.of(domain.getFullyQualifiedName())));
  }

  private static CreateTable tableRequest(DatabaseSchema schema, String name, List<TagLabel> tags) {
    return new CreateTable()
        .withName(name)
        .withDatabaseSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
        .withTags(tags);
  }

  private static Task createTaskAssignedTo(
      TestNamespace ns, Table table, User assignee, String label) {
    return SdkClients.adminClient()
        .tasks()
        .create(
            new CreateTask()
                .withName(ns.prefix("task-" + label))
                .withDescription("Task about " + table.getName())
                .withCategory(TaskCategory.MetadataUpdate)
                .withType(TaskEntityType.DescriptionUpdate)
                .withAbout(entityLink(table))
                .withAssignees(List.of(assignee.getFullyQualifiedName())));
  }

  /** A user denied ViewBasic on tables tagged PII.Sensitive, cleaned up with the namespace. */
  private static User readerDeniedTaggedTables(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String prefix = ns.shortPrefix("tasklist");
    Rule denyTagged =
        new Rule()
            .withName(prefix + "_deny")
            .withResources(List.of(Entity.TABLE))
            .withOperations(List.of(MetadataOperation.VIEW_BASIC))
            .withCondition("matchAnyTag('PII.Sensitive')")
            .withEffect(Rule.Effect.DENY);
    Policy policy =
        ns.trackRoot(
            Entity.POLICY,
            admin
                .policies()
                .create(
                    new CreatePolicy()
                        .withName(prefix + "_policy")
                        .withDescription("Denies viewing tables tagged PII.Sensitive")
                        .withRules(List.of(denyTagged))));
    Role role =
        ns.trackRoot(
            Entity.ROLE,
            admin
                .roles()
                .create(
                    new CreateRole()
                        .withName(prefix + "_role")
                        .withDescription("Role carrying the tagged-table deny")
                        .withPolicies(List.of(policy.getFullyQualifiedName()))));
    String name = prefix + "_user";
    return ns.trackRoot(
        Entity.USER,
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(name)
                    .withEmail(name + "@test.openmetadata.org")
                    .withRoles(List.of(role.getId()))));
  }

  private static String encode(Table table) {
    return URLEncoder.encode(table.getFullyQualifiedName(), StandardCharsets.UTF_8);
  }

  private static UUID insertActivity(Table table, User actor) throws Exception {
    ActivityEvent event =
        new ActivityEvent()
            .withId(UUID.randomUUID())
            .withEventType(ActivityEventType.ENTITY_UPDATED)
            .withEntity(table.getEntityReference())
            .withAbout(entityLink(table))
            .withActor(actor.getEntityReference())
            .withTimestamp(System.currentTimeMillis())
            .withSummary("Updated " + table.getName());
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.POST,
            ACTIVITY_PATH + "/test-insert",
            MAPPER.writeValueAsString(event),
            RequestOptions.builder().build());
    return event.getId();
  }

  private static void replyAsAdmin(UUID activityId, String message) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.POST,
            ACTIVITY_PATH + "/" + activityId + "/replies",
            MAPPER.writeValueAsString(new CreatePost().withMessage(message)),
            RequestOptions.builder().build());
  }

  private static String loggedInUserName(OpenMetadataClient client) throws Exception {
    return MAPPER.readTree(get(client, "/v1/users/loggedInUser")).path("name").asText();
  }

  private static List<String> listedIds(OpenMetadataClient client, String path) throws Exception {
    List<String> ids = new ArrayList<>();
    MAPPER.readTree(get(client, path)).path("data").forEach(e -> ids.add(e.path("id").asText()));
    return ids;
  }

  private static Table inDomain(Table table, Domain domain) throws Exception {
    patch(
        SdkClients.adminClient(),
        "/v1/tables/" + table.getId(),
        "[{\"op\":\"add\",\"path\":\"/domains\",\"value\":[{\"id\":\""
            + domain.getId()
            + "\",\"type\":\"domain\"}]}]");
    return table;
  }

  /** One page of size one of the announcements in {@code domain}, from {@code after}. */
  private static JsonNode announcementPage(OpenMetadataClient client, Domain domain, String after)
      throws Exception {
    RequestOptions.Builder options =
        RequestOptions.builder()
            .queryParam("domain", domain.getFullyQualifiedName())
            .queryParam("limit", "1");
    if (after != null) {
      options.queryParam("after", after);
    }
    return MAPPER.readTree(
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, ANNOUNCEMENTS_PATH, null, options.build()));
  }

  /** Every active entity announcement the client is shown, across all pages. */
  private static List<String> activeAnnouncementIds(OpenMetadataClient client) throws Exception {
    List<String> ids = new ArrayList<>();
    String after = null;
    do {
      RequestOptions.Builder options =
          RequestOptions.builder()
              .queryParam("active", "true")
              .queryParam("system", "false")
              .queryParam("limit", "1000");
      if (after != null) {
        options.queryParam("after", after);
      }
      JsonNode page =
          MAPPER.readTree(
              client
                  .getHttpClient()
                  .executeForString(HttpMethod.GET, ANNOUNCEMENTS_PATH, null, options.build()));
      page.path("data").forEach(announcement -> ids.add(announcement.path("id").asText()));
      after = page.path("paging").path("after").asText(null);
    } while (after != null);
    return ids;
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

  /**
   * Builds a user carrying the seeded {@code DomainOnlyAccessRole} scoped to {@code domain}, so the
   * task create path runs {@code enforceDomainOnlyPolicyForTask}. Mirrors the domain-only setup in
   * ActivityResourceIT.
   */
  private static OpenMetadataClient domainOnlyClient(Domain domain) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Role domainOnlyRole = admin.roles().getByName("DomainOnlyAccessRole");
    String prefix = "domonly_" + UUID.randomUUID().toString().substring(0, 8);
    String email = prefix + "@test.openmetadata.org";
    admin
        .users()
        .create(
            new CreateUser()
                .withName(prefix)
                .withEmail(email)
                .withDescription("Domain-only access user for feed guard regression")
                .withRoles(List.of(domainOnlyRole.getId()))
                .withDomains(List.of(domain.getFullyQualifiedName())));
    return SdkClients.createClient(email, email, new String[] {});
  }
}
