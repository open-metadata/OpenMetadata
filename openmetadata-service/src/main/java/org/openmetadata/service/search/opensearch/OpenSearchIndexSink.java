package org.openmetadata.service.search.opensearch;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getSuccessFromBulkResponse;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.exception.SinkException;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.workflows.interfaces.Sink;
import os.org.opensearch.action.bulk.BulkRequest;
import os.org.opensearch.action.bulk.BulkResponse;
import os.org.opensearch.client.RequestOptions;

@Slf4j
public class OpenSearchIndexSink implements Sink<BulkRequest, BulkResponse> {
  private final StepStats stats = new StepStats();
  private final SearchRepository searchRepository;

  public OpenSearchIndexSink(SearchRepository repository, int total) {
    this.searchRepository = repository;
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public BulkResponse write(BulkRequest data, Map<String, Object> contextData) throws SinkException {
    LOG.debug("[EsSearchIndexSink] Processing a Batch of Size: {}", data.numberOfActions());
    try {
      BulkResponse response = searchRepository.getSearchClient().bulk(data, RequestOptions.DEFAULT);
      int currentSuccess = getSuccessFromBulkResponse(response);
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
