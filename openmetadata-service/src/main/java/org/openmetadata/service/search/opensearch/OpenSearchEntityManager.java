package org.openmetadata.service.search.opensearch;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.EntityManagementClient;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.Refresh;
import os.org.opensearch.client.opensearch.core.BulkRequest;
import os.org.opensearch.client.opensearch.core.BulkResponse;
import os.org.opensearch.client.opensearch.core.DeleteResponse;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;

/**
 * OpenSearch implementation of entity management operations.
 * This class handles all entity-related operations for OpenSearch.
 */
@Slf4j
public class OpenSearchEntityManager implements EntityManagementClient {
  private final OpenSearchClient client;
  private final boolean isClientAvailable;
  private final ObjectMapper objectMapper = new ObjectMapper();

  public OpenSearchEntityManager(OpenSearchClient client) {
    this.client = client;
    this.isClientAvailable = client != null;
  }

  @Override
  public void createEntity(String indexName, String docId, String doc) {
    if (isClientAvailable) {
      try {
        client.update(
            u ->
                u.index(indexName)
                    .id(docId)
                    .refresh(Refresh.True)
                    .docAsUpsert(true)
                    .doc(toJsonData(doc)),
            Map.class);
        LOG.info(
            "Successfully created entity in OpenSearch for index: {}, docId: {}", indexName, docId);
      } catch (Exception e) {
        LOG.error(
            "Failed to create entity in OpenSearch for index: {}, docId: {}", indexName, docId, e);
      }
    } else {
      LOG.warn("OpenSearch client is not available. Cannot create entity.");
    }
  }

  @Override
  public void createEntities(String indexName, List<Map<String, String>> docsAndIds) {
    if (isClientAvailable) {
      try {
        List<BulkOperation> operations = new ArrayList<>();
        for (Map<String, String> docAndId : docsAndIds) {
          Map.Entry<String, String> entry = docAndId.entrySet().iterator().next();
          operations.add(
              BulkOperation.of(
                  b ->
                      b.index(
                          i ->
                              i.index(indexName)
                                  .id(entry.getKey())
                                  .document(toJsonData(entry.getValue())))));
        }

        BulkRequest bulkRequest =
            BulkRequest.of(b -> b.operations(operations).refresh(Refresh.True));
        BulkResponse bulkResponse = client.bulk(bulkRequest);

        if (bulkResponse.errors()) {
          LOG.error(
              "Bulk indexing to OpenSearch has errors for index: {}. Total requests: {}, Errors: {}",
              indexName,
              docsAndIds.size(),
              bulkResponse.items().stream().filter(item -> item.error() != null).count());
          bulkResponse
              .items()
              .forEach(
                  item -> {
                    if (item.error() != null) {
                      LOG.error(
                          "Bulk indexing error for id {}: {}", item.id(), item.error().reason());
                    }
                  });
        } else {
          LOG.info(
              "Successfully indexed {} entities to OpenSearch for index: {}",
              docsAndIds.size(),
              indexName);
        }
      } catch (IOException e) {
        LOG.error("Failed to create entities in OpenSearch for index: {} ", indexName, e);
      }
    } else {
      LOG.warn("OpenSearch client is not available. Cannot create entities.");
    }
  }

  @Override
  public void createTimeSeriesEntity(String indexName, String docId, String doc) {
    if (isClientAvailable) {
      try {
        client.update(
            u ->
                u.index(indexName)
                    .id(docId)
                    .refresh(Refresh.True)
                    .docAsUpsert(true)
                    .doc(toJsonData(doc)),
            Map.class);
        LOG.info(
            "Successfully created time series entity in OpenSearch for index: {}, docId: {}",
            indexName,
            docId);
      } catch (IOException e) {
        LOG.error(
            "Failed to create time series entity in OpenSearch for index: {}, docId: {}",
            indexName,
            docId,
            e);
      }
    } else {
      LOG.warn("OpenSearch client is not available. Cannot create time series entity.");
    }
  }

  @Override
  public void deleteEntity(String indexName, String docId) {
    if (isClientAvailable) {
      try {
        DeleteResponse response =
            client.delete(d -> d.index(indexName).id(docId).refresh(Refresh.WaitFor));
        LOG.info(
            "Successfully deleted entity from OpenSearch for index: {}, docId: {}, result: {}",
            indexName,
            docId,
            response.result());
      } catch (IOException e) {
        LOG.error(
            "Failed to delete entity from OpenSearch for index: {}, docId: {}, error: {}",
            indexName,
            docId,
            e.getMessage(),
            e);
      }
    } else {
      LOG.warn("OpenSearch client is not available. Cannot delete entity.");
    }
  }

  private JsonData toJsonData(String doc) {
    Map<String, Object> docMap;
    try {
      docMap = objectMapper.readValue(doc, new TypeReference<>() {});
    } catch (JsonProcessingException e) {
      throw new RuntimeException(e);
    }
    return JsonData.of(docMap);
  }
}
