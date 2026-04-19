package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.steps;

import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.insights.search.DailyIndex;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.stats.StepResult;
import org.openmetadata.service.apps.bundles.insights.stats.WorkflowStatsCollector;

@Slf4j
public final class RollForwardStep {

  private final DataInsightsSearchInterface searchInterface;

  public RollForwardStep(DataInsightsSearchInterface searchInterface) {
    this.searchInterface = searchInterface;
  }

  public void execute(DailyIndex today, WorkflowStatsCollector stats) throws IOException {
    DailyIndex yesterday = today.previous();

    if (!searchInterface.dailyIndexExists(yesterday)) {
      LOG.info(
          "[RollForward] No previous index for {}. Skipping roll-forward.", today.entityType());
      stats.record(new StepResult("roll-forward-" + today.entityType(), 0, 0, List.of()));
      return;
    }

    searchInterface.rollForward(yesterday, today);
    LOG.info("[RollForward] {} → {}", yesterday.name(), today.name());
    stats.record(new StepResult("roll-forward-" + today.entityType(), 1, 0, List.of()));
  }
}
