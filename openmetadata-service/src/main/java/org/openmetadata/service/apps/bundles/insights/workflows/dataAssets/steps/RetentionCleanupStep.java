package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.steps;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.insights.search.DailyIndex;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.stats.StepResult;
import org.openmetadata.service.apps.bundles.insights.stats.WorkflowStatsCollector;

@Slf4j
public final class RetentionCleanupStep {

  private final DataInsightsSearchInterface searchInterface;
  private final int retentionDays;

  public RetentionCleanupStep(DataInsightsSearchInterface searchInterface, int retentionDays) {
    this.searchInterface = searchInterface;
    this.retentionDays = retentionDays;
  }

  public void execute(DailyIndex today, WorkflowStatsCollector stats) throws IOException {
    LocalDate cutoff = today.date().minusDays(retentionDays);
    List<DailyIndex> indices =
        searchInterface.listDailyIndices(today.clusterAlias(), today.entityType());
    int deleted = 0;
    for (DailyIndex index : indices) {
      if (index.isExpiredBy(cutoff)) {
        searchInterface.deleteDailyIndex(index);
        deleted++;
        LOG.debug("[RetentionCleanup] Deleted expired index: {}", index.name());
      }
    }
    stats.record(new StepResult("retention-cleanup-" + today.entityType(), deleted, 0, List.of()));
  }
}
