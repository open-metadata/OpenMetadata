package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.schema.system.IndexingError.ErrorSource.SINK;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_NAME_LIST_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getErrorsFromBulkResponse;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import es.org.elasticsearch.action.DocWriteRequest;
import es.org.elasticsearch.action.bulk.BulkRequest;
import es.org.elasticsearch.action.bulk.BulkResponse;
import es.org.elasticsearch.client.RequestOptions;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.workflows.interfaces.Sink;

@Slf4j
public class ElasticSearchIndexSink implements Sink<BulkRequest, BulkResponse> {
  private final StepStats stats = new StepStats();
  private final SearchRepository searchRepository;
  private final long maxPayLoadSizeInBytes;

  public ElasticSearchIndexSink(
      SearchRepository searchRepository, int total, long maxPayLoadSizeInBytes) {
    this.searchRepository = searchRepository;
    this.maxPayLoadSizeInBytes = maxPayLoadSizeInBytes;
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public BulkResponse write(BulkRequest data, Map<String, Object> contextData)
      throws SearchIndexException {
    LOG.debug("[EsSearchIndexSink] Processing a Batch of Size: {}", data.numberOfActions());
    try {
      List<?> entityNames =
          (List<?>)
              Optional.ofNullable(contextData.get(ENTITY_NAME_LIST_KEY))
                  .orElse(Collections.emptyList());
      List<EntityError> entityErrorList = new ArrayList<>();
      BulkResponse response = null;

      BulkRequest bufferData = new BulkRequest();
      long requestIndex = 0; // Index to track the corresponding entity name

      for (DocWriteRequest<?> request : data.requests()) {
        long requestSize = new BulkRequest().add(request).estimatedSizeInBytes();

        if (requestSize > maxPayLoadSizeInBytes) {
          entityErrorList.add(
              new EntityError()
                  .withMessage("Entity size exceeds elastic search maximum payload size")
                  .withEntity(entityNames.get(Math.toIntExact(requestIndex))));
          requestIndex++;
          continue;
        }

        if (bufferData.estimatedSizeInBytes() + requestSize > maxPayLoadSizeInBytes) {
          response = searchRepository.getSearchClient().bulk(bufferData, RequestOptions.DEFAULT);
          entityErrorList.addAll(getErrorsFromBulkResponse(response));
          bufferData = new BulkRequest();
        }

        bufferData.add(request);
        requestIndex++;
      }

      // Send the last buffer if it has any requests
      if (!bufferData.requests().isEmpty()) {
        response = searchRepository.getSearchClient().bulk(bufferData, RequestOptions.DEFAULT);
        entityErrorList.addAll(getErrorsFromBulkResponse(response));
      }

      LOG.debug(
          "[EsSearchIndexSink] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          data.numberOfActions(),
          data.numberOfActions() - entityErrorList.size(),
          entityErrorList.size());
      updateStats(data.numberOfActions() - entityErrorList.size(), entityErrorList.size());

      // Handle errors
      if (!entityErrorList.isEmpty()) {
        throw new SearchIndexException(
            new IndexingError()
                .withErrorSource(SINK)
                .withSubmittedCount(data.numberOfActions())
                .withSuccessCount(data.numberOfActions() - entityErrorList.size())
                .withFailedCount(entityErrorList.size())
                .withMessage(String.format("Issues in Sink To Elastic Search: %s", entityErrorList))
                .withFailedEntities(entityErrorList));
      }

      return response; // Return the last response
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
              .withMessage(String.format("Issue in Sink to Elastic Search: %s", e.getMessage()))
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
