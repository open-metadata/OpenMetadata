package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.steps;

import java.io.IOException;
import java.util.List;
import org.openmetadata.service.apps.bundles.insights.search.DailyIndex;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.stats.StepResult;
import org.openmetadata.service.apps.bundles.insights.stats.WorkflowStatsCollector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public record RollForwardStep(DataInsightsSearchInterface searchInterface) {

  private static final Logger LOG = LoggerFactory.getLogger(RollForwardStep.class);

  public void execute(DailyIndex today, WorkflowStatsCollector stats) throws IOException {
    DailyIndex yesterday = today.previous();

    if (!searchInterface.dailyIndexExists(yesterday)) {
      LOG.warn(
          "[RollForward] No previous index found for {}. Skipping roll-forward — this day will be"
              + " delta-only with no continuity from prior data.",
          today.entityType());
      stats.record(new StepResult("roll-forward-" + today.entityType(), 0, 0, List.of()));
      return;
    }

    searchInterface.rollForward(yesterday, today);
    LOG.info("[RollForward] {} → {}", yesterday.name(), today.name());
    stats.record(new StepResult("roll-forward-" + today.entityType(), 1, 0, List.of()));
  }
}
