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

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.time.Duration;
import java.util.HashMap;
import java.util.LinkedHashSet;
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
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Regression guard for the
 * {@code ReindexingUtil.getSearchIndexFields → Entity.getFields(entityType, fields)} contract.
 *
 * <p>{@link org.openmetadata.service.search.indexes.SearchIndex#COMMON_REINDEX_FIELDS} is the
 * union of relationship/enrichment fields the reindex pipeline asks {@code EntityRepository}
 * to fetch. Many entity schemas omit one or more of these (e.g. {@code storageService},
 * {@code databaseService} and every other {@code *Service} have no {@code reviewers} /
 * {@code votes} / {@code extension} / {@code certification}; {@code ingestionPipeline} has no
 * {@code dataProducts}; {@code user} / {@code team} omit most of them).
 *
 * <p>Without the {@code allowedFields} intersection inside
 * {@link org.openmetadata.service.workflows.searchIndex.ReindexingUtil#getSearchIndexFields(String)
 * ReindexingUtil.getSearchIndexFields}, the validation in
 * {@link org.openmetadata.service.util.EntityUtil.Fields} throws
 * {@code IllegalArgumentException("Invalid field name reviewers")} on the first batch, which
 * surfaces as a {@code Reader}-source {@code IndexingError} and terminates that entity-type's
 * partition.
 *
 * <p>This test triggers the bundled {@code SearchIndexingApplication} (which runs reindex for
 * every registered entity type), waits for completion, and asserts that:
 *
 * <ul>
 *   <li>The job completed successfully (status not {@code failed}).</li>
 *   <li>Per-entity {@code entityStats} for every fields-missing type reports zero
 *       {@code failedRecords} — i.e. no batches were rejected by the field validator.</li>
 *   <li>{@code totalRecords > 0} for at least one of those types, proving the reindex actually
 *       exercised the {@code Entity.getFields} validation path (a vacuous "0 failures because
 *       0 entities" result wouldn't catch the regression).</li>
 * </ul>
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class SearchIndexingFieldsParityIT {

  private static final String APP_NAME = "SearchIndexingApplication";

  /** Entity types whose JSON schema is missing one or more fields from {@code
   *  COMMON_REINDEX_FIELDS} ({@code owners, domains, reviewers, followers, votes, extension,
   *  certification, dataProducts}). Any of these would throw on the first batch without the
   *  {@code allowedFields} intersection. Verified against the generated {@code @JsonPropertyOrder}
   *  on each entity class as of this commit. */
  private static final Set<String> FIELDS_MISSING_TYPES =
      Set.of(
          "container",
          "databaseService",
          "storageService",
          "messagingService",
          "pipelineService",
          "dashboardService",
          "mlmodelService",
          "metadataService",
          "searchService",
          "apiService",
          "ingestionPipeline",
          "team",
          "user",
          "tag",
          "classification",
          "glossary",
          "glossaryTerm",
          "dataProduct",
          "domain",
          "table",
          "topic",
          "dashboard",
          "pipeline",
          "mlmodel",
          "database",
          "databaseSchema",
          "chart",
          "dashboardDataModel",
          "apiCollection",
          "apiEndpoint",
          "spreadsheet",
          "worksheet",
          "directory",
          "file",
          "storedProcedure",
          "searchIndex",
          "query",
          "metric");

  @BeforeAll
  static void setup() {
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void allEntityTypesReindexWithoutFieldValidationFailures() throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");

    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    waitForCurrentRunCompletion(httpClient);
    // Snapshot the latest run BEFORE triggering. Without this, a fast poll after trigger can
    // observe the previous completed run and pass without ever seeing the new one.
    Long previousRunStartTime = readLatestRunStartTime(httpClient);
    triggerWithDefaultConfig(httpClient);
    AppRunRecord run = waitForLatestRunSuccess(httpClient, previousRunStartTime);

    assertNoFieldValidationFailures(run);
  }

  private static void triggerWithDefaultConfig(HttpClient httpClient) {
    // Re-trigger with the bundled config. The default config indexes "all" entity types with
    // recreateIndex=true, which is exactly the surface we need to exercise: every registered
    // entity type goes through PaginatedEntitiesSource → Entity.getFields(entityType, fields).
    Map<String, Object> config = new HashMap<>();
    config.put("entities", List.of("all"));
    config.put("recreateIndex", true);
    config.put("batchSize", "100");

    Awaitility.await("Trigger " + APP_NAME)
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
    Awaitility.await("Reindex run completion")
        .atMost(Duration.ofMinutes(10))
        .pollDelay(Duration.ofSeconds(2))
        .pollInterval(Duration.ofSeconds(5))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              AppRunRecord run =
                  httpClient.execute(
                      HttpMethod.GET,
                      "/v1/apps/name/" + APP_NAME + "/runs/latest",
                      null,
                      AppRunRecord.class);
              assertNotNull(run);
              assertNotNull(run.getStatus());
              // Reject the previous run record — Quartz creates the new AppRunRecord
              // asynchronously, so the latest endpoint can briefly serve the prior completed
              // run after our trigger. The new run is identified by a later startTime.
              if (previousRunStartTime != null
                  && run.getStartTime() != null
                  && run.getStartTime() <= previousRunStartTime) {
                throw new AssertionError(
                    "Latest run is still the pre-trigger one (startTime="
                        + run.getStartTime()
                        + ", previous="
                        + previousRunStartTime
                        + "); waiting for new run record");
              }
              String status = run.getStatus().value();
              assertTrue(
                  "success".equalsIgnoreCase(status)
                      || "completed".equalsIgnoreCase(status)
                      || "failed".equalsIgnoreCase(status)
                      || "activeError".equalsIgnoreCase(status),
                  "Run not in terminal state yet: " + status);
              holder[0] = run;
            });
    AppRunRecord run = holder[0];
    String status = run.getStatus().value().toLowerCase();
    assertNotEquals("failed", status, () -> "Reindex job failed: " + run);
    return run;
  }

  /** Read the latest run's startTime, or null if no prior run exists / endpoint is empty. */
  private static Long readLatestRunStartTime(HttpClient httpClient) {
    try {
      AppRunRecord latest =
          httpClient.execute(
              HttpMethod.GET,
              "/v1/apps/name/" + APP_NAME + "/runs/latest",
              null,
              AppRunRecord.class);
      return latest == null ? null : latest.getStartTime();
    } catch (Exception ignored) {
      return null;
    }
  }

  private static void waitForCurrentRunCompletion(HttpClient httpClient) {
    try {
      Awaitility.await("Wait for in-flight " + APP_NAME)
          .atMost(Duration.ofMinutes(5))
          .pollInterval(Duration.ofSeconds(3))
          .ignoreExceptions()
          .until(
              () -> {
                AppRunRecord latest =
                    httpClient.execute(
                        HttpMethod.GET,
                        "/v1/apps/name/" + APP_NAME + "/runs/latest",
                        null,
                        AppRunRecord.class);
                if (latest == null || latest.getStatus() == null) {
                  return true;
                }
                String status = latest.getStatus().value().toLowerCase();
                return !"running".equals(status) && !"started".equals(status);
              });
    } catch (org.awaitility.core.ConditionTimeoutException ignored) {
      // Best-effort wait; the trigger logic retries on "already running".
    }
  }

  /** Walk {@code successContext.stats.entityStats} and assert that every fields-missing
   *  entity type reports {@code failedRecords == 0}. We additionally require at least one of
   *  those types to have processed records, so a coverage regression (no entities seeded)
   *  doesn't hide the underlying validation bug. */
  @SuppressWarnings("unchecked")
  private static void assertNoFieldValidationFailures(AppRunRecord run) {
    Object successContext = run.getSuccessContext();
    assertNotNull(
        successContext,
        () ->
            "successContext missing; run="
                + run.getStatus().value()
                + ", failureContext="
                + run.getFailureContext());
    Map<String, Object> ctxMap = readMap(successContext);
    Map<String, Object> stats = readMap(ctxMap.get("stats"));
    Map<String, Object> entityStats = readMap(stats.get("entityStats"));
    assertNotNull(entityStats, "entityStats absent — cannot verify per-entity failures");

    Set<String> typesWithFailures = new LinkedHashSet<>();
    long totalSuccessAcrossWatchedTypes = 0;

    for (String entityType : FIELDS_MISSING_TYPES) {
      Object perTypeStats = entityStats.get(entityType);
      if (perTypeStats == null) {
        continue;
      }
      Map<String, Object> perType = readMap(perTypeStats);
      long failed = asLong(perType.get("failedRecords"));
      long success = asLong(perType.get("successRecords"));
      long total = asLong(perType.get("totalRecords"));
      totalSuccessAcrossWatchedTypes += success;
      if (failed > 0) {
        typesWithFailures.add(
            entityType + "(failed=" + failed + " success=" + success + " total=" + total + ")");
      }
    }

    assertTrue(
        typesWithFailures.isEmpty(),
        () ->
            "Reindex reported failed records for entity types whose JSON schema is missing"
                + " one or more COMMON_REINDEX_FIELDS — this is the symptom of"
                + " ReindexingUtil.getSearchIndexFields requesting a field that"
                + " EntityRepository.allowedFields rejects. Failing types: "
                + typesWithFailures);

    // Require at least one successful record across the watched types. totalRecords is seeded
    // before any partition runs, so it would pass even for an early-aborted run; successRecords
    // only ticks once the Reader → Process → Sink pipeline has actually walked at least one
    // entity through Entity.getFields, which is the validation we care about.
    assertTrue(
        totalSuccessAcrossWatchedTypes > 0,
        "None of the watched fields-missing entity types had any successful records. The test"
            + " cannot distinguish 'all clean' from 'nothing exercised'. Seed at least one"
            + " entity of a watched type and ensure the run completed before assertion.");
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> readMap(Object o) {
    if (o == null) {
      return Map.of();
    }
    if (o instanceof Map<?, ?> m) {
      return (Map<String, Object>) m;
    }
    return org.openmetadata.schema.utils.JsonUtils.getMap(o);
  }

  private static long asLong(Object o) {
    if (o == null) {
      return 0L;
    }
    if (o instanceof Number n) {
      return n.longValue();
    }
    return Long.parseLong(o.toString());
  }
}
