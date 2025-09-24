package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.FieldValue;
import es.co.elastic.clients.elasticsearch._types.Refresh;
import es.co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Operator;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.BulkResponse;
import es.co.elastic.clients.elasticsearch.core.DeleteByQueryResponse;
import es.co.elastic.clients.elasticsearch.core.DeleteResponse;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import es.co.elastic.clients.json.JsonData;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
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

  @Override
  public void deleteEntityByFields(
      List<String> indexNames, List<Pair<String, String>> fieldAndValue) {
    if (isClientAvailable) {
      try {
        BoolQuery.Builder boolQueryBuilder = new BoolQuery.Builder();
        for (Pair<String, String> p : fieldAndValue) {
          boolQueryBuilder.must(
              Query.of(q -> q.term(t -> t.field(p.getKey()).value(p.getValue()))));
        }

        DeleteByQueryResponse response =
            client.deleteByQuery(
                d ->
                    d.index(indexNames).query(q -> q.bool(boolQueryBuilder.build())).refresh(true));

        LOG.info(
            "DeleteByQuery response From ES - Deleted: {}, Failures: {}",
            response.deleted(),
            response.failures().size());
      } catch (IOException e) {
        LOG.error("Failed to delete entities by fields using new ES client", e);
      }
    } else {
      LOG.error("ElasticSearch client is not available. Cannot delete entities by fields.");
    }
  }

  @Override
  public void deleteEntityByFQNPrefix(String indexName, String fqnPrefix) {
    if (isClientAvailable) {
      try {
        DeleteByQueryResponse response =
            client.deleteByQuery(
                d ->
                    d.index(indexName)
                        .query(
                            q ->
                                q.prefix(
                                    p ->
                                        p.field("fullyQualifiedName.keyword")
                                            .value(fqnPrefix.toLowerCase())))
                        .refresh(true));

        LOG.info(
            "DeleteByQuery by FQN prefix response from ES - Deleted: {}, Failures: {}",
            response.deleted(),
            response.failures().size());
      } catch (IOException e) {
        LOG.error("Failed to delete entities by FQN prefix using ES client", e);
      }
    } else {
      LOG.error("ElasticSearch client is not available. Cannot delete entities by FQN prefix.");
    }
  }

  @Override
  public void deleteByScript(String indexName, String scriptTxt, Map<String, Object> params) {
    if (isClientAvailable) {
      try {
        DeleteByQueryResponse response =
            client.deleteByQuery(
                d ->
                    d.index(indexName)
                        .query(
                            q ->
                                q.script(
                                    s ->
                                        s.script(
                                            script ->
                                                script.inline(
                                                    inline ->
                                                        inline
                                                            .source(scriptTxt)
                                                            .params(
                                                                params.entrySet().stream()
                                                                    .collect(
                                                                        Collectors.toMap(
                                                                            Map.Entry::getKey,
                                                                            entry ->
                                                                                JsonData.of(
                                                                                    entry
                                                                                        .getValue()))))))))
                        .refresh(true));

        LOG.info(
            "DeleteByQuery by script response from ES - Deleted: {}, Failures: {}",
            response.deleted(),
            response.failures().size());
      } catch (IOException e) {
        LOG.error("Failed to delete entities by script using ES client", e);
      }
    } else {
      LOG.error("ElasticSearch client is not available. Cannot delete entities by script.");
    }
  }

  @Override
  public void softDeleteOrRestoreEntity(String indexName, String docId, String scriptTxt) {
    if (isClientAvailable) {
      try {
        client.update(
            u ->
                u.index(indexName)
                    .id(docId)
                    .refresh(Refresh.True)
                    .script(
                        s -> s.inline(inline -> inline.source(scriptTxt).params(new HashMap<>()))),
            Map.class);
        LOG.info(
            "Successfully soft deleted/restored entity in ElasticSearch for index: {}, docId: {}",
            indexName,
            docId);
      } catch (IOException e) {
        LOG.error(
            "Failed to soft delete/restore entity in ElasticSearch for index: {}, docId: {}",
            indexName,
            docId,
            e);
      }
    } else {
      LOG.error("ElasticSearch client is not available. Cannot soft delete/restore entity.");
    }
  }

  @Override
  public void softDeleteOrRestoreChildren(
      List<String> indexNames, String scriptTxt, List<Pair<String, String>> fieldAndValue) {
    if (isClientAvailable) {
      try {
        BoolQuery.Builder boolQueryBuilder = new BoolQuery.Builder();

        for (Pair<String, String> p : fieldAndValue) {
          boolQueryBuilder.must(
              Query.of(q -> q.term(t -> t.field(p.getKey()).value(FieldValue.of(p.getValue())))));
        }

        client.updateByQuery(
            u ->
                u.index(indexNames)
                    .query(q -> q.bool(boolQueryBuilder.build()))
                    .script(
                        s -> s.inline(inline -> inline.source(scriptTxt).params(new HashMap<>())))
                    .refresh(true));

        LOG.info(
            "Successfully soft deleted/restored children in ElasticSearch for indices: {}",
            indexNames);
      } catch (IOException e) {
        LOG.error(
            "Failed to soft delete/restore children in ElasticSearch for indices: {}",
            indexNames,
            e);
      }
    } else {
      LOG.error("ElasticSearch client is not available. Cannot soft delete/restore children.");
    }
  }

  @Override
  public void updateEntity(
      String indexName, String docId, Map<String, Object> doc, String scriptTxt) {
    if (isClientAvailable) {
      try {
        Map<String, JsonData> params = convertToJsonDataMap(doc);

        client.update(
            u ->
                u.index(indexName)
                    .id(docId)
                    .refresh(Refresh.True)
                    .scriptedUpsert(true)
                    .script(s -> s.inline(inline -> inline.source(scriptTxt).params(params))),
            Map.class);

        LOG.info(
            "Successfully updated entity in ElasticSearch for index: {}, docId: {}",
            indexName,
            docId);
      } catch (IOException e) {
        LOG.error(
            "Failed to update entity in ElasticSearch for index: {}, docId: {}",
            indexName,
            docId,
            e);
      }
    } else {
      LOG.error("ElasticSearch client is not available. Cannot update entity.");
    }
  }

  @Override
  public void updateChildren(
      String indexName,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates) {
    if (isClientAvailable) {
      try {
        Map<String, JsonData> params =
            convertToJsonDataMap(updates.getValue() == null ? new HashMap<>() : updates.getValue());

        client.updateByQuery(
            u ->
                u.index(Entity.getSearchRepository().getIndexOrAliasName(indexName))
                    .query(
                        q ->
                            q.match(
                                m ->
                                    m.field(fieldAndValue.getKey())
                                        .query(fieldAndValue.getValue())
                                        .operator(Operator.And)))
                    .script(s -> s.inline(inline -> inline.source(updates.getKey()).params(params)))
                    .refresh(true));

        LOG.info("Successfully updated children in ElasticSearch for index: {}", indexName);
      } catch (IOException e) {
        LOG.error("Failed to update children in ElasticSearch for index: {}", indexName, e);
      }
    } else {
      LOG.error("ElasticSearch client is not available. Cannot update children.");
    }
  }

  @Override
  public void updateChildren(
      List<String> indexNames,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates) {
    if (isClientAvailable) {
      try {
        Map<String, JsonData> params =
            convertToJsonDataMap(updates.getValue() == null ? new HashMap<>() : updates.getValue());

        client.updateByQuery(
            u ->
                u.index(indexNames)
                    .query(
                        q ->
                            q.match(
                                m ->
                                    m.field(fieldAndValue.getKey())
                                        .query(fieldAndValue.getValue())
                                        .operator(Operator.And)))
                    .script(s -> s.inline(inline -> inline.source(updates.getKey()).params(params)))
                    .refresh(true));

        LOG.info("Successfully updated children in ElasticSearch for indices: {}", indexNames);
      } catch (IOException e) {
        LOG.error("Failed to update children in ElasticSearch for indices: {}", indexNames, e);
      }
    } else {
      LOG.error("ElasticSearch client is not available. Cannot update children for indices.");
    }
  }

  private Map<String, JsonData> convertToJsonDataMap(Map<String, Object> map) {
    return JsonUtils.getMap(map).entrySet().stream()
        .collect(Collectors.toMap(Map.Entry::getKey, entry -> JsonData.of(entry.getValue())));
  }
}
