package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AppRunInterruption;
import org.openmetadata.service.apps.bundles.rdf.distributed.RdfAbandonedRunRecorder;
import org.openmetadata.service.apps.bundles.rdf.distributed.RdfIndexJob;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * A run that ends without reporting its own status must still say why, on MySQL and Postgres. Every
 * record here belongs to an app name no real app uses, so the concurrent tests sharing this
 * database never see them.
 */
@Execution(ExecutionMode.CONCURRENT)
public class AppRunInterruptionIT {
  private static final String STATUS = AppExtension.ExtensionType.STATUS.toString();
  private static final int TABLES = 5_695;

  private final UUID appId = UUID.randomUUID();
  private final String appName = "AppRunInterruptionIT-" + appId;
  private CollectionDAO.AppExtensionTimeSeries runs;

  @BeforeEach
  void connect() {
    runs = Entity.getCollectionDAO().appExtensionTimeSeriesDao();
  }

  @AfterEach
  void deleteRuns() {
    runs.deleteAllByAppId(appId.toString());
  }

  @Test
  void runningRunEndsWithTheReasonWhileOtherRunsAndContextStay() {
    insert(
        run(1_000L, AppRunRecord.Status.RUNNING)
            .withFailureContext(new FailureContext().withAdditionalProperty("partial", "kept")));
    insert(run(2_000L, AppRunRecord.Status.SUCCESS));
    assertTrue(runs.listAppNamesWithRunningStatus().contains(appName));

    final int ended =
        runs.markRunningEntriesInterrupted(
            List.of(appName), AppRunInterruption.failure("the server stopped"), 5_000L);

    assertEquals(1, ended);
    final AppRunRecord interrupted = read(1_000L);
    assertEquals(AppRunRecord.Status.FAILED, interrupted.getStatus());
    assertEquals(5_000L, interrupted.getEndTime());
    assertEquals("the server stopped", failure(interrupted).getMessage());
    assertEquals(IndexingError.ErrorSource.JOB, failure(interrupted).getErrorSource());
    assertTrue(AppRunInterruption.isInterrupted(interrupted));
    assertEquals("kept", interrupted.getFailureContext().getAdditionalProperties().get("partial"));
    assertEquals(AppRunRecord.Status.SUCCESS, read(2_000L).getStatus());
    assertFalse(runs.listAppNamesWithRunningStatus().contains(appName));
  }

  @Test
  void earlierFailureOfARunningRunIsReplacedWhole() {
    insert(
        run(1_000L, AppRunRecord.Status.RUNNING)
            .withFailureContext(
                new FailureContext()
                    .withFailure(
                        new IndexingError().withMessage("partial").withStackTrace("old trace"))));

    runs.markRunningEntriesInterrupted(
        List.of(appName), AppRunInterruption.failure("the server stopped"), 5_000L);

    final IndexingError failure = failure(read(1_000L));
    assertEquals("the server stopped", failure.getMessage());
    assertNull(failure.getStackTrace());
  }

  @Test
  void rdfRunMarkedInterruptedAfterItsJobFinishedGetsTheOutcomeOnce() {
    insert(run(1_000L, AppRunRecord.Status.RUNNING));
    runs.markRunningEntriesInterrupted(
        List.of(appName), AppRunInterruption.stillRunningAtStartup(), 20_000L);
    final RdfIndexJob job = finishedJob(1_000L, 9_000L);
    final RdfAbandonedRunRecorder recorder = new RdfAbandonedRunRecorder(runs, appName);

    recorder.recordIfAbandoned(job);
    recorder.recordIfAbandoned(job);

    final AppRunRecord recorded = read(1_000L);
    assertEquals(AppRunRecord.Status.SUCCESS, recorded.getStatus());
    assertEquals(9_000L, recorded.getEndTime());
    assertEquals(8_000L, recorded.getExecutionTime());
    assertNull(recorded.getFailureContext());
    assertEquals(TABLES, recorded.getSuccessContext().getStats().getJobStats().getSuccessRecords());
  }

  @Test
  void rdfRunItsCoordinatorRecordedIsLeftAlone() {
    insert(run(1_000L, AppRunRecord.Status.SUCCESS).withEndTime(12_000L));

    new RdfAbandonedRunRecorder(runs, appName).recordIfAbandoned(finishedJob(1_000L, 9_000L));

    final AppRunRecord recorded = read(1_000L);
    assertEquals(AppRunRecord.Status.SUCCESS, recorded.getStatus());
    assertEquals(12_000L, recorded.getEndTime());
    assertNull(recorded.getSuccessContext());
  }

  private AppRunRecord run(final long timestamp, final AppRunRecord.Status status) {
    return new AppRunRecord()
        .withAppId(appId)
        .withAppName(appName)
        .withTimestamp(timestamp)
        .withStartTime(timestamp)
        .withStatus(status);
  }

  private void insert(final AppRunRecord run) {
    runs.insert(JsonUtils.pojoToJson(run), STATUS);
  }

  private AppRunRecord read(final long timestamp) {
    final List<String> found =
        runs.listAppExtensionInWindowByName(appName, 1, 0, timestamp, timestamp + 1, STATUS);
    assertEquals(1, found.size(), "run at " + timestamp);
    return JsonUtils.readValue(found.getFirst(), AppRunRecord.class);
  }

  private static IndexingError failure(final AppRunRecord run) {
    return run.getFailureContext().getFailure();
  }

  private static RdfIndexJob finishedJob(final long runTimestamp, final long completedAt) {
    return RdfIndexJob.builder()
        .id(UUID.randomUUID())
        .status(IndexJobStatus.COMPLETED)
        .jobConfiguration(new EventPublisherJob().withTimestamp(runTimestamp))
        .totalRecords(TABLES)
        .processedRecords(TABLES)
        .successRecords(TABLES)
        .entityStats(
            Map.of(
                "table",
                RdfIndexJob.EntityTypeStats.builder()
                    .entityType("table")
                    .totalRecords(TABLES)
                    .processedRecords(TABLES)
                    .successRecords(TABLES)
                    .build()))
        .completedAt(completedAt)
        .build();
  }
}
