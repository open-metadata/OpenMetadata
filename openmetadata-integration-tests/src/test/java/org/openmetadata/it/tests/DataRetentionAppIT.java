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
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.awaitility.Awaitility;
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
import org.openmetadata.schema.api.feed.CreateThread;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for the Data Retention application.
 *
 * <p>Regression coverage for the 2.0 activity-storage migration: the migration renames
 * thread_entity (e.g. to thread_entity_legacy) specifically to fail stale references, so the
 * retention job must resolve the current thread storage table instead of hardcoding the old name.
 * A failure in one cleanup step also aborts the steps after it, so a crash here silently disables
 * test-case-result, profile-data, and audit-log retention as well.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class DataRetentionAppIT {

  private static final String APP_NAME = "DataRetentionApplication";
  // Default activityThreadsRetentionPeriod is 60 days; 90 days is safely past it.
  private static final long NINETY_DAYS_MILLIS = 90L * 24 * 60 * 60 * 1000;
  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  @BeforeAll
  static void setup() {
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void test_retentionRun_cleansOldConversationsFromThreadStorage(TestNamespace ns)
      throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");

    Table table = createTestTable(ns);
    String about = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    Thread oldThread = createConversation(about, "conversation past retention period");
    Thread recentThread = createConversation(about, "recent conversation");

    String threadTable = resolveThreadTableName();
    backdateThread(threadTable, oldThread.getId(), System.currentTimeMillis() - NINETY_DAYS_MILLIS);

    AppRunRecord run = triggerAppAndWaitForCompletion();

    assertEquals(
        "success",
        run.getStatus().value(),
        () -> "Data retention run did not succeed. failureContext=" + run.getFailureContext());
    assertEquals(
        0,
        threadRowCount(threadTable, oldThread.getId()),
        "conversation older than the retention period must be deleted");
    assertEquals(
        1,
        threadRowCount(threadTable, recentThread.getId()),
        "recent conversation must be retained");
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

  private Thread createConversation(String about, String message) throws Exception {
    CreateThread createThread =
        new CreateThread().withMessage(message).withAbout(about).withType(ThreadType.Conversation);
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/feed", createThread, Thread.class);
  }

  /** Mirrors FeedRepository's resolution across the pre/post-migration thread table names. */
  private String resolveThreadTableName() {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle -> {
              for (String candidate :
                  List.of("thread_entity_legacy", "thread_entity_archived", "thread_entity")) {
                Integer tableCount =
                    handle
                        .createQuery(
                            "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = :name")
                        .bind("name", candidate)
                        .mapTo(Integer.class)
                        .one();
                if (tableCount != null && tableCount > 0) {
                  return candidate;
                }
              }
              throw new IllegalStateException("No thread storage table found in test database");
            });
  }

  /** createdAt is a generated column over json->threadTs, so backdating rewrites the json. */
  private void backdateThread(String threadTable, UUID threadId, long createdAtMillis)
      throws Exception {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              String json =
                  handle
                      .createQuery("SELECT json FROM " + threadTable + " WHERE id = :id")
                      .bind("id", threadId.toString())
                      .mapTo(String.class)
                      .one();
              ObjectNode thread = (ObjectNode) MAPPER.readTree(json);
              thread.put("threadTs", createdAtMillis);
              boolean isPostgres =
                  handle
                      .getConnection()
                      .getMetaData()
                      .getDatabaseProductName()
                      .toLowerCase(Locale.ROOT)
                      .contains("postgres");
              String update =
                  isPostgres
                      ? "UPDATE " + threadTable + " SET json = CAST(:json AS jsonb) WHERE id = :id"
                      : "UPDATE " + threadTable + " SET json = :json WHERE id = :id";
              handle
                  .createUpdate(update)
                  .bind("json", thread.toString())
                  .bind("id", threadId.toString())
                  .execute();
            });
  }

  private int threadRowCount(String threadTable, UUID threadId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM " + threadTable + " WHERE id = :id")
                    .bind("id", threadId.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private AppRunRecord triggerAppAndWaitForCompletion() {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    long triggerTime = System.currentTimeMillis();
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

    AtomicReference<AppRunRecord> completedRun = new AtomicReference<>();
    Awaitility.await("Wait for terminal run of " + APP_NAME)
        .atMost(Duration.ofMinutes(5))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              AppRunRecord run =
                  httpClient.execute(
                      HttpMethod.GET,
                      "/v1/apps/name/" + APP_NAME + "/runs/latest",
                      null,
                      AppRunRecord.class);
              if (run == null
                  || run.getStatus() == null
                  || run.getTimestamp() == null
                  // Allow modest clock skew between the test JVM and the server under test.
                  || run.getTimestamp() < triggerTime - 60_000) {
                return false;
              }
              String status = run.getStatus().value();
              if ("running".equalsIgnoreCase(status) || "started".equalsIgnoreCase(status)) {
                return false;
              }
              completedRun.set(run);
              return true;
            });
    return completedRun.get();
  }
}
