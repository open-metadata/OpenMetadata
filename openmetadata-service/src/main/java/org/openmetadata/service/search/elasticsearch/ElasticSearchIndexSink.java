package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.schema.system.IndexingError.ErrorSource.SINK;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.elasticsearch._types.ErrorCause;
import es.co.elastic.clients.elasticsearch.core.BulkResponse;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkResponseItem;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.IOException;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.interfaces.TaggedOperation;

@Slf4j
public class ElasticSearchIndexSink
    implements Sink<List<TaggedOperation<BulkOperation>>, BulkResponse> {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final JacksonJsonpMapper JACKSON_JSONP_MAPPER =
      new JacksonJsonpMapper(OBJECT_MAPPER);

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
  public BulkResponse write(List<TaggedOperation<BulkOperation>> data) throws SearchIndexException {
    LOG.debug("[EsSearchIndexSink] Processing a Batch of Size: {}", data.size());
    try {
      List<EntityError> entityErrorList = new ArrayList<>();
      BulkResponse response = null;

      List<TaggedOperation<BulkOperation>> buffer = new ArrayList<>();
      long bufferSize = 0;

      for (TaggedOperation<BulkOperation> tagged : data) {
        long operationSize = estimateBulkOperationSize(tagged.operation());

        if (operationSize > maxPayLoadSizeInBytes) {
          LOG.error(
              "[EsSearchIndexSink] Entity size exceeds payload limit, skipping entity: {} (type={})",
              tagged.entityRef().getId(),
              tagged.entityRef().getType());
          entityErrorList.add(
              new EntityError()
                  .withMessage("Entity size exceeds elastic search maximum payload size")
                  .withEntity(tagged.entityRef()));
          continue;
        }

        if (bufferSize + operationSize > maxPayLoadSizeInBytes && !buffer.isEmpty()) {
          response = sendWithBisection(buffer, entityErrorList);
          buffer = new ArrayList<>();
          bufferSize = 0;
        }

        buffer.add(tagged);
        bufferSize += operationSize;
      }

      if (!buffer.isEmpty()) {
        response = sendWithBisection(buffer, entityErrorList);
      }

      LOG.debug(
          "[EsSearchIndexSink] Batch Stats :- Submitted : {} Success: {} Failed: {}",
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
                .withMessage(String.format("Issues in Sink To Elastic Search: %s", entityErrorList))
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
              .withMessage(String.format("Issue in Sink to Elastic Search: %s", e.getMessage()))
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug("[ESSearchIndexSink] Failed, Details : {}", JsonUtils.pojoToJson(indexingError));
      updateStats(0, data.size());
      throw new SearchIndexException(indexingError);
    }
  }

  /**
   * Sends bulk operations to Elasticsearch, iteratively bisecting the batch on 413 (Request Entity
   * Too Large) responses. If a single operation exceeds the server limit, it is recorded as a
   * failed entity and skipped so the rest of the batch can proceed.
   */
  private BulkResponse sendWithBisection(
      List<TaggedOperation<BulkOperation>> taggedOps, List<EntityError> errorList)
      throws IOException {
    Deque<List<TaggedOperation<BulkOperation>>> pending = new ArrayDeque<>();
    pending.push(taggedOps);
    BulkResponse lastResponse = null;

    while (!pending.isEmpty()) {
      List<TaggedOperation<BulkOperation>> chunk = pending.pop();
      List<BulkOperation> operations = chunk.stream().map(TaggedOperation::operation).toList();
      try {
        BulkResponse response = searchRepository.getSearchClient().bulkElasticSearch(operations);
        errorList.addAll(extractErrorsFromResponse(response, chunk));
        lastResponse = response;
      } catch (ElasticsearchException e) {
        if (e.status() != 413) {
          throw e;
        }
        if (chunk.size() == 1) {
          LOG.error(
              "[EsSearchIndexSink] Single document exceeds Elasticsearch payload limit, skipping entity: {} (type={})",
              chunk.getFirst().entityRef().getId(),
              chunk.getFirst().entityRef().getType());
          errorList.add(
              new EntityError()
                  .withMessage("Document exceeds Elasticsearch maximum payload size (413)")
                  .withEntity(chunk.getFirst().entityRef()));
          continue;
        }
        int mid = chunk.size() / 2;
        LOG.warn(
            "[EsSearchIndexSink] Bulk request rejected with 413, bisecting batch of {} into [{}, {}]",
            chunk.size(),
            mid,
            chunk.size() - mid);
        pending.push(chunk.subList(mid, chunk.size()));
        pending.push(chunk.subList(0, mid));
      }
    }
    return lastResponse;
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
      BulkResponse response, List<TaggedOperation<BulkOperation>> taggedOps) {
    List<EntityError> errors = new ArrayList<>();
    if (response != null && response.errors()) {
      for (int i = 0; i < response.items().size(); i++) {
        BulkResponseItem item = response.items().get(i);
        if (item.error() != null) {
          errors.add(
              new EntityError()
                  .withMessage(buildErrorMessage(item.error()))
                  .withEntity(taggedOps.get(i).entityRef()));
        }
      }
    }
    return errors;
  }

  private String buildErrorMessage(ErrorCause error) {
    String message = String.format("%s: %s", error.type(), error.reason());
    if (error.causedBy() != null) {
      message = String.format("%s | Caused by: %s", message, buildErrorMessage(error.causedBy()));
    } else if (error.rootCause() != null && !error.rootCause().isEmpty()) {
      String rootCauses =
          error.rootCause().stream()
              .map(c -> String.format("%s: %s", c.type(), c.reason()))
              .collect(Collectors.joining("; "));
      message = String.format("%s | Root cause: [%s]", message, rootCauses);
    }
    return message;
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
