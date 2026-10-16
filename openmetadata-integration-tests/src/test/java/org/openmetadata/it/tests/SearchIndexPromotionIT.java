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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;

@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class SearchIndexPromotionIT {

  private static final String APP_NAME = "SearchIndexingApplication";
  private static final String TABLE_ENTITY = "table";
  private static final String TABLE_CANONICAL_ALIAS = "openmetadata_table_search_index";
  private static final String TABLE_SHORT_ALIAS = "openmetadata_table";
  private static final String TABLE_REBUILD_PREFIX = TABLE_CANONICAL_ALIAS + "_rebuild_";
  private static final Set<String> SUCCESS_STATUSES = Set.of("success", "completed");
  private static final Set<String> TERMINAL_STATUSES =
      Set.of("success", "completed", "failed", "activeerror", "stopped");

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void tableOnlyRerunPromotesNewStagedIndex(TestNamespace ns) {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");

    createTableForReindex(ns);

    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    waitForCurrentRunCompletion(httpClient);

    String initialTarget = readSingleTableAliasTargetIfPresent();
    Long previousRunStartTime = readLatestRunStartTime(httpClient);
    triggerTableReindex(httpClient);
    AppRunRecord firstRun = waitForLatestRunSuccess(httpClient, previousRunStartTime);
    String firstTarget = waitForPromotedTableAlias(initialTarget);

    triggerTableReindex(httpClient);
    waitForLatestRunSuccess(httpClient, firstRun.getStartTime());
    String secondTarget = waitForPromotedTableAlias(firstTarget);

    assertNotEquals(firstTarget, secondTarget, "Second reindex should promote a new staged index");
    assertPreviousTargetIsNotServing(firstTarget);
  }

  private static void createTableForReindex(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table =
        TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "promotion_table");

    assertNotNull(table.getId(), "Test table should be created before reindex");
  }

  private static void triggerTableReindex(HttpClient httpClient) {
    Map<String, Object> config = new HashMap<>();
    config.put("entities", List.of(TABLE_ENTITY));
    config.put("batchSize", 100);

    Awaitility.await("Trigger table-only " + APP_NAME)
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptionsMatching(
            e -> e.getMessage() != null && e.getMessage().contains("already running"))
        .until(
            () -> {
              httpClient.execute(
                  HttpMethod.POST, "/v1/apps/trigger/" + APP_NAME, config, Void.class);
              return true;
            });
  }

  private static AppRunRecord waitForLatestRunSuccess(
      HttpClient httpClient, Long previousRunStartTime) {
    AppRunRecord[] holder = new AppRunRecord[1];

    Awaitility.await("Table reindex run completion")
        .atMost(Duration.ofMinutes(5))
        .pollDelay(Duration.ofSeconds(2))
        .pollInterval(Duration.ofSeconds(5))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              AppRunRecord run = readLatestRun(httpClient);
              assertNotNull(run);
              assertNotNull(run.getStatus());
              if (previousRunStartTime != null
                  && run.getStartTime() != null
                  && run.getStartTime() <= previousRunStartTime) {
                throw new AssertionError(
                    "Latest run is still the pre-trigger one (startTime="
                        + run.getStartTime()
                        + ", previous="
                        + previousRunStartTime
                        + ")");
              }
              String status = normalizedStatus(run);
              assertTrue(
                  TERMINAL_STATUSES.contains(status), "Run not in terminal state: " + status);
              holder[0] = run;
            });

    AppRunRecord run = holder[0];
    assertTrue(
        SUCCESS_STATUSES.contains(normalizedStatus(run)),
        () -> "Expected successful table reindex run but got: " + run);
    return run;
  }

  private static String waitForPromotedTableAlias(String previousTarget) {
    String[] target = new String[1];

    Awaitility.await("Table alias promotion")
        .atMost(Duration.ofMinutes(2))
        .pollDelay(Duration.ofSeconds(1))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              String currentTarget = readSingleTableAliasTarget();
              assertTrue(
                  currentTarget.startsWith(TABLE_REBUILD_PREFIX),
                  "Table alias should point at a staged rebuild index, got " + currentTarget);
              if (previousTarget != null) {
                assertNotEquals(
                    previousTarget,
                    currentTarget,
                    "Table alias should move to a new staged index after rerun");
              }
              Set<String> shortAliasTargets = searchClient().getIndicesByAlias(TABLE_SHORT_ALIAS);
              assertTrue(
                  shortAliasTargets.contains(currentTarget),
                  "Short table alias should include the promoted staged table index");
              target[0] = currentTarget;
            });

    return target[0];
  }

  private static String readSingleTableAliasTargetIfPresent() {
    Set<String> targets = searchClient().getIndicesByAlias(TABLE_CANONICAL_ALIAS);
    if (targets.isEmpty()) {
      return null;
    }
    assertEquals(1, targets.size(), "Table canonical alias should have a single target");
    return targets.iterator().next();
  }

  private static String readSingleTableAliasTarget() {
    String target = readSingleTableAliasTargetIfPresent();
    assertNotNull(target, "Table canonical alias should point at a promoted index");
    return target;
  }

  private static void assertPreviousTargetIsNotServing(String previousTarget) {
    SearchClient client = searchClient();
    if (!client.indexExists(previousTarget)) {
      return;
    }

    Set<String> aliases = client.getAliases(previousTarget);
    assertFalse(
        aliases.contains(TABLE_CANONICAL_ALIAS),
        "Previous staged index should no longer have the canonical table alias");
    assertFalse(
        aliases.contains(TABLE_SHORT_ALIAS),
        "Previous staged index should no longer have the short table alias");
  }

  private static Long readLatestRunStartTime(HttpClient httpClient) {
    try {
      AppRunRecord latest = readLatestRun(httpClient);
      return latest == null ? null : latest.getStartTime();
    } catch (Exception ignored) {
      return null;
    }
  }

  private static AppRunRecord readLatestRun(HttpClient httpClient) {
    return httpClient.execute(
        HttpMethod.GET, "/v1/apps/name/" + APP_NAME + "/runs/latest", null, AppRunRecord.class);
  }

  private static void waitForCurrentRunCompletion(HttpClient httpClient) {
    try {
      Awaitility.await("Wait for in-flight " + APP_NAME)
          .atMost(Duration.ofMinutes(5))
          .pollInterval(Duration.ofSeconds(3))
          .ignoreExceptions()
          .until(
              () -> {
                AppRunRecord latest = readLatestRun(httpClient);
                if (latest == null || latest.getStatus() == null) {
                  return true;
                }
                String status = normalizedStatus(latest);
                return !"running".equals(status) && !"started".equals(status);
              });
    } catch (org.awaitility.core.ConditionTimeoutException ignored) {
      // The trigger retry loop handles "already running" if the current run continues.
    }
  }

  private static String normalizedStatus(AppRunRecord run) {
    return run.getStatus().value().toLowerCase();
  }

  private static SearchClient searchClient() {
    return Entity.getSearchRepository().getSearchClient();
  }
}
