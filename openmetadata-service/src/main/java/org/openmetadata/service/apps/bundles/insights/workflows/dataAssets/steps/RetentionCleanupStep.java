package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.steps;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import org.openmetadata.service.apps.bundles.insights.search.DailyIndex;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.stats.StepResult;
import org.openmetadata.service.apps.bundles.insights.stats.WorkflowStatsCollector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public record RetentionCleanupStep(
    DataInsightsSearchInterface searchInterface, int retentionDays) {

  private static final Logger LOG = LoggerFactory.getLogger(RetentionCleanupStep.class);

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
