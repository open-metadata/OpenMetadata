package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getSuccessFromBulkResponseEs;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import es.org.elasticsearch.action.bulk.BulkRequest;
import es.org.elasticsearch.action.bulk.BulkResponse;
import es.org.elasticsearch.client.RequestOptions;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.exception.SinkException;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.workflows.interfaces.Sink;

@Slf4j
public class ElasticSearchIndexSink implements Sink<BulkRequest, BulkResponse> {
  private final StepStats stats = new StepStats();
  private final SearchRepository searchRepository;

  public ElasticSearchIndexSink(SearchRepository searchRepository, int total) {
    this.searchRepository = searchRepository;
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public BulkResponse write(BulkRequest data, Map<String, Object> contextData) throws SinkException {
    LOG.debug("[EsSearchIndexSink] Processing a Batch of Size: {}", data.numberOfActions());
    try {
      BulkResponse response = searchRepository.getSearchClient().bulk(data, RequestOptions.DEFAULT);
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
