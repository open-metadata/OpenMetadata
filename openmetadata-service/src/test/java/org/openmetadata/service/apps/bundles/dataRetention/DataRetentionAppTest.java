package org.openmetadata.service.apps.bundles.dataRetention;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.WorkflowRepository;
import org.openmetadata.service.search.SearchRepository;

@ExtendWith(MockitoExtension.class)
class DataRetentionAppTest {
  private static final int BATCH_SIZE = 10_000;
  private static final int DEFAULT_REVERSE_INGESTION_WORKFLOW_RETENTION_DAYS = 30;

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchRepository searchRepository;
  @Mock private CollectionDAO.WorkflowDAO workflowDAO;
  @Mock private WorkflowRepository workflowRepository;

  private DataRetention dataRetention;

  @BeforeEach
  void setUp() {
    when(collectionDAO.workflowDAO()).thenReturn(workflowDAO);
    when(collectionDAO.feedDAO()).thenReturn(null);
    dataRetention = new DataRetention(collectionDAO, searchRepository, workflowRepository);
  }

  @Test
  void reverseIngestionRetentionDaysDefaultsWhenMissing() throws Exception {
    Method resolveMethod =
        DataRetention.class.getDeclaredMethod(
            "resolveReverseIngestionWorkflowRetentionDays", Integer.class);
    resolveMethod.setAccessible(true);

    int resultWhenMissing = (int) resolveMethod.invoke(dataRetention, (Integer) null);
    assertEquals(DEFAULT_REVERSE_INGESTION_WORKFLOW_RETENTION_DAYS, resultWhenMissing);

    int resultWhenConfigured = (int) resolveMethod.invoke(dataRetention, 7);
    assertEquals(7, resultWhenConfigured);
  }

  @Test
  void cutoffMillisUsesFixedNowSupplier() throws Exception {
    Method cutoffMethod =
        DataRetention.class.getDeclaredMethod("getRetentionCutoffMillis", int.class);
    cutoffMethod.setAccessible(true);

    int retentionDays = 30;
    long nowBefore = System.currentTimeMillis();
    long expectedLowerBound = nowBefore - ((long) retentionDays * 24 * 60 * 60 * 1000) - 5000;

    long actualCutoffMillis = (long) cutoffMethod.invoke(dataRetention, retentionDays);
    long nowAfter = System.currentTimeMillis();
    long expectedUpperBound = nowAfter - ((long) retentionDays * 24 * 60 * 60 * 1000) + 5000;

    org.junit.jupiter.api.Assertions.assertTrue(actualCutoffMillis >= expectedLowerBound);
    org.junit.jupiter.api.Assertions.assertTrue(actualCutoffMillis <= expectedUpperBound);
  }

  @Test
  void reverseWorkflowDeletionUsesTerminalStatusCandidateQuery() throws Exception {
    invokeInitializeStatsDefaults();

    int retentionDays = 10;
    UUID workflowId = UUID.randomUUID();

    when(workflowDAO.listTerminalReverseIngestionWorkflowIdsBeforeCutoff(anyLong(), eq(BATCH_SIZE)))
        .thenReturn(List.of(workflowId))
        .thenReturn(List.of());

    invokeCleanReverseIngestionWorkflows(retentionDays);

    verify(workflowDAO)
        .listTerminalReverseIngestionWorkflowIdsBeforeCutoff(anyLong(), eq(BATCH_SIZE));
    verify(workflowRepository).delete(eq("admin"), eq(workflowId), eq(true), eq(true));
  }

  @Test
  void reverseWorkflowDeletionBatchesAcrossMultiplePages() throws Exception {
    invokeInitializeStatsDefaults();

    int retentionDays = 5;

    List<UUID> firstBatch = new ArrayList<>(BATCH_SIZE);
    for (int i = 0; i < BATCH_SIZE; i++) {
      firstBatch.add(UUID.randomUUID());
    }
    List<UUID> secondBatch = List.of(UUID.randomUUID(), UUID.randomUUID());

    when(workflowDAO.listTerminalReverseIngestionWorkflowIdsBeforeCutoff(anyLong(), eq(BATCH_SIZE)))
        .thenReturn(firstBatch)
        .thenReturn(secondBatch)
        .thenReturn(List.of());

    invokeCleanReverseIngestionWorkflows(retentionDays);

    verify(workflowDAO, times(2))
        .listTerminalReverseIngestionWorkflowIdsBeforeCutoff(anyLong(), eq(BATCH_SIZE));
    int expectedDeleted = BATCH_SIZE + secondBatch.size();
    verify(workflowRepository, times(expectedDeleted))
        .delete(eq("admin"), any(UUID.class), eq(true), eq(true));

    StepStats stepStats = getReverseIngestionStepStats();
    assertNotNull(stepStats);
    assertEquals(expectedDeleted, stepStats.getSuccessRecords());
    assertEquals(0, stepStats.getFailedRecords());
  }

  private void invokeInitializeStatsDefaults() throws Exception {
    Method initMethod = DataRetention.class.getDeclaredMethod("initializeStatsDefaults");
    initMethod.setAccessible(true);
    initMethod.invoke(dataRetention);
  }

  private void invokeCleanReverseIngestionWorkflows(int retentionDays) throws Exception {
    Method cleanMethod =
        DataRetention.class.getDeclaredMethod("cleanReverseIngestionWorkflows", int.class);
    cleanMethod.setAccessible(true);
    cleanMethod.invoke(dataRetention, retentionDays);
  }

  private StepStats getReverseIngestionStepStats() throws Exception {
    Field retentionStatsField = DataRetention.class.getDeclaredField("retentionStats");
    retentionStatsField.setAccessible(true);
    Stats stats = (Stats) retentionStatsField.get(dataRetention);

    EntityStats entityStats = stats.getEntityStats();
    assertNotNull(entityStats);

    Object stepStatsObj = entityStats.getAdditionalProperties().get("reverse_ingestion_workflows");
    assertNotNull(stepStatsObj);
    return (StepStats) stepStatsObj;
  }
}
