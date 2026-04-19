package org.openmetadata.service.apps.bundles.insights.workflow;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.service.apps.bundles.insights.config.InsightsConfig;
import org.openmetadata.service.apps.bundles.insights.search.SearchComponentFactory;
import org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.CostAnalysisWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsBackfillWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.dataQuality.DataQualityWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.WebAnalyticsWorkflow;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

public final class WorkflowRegistry {

  private WorkflowRegistry() {}

  public static List<InsightsWorkflow> createWorkflows(
      InsightsConfig config,
      SearchComponentFactory searchFactory,
      CollectionDAO collectionDAO,
      SearchRepository searchRepository) {

    List<InsightsWorkflow> workflows = new ArrayList<>();

    if (config.shouldRecreateDataAssets()) {
      workflows.add(
          new DataAssetsBackfillWorkflow(config, searchFactory, collectionDAO, searchRepository));
    } else {
      workflows.add(new DataAssetsWorkflow(config, searchFactory, collectionDAO, searchRepository));
    }

    workflows.add(new WebAnalyticsWorkflow(config));
    workflows.add(new CostAnalysisWorkflow(config, collectionDAO));
    workflows.add(new DataQualityWorkflow(config, collectionDAO, searchFactory));

    return workflows;
  }
}
