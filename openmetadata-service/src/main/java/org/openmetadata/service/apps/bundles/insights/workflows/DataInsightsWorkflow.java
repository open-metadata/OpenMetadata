package org.openmetadata.service.apps.bundles.insights.workflows;

import org.openmetadata.service.exception.SearchIndexException;

public interface DataInsightsWorkflow {
  WorkflowStats getWorkflowStats();

  void process() throws SearchIndexException;

  void stop();
}
