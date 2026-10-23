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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.PreparedBatch;
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
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.governance.workflows.WorkflowInstance.WorkflowStatus;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.util.FullyQualifiedName;

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
  // Both inside the 30-day default workflowInstanceRetentionPeriod.
  private static final long TWENTY_DAYS_MILLIS = 20L * 24 * 60 * 60 * 1000;
  private static final long TEN_DAYS_MILLIS = 10L * 24 * 60 * 60 * 1000;
  private static final int STATES_PER_RUN = 3;

  /** org.quartz.threadPool.threadCount in AppScheduler — every thread must run the job once. */
  /** Mirrors {@code ReindexHelpers}. Everything else in the schema's enum is still in flight. */
  private static final Set<String> TERMINAL_RUN_STATUSES =
      Set.of("success", "completed", "failed", "stopped", "activeError");

  private static final int APP_SCHEDULER_THREAD_COUNT = 10;

  private static final int RUNS_AFTER_CONFIG_CHANGE = 3;

  /** Not a schema default, so a stale read cannot be mistaken for the configured value. */
  private static final int DISTINCT_RETENTION_DAYS = 11;

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

  /**
   * A config change must reach the next run. Quartz worker threads are long lived and cache the App
   * they were handed, so once every thread has run this job at least once, a stale copy is all any
   * later run sees — the job keeps pruning to whatever retention period was current when that
   * thread first woke up, for the life of the process.
   */
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
  private String resolveThreadTableName() throws SQLException {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle -> {
              String tableExistsQuery =
                  isPostgres(handle)
                      ? "SELECT COUNT(*) FROM information_schema.tables "
                          + "WHERE table_schema = current_schema() AND table_name = :name"
                      : "SELECT COUNT(*) FROM information_schema.tables "
                          + "WHERE table_schema = DATABASE() AND table_name = :name";
              for (String candidate :
                  List.of("thread_entity_legacy", "thread_entity_archived", "thread_entity")) {
                Integer tableCount =
                    handle
                        .createQuery(tableExistsQuery)
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
              String update =
                  isPostgres(handle)
                      ? "UPDATE " + threadTable + " SET json = CAST(:json AS jsonb) WHERE id = :id"
                      : "UPDATE " + threadTable + " SET json = :json WHERE id = :id";
              handle
                  .createUpdate(update)
                  .bind("json", thread.toString())
                  .bind("id", threadId.toString())
                  .execute();
            });
  }

  /**
   * Seeds governance workflow runs straight into the time-series tables: more expired runs than one
   * cleanup page holds, with the runs that must survive interleaved among them. A retention run must
   * delete exactly the expired runs, with all of their states, and leave every kept run whole.
   */
  @Test
  void test_retentionRun_deletesExpiredWorkflowRunsButKeepsEachEntitysLatest(TestNamespace ns)
      throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");
    final WorkflowRunHistory history = new WorkflowRunHistory(ns.prefix("retentionWorkflow"));
    // The rows are inserted directly, so TestNamespace cleanup cannot see them: remove every seeded
    // run, state and live-process row, also when seeding or the app run fails part way.
    try {
      final Set<String> keptRuns = TestSuiteBootstrap.getJdbi().withHandle(history::seedRunsToKeep);
      final Set<String> expiredRuns =
          TestSuiteBootstrap.getJdbi().withHandle(history::seedExpiredRuns);
      final AppRunRecord run = triggerAppAndWaitForCompletion();
      assertRetentionOutcome(history, run, keptRuns, expiredRuns);
    } finally {
      TestSuiteBootstrap.getJdbi().useHandle(history::removeSeededHistory);
    }
  }

  private void assertRetentionOutcome(
      final WorkflowRunHistory history,
      final AppRunRecord run,
      final Set<String> keptRuns,
      final Set<String> expiredRuns)
      throws Exception {
    assertEquals(
        "success",
        run.getStatus().value(),
        () -> "Data retention run did not succeed. failureContext=" + run.getFailureContext());
    assertEquals(
        keptRuns,
        history.remainingRunIds(),
        "only ended runs past the retention period with a newer run for their entity may go");
    assertEquals(
        history.statesPerRun(keptRuns),
        history.remainingStatesPerRun(),
        "a kept run must keep every state and a deleted run must leave none behind");
    assertStatesEndpoint(history.workflowName(), keptRuns, expiredRuns);
    // RUNNING, SUPERSEDED and EXCEPTION with a live process, and the two inside the period.
    assertEquals(5, countRunsFromApi(history.workflowName(), history.busyEntity()));
    // A non-ASCII entity link: the hash computed in Java must match the database's md5.
    assertEquals(1, countRunsFromApi(history.workflowName(), history.nonAsciiEntity()));
  }

  private int countRunsFromApi(String workflowName, String entityLink) throws Exception {
    final String path =
        "/v1/governance/workflowInstances?workflowDefinitionName=%s&entityLink=%s&startTs=0&endTs=%d&limit=100"
            .formatted(
                workflowName,
                URLEncoder.encode(entityLink, StandardCharsets.UTF_8),
                System.currentTimeMillis());
    final String json =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, path, null, RequestOptions.builder().build());
    return MAPPER.readTree(json).path("data").size();
  }

  private void assertStatesEndpoint(
      String workflowName, Set<String> keptRuns, Set<String> expiredRuns) throws Exception {
    // The first run seeded on each side: the lone entity's run, and an expired busy-entity run.
    final String keptRun = keptRuns.iterator().next();
    assertEquals(STATES_PER_RUN, countStatesFromApi(workflowName, keptRun));
    assertEquals(0, countStatesFromApi(workflowName, expiredRuns.iterator().next()));
    assertEquals(
        0,
        countStatesFromApi(workflowName + "Other", keptRun),
        "a workflow that does not own the run must not list its states");
  }

  private int countStatesFromApi(String workflowName, String runId) throws Exception {
    final String path =
        "/v1/governance/workflowInstanceStates/%s/%s?startTs=0&endTs=%d&limit=100"
            .formatted(workflowName, runId, System.currentTimeMillis());
    final String json =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, path, null, RequestOptions.builder().build());
    return MAPPER.readTree(json).path("data").size();
  }

  private static boolean isPostgres(Handle handle) throws SQLException {
    return handle
        .getConnection()
        .getMetaData()
        .getDatabaseProductName()
        .toLowerCase(Locale.ROOT)
        .contains("postgres");
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

  /**
   * Triggers the app and returns the record for <em>that</em> run.
   *
   * <p>{@link AppRunRecord} carries no run id, and {@code /runs/latest} hands back whichever record
   * has the highest timestamp, so a start-time floor is the only thing separating this run's record
   * from the previous one. Waiting for the previous run to go terminal, capturing the floor, then
   * requiring a terminal record at or after it is the shape {@code
   * ReindexHelpers.triggerSearchIndexAndWait} already uses against the same endpoint. Its helpers
   * take a {@code ServerHandle} rather than an SDK client, so the shape is ported rather than
   * called.
   *
   * <p>The floor carries no skew tolerance on purpose. {@code TestSuiteBootstrap} runs the server
   * in-process under {@code DropwizardAppExtension}, so the timestamp {@code
   * OmAppJobListener.jobToBeExecuted} writes comes from this same JVM clock. A skew window would
   * drag the floor below the previous run's timestamp, and the first poll — which can easily beat
   * the RUNNING record, since the listener makes two DB round trips before writing it — would
   * accept that stale record instead.
   */
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

  private record RunSpec(
      String workflowDefinitionId,
      String entityLink,
      WorkflowStatus status,
      long timestamp,
      boolean liveProcess) {
    RunSpec(String workflowDefinitionId, String entityLink, WorkflowStatus status, long timestamp) {
      this(workflowDefinitionId, entityLink, status, timestamp, false);
    }
  }

  /**
   * Governance workflow run history for one workflow, seeded as rows with {@link #STATES_PER_RUN}
   * states per run, plus one run of a second workflow for the same busy entity.
   */
  private static final class WorkflowRunHistory {
    // A cleanup page holds 1,000 runs, so this forces a second page.
    private static final int EXPIRED_RUNS_PAST_ONE_PAGE = 1_200;
    private static final List<WorkflowStatus> ENDED_STATUSES =
        List.of(
            WorkflowStatus.FINISHED,
            WorkflowStatus.FAILURE,
            WorkflowStatus.SUPERSEDED,
            WorkflowStatus.EXCEPTION);

    private final String workflowName;
    private final List<String> liveExecutionIds = new ArrayList<>();
    private final String workflowId = UUID.randomUUID().toString();
    private final String otherWorkflowId = UUID.randomUUID().toString();
    private final long expiredAt = System.currentTimeMillis() - NINETY_DAYS_MILLIS;
    private final String busyEntity;
    private final String loneEntity;
    private final String nonAsciiEntity;

    WorkflowRunHistory(String workflowName) {
      this.workflowName = workflowName;
      this.busyEntity = "<#E::glossaryTerm::%s.busy>".formatted(workflowName);
      this.loneEntity = "<#E::glossaryTerm::%s.lone>".formatted(workflowName);
      this.nonAsciiEntity = "<#E::glossaryTerm::%s.Größe_データ>".formatted(workflowName);
    }

    String workflowName() {
      return workflowName;
    }

    String busyEntity() {
      return busyEntity;
    }

    String nonAsciiEntity() {
      return nonAsciiEntity;
    }

    Set<String> seedRunsToKeep(Handle handle) throws SQLException {
      final long now = System.currentTimeMillis();
      return seed(
          handle,
          List.of(
              // Ended long ago, but the entity's only run, and the newest run with no entity.
              new RunSpec(workflowId, loneEntity, WorkflowStatus.FINISHED, expiredAt),
              new RunSpec(workflowId, nonAsciiEntity, WorkflowStatus.FINISHED, expiredAt),
              new RunSpec(workflowId, null, WorkflowStatus.FINISHED, expiredAt + 1_000),
              // Old, but the latest run of another workflow for the busy entity.
              new RunSpec(otherWorkflowId, busyEntity, WorkflowStatus.FINISHED, expiredAt),
              // Old and superseded, but still running: by status, or by a Flowable process that
              // outlived a supersede whose process delete failed, or an EXCEPTION being retried.
              new RunSpec(workflowId, busyEntity, WorkflowStatus.RUNNING, expiredAt + 600_500),
              new RunSpec(
                  workflowId, busyEntity, WorkflowStatus.SUPERSEDED, expiredAt + 650_500, true),
              new RunSpec(
                  workflowId, busyEntity, WorkflowStatus.EXCEPTION, expiredAt + 700_500, true),
              // Superseded, but inside the retention period.
              new RunSpec(
                  workflowId, busyEntity, WorkflowStatus.FINISHED, now - TWENTY_DAYS_MILLIS),
              new RunSpec(workflowId, busyEntity, WorkflowStatus.FINISHED, now - TEN_DAYS_MILLIS)));
    }

    Set<String> seedExpiredRuns(Handle handle) throws SQLException {
      final List<RunSpec> expired = new ArrayList<>();
      for (int i = 0; i < EXPIRED_RUNS_PAST_ONE_PAGE; i++) {
        final WorkflowStatus status = ENDED_STATUSES.get(i % ENDED_STATUSES.size());
        expired.add(new RunSpec(workflowId, busyEntity, status, expiredAt + i * 1_000L));
      }
      expired.add(new RunSpec(workflowId, null, WorkflowStatus.FINISHED, expiredAt));
      // An EXCEPTION run whose process is gone is over, whatever marks it carries.
      expired.add(
          new RunSpec(workflowId, busyEntity, WorkflowStatus.EXCEPTION, expiredAt + 800_500));
      return seed(handle, expired);
    }

    Set<String> remainingRunIds() {
      return TestSuiteBootstrap.getJdbi()
          .withHandle(
              handle ->
                  handle
                      .createQuery(
                          "SELECT id FROM workflow_instance_time_series "
                              + "WHERE workflowDefinitionId IN (:workflowId, :otherWorkflowId)")
                      .bind("workflowId", workflowId)
                      .bind("otherWorkflowId", otherWorkflowId)
                      .mapTo(String.class)
                      .collect(Collectors.toSet()));
    }

    Map<String, Integer> remainingStatesPerRun() {
      return TestSuiteBootstrap.getJdbi()
          .withHandle(
              handle ->
                  handle
                      .createQuery(
                          "SELECT workflowInstanceId, COUNT(*) AS states "
                              + "FROM workflow_instance_state_time_series "
                              + "WHERE workflowDefinitionId IN (:workflowId, :otherWorkflowId) "
                              + "GROUP BY workflowInstanceId")
                      .bind("workflowId", workflowId)
                      .bind("otherWorkflowId", otherWorkflowId)
                      .reduceRows(
                          new HashMap<String, Integer>(),
                          (counts, row) -> {
                            counts.put(
                                row.getColumn("workflowInstanceId", String.class),
                                row.getColumn("states", Integer.class));
                            return counts;
                          }));
    }

    Map<String, Integer> statesPerRun(Set<String> runIds) {
      return runIds.stream().collect(Collectors.toMap(runId -> runId, runId -> STATES_PER_RUN));
    }

    private Set<String> seed(Handle handle, List<RunSpec> runs) throws SQLException {
      final boolean postgres = isPostgres(handle);
      final PreparedBatch runRows =
          handle.prepareBatch(insertSql("workflow_instance_time_series", postgres));
      final PreparedBatch stateRows =
          handle.prepareBatch(insertSql("workflow_instance_state_time_series", postgres));
      // Insertion order, so callers can pick a run they know: the first one seeded.
      final Set<String> runIds = new LinkedHashSet<>();
      for (final RunSpec run : runs) {
        final String runId = UUID.randomUUID().toString();
        runIds.add(runId);
        runRows
            .bind("jsonSchema", "workflowInstance")
            .bind("json", runJson(runId, run))
            .bind("hash", FullyQualifiedName.buildHash(nameOf(run)))
            .add();
        addStateRows(stateRows, runId, run);
        if (run.liveProcess()) {
          addLiveProcess(handle, runId);
        }
      }
      runRows.execute();
      stateRows.execute();
      return runIds;
    }

    /** A Flowable process instance row keyed by the run id, as a live process of the run has. */
    private void addLiveProcess(Handle handle, String runId) {
      final String executionId = UUID.randomUUID().toString();
      handle
          .createUpdate(
              "INSERT INTO ACT_RU_EXECUTION (ID_, REV_, BUSINESS_KEY_) VALUES (:id, 1, :key)")
          .bind("id", executionId)
          .bind("key", runId)
          .execute();
      liveExecutionIds.add(executionId);
    }

    void removeSeededHistory(final Handle handle) {
      if (!nullOrEmpty(liveExecutionIds)) {
        handle
            .createUpdate("DELETE FROM ACT_RU_EXECUTION WHERE ID_ IN (<ids>)")
            .bindList("ids", liveExecutionIds)
            .execute();
      }
      for (final String table :
          List.of("workflow_instance_state_time_series", "workflow_instance_time_series")) {
        handle
            .createUpdate(
                "DELETE FROM %s WHERE workflowDefinitionId IN (:workflowId, :otherWorkflowId)"
                    .formatted(table))
            .bind("workflowId", workflowId)
            .bind("otherWorkflowId", otherWorkflowId)
            .execute();
      }
    }

    private void addStateRows(PreparedBatch stateRows, String runId, RunSpec run) {
      for (int stage = 0; stage < STATES_PER_RUN; stage++) {
        stateRows
            .bind("jsonSchema", "workflowInstanceState")
            .bind("json", stateJson(runId, run, stage))
            .bind("hash", FullyQualifiedName.buildHash(nameOf(run), runId))
            .add();
      }
    }

    private String nameOf(RunSpec run) {
      return workflowId.equals(run.workflowDefinitionId()) ? workflowName : otherWorkflowName();
    }

    String otherWorkflowName() {
      return workflowName + "Other";
    }

    private static String insertSql(String table, boolean postgres) {
      return "INSERT INTO %s (jsonSchema, json, entityFQNHash) VALUES (:jsonSchema, %s, :hash)"
          .formatted(table, postgres ? "CAST(:json AS jsonb)" : ":json");
    }

    private static String runJson(String runId, RunSpec run) {
      final ObjectNode variables = MAPPER.createObjectNode();
      if (run.entityLink() != null) {
        variables.put("global_relatedEntity", run.entityLink());
      }
      final ObjectNode json =
          MAPPER
              .createObjectNode()
              .put("id", runId)
              .put("workflowDefinitionId", run.workflowDefinitionId())
              .put("startedAt", run.timestamp())
              .put("timestamp", run.timestamp())
              .put("status", run.status().value());
      if (run.status() != WorkflowStatus.RUNNING) {
        json.put("endedAt", run.timestamp() + 80);
      }
      return json.set("variables", variables).toString();
    }

    private static String stateJson(String runId, RunSpec run, int stage) {
      final long startedAt = run.timestamp() + stage;
      final ObjectNode stageNode =
          MAPPER
              .createObjectNode()
              .put("name", "stage" + stage)
              .put("startedAt", startedAt)
              .put("endedAt", startedAt + 1);
      return MAPPER
          .createObjectNode()
          .put("id", UUID.randomUUID().toString())
          .put("workflowInstanceId", runId)
          .put("workflowInstanceExecutionId", runId)
          .put("workflowDefinitionId", run.workflowDefinitionId())
          .put("timestamp", startedAt)
          .put("status", WorkflowStatus.FINISHED.value())
          .set("stage", stageNode)
          .toString();
    }
  }

  private static boolean isTerminal(AppRunRecord run) {
    return run.getStatus() != null && TERMINAL_RUN_STATUSES.contains(run.getStatus().value());
  }
}
