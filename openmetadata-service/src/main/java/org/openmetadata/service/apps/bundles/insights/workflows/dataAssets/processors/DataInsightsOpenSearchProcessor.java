package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors;

import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow.DATA_STREAM_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.workflows.interfaces.Processor;
import os.org.opensearch.action.bulk.BulkRequest;
import os.org.opensearch.action.index.IndexRequest;
import os.org.opensearch.common.xcontent.XContentType;

@Slf4j
public class DataInsightsOpenSearchProcessor
    implements Processor<BulkRequest, List<Map<String, Object>>> {

  private final StepStats stats = new StepStats();

  public DataInsightsOpenSearchProcessor(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public BulkRequest process(List<Map<String, Object>> input, Map<String, Object> contextData)
      throws SearchIndexException {
    String index = (String) contextData.get(DATA_STREAM_KEY);
    LOG.debug(
        "[OsEntitiesProcessor] Processing a Batch of Size: {}, Index: {} ", input.size(), index);
    BulkRequest requests;
    try {
      requests = buildBulkRequests(index, input);
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
                  "Data Insights OpenSearch Processor Encountered Failure. Converting requests to ES Request.")
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(
          "[DataInsightsOpenSearchProcessor] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, input.size());
      throw new SearchIndexException(error);
    }
    return requests;
  }

  private static BulkRequest buildBulkRequests(String index, List<Map<String, Object>> input) {
    BulkRequest bulkRequests = new BulkRequest();
    for (Map<String, Object> entity : input) {
      IndexRequest request = getIndexRequest(index, entity);
      bulkRequests.add(request);
    }
    return bulkRequests;
  }

  private static IndexRequest getIndexRequest(String index, Map<String, Object> entity) {
    IndexRequest indexRequest = new IndexRequest(index);
    indexRequest.source(JsonUtils.pojoToJson(entity), XContentType.JSON);
    indexRequest.opType("create");
    return indexRequest;
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
