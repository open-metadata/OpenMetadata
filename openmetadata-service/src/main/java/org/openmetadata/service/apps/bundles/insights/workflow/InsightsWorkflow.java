package org.openmetadata.service.apps.bundles.insights.workflow;

import org.openmetadata.service.apps.bundles.insights.stats.WorkflowResult;

public interface InsightsWorkflow {
  String name();

  WorkflowResult execute();

  void stop();
}
