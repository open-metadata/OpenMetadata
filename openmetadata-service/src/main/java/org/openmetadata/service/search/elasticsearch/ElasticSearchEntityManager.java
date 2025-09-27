package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.service.exception.CatalogGenericExceptionMapper.getResponse;
import static org.openmetadata.service.search.SearchClient.ADD_UPDATE_ENTITY_RELATIONSHIP;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.ElasticsearchAsyncClient;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.BulkIndexByScrollFailure;
import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.elasticsearch._types.FieldValue;
import es.co.elastic.clients.elasticsearch._types.Refresh;
import es.co.elastic.clients.elasticsearch._types.ScriptLanguage;
import es.co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Operator;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.BulkResponse;
import es.co.elastic.clients.elasticsearch.core.DeleteByQueryResponse;
import es.co.elastic.clients.elasticsearch.core.DeleteResponse;
import es.co.elastic.clients.elasticsearch.core.GetResponse;
import es.co.elastic.clients.elasticsearch.core.UpdateByQueryResponse;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import es.co.elastic.clients.json.JsonData;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.sdk.exception.SearchIndexNotFoundException;
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
  private ElasticsearchAsyncClient asyncClient;
  private final boolean isAsyncClientAvailable;
  private final ObjectMapper objectMapper = new ObjectMapper();

  public ElasticSearchEntityManager(ElasticsearchClient client) {
    this.client = client;
    this.isClientAvailable = client != null;
    this.asyncClient =
        this.isClientAvailable ? new ElasticsearchAsyncClient(this.client._transport()) : null;
    this.isAsyncClientAvailable = this.asyncClient != null;
  }

  @Override
  public void createEntity(String indexName, String docId, String doc) throws IOException {
    upsertDocument(indexName, docId, doc, "create entity");
  }

  @Override
  public void createEntities(String indexName, List<Map<String, String>> docsAndIds) {
    if (!isAsyncClientAvailable) {
      LOG.error("ElasticSearch async client is not available. Cannot create entities.");
      return;
    }

    List<BulkOperation> operations = new ArrayList<>();
    for (Map<String, String> docAndId : docsAndIds) {
      if (docAndId == null || docAndId.isEmpty()) continue; // skip invalid entries
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

    // Execute the async bulk request
    CompletableFuture<BulkResponse> future =
        asyncClient.bulk(b -> b.index(indexName).operations(operations).refresh(Refresh.True));

    // Handle response asynchronously
    future.whenComplete(
        (response, error) -> {
          if (error != null) {
            LOG.error("Failed to create entities in ElasticSearch (async)", error);
            return;
          }

          if (response.errors()) {
            LOG.error(
                "Bulk indexing to ElasticSearch encountered errors. Index: {}, Total: {}, Failed: {}",
                indexName,
                docsAndIds.size(),
                response.items().stream().filter(item -> item.error() != null).count());

            response.items().stream()
                .filter(item -> item.error() != null)
                .forEach(
                    item ->
                        LOG.error(
                            "Indexing failed for ID {}: {}", item.id(), item.error().reason()));
          } else {
            LOG.info(
                "Successfully indexed {} entities to ElasticSearch (async) for index: {}",
                docsAndIds.size(),
                indexName);
          }
        });
  }

  @Override
  public void createTimeSeriesEntity(String indexName, String docId, String doc)
      throws IOException {
    upsertDocument(indexName, docId, doc, "create time series entity");
  }

  @Override
  public void deleteEntity(String indexName, String docId) throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot delete entity.");
      return;
    }
    DeleteResponse response =
        client.delete(d -> d.index(indexName).id(docId).refresh(Refresh.WaitFor));
    LOG.info(
        "Successfully deleted entity from ElasticSearch for index: {}, docId: {}, result: {}",
        indexName,
        docId,
        response.result());
  }

  @Override
  public void deleteEntityByFields(
      List<String> indexNames, List<Pair<String, String>> fieldAndValue) throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot delete entities by fields.");
      return;
    }

    BoolQuery.Builder boolQueryBuilder = new BoolQuery.Builder();
    for (Pair<String, String> p : fieldAndValue) {
      boolQueryBuilder.must(
          Query.of(q -> q.term(t -> t.field(p.getKey()).value(FieldValue.of(p.getValue())))));
    }

    DeleteByQueryResponse response =
        client.deleteByQuery(
            d -> d.index(indexNames).query(q -> q.bool(boolQueryBuilder.build())).refresh(true));

    LOG.info(
        "DeleteByQuery response From ES - Deleted: {}, Failures: {}",
        response.deleted(),
        response.failures().size());

    if (!response.failures().isEmpty()) {
      String failureDetails =
          response.failures().stream()
              .map(BulkIndexByScrollFailure::toString)
              .collect(Collectors.joining("; "));
      LOG.error("DeleteByQuery encountered failures: {}", failureDetails);
    }
  }

  @Override
  public void deleteEntityByFQNPrefix(String indexName, String fqnPrefix) throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot delete entities by FQN prefix.");
      return;
    }

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

    if (!response.failures().isEmpty()) {
      String failureDetails =
          response.failures().stream()
              .map(BulkIndexByScrollFailure::toString)
              .collect(Collectors.joining("; "));
      LOG.error("DeleteByQuery by FQN prefix encountered failures: {}", failureDetails);
    }
  }

  @Override
  public void deleteByScript(String indexName, String scriptTxt, Map<String, Object> params)
      throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot delete entities by script.");
      return;
    }

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
                                                        .lang(ScriptLanguage.Painless)
                                                        .source(scriptTxt)
                                                        .params(convertToJsonDataMap(params))))))
                    .refresh(true));

    LOG.info(
        "DeleteByQuery by script response from ES - Deleted: {}, Failures: {}",
        response.deleted(),
        response.failures().size());

    if (!response.failures().isEmpty()) {
      String failureDetails =
          response.failures().stream()
              .map(BulkIndexByScrollFailure::toString)
              .collect(Collectors.joining("; "));
      LOG.error("DeleteByQuery script encountered failures: {}", failureDetails);
    }
  }

  @Override
  public void softDeleteOrRestoreEntity(String indexName, String docId, String scriptTxt)
      throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot soft delete/restore entity.");
      return;
    }

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
                                    .lang(ScriptLanguage.Painless)
                                    .source(scriptTxt)
                                    .params(Map.of()))),
        Map.class);
    LOG.info(
        "Successfully soft deleted/restored entity in ElasticSearch for index: {}, docId: {}",
        indexName,
        docId);
  }

  @Override
  public void softDeleteOrRestoreChildren(
      List<String> indexNames, String scriptTxt, List<Pair<String, String>> fieldAndValue)
      throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot soft delete/restore children.");
      return;
    }

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
                                        .lang(ScriptLanguage.Painless)
                                        .source(scriptTxt)
                                        .params(Map.of())))
                    .refresh(true));

    LOG.info(
        "Successfully soft deleted/restored children in ElasticSearch for indices: {}, updated documents: {}",
        indexNames,
        response.updated());
    if (!response.failures().isEmpty()) {
      String failureDetails =
          response.failures().stream()
              .map(BulkIndexByScrollFailure::toString)
              .collect(Collectors.joining("; "));
      LOG.error("UpdateByQuery encountered failures: {}", failureDetails);
    }
  }

  @Override
  public void updateEntity(
      String indexName, String docId, Map<String, Object> doc, String scriptTxt) {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot update entity.");
      return;
    }

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
                                      .lang(ScriptLanguage.Painless)
                                      .source(scriptTxt)
                                      .params(params))),
          Map.class);

      LOG.info(
          "Successfully updated entity in ElasticSearch for index: {}, docId: {}",
          indexName,
          docId);
    } catch (IOException | ElasticsearchException e) {
      LOG.error(
          "Failed to update entity in ElasticSearch for index: {}, docId: {}", indexName, docId, e);
    }
  }

  @Override
  public void updateChildren(
      String indexName,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates) {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot update children.");
      return;
    }

    try {
      Map<String, JsonData> params =
          convertToJsonDataMap(updates.getValue() == null ? Map.of() : updates.getValue());

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
                  .script(
                      s ->
                          s.inline(
                              inline ->
                                  inline
                                      .lang(ScriptLanguage.Painless)
                                      .source(updates.getKey())
                                      .params(params)))
                  .refresh(true));

      LOG.info("Successfully updated children in ElasticSearch for index: {}", indexName);
    } catch (IOException | ElasticsearchException e) {
      LOG.error("Failed to update children in ElasticSearch for index: {}", indexName, e);
    }
  }

  @Override
  public void updateChildren(
      List<String> indexNames,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates)
      throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot update children for indices.");
      return;
    }
    Map<String, JsonData> params =
        convertToJsonDataMap(updates.getValue() == null ? Map.of() : updates.getValue());

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
                .script(
                    s ->
                        s.inline(
                            inline ->
                                inline
                                    .lang(ScriptLanguage.Painless)
                                    .source(updates.getKey())
                                    .params(params)))
                .refresh(true));

    LOG.info("Successfully updated children in ElasticSearch for indices: {}", indexNames);
  }

  @Override
  public Response getDocByID(String indexName, String entityId) throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot get document by ID.");
      return getResponse(Response.Status.NOT_FOUND, "Document not found.");
    }

    try {
      GetResponse<Map> response =
          client.get(
              g ->
                  g.index(Entity.getSearchRepository().getIndexOrAliasName(indexName)).id(entityId),
              Map.class);

      if (response != null && response.found()) {
        return Response.status(Response.Status.OK).entity(response.source()).build();
      }
    } catch (ElasticsearchException e) {
      if (e.status() == 404) {
        throw new SearchIndexNotFoundException(
            String.format("Failed to find doc with id %s", entityId));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getMessage()));
      }
    }
    return getResponse(Response.Status.NOT_FOUND, "Document not found.");
  }

  @Override
  public void updateEntityRelationship(
      String indexName,
      Pair<String, String> fieldAndValue,
      Map<String, Object> entityRelationshipData) {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot update entity relationship.");
      return;
    }

    try {
      Map<String, JsonData> params =
          entityRelationshipData != null
              ? Collections.singletonMap(
                  "entityRelationshipData", JsonData.of(entityRelationshipData))
              : Map.of();

      UpdateByQueryResponse response =
          client.updateByQuery(
              u ->
                  u.index(indexName)
                      .query(
                          q ->
                              q.match(
                                  m ->
                                      m.field(fieldAndValue.getKey())
                                          .query(fieldAndValue.getValue())
                                          .operator(Operator.And)))
                      .script(
                          s ->
                              s.inline(
                                  inline ->
                                      inline
                                          .lang(ScriptLanguage.Painless)
                                          .source(ADD_UPDATE_ENTITY_RELATIONSHIP)
                                          .params(params)))
                      .refresh(true));

      LOG.info(
          "Successfully updated entity relationship in ElasticSearch for index: {}", indexName);

      if (!response.failures().isEmpty()) {
        String failureDetails =
            response.failures().stream()
                .map(BulkIndexByScrollFailure::toString)
                .collect(Collectors.joining("; "));
        LOG.error("updated entity relationship encountered failures: {}", failureDetails);
      }

    } catch (IOException | ElasticsearchException e) {
      LOG.error(
          "Failed to update entity relationship in ElasticSearch for index: {}", indexName, e);
    }
  }

  @Override
  public void reindexWithEntityIds(
      List<String> sourceIndices,
      String destinationIndex,
      String pipelineName,
      String entityType,
      List<UUID> entityIds) {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot reindex entities.");
      return;
    }

    try {
      List<String> queryIDs = entityIds.stream().map(UUID::toString).collect(Collectors.toList());

      client.reindex(
          r ->
              r.source(s -> s.index(sourceIndices).query(q -> q.ids(ids -> ids.values(queryIDs))))
                  .dest(d -> d.index(destinationIndex).pipeline(pipelineName))
                  .refresh(true));

      LOG.info("Reindex {} entities of type {} to vector index", entityIds.size(), entityType);
    } catch (IOException | ElasticsearchException e) {
      LOG.error("Failed to reindex entities: {}", e.getMessage(), e);
    }
  }

  private void upsertDocument(String indexName, String docId, String doc, String operation)
      throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot {}.", operation);
      return;
    }
    client.update(
        u ->
            u.index(indexName)
                .id(docId)
                .docAsUpsert(true)
                .refresh(Refresh.True)
                .doc(toJsonData(doc)),
        Map.class);
    LOG.info(
        "Successfully {} in ElasticSearch for index: {}, docId: {}", operation, indexName, docId);
  }

  private Map<String, JsonData> convertToJsonDataMap(Map<String, Object> map) {
    return JsonUtils.getMap(map).entrySet().stream()
        .filter(entry -> entry.getValue() != null)
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
