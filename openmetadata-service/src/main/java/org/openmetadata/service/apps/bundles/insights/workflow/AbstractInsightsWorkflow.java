package org.openmetadata.service.apps.bundles.insights.workflow;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.insights.stats.WorkflowResult;
import org.openmetadata.service.apps.bundles.insights.stats.WorkflowStatsCollector;
import org.openmetadata.service.exception.SearchIndexException;

@Slf4j
public abstract class AbstractInsightsWorkflow implements InsightsWorkflow {

  private final String workflowName;
  private final WorkflowStatsCollector stats;
  protected volatile boolean stopped = false;

  protected AbstractInsightsWorkflow(String workflowName) {
    this.workflowName = workflowName;
    this.stats = new WorkflowStatsCollector(workflowName);
  }

  @Override
  public final WorkflowResult execute() {
    if (!isEnabled()) {
      LOG.info("[{}] Skipped — workflow is disabled.", workflowName);
      return stats.buildResult();
    }
    try {
      initialize();
      run();
    } catch (SearchIndexException ex) {
      stats.recordIndexingError(ex.getIndexingError());
    } catch (Exception ex) {
      stats.recordWorkflowError(ex);
    } finally {
      cleanup();
    }
    return stats.buildResult();
  }

  protected abstract boolean isEnabled();

  protected abstract void initialize() throws Exception;

  protected abstract void run() throws Exception;

  protected void cleanup() {}

  protected WorkflowStatsCollector stats() {
    return stats;
  }

  @Override
  public String name() {
    return workflowName;
  }

  @Override
  public void stop() {
    stopped = true;
  }
}
