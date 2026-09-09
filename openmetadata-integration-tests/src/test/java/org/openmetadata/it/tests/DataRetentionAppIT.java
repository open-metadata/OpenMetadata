/*
 *  Copyright 2026 Collate.
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
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.SQLException;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.feed.CreateConversation;
import org.openmetadata.schema.api.feed.CreatePost;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.feed.ConversationReply;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ActivityEventType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * Integration tests for the Data Retention application.
 *
 * <p>Regression coverage for Conversation V2 retention. User conversations retain the legacy
 * policy, while Activity comments are retained indefinitely unless an administrator explicitly
 * enables their policy. A failure in either cleanup also aborts later retention steps.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class DataRetentionAppIT {

  private static final String APP_NAME = "DataRetentionApplication";
  // Default activityThreadsRetentionPeriod is 60 days; 90 days is safely past it.
  private static final long NINETY_DAYS_MILLIS = 90L * 24 * 60 * 60 * 1000;
  private static final Set<String> TERMINAL_RUN_STATUSES =
      Set.of("success", "completed", "failed", "stopped", "activeError");
  private static final int APP_SCHEDULER_THREAD_COUNT = 10;
  private static final int RUNS_AFTER_CONFIG_CHANGE = 3;
  private static final int DISTINCT_RETENTION_DAYS = 11;
  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  @BeforeAll
  static void setup() {
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void test_retentionRun_cleansOldConversations(TestNamespace ns) throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");

    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    Conversation oldConversation = createConversation(about, "conversation past retention period");
    Conversation recentConversation = createConversation(about, "recent conversation");

    backdateConversation(oldConversation.getId(), System.currentTimeMillis() - NINETY_DAYS_MILLIS);

    AppRunRecord run = triggerAppAndWaitForCompletion();

    assertEquals(
        "success",
        run.getStatus().value(),
        () -> "Data retention run did not succeed. failureContext=" + run.getFailureContext());
    assertEquals(
        0,
        conversationRowCount(oldConversation.getId()),
        "conversation older than the retention period must be deleted");
    assertEquals(
        1,
        conversationRowCount(recentConversation.getId()),
        "recent conversation must be retained");
  }

  @Test
  void test_activityCommentsRequireExplicitRetentionPolicy(TestNamespace ns) throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");

    Table table = createTestTable(ns);
    ActivityEvent activity = createActivity(table);
    ConversationReply reply = addActivityReply(activity.getId());
    assertEquals(activity.getId(), reply.getConversationId());
    backdateConversation(activity.getId(), System.currentTimeMillis() - NINETY_DAYS_MILLIS);
    ActivityEvent oldActivityWithRecentComment = createActivity(table);
    addActivityReply(oldActivityWithRecentComment.getId());
    backdateActivityTimestamp(
        oldActivityWithRecentComment.getId(), System.currentTimeMillis() - NINETY_DAYS_MILLIS);

    setActivityCommentsRetentionPeriod(0);
    try {
      AppRunRecord defaultRun = triggerAppAndWaitForCompletion();
      assertEquals("success", defaultRun.getStatus().value());
      assertEquals(
          1,
          conversationRowCount(activity.getId()),
          "activity comments must be retained when no retention policy is enabled");
      assertEquals(1, conversationRowCount(oldActivityWithRecentComment.getId()));

      setActivityCommentsRetentionPeriod(1);
      AppRunRecord configuredRun = triggerAppAndWaitForCompletion();
      assertEquals("success", configuredRun.getStatus().value());
      assertEquals(
          0,
          conversationRowCount(activity.getId()),
          "an explicit activity-comment retention policy must remove expired comments");
      assertEquals(
          1,
          activityRowCount(activity.getId()),
          "comment retention must not remove the ActivityEvent");
      assertEquals(
          1,
          conversationRowCount(oldActivityWithRecentComment.getId()),
          "a recent comment on an old ActivityEvent must be retained");
    } finally {
      setActivityCommentsRetentionPeriod(0);
    }
  }

  @Test
  void test_appConfigurationChange_isUsedByTheNextRun() throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");

    App app = Apps.getByName(APP_NAME);
    int original = changeEventRetentionPeriod(JsonUtils.getMap(app.getAppConfiguration()));
    int changed =
        original == DISTINCT_RETENTION_DAYS ? DISTINCT_RETENTION_DAYS + 1 : DISTINCT_RETENTION_DAYS;

    try {
      for (int i = 0; i < APP_SCHEDULER_THREAD_COUNT; i++) {
        triggerAppAndWaitForCompletion();
      }

      setChangeEventRetentionPeriod(app.getId(), changed);

      for (int run = 0; run < RUNS_AFTER_CONFIG_CHANGE; run++) {
        AppRunRecord record = triggerAppAndWaitForCompletion();
        assertEquals(
            changed,
            changeEventRetentionPeriod(record.getConfig()),
            "run " + run + " used a stale appConfiguration");
      }
    } finally {
      setChangeEventRetentionPeriod(app.getId(), original);
    }
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

  private Conversation createConversation(String about, String message) throws Exception {
    CreateConversation request = new CreateConversation().withMessage(message).withAbout(about);
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/conversations", request, Conversation.class);
  }

  private ActivityEvent createActivity(Table table) throws Exception {
    User admin = SdkClients.adminClient().users().getByName("admin");
    ActivityEvent event =
        new ActivityEvent()
            .withId(UUID.randomUUID())
            .withEventType(ActivityEventType.ENTITY_CREATED)
            .withEntity(
                new EntityReference()
                    .withId(table.getId())
                    .withType(Entity.TABLE)
                    .withName(table.getName())
                    .withFullyQualifiedName(table.getFullyQualifiedName()))
            .withActor(
                new EntityReference()
                    .withId(admin.getId())
                    .withType(Entity.USER)
                    .withName(admin.getName())
                    .withFullyQualifiedName(admin.getFullyQualifiedName()))
            .withAbout("<#E::table::" + table.getFullyQualifiedName() + ">")
            .withTimestamp(System.currentTimeMillis())
            .withSummary("Activity comment retention test");
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/activity/test-insert", event, ActivityEvent.class);
  }

  private ConversationReply addActivityReply(UUID activityId) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/activity/" + activityId + "/replies",
            new CreatePost().withMessage("Retain this activity comment"),
            ConversationReply.class);
  }

  private void backdateConversation(UUID conversationId, long createdAtMillis) throws Exception {
    updateConversationJson(
        conversationId,
        conversation -> {
          conversation.put("createdAt", createdAtMillis);
          conversation.put("updatedAt", createdAtMillis);
          if ("Activity".equals(conversation.path("source").asText())) {
            conversation.put("activityTimestamp", createdAtMillis);
          }
        });
  }

  private void backdateActivityTimestamp(UUID conversationId, long activityTimestamp)
      throws Exception {
    updateConversationJson(
        conversationId, conversation -> conversation.put("activityTimestamp", activityTimestamp));
  }

  private void updateConversationJson(UUID conversationId, Consumer<ObjectNode> update)
      throws Exception {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              String json =
                  handle
                      .createQuery("SELECT json FROM conversation_entity WHERE id = :id")
                      .bind("id", conversationId.toString())
                      .mapTo(String.class)
                      .one();
              ObjectNode conversation = (ObjectNode) MAPPER.readTree(json);
              update.accept(conversation);
              String updateSql =
                  isPostgres(handle)
                      ? "UPDATE conversation_entity SET json = CAST(:json AS jsonb) WHERE id = :id"
                      : "UPDATE conversation_entity SET json = :json WHERE id = :id";
              handle
                  .createUpdate(updateSql)
                  .bind("json", conversation.toString())
                  .bind("id", conversationId.toString())
                  .execute();
            });
  }

  private boolean isPostgres(Handle handle) throws SQLException {
    return handle
        .getConnection()
        .getMetaData()
        .getDatabaseProductName()
        .toLowerCase(Locale.ROOT)
        .contains("postgres");
  }

  private int conversationRowCount(UUID conversationId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM conversation_entity WHERE id = :id")
                    .bind("id", conversationId.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private int activityRowCount(UUID activityId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM activity_stream WHERE id = :id")
                    .bind("id", activityId.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private void setActivityCommentsRetentionPeriod(int days) throws Exception {
    UUID appId = Apps.getByName(APP_NAME).getId();
    String patch =
        "[{\"op\":\"replace\",\"path\":\"/appConfiguration/"
            + "activityCommentsRetentionPeriod\",\"value\":"
            + days
            + "}]";
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/apps/" + appId,
            patch,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
  }

  private void setChangeEventRetentionPeriod(UUID appId, int days) {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/apps/" + appId,
            String.format(
                "[{\"op\":\"replace\",\"path\":\"/appConfiguration/changeEventRetentionPeriod\","
                    + "\"value\":%d}]",
                days),
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
  }

  private int changeEventRetentionPeriod(Map<String, Object> config) {
    assertNotNull(config, "run record carried no config");
    return ((Number) config.get("changeEventRetentionPeriod")).intValue();
  }

  private AppRunRecord triggerAppAndWaitForCompletion() {
    waitForLatestRunTerminal();
    long floorMillis = System.currentTimeMillis();
    triggerWhenAccepted();
    return waitForTerminalRunStartedAtOrAfter(floorMillis);
  }

  private void waitForLatestRunTerminal() {
    Awaitility.await("Previous run of " + APP_NAME + " to reach a terminal status")
        .atMost(Duration.ofMinutes(5))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              AppRunRecord run = fetchLatestRun();
              return run == null || isTerminal(run);
            });
  }

  private void triggerWhenAccepted() {
    Awaitility.await("Trigger " + APP_NAME)
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptionsMatching(
            e -> e.getMessage() != null && e.getMessage().contains("already running"))
        .until(
            () -> {
              Apps.trigger(APP_NAME).run();
              return true;
            });
  }

  private AppRunRecord waitForTerminalRunStartedAtOrAfter(long floorMillis) {
    AtomicReference<AppRunRecord> completedRun = new AtomicReference<>();
    Awaitility.await("Terminal run of " + APP_NAME + " started at or after " + floorMillis)
        .atMost(Duration.ofMinutes(5))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              AppRunRecord run = fetchLatestRun();
              boolean isTheRunWeTriggered =
                  run != null
                      && run.getTimestamp() != null
                      && run.getTimestamp() >= floorMillis
                      && isTerminal(run);
              if (isTheRunWeTriggered) {
                completedRun.set(run);
              }
              return isTheRunWeTriggered;
            });
    return completedRun.get();
  }

  private AppRunRecord fetchLatestRun() {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    return httpClient.execute(
        HttpMethod.GET, "/v1/apps/name/" + APP_NAME + "/runs/latest", null, AppRunRecord.class);
  }

  private static boolean isTerminal(AppRunRecord run) {
    return run.getStatus() != null && TERMINAL_RUN_STATUSES.contains(run.getStatus().value());
  }
}
