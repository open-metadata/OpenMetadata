package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.steps;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.io.IOException;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.service.apps.bundles.insights.search.DailyIndex;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.stats.WorkflowStatsCollector;

@ExtendWith(MockitoExtension.class)
class RollForwardStepTest {

  @Mock DataInsightsSearchInterface searchInterface;

  private WorkflowStatsCollector stats;

  @BeforeEach
  void setUp() {
    stats = new WorkflowStatsCollector("test");
  }

  @Test
  void rollForwardCalledWithCorrectIndicesWhenYesterdayExists() throws IOException {
    LocalDate today = LocalDate.of(2026, 4, 17);
    DailyIndex todayIndex = new DailyIndex("", "table", today);
    DailyIndex yesterdayIndex = todayIndex.previous();

    when(searchInterface.dailyIndexExists(yesterdayIndex)).thenReturn(true);

    new RollForwardStep(searchInterface).execute(todayIndex, stats);

    verify(searchInterface).rollForward(yesterdayIndex, todayIndex);
    assertEquals(1, stats.buildResult().stepStats().get("roll-forward-table").getSuccessRecords());
  }

  @Test
  void skipsRollForwardWhenYesterdayIndexMissing() throws IOException {
    DailyIndex today = new DailyIndex("", "table", LocalDate.now());
    when(searchInterface.dailyIndexExists(today.previous())).thenReturn(false);

    new RollForwardStep(searchInterface).execute(today, stats);

    verify(searchInterface, never()).rollForward(any(), any());
    assertEquals(0, stats.buildResult().stepStats().get("roll-forward-table").getSuccessRecords());
  }

  @Test
  void ioExceptionFromRollForwardPropagates() throws IOException {
    DailyIndex today = new DailyIndex("", "table", LocalDate.now());
    when(searchInterface.dailyIndexExists(today.previous())).thenReturn(true);
    doThrow(new IOException("ES unreachable")).when(searchInterface).rollForward(any(), any());

    assertThrows(IOException.class, () -> new RollForwardStep(searchInterface).execute(today, stats));
  }
}
