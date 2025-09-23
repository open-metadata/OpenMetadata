package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.Refresh;
import es.co.elastic.clients.elasticsearch.core.BulkResponse;
import es.co.elastic.clients.elasticsearch.core.DeleteResponse;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import es.co.elastic.clients.json.JsonData;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.EntityManagementClient;

/**
 * Elasticsearch implementation of entity management operations.
 * This class handles all entity-related operations for Elasticsearch.
 */
@Slf4j
public class ElasticSearchEntityManager implements EntityManagementClient {
  private final ElasticsearchClient client;
  private final boolean isClientAvailable;

  public ElasticSearchEntityManager(ElasticsearchClient client) {
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
                    .docAsUpsert(true)
                    .refresh(Refresh.True)
                    .doc(JsonData.fromJson(doc)),
            Map.class);
        LOG.info(
            "Successfully created entity in ElasticSearch for index: {}, docId: {}",
            indexName,
            docId);
      } catch (IOException e) {
        LOG.error(
            "Failed to create entity in ElasticSearch for index: {}, docId: {}",
            indexName,
            docId,
            e);
      }
    } else {
      LOG.error("ElasticSearch client is not available. Cannot create entity.");
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
                                  .document(JsonData.fromJson(entry.getValue())))));
        }

        BulkResponse response =
            client.bulk(b -> b.index(indexName).operations(operations).refresh(Refresh.True));

        if (response.errors()) {
          String errorMessage =
              response.items().stream()
                  .filter(item -> item.error() != null)
                  .map(
                      item ->
                          "Failed to index document " + item.id() + ": " + item.error().reason())
                  .collect(Collectors.joining("; "));
          LOG.error("Failed to create entities in ElasticSearch: {}", errorMessage);
        } else {
          LOG.info("Successfully created {} entities in ElasticSearch", docsAndIds.size());
        }
      } catch (IOException e) {
        LOG.error("Failed to create entities in ElasticSearch for index: {} ", indexName, e);
      }
    } else {
      LOG.error("ElasticSearch client is not available. Cannot create entities.");
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
                    .docAsUpsert(true)
                    .refresh(Refresh.True)
                    .doc(JsonData.fromJson(doc)),
            Map.class);
        LOG.info(
            "Successfully created time series entity in ElasticSearch for index: {}, docId: {}",
            indexName,
            docId);
      } catch (Exception e) {
        LOG.error(
            "Failed to create time series entity in ElasticSearch for index: {}, docId: {}",
            indexName,
            docId,
            e);
      }
    } else {
      LOG.error("ElasticSearch client is not available. Cannot create time series entity.");
    }
  }

  @Override
  public void deleteEntity(String indexName, String docId) {
    if (isClientAvailable) {
      try {
        DeleteResponse response =
            client.delete(d -> d.index(indexName).id(docId).refresh(Refresh.WaitFor));
        LOG.info(
            "Successfully deleted entity from ElasticSearch for index: {}, docId: {}, result: {}",
            indexName,
            docId,
            response.result());
      } catch (Exception e) {
        LOG.error(
            "Failed to delete entity from ElasticSearch for index: {}, docId: {}, error: {}",
            indexName,
            docId,
            e.getMessage(),
            e);
      }
    } else {
      LOG.error("ElasticSearch client is not available. Cannot delete entity.");
    }
  }
}
