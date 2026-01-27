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
import org.openmetadata.service.search.opensearch.OsUtils;
import org.openmetadata.service.workflows.interfaces.Processor;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;

@Slf4j
public class DataInsightsOpenSearchProcessor
    implements Processor<List<BulkOperation>, List<Map<String, Object>>> {

  private final StepStats stats = new StepStats();

  public DataInsightsOpenSearchProcessor(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public List<BulkOperation> process(
      List<Map<String, Object>> input, Map<String, Object> contextData)
      throws SearchIndexException {
    String index = (String) contextData.get(DATA_STREAM_KEY);
    LOG.debug(
        "[OsEntitiesProcessor] Processing a Batch of Size: {}, Index: {} ", input.size(), index);
    List<BulkOperation> operations;
    try {
      operations = buildBulkOperations(index, input);
      LOG.debug(
          "[OsEntitiesProcessor] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          input.size(),
          input.size(),
          0);
      updateStats(input.size(), 0);
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(input.size())
              .withFailedCount(input.size())
              .withSuccessCount(0)
              .withMessage(
                  "Data Insights OpenSearch Processor Encountered Failure. Converting requests to BulkOperation.")
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(
          "[DataInsightsOpenSearchProcessor] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, input.size());
      throw new SearchIndexException(error);
    }
    return operations;
  }

  private static List<BulkOperation> buildBulkOperations(
      String index, List<Map<String, Object>> input) {
    List<BulkOperation> operations = new ArrayList<>();
    for (Map<String, Object> entity : input) {
      BulkOperation operation = getCreateOperation(index, entity);
      operations.add(operation);
    }
    return operations;
  }

  private static BulkOperation getCreateOperation(String index, Map<String, Object> entity) {
    String doc = JsonUtils.pojoToJson(entity);
    return BulkOperation.of(b -> b.create(c -> c.index(index).document(OsUtils.toJsonData(doc))));
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }

  @Override
  public StepStats getStats() {
    return stats;
  }
}
