package org.openmetadata.service.search.opensearch;

import static org.openmetadata.schema.system.IndexingError.ErrorSource.SINK;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_NAME_LIST_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
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
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;

@Slf4j
public class OpenSearchIndexSink
    implements Sink<List<BulkOperation>, os.org.opensearch.client.opensearch.core.BulkResponse> {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final JacksonJsonpMapper JACKSON_JSONP_MAPPER =
      new JacksonJsonpMapper(OBJECT_MAPPER);

  private final StepStats stats = new StepStats();
  private final SearchRepository searchRepository;

  private final long maxPayLoadSizeInBytes;

  public OpenSearchIndexSink(SearchRepository repository, int total, long maxPayLoadSizeInBytes) {
    this.searchRepository = repository;
    this.maxPayLoadSizeInBytes = maxPayLoadSizeInBytes;
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public os.org.opensearch.client.opensearch.core.BulkResponse write(
      List<BulkOperation> data, Map<String, Object> contextData) throws SearchIndexException {
    LOG.debug("[OsSearchIndexSink] Processing a Batch of Size: {}", data.size());
    try {
      List<?> entityNames =
          (List<?>)
              Optional.ofNullable(contextData.get(ENTITY_NAME_LIST_KEY))
                  .orElse(Collections.emptyList());
      List<EntityError> entityErrorList = new ArrayList<>();
      os.org.opensearch.client.opensearch.core.BulkResponse response = null;

      List<BulkOperation> bufferData = new ArrayList<>();
      long bufferSize = 0;
      int requestIndex = 0;

      for (BulkOperation operation : data) {
        long operationSize = estimateBulkOperationSize(operation);

        if (operationSize > maxPayLoadSizeInBytes) {
          entityErrorList.add(
              new EntityError()
                  .withMessage("Entity size exceeds opensearch maximum payload size")
                  .withEntity(
                      requestIndex < entityNames.size()
                          ? entityNames.get(requestIndex)
                          : String.format("Unknown entity at index %d", requestIndex)));
          requestIndex++;
          continue;
        }

        if (bufferSize + operationSize > maxPayLoadSizeInBytes && !bufferData.isEmpty()) {
          response = searchRepository.getSearchClient().bulkOpenSearch(bufferData);
          entityErrorList.addAll(
              extractErrorsFromResponse(response, entityNames, requestIndex - bufferData.size()));
          bufferData = new ArrayList<>();
          bufferSize = 0;
        }

        bufferData.add(operation);
        bufferSize += operationSize;
        requestIndex++;
      }

      if (!bufferData.isEmpty()) {
        response = searchRepository.getSearchClient().bulkOpenSearch(bufferData);
        entityErrorList.addAll(
            extractErrorsFromResponse(response, entityNames, requestIndex - bufferData.size()));
      }

      LOG.debug(
          "[OsSearchIndexSink] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          data.size(),
          data.size() - entityErrorList.size(),
          entityErrorList.size());
      updateStats(data.size() - entityErrorList.size(), entityErrorList.size());

      if (!entityErrorList.isEmpty()) {
        throw new SearchIndexException(
            new IndexingError()
                .withErrorSource(SINK)
                .withSubmittedCount(data.size())
                .withSuccessCount(data.size() - entityErrorList.size())
                .withFailedCount(entityErrorList.size())
                .withMessage(String.format("Issues in Sink To OpenSearch: %s", entityErrorList))
                .withFailedEntities(entityErrorList));
      }

      return response;
    } catch (SearchIndexException ex) {
      updateStats(ex.getIndexingError().getSuccessCount(), ex.getIndexingError().getFailedCount());
      throw ex;
    } catch (Exception e) {
      IndexingError indexingError =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.SINK)
              .withSubmittedCount(data.size())
              .withSuccessCount(0)
              .withFailedCount(data.size())
              .withMessage(String.format("Issue in Sink to OpenSearch: %s", e.getMessage()))
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug("[OSSearchIndexSink] Failed, Details : {}", JsonUtils.pojoToJson(indexingError));
      updateStats(0, data.size());
      throw new SearchIndexException(indexingError);
    }
  }

  private long estimateBulkOperationSize(BulkOperation operation) {
    try {
      StringWriter writer = new StringWriter();
      JsonGenerator generator = JACKSON_JSONP_MAPPER.jsonProvider().createGenerator(writer);
      operation.serialize(generator, JACKSON_JSONP_MAPPER);
      generator.close();
      return writer.toString().getBytes(StandardCharsets.UTF_8).length;
    } catch (Exception e) {
      LOG.warn("Failed to estimate bulk operation size, using default: {}", e.getMessage());
      return 1024;
    }
  }

  private List<EntityError> extractErrorsFromResponse(
      os.org.opensearch.client.opensearch.core.BulkResponse response,
      List<?> entityNames,
      int startIndex) {
    List<EntityError> errors = new ArrayList<>();
    if (response != null && response.errors()) {
      for (int i = 0; i < response.items().size(); i++) {
        os.org.opensearch.client.opensearch.core.bulk.BulkResponseItem item =
            response.items().get(i);
        if (item.error() != null) {
          int entityIndex = startIndex + i;
          errors.add(
              new EntityError()
                  .withMessage(item.error().reason())
                  .withEntity(
                      entityIndex < entityNames.size()
                          ? entityNames.get(entityIndex)
                          : String.format("Unknown entity at index %d", entityIndex)));
        }
      }
    }
    return errors;
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
