package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getSuccessFromBulkResponseEs;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.client.RequestOptions;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.exception.SinkException;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.workflows.interfaces.Sink;

@Slf4j
public class ElasticSearchIndexSink implements Sink<BulkRequest, BulkResponse> {
  private final StepStats stats = new StepStats();
  private final SearchClient client;

  public ElasticSearchIndexSink(SearchClient client) {
    this.client = client;
  }

  @Override
  public BulkResponse write(BulkRequest data, Map<String, Object> contextData) throws SinkException {
    LOG.debug("[EsSearchIndexSink] Processing a Batch of Size: {}", data.numberOfActions());
    try {
      BulkResponse response = client.bulk(data, RequestOptions.DEFAULT);
      int currentSuccess = getSuccessFromBulkResponseEs(response);
      int currentFailed = response.getItems().length - currentSuccess;

      // Update Stats
      LOG.debug(
          "[EsSearchIndexSink] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          data.numberOfActions(),
          currentSuccess,
          currentFailed);
      updateStats(currentSuccess, currentFailed);

      return response;
    } catch (Exception e) {
      LOG.debug(
          "[EsSearchIndexSink] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          data.numberOfActions(),
          0,
          data.numberOfActions());
      updateStats(0, data.numberOfActions());
      throw new SinkException("[EsSearchIndexSink] Batch encountered Exception. Failing Completely", e);
    }
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
