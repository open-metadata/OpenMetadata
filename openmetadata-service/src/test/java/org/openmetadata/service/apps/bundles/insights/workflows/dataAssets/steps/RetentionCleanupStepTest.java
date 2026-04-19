package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.steps;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.service.apps.bundles.insights.search.DailyIndex;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.stats.WorkflowStatsCollector;

@ExtendWith(MockitoExtension.class)
class RetentionCleanupStepTest {

  @Mock DataInsightsSearchInterface searchInterface;

  private WorkflowStatsCollector stats;
  private static final int RETENTION_DAYS = 30;

  @BeforeEach
  void setUp() {
    stats = new WorkflowStatsCollector("test");
  }

  @Test
  void expiredIndicesAreDeleted() throws IOException {
    LocalDate today = LocalDate.of(2026, 4, 17);
    DailyIndex todayIndex = new DailyIndex("", "table", today);
    LocalDate cutoff = today.minusDays(RETENTION_DAYS);

    DailyIndex expired = new DailyIndex("", "table", cutoff.minusDays(1));
    DailyIndex fresh = new DailyIndex("", "table", cutoff);

    when(searchInterface.listDailyIndices("", "table")).thenReturn(List.of(expired, fresh));

    new RetentionCleanupStep(searchInterface, RETENTION_DAYS).execute(todayIndex, stats);

    verify(searchInterface).deleteDailyIndex(expired);
    verify(searchInterface, never()).deleteDailyIndex(fresh);
    assertEquals(1, stats.buildResult().stepStats().get("retention-cleanup-table").getSuccessRecords());
  }

  @Test
  void emptyIndexListProducesNoDeletes() throws IOException {
    DailyIndex today = new DailyIndex("", "table", LocalDate.now());
    when(searchInterface.listDailyIndices("", "table")).thenReturn(List.of());

    new RetentionCleanupStep(searchInterface, RETENTION_DAYS).execute(today, stats);

    verify(searchInterface, never()).deleteDailyIndex(any());
    assertEquals(0, stats.buildResult().stepStats().get("retention-cleanup-table").getSuccessRecords());
  }
}
