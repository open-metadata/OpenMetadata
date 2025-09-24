package org.openmetadata.service.search.opensearch;

import static org.openmetadata.service.exception.CatalogGenericExceptionMapper.getResponse;
import static org.openmetadata.service.search.SearchClient.ADD_UPDATE_ENTITY_RELATIONSHIP;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch._types.ScriptLanguage;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.sdk.exception.SearchIndexNotFoundException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.EntityManagementClient;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.BulkIndexByScrollFailure;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.opensearch._types.Refresh;
import os.org.opensearch.client.opensearch._types.query_dsl.BoolQuery;
import os.org.opensearch.client.opensearch._types.query_dsl.Operator;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
import os.org.opensearch.client.opensearch.core.BulkRequest;
import os.org.opensearch.client.opensearch.core.BulkResponse;
import os.org.opensearch.client.opensearch.core.DeleteByQueryResponse;
import os.org.opensearch.client.opensearch.core.DeleteResponse;
import os.org.opensearch.client.opensearch.core.GetResponse;
import os.org.opensearch.client.opensearch.core.UpdateByQueryResponse;
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
      LOG.error("OpenSearch client is not available. Cannot create entity.");
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
      LOG.error("OpenSearch client is not available. Cannot create entities.");
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
      LOG.error("OpenSearch client is not available. Cannot create time series entity.");
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
      LOG.error("OpenSearch client is not available. Cannot delete entity.");
    }
  }

  @Override
  public void deleteEntityByFields(
      List<String> indexNames, List<Pair<String, String>> fieldAndValue) {
    if (isClientAvailable) {
      try {
        // Build the query using the new OpenSearch client API
        BoolQuery.Builder boolQueryBuilder = new BoolQuery.Builder();

        for (Pair<String, String> p : fieldAndValue) {
          boolQueryBuilder.must(
              Query.of(q -> q.term(t -> t.field(p.getKey()).value(FieldValue.of(p.getValue())))));
        }

        // Execute delete by query using the new client
        DeleteByQueryResponse response =
            client.deleteByQuery(
                d ->
                    d.index(indexNames).query(q -> q.bool(boolQueryBuilder.build())).refresh(true));

        LOG.info(
            "DeleteByQuery response from OS - Deleted: {}, Failures: {}",
            response.deleted(),
            response.failures().size());

        if (!response.failures().isEmpty()) {
          String failureDetails =
              response.failures().stream()
                  .map(BulkIndexByScrollFailure::toString)
                  .collect(Collectors.joining("; "));
          LOG.error("DeleteByQuery encountered failures: {}", failureDetails);
        }

      } catch (IOException e) {
        LOG.error("Failed to delete entities by fields using new OpenSearch client", e);
      }
    } else {
      LOG.error("OpenSearch client is not available. Cannot delete entities by fields.");
    }
  }

  @Override
  public void deleteEntityByFQNPrefix(String indexName, String fqnPrefix) {
    if (isClientAvailable) {
      try {
        // Build prefix query using the new OpenSearch client API
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
            "DeleteByQuery by FQN prefix response from OS - Deleted: {}, Failures: {}",
            response.deleted(),
            response.failures().size());

        if (!response.failures().isEmpty()) {
          String failureDetails =
              response.failures().stream()
                  .map(BulkIndexByScrollFailure::toString)
                  .collect(Collectors.joining("; "));
          LOG.error("DeleteByQuery by FQN prefix encountered failures: {}", failureDetails);
        }

      } catch (IOException e) {
        LOG.error("Failed to delete entities by FQN prefix using OpenSearch client", e);
      }
    } else {
      LOG.error("OpenSearch client is not available. Cannot delete entities by FQN prefix.");
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
                                                            .lang(
                                                                ScriptLanguage.Painless.jsonValue())
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
            "DeleteByQuery by script response from OS - Deleted: {}, Failures: {}",
            response.deleted(),
            response.failures().size());

        if (!response.failures().isEmpty()) {
          String failureDetails =
              response.failures().stream()
                  .map(BulkIndexByScrollFailure::toString)
                  .collect(Collectors.joining("; "));
          LOG.error("DeleteByQuery script encountered failures: {}", failureDetails);
        }
      } catch (IOException e) {
        LOG.error("Failed to delete entities by script using OpenSearch client", e);
      }
    } else {
      LOG.error("OpenSearch client is not available. Cannot delete entities by script.");
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
                        s ->
                            s.inline(
                                inline ->
                                    inline
                                        .lang(ScriptLanguage.Painless.jsonValue())
                                        .source(scriptTxt)
                                        .params(new HashMap<>()))),
            Map.class);
        LOG.info(
            "Successfully soft deleted/restored entity in OpenSearch for index: {}, docId: {}",
            indexName,
            docId);
      } catch (IOException | OpenSearchException e) {
        LOG.error(
            "Failed to soft delete/restore entity in OpenSearch for index: {}, docId: {}",
            indexName,
            docId,
            e);
      }
    } else {
      LOG.error("OpenSearch client is not available. Cannot soft delete/restore entity.");
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

        UpdateByQueryResponse response =
            client.updateByQuery(
                u ->
                    u.index(indexNames)
                        .query(q -> q.bool(boolQueryBuilder.build()))
                        .script(
                            s ->
                                s.inline(
                                    inline ->
                                        inline
                                            .lang(ScriptLanguage.Painless.jsonValue())
                                            .source(scriptTxt)
                                            .params(new HashMap<>())))
                        .refresh(true));

        LOG.info(
            "Successfully soft deleted/restored children in OpenSearch for indices: {}, updated documents: {}",
            indexNames,
            response.updated());

        if (!response.failures().isEmpty()) {
          String failureDetails =
              response.failures().stream()
                  .map(BulkIndexByScrollFailure::toString)
                  .collect(Collectors.joining("; "));
          LOG.error("UpdateByQuery encountered failures: {}", failureDetails);
        }

      } catch (IOException | OpenSearchException e) {
        LOG.error(
            "Failed to soft delete/restore children in OpenSearch for indices: {}", indexNames, e);
      }
    } else {
      LOG.error("OpenSearch client is not available. Cannot soft delete/restore children.");
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
                    .script(
                        s ->
                            s.inline(
                                inline ->
                                    inline
                                        .lang(ScriptLanguage.Painless.jsonValue())
                                        .source(scriptTxt)
                                        .params(params))),
            Map.class);

        LOG.info(
            "Successfully updated entity in OpenSearch for index: {}, docId: {}", indexName, docId);
      } catch (IOException | OpenSearchException e) {
        LOG.error(
            "Failed to update entity in OpenSearch for index: {}, docId: {}", indexName, docId, e);
      }
    } else {
      LOG.error("OpenSearch client is not available. Cannot update entity.");
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
                                        .query(FieldValue.of(fieldAndValue.getValue()))
                                        .operator(Operator.And)))
                    .script(
                        s ->
                            s.inline(
                                inline ->
                                    inline
                                        .lang(ScriptLanguage.Painless.jsonValue())
                                        .source(updates.getKey())
                                        .params(params)))
                    .refresh(true));

        LOG.info("Successfully updated children in OpenSearch for index: {}", indexName);
      } catch (IOException e) {
        LOG.error("Failed to update children in OpenSearch for index: {}", indexName, e);
      }
    } else {
      LOG.error("OpenSearch client is not available. Cannot update children.");
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
                                        .query(FieldValue.of(fieldAndValue.getValue()))
                                        .operator(Operator.And)))
                    .script(
                        s ->
                            s.inline(
                                inline ->
                                    inline
                                        .lang(ScriptLanguage.Painless.jsonValue())
                                        .source(updates.getKey())
                                        .params(params)))
                    .refresh(true));

        LOG.info("Successfully updated children in OpenSearch for indices: {}", indexNames);
      } catch (IOException e) {
        LOG.error("Failed to update children in OpenSearch for indices: {}", indexNames, e);
      }
    } else {
      LOG.error("OpenSearch client is not available. Cannot update children for indices.");
    }
  }

  @Override
  public Response getDocByID(String indexName, String entityId) throws IOException {
    if (isClientAvailable) {
      try {
        GetResponse<Map> response =
            client.get(
                g ->
                    g.index(Entity.getSearchRepository().getIndexOrAliasName(indexName))
                        .id(entityId),
                Map.class);

        if (response.found()) {
          return Response.status(Response.Status.OK).entity(response.source()).build();
        }
      } catch (OpenSearchException e) {
        if (e.status() == 404) {
          throw new SearchIndexNotFoundException(
              String.format("Failed to find doc with id %s", entityId));
        } else {
          throw new SearchException(String.format("Search failed due to %s", e.getMessage()));
        }
      }
    } else {
      LOG.error("OpenSearch client is not available. Cannot get document by ID.");
    }
    return getResponse(Response.Status.NOT_FOUND, "Document not found.");
  }

  @Override
  public void updateEntityRelationship(
      String indexName,
      Pair<String, String> fieldAndValue,
      Map<String, Object> entityRelationshipData) {
    if (isClientAvailable) {
      try {
        Map<String, JsonData> params =
            Collections.singletonMap("entityRelationshipData", JsonData.of(entityRelationshipData));

        client.updateByQuery(
            u ->
                u.index(indexName)
                    .query(
                        q ->
                            q.match(
                                m ->
                                    m.field(fieldAndValue.getKey())
                                        .query(FieldValue.of(fieldAndValue.getValue()))
                                        .operator(Operator.And)))
                    .script(
                        s ->
                            s.inline(
                                inline ->
                                    inline
                                        .lang(ScriptLanguage.Painless.jsonValue())
                                        .source(ADD_UPDATE_ENTITY_RELATIONSHIP)
                                        .params(params)))
                    .refresh(true));

        LOG.info("Successfully updated entity relationship in OpenSearch for index: {}", indexName);
      } catch (IOException e) {
        LOG.error("Failed to update entity relationship in OpenSearch for index: {}", indexName, e);
      }
    } else {
      LOG.error("OpenSearch client is not available. Cannot update entity relationship.");
    }
  }

  @Override
  public void reindexWithEntityIds(
      List<String> sourceIndices,
      String destinationIndex,
      String pipelineName,
      String entityType,
      List<UUID> entityIds) {
    if (isClientAvailable) {
      try {
        List<String> queryIDs = entityIds.stream().map(UUID::toString).collect(Collectors.toList());

        client.reindex(
            r ->
                r.source(s -> s.index(sourceIndices).query(q -> q.ids(ids -> ids.values(queryIDs))))
                    .dest(d -> d.index(destinationIndex).pipeline(pipelineName))
                    .refresh(true));

        LOG.info("Reindex {} entities of type {} to vector index", entityIds.size(), entityType);
      } catch (IOException e) {
        LOG.error("Failed to reindex entities: {}", e.getMessage(), e);
      }
    } else {
      LOG.error("OpenSearch client is not available. Cannot reindex entities.");
    }
  }

  private Map<String, JsonData> convertToJsonDataMap(Map<String, Object> map) {
    return JsonUtils.getMap(map).entrySet().stream()
        .collect(Collectors.toMap(Map.Entry::getKey, entry -> JsonData.of(entry.getValue())));
  }

  private JsonData toJsonData(String doc) {
    Map<String, Object> docMap;
    try {
      docMap = objectMapper.readValue(doc, new TypeReference<>() {});
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid JSON input", e);
    }
    return JsonData.of(docMap);
  }
}
