package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors;

import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow.DATA_STREAM_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.workflows.interfaces.Processor;

@Slf4j
public abstract class AbstractDataInsightsBulkProcessor<T>
    implements Processor<List<T>, List<Map<String, Object>>> {

  private final StepStats stats = new StepStats();

  protected AbstractDataInsightsBulkProcessor(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  protected abstract T buildIndexOperation(String index, String entityId, String docJson);

  @Override
  public List<T> process(List<Map<String, Object>> input, Map<String, Object> contextData)
      throws SearchIndexException {
    String index = (String) contextData.get(DATA_STREAM_KEY);
    LOG.debug(
        "[DataInsightsProcessor] Processing batch of size: {}, index: {}", input.size(), index);
    try {
      List<T> operations = new ArrayList<>(input.size());
      for (Map<String, Object> entity : input) {
        String entityId = (String) entity.get("id");
        String doc = JsonUtils.pojoToJson(entity);
        operations.add(buildIndexOperation(index, entityId, doc));
      }
      updateStats(input.size(), 0);
      return operations;
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(input.size())
              .withFailedCount(input.size())
              .withSuccessCount(0)
              .withMessage("Data Insights Processor failed converting entities to BulkOperations.")
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug("[DataInsightsProcessor] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, input.size());
      throw new SearchIndexException(error);
    }
  }

  @Override
  public synchronized void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }

  @Override
  public StepStats getStats() {
    return stats;
  }
}
