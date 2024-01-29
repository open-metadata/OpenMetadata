package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.schema.system.IndexingError.ErrorSource.SINK;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getErrorsFromBulkResponse;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getSuccessFromBulkResponseEs;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import es.org.elasticsearch.action.bulk.BulkRequest;
import es.org.elasticsearch.action.bulk.BulkResponse;
import es.org.elasticsearch.client.RequestOptions;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;
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
  public BulkResponse write(BulkRequest data, Map<String, Object> contextData)
      throws SearchIndexException {
    LOG.debug("[EsSearchIndexSink] Processing a Batch of Size: {}", data.numberOfActions());
    try {
      BulkResponse response = searchRepository.getSearchClient().bulk(data, RequestOptions.DEFAULT);
      int currentSuccess = getSuccessFromBulkResponseEs(response);
      int currentFailed = response.getItems().length - currentSuccess;

      if (currentFailed != 0) {
        throw new SearchIndexException(
            new IndexingError()
                .withErrorSource(SINK)
                .withSubmittedCount(data.numberOfActions())
                .withSuccessCount(currentSuccess)
                .withFailedCount(currentFailed)
                .withMessage("Issues in Sink To Elastic Search.")
                .withFailedEntities(getErrorsFromBulkResponse(response)));
      }

      // Update Stats
      LOG.debug(
          "[EsSearchIndexSink] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          data.numberOfActions(),
          currentSuccess,
          currentFailed);
      updateStats(currentSuccess, currentFailed);

      return response;
    } catch (SearchIndexException ex) {
      updateStats(ex.getIndexingError().getSuccessCount(), ex.getIndexingError().getFailedCount());
      throw ex;
    } catch (Exception e) {
      IndexingError indexingError =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.SINK)
              .withSubmittedCount(data.numberOfActions())
              .withSuccessCount(0)
              .withFailedCount(data.numberOfActions())
              .withMessage("Issue in Sink to Elastic Search.")
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug("[ESSearchIndexSink] Failed, Details : {}", JsonUtils.pojoToJson(indexingError));
      updateStats(0, data.numberOfActions());
      throw new SearchIndexException(indexingError);
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
