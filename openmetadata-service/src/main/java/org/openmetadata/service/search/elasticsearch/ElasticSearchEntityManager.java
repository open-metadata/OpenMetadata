package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.service.exception.CatalogGenericExceptionMapper.getResponse;
import static org.openmetadata.service.search.SearchClient.ADD_UPDATE_ENTITY_RELATIONSHIP;
import static org.openmetadata.service.search.SearchClient.ADD_UPDATE_LINEAGE;
import static org.openmetadata.service.search.SearchClient.DELETE_COLUMN_LINEAGE_SCRIPT;
import static org.openmetadata.service.search.SearchClient.FIELDS_TO_REMOVE_WHEN_NULL;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.UPDATE_CLASSIFICATION_TAG_FQN_BY_PREFIX_SCRIPT;
import static org.openmetadata.service.search.SearchClient.UPDATE_COLUMN_LINEAGE_SCRIPT;
import static org.openmetadata.service.search.SearchClient.UPDATE_DATA_PRODUCT_FQN_SCRIPT;
import static org.openmetadata.service.search.SearchClient.UPDATE_FQN_PREFIX_SCRIPT;
import static org.openmetadata.service.search.SearchClient.UPDATE_GLOSSARY_TERM_TAG_FQN_BY_PREFIX_SCRIPT;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.ElasticsearchAsyncClient;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.BulkIndexByScrollFailure;
import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.elasticsearch._types.ErrorCause;
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
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.elasticsearch.core.UpdateByQueryResponse;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import es.co.elastic.clients.elasticsearch.core.search.Hit;
import es.co.elastic.clients.json.JsonData;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.entityRelationship.SearchEntityRelationshipRequest;
import org.openmetadata.schema.api.entityRelationship.SearchEntityRelationshipResult;
import org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.entityRelationship.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.sdk.exception.SearchIndexNotFoundException;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.EntityManagementClient;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

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
        client.delete(d -> d.index(indexName).id(docId).refresh(Refresh.True));
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
                                            script
                                                .source(ss -> ss.scriptString(scriptTxt))
                                                .lang(ScriptLanguage.Painless)
                                                .params(convertToJsonDataMap(params)))))
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
                        s.source(ss -> ss.scriptString(scriptTxt))
                            .lang(ScriptLanguage.Painless)
                            .params(Map.of())),
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
                            s.source(ss -> ss.scriptString(scriptTxt))
                                .lang(ScriptLanguage.Painless)
                                .params(Map.of()))
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
                  .upsert(params)
                  .script(
                      s ->
                          s.source(ss -> ss.scriptString(scriptTxt))
                              .lang(ScriptLanguage.Painless)
                              .params(params)),
          Map.class);

      LOG.info(
          "Successfully updated entity in ElasticSearch for index: {}, docId: {}",
          indexName,
          docId);
    } catch (ElasticsearchException e) {
      if (e.status() == 404) {
        LOG.warn(
            "Document not found during update for index: {}, docId: {}. The document may not have been indexed yet.",
            indexName,
            docId);
      } else {
        LOG.error(
            "Failed to update entity in ElasticSearch for index: {}, docId: {}",
            indexName,
            docId,
            e);
      }
    } catch (IOException e) {
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
                          s.source(ss -> ss.scriptString(updates.getKey()))
                              .lang(ScriptLanguage.Painless)
                              .params(params))
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
                        s.source(ss -> ss.scriptString(updates.getKey()))
                            .lang(ScriptLanguage.Painless)
                            .params(params))
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
                              s.source(ss -> ss.scriptString(ADD_UPDATE_ENTITY_RELATIONSHIP))
                                  .lang(ScriptLanguage.Painless)
                                  .params(params))
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

  @Override
  public void updateByFqnPrefix(
      String indexName, String oldParentFQN, String newParentFQN, String prefixFieldCondition) {
    try {
      Query prefixQuery =
          Query.of(q -> q.prefix(p -> p.field(prefixFieldCondition).value(oldParentFQN)));

      Map<String, JsonData> params =
          Map.of(
              "oldParentFQN", JsonData.of(oldParentFQN),
              "newParentFQN", JsonData.of(newParentFQN));

      UpdateByQueryResponse updateResponse =
          client.updateByQuery(
              req ->
                  req.index(Entity.getSearchRepository().getIndexOrAliasName(indexName))
                      .query(prefixQuery)
                      .script(
                          s ->
                              s.source(ss -> ss.scriptString(UPDATE_FQN_PREFIX_SCRIPT))
                                  .lang(ScriptLanguage.Painless)
                                  .params(params))
                      .refresh(true));

      LOG.info("Successfully propagated FQN updates for parent FQN: {}", oldParentFQN);

      if (!updateResponse.failures().isEmpty()) {
        String errorMessage =
            updateResponse.failures().stream()
                .map(BulkIndexByScrollFailure::cause)
                .map(ErrorCause::reason)
                .collect(Collectors.joining(", "));
        LOG.error("Failed to update FQN prefix: {}", errorMessage);
      }

    } catch (Exception e) {
      LOG.error("Error while propagating FQN updates: {}", e.getMessage(), e);
    }
  }

  @Override
  @SneakyThrows
  public void updateLineage(
      String indexName, Pair<String, String> fieldAndValue, EsLineageData lineageData) {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot update lineage.");
      return;
    }

    Map<String, JsonData> params =
        Collections.singletonMap("lineageData", JsonData.of(JsonUtils.getMap(lineageData)));

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
                            s.source(ss -> ss.scriptString(ADD_UPDATE_LINEAGE))
                                .lang(ScriptLanguage.Painless)
                                .params(params))
                    .refresh(true));

    LOG.info("Successfully updated lineage in ElasticSearch for index: {}", indexName);

    if (!response.failures().isEmpty()) {
      String failureDetails =
          response.failures().stream()
              .map(BulkIndexByScrollFailure::toString)
              .collect(Collectors.joining("; "));
      LOG.error("Update lineage encountered failures: {}", failureDetails);
    }
  }

  @Override
  public void deleteByRangeQuery(
      String index, String fieldName, Object gt, Object gte, Object lt, Object lte)
      throws IOException {
    if (!isClientAvailable) {
      LOG.error("Elasticsearch client is not available. Cannot delete by range query.");
      return;
    }

    // Build the range query using untyped range for flexible field types
    Query query =
        Query.of(
            q ->
                q.range(
                    r ->
                        r.untyped(
                            u -> {
                              u.field(fieldName);
                              if (gt != null) u.gt(JsonData.of(String.valueOf(gt)));
                              if (gte != null) u.gte(JsonData.of(String.valueOf(gte)));
                              if (lt != null) u.lt(JsonData.of(String.valueOf(lt)));
                              if (lte != null) u.lte(JsonData.of(String.valueOf(lte)));
                              return u;
                            })));

    // Execute delete-by-query with refresh
    DeleteByQueryResponse response =
        client.deleteByQuery(d -> d.index(index).query(query).refresh(true));

    LOG.info(
        "DeleteByQuery response from ES - Deleted: {}, Failures: {}",
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
  public void deleteByRangeAndTerm(
      String index,
      String rangeFieldName,
      Object gt,
      Object gte,
      Object lt,
      Object lte,
      String termKey,
      String termValue)
      throws IOException {
    if (!isClientAvailable) {
      LOG.error("Elasticsearch client is not available. Cannot delete by range and term query.");
      return;
    }

    // Build the range query using untyped range for flexible field types
    Query rangeQuery =
        Query.of(
            q ->
                q.range(
                    r ->
                        r.untyped(
                            u -> {
                              u.field(rangeFieldName);
                              if (gt != null) u.gt(JsonData.of(String.valueOf(gt)));
                              if (gte != null) u.gte(JsonData.of(String.valueOf(gte)));
                              if (lt != null) u.lt(JsonData.of(String.valueOf(lt)));
                              if (lte != null) u.lte(JsonData.of(String.valueOf(lte)));
                              return u;
                            })));

    // Build the term query
    Query termQuery = Query.of(q -> q.term(t -> t.field(termKey).value(FieldValue.of(termValue))));

    // Combine both queries with a bool query
    Query combinedQuery = Query.of(q -> q.bool(b -> b.must(rangeQuery).must(termQuery)));

    // Execute delete-by-query with refresh
    DeleteByQueryResponse response =
        client.deleteByQuery(d -> d.index(index).query(combinedQuery).refresh(true));

    LOG.info(
        "DeleteByRangeAndTerm response from ES - Deleted: {}, Failures: {}",
        response.deleted(),
        response.failures().size());

    if (!response.failures().isEmpty()) {
      String failureDetails =
          response.failures().stream()
              .map(BulkIndexByScrollFailure::toString)
              .collect(Collectors.joining("; "));
      LOG.error("DeleteByRangeAndTerm encountered failures: {}", failureDetails);
    }
  }

  @Override
  public void updateColumnsInUpstreamLineage(
      String indexName, HashMap<String, String> originalUpdatedColumnFqnMap) {
    if (!isClientAvailable) {
      LOG.error(
          "Elasticsearch client is not available. Cannot update columns in upstream lineage.");
      return;
    }

    try {
      Map<String, JsonData> params =
          Collections.singletonMap("columnUpdates", JsonData.of(originalUpdatedColumnFqnMap));

      UpdateByQueryResponse updateResponse =
          client.updateByQuery(
              req ->
                  req.index(Entity.getSearchRepository().getIndexOrAliasName(indexName))
                      .script(
                          s ->
                              s.source(ss -> ss.scriptString(UPDATE_COLUMN_LINEAGE_SCRIPT))
                                  .lang(ScriptLanguage.Painless)
                                  .params(params))
                      .refresh(true));

      LOG.info(
          "Successfully updated columns in upstream lineage for index: {}, updated: {}",
          indexName,
          updateResponse.updated());

      if (!updateResponse.failures().isEmpty()) {
        String errorMessage =
            updateResponse.failures().stream()
                .map(BulkIndexByScrollFailure::cause)
                .map(ErrorCause::reason)
                .collect(Collectors.joining(", "));
        LOG.error("Failed to update columns in upstream lineage: {}", errorMessage);
      }

    } catch (Exception e) {
      LOG.error("Error while updating columns in upstream lineage: {}", e.getMessage(), e);
    }
  }

  @Override
  public void deleteColumnsInUpstreamLineage(String indexName, List<String> deletedColumns) {
    if (!isClientAvailable) {
      LOG.error(
          "Elasticsearch client is not available. Cannot delete columns from upstream lineage.");
      return;
    }

    try {
      Map<String, JsonData> params =
          Collections.singletonMap("deletedFQNs", JsonData.of(deletedColumns));

      UpdateByQueryResponse updateResponse =
          client.updateByQuery(
              req ->
                  req.index(Entity.getSearchRepository().getIndexOrAliasName(indexName))
                      .script(
                          s ->
                              s.source(ss -> ss.scriptString(DELETE_COLUMN_LINEAGE_SCRIPT))
                                  .lang(ScriptLanguage.Painless)
                                  .params(params))
                      .refresh(true));

      LOG.info(
          "Successfully deleted columns from upstream lineage for index: {}, updated: {}",
          indexName,
          updateResponse.updated());

      if (!updateResponse.failures().isEmpty()) {
        String errorMessage =
            updateResponse.failures().stream()
                .map(BulkIndexByScrollFailure::cause)
                .map(ErrorCause::reason)
                .collect(Collectors.joining(", "));
        LOG.error("Failed to delete columns from upstream lineage: {}", errorMessage);
      }

    } catch (Exception e) {
      LOG.error("Error while deleting columns from upstream lineage: {}", e.getMessage(), e);
    }
  }

  @Override
  public void updateGlossaryTermByFqnPrefix(
      String indexName, String oldFqnPrefix, String newFqnPrefix, String prefixFieldCondition) {
    if (!isClientAvailable) {
      LOG.error(
          "Elasticsearch client is not available. Cannot update glossary term by FQN prefix.");
      return;
    }

    try {
      Query prefixQuery =
          Query.of(q -> q.prefix(p -> p.field(prefixFieldCondition).value(oldFqnPrefix)));

      Map<String, JsonData> params =
          Map.of(
              "oldParentFQN", JsonData.of(oldFqnPrefix),
              "newParentFQN", JsonData.of(newFqnPrefix));

      UpdateByQueryResponse updateResponse =
          client.updateByQuery(
              req ->
                  req.index(Entity.getSearchRepository().getIndexOrAliasName(indexName))
                      .query(prefixQuery)
                      .script(
                          s ->
                              s.source(
                                      ss ->
                                          ss.scriptString(
                                              UPDATE_GLOSSARY_TERM_TAG_FQN_BY_PREFIX_SCRIPT))
                                  .lang(ScriptLanguage.Painless)
                                  .params(params))
                      .refresh(true));

      LOG.info(
          "Successfully updated glossary term FQN for index: {}, updated: {}",
          indexName,
          updateResponse.updated());

      if (!updateResponse.failures().isEmpty()) {
        String errorMessage =
            updateResponse.failures().stream()
                .map(BulkIndexByScrollFailure::cause)
                .map(ErrorCause::reason)
                .collect(Collectors.joining(", "));
        LOG.error("Failed to update glossary term FQN: {}", errorMessage);
      }

    } catch (Exception e) {
      LOG.error("Error while updating glossary term FQN: {}", e.getMessage(), e);
    }
  }

  @Override
  public void updateClassificationTagByFqnPrefix(
      String indexName, String oldFqnPrefix, String newFqnPrefix, String prefixFieldCondition) {
    if (!isClientAvailable) {
      LOG.error(
          "Elasticsearch client is not available. Cannot update classification tag by FQN prefix.");
      return;
    }

    try {
      Query prefixQuery =
          Query.of(q -> q.prefix(p -> p.field(prefixFieldCondition).value(oldFqnPrefix)));

      Map<String, JsonData> params =
          Map.of(
              "oldParentFQN", JsonData.of(oldFqnPrefix),
              "newParentFQN", JsonData.of(newFqnPrefix));

      UpdateByQueryResponse updateResponse =
          client.updateByQuery(
              req ->
                  req.index(Entity.getSearchRepository().getIndexOrAliasName(indexName))
                      .query(prefixQuery)
                      .script(
                          s ->
                              s.source(
                                      ss ->
                                          ss.scriptString(
                                              UPDATE_CLASSIFICATION_TAG_FQN_BY_PREFIX_SCRIPT))
                                  .lang(ScriptLanguage.Painless)
                                  .params(params))
                      .refresh(true));

      LOG.info(
          "Successfully updated classification tag FQN for index: {}, updated: {}",
          indexName,
          updateResponse.updated());

      if (!updateResponse.failures().isEmpty()) {
        String errorMessage =
            updateResponse.failures().stream()
                .map(BulkIndexByScrollFailure::cause)
                .map(ErrorCause::reason)
                .collect(Collectors.joining(", "));
        LOG.error("Failed to update classification tag FQN: {}", errorMessage);
      }

    } catch (Exception e) {
      LOG.error("Error while updating classification tag FQN: {}", e.getMessage(), e);
    }
  }

  @Override
  public void updateDataProductReferences(String oldFqn, String newFqn) {
    if (!isClientAvailable) {
      LOG.error("Elasticsearch client is not available. Cannot update data product references.");
      return;
    }

    try {
      // Query for all documents that have this data product in their dataProducts array
      // Note: dataProducts is not mapped as nested, so we use a simple term query
      Query termQuery =
          Query.of(q -> q.term(t -> t.field("dataProducts.fullyQualifiedName").value(oldFqn)));

      Map<String, JsonData> params =
          Map.of(
              "oldFqn", JsonData.of(oldFqn),
              "newFqn", JsonData.of(newFqn));

      UpdateByQueryResponse updateResponse =
          client.updateByQuery(
              req ->
                  req.index(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
                      .query(termQuery)
                      .script(
                          s ->
                              s.source(ss -> ss.scriptString(UPDATE_DATA_PRODUCT_FQN_SCRIPT))
                                  .lang(ScriptLanguage.Painless)
                                  .params(params))
                      .refresh(true));

      LOG.info(
          "Successfully updated data product references from {} to {}, updated: {}",
          oldFqn,
          newFqn,
          updateResponse.updated());

      if (!updateResponse.failures().isEmpty()) {
        String errorMessage =
            updateResponse.failures().stream()
                .map(BulkIndexByScrollFailure::cause)
                .map(ErrorCause::reason)
                .collect(Collectors.joining(", "));
        LOG.error("Failed to update data product references: {}", errorMessage);
      }

    } catch (Exception e) {
      LOG.error("Error while updating data product references: {}", e.getMessage(), e);
    }
  }

  @Override
  public void updateAssetDomainsForDataProduct(
      String dataProductFqn, List<String> oldDomainFqns, List<EntityReference> newDomains) {
    if (!isClientAvailable) {
      LOG.error("Elasticsearch client is not available. Cannot update asset domains.");
      return;
    }

    try {
      // Query for all documents that have this data product in their dataProducts array
      Query termQuery =
          Query.of(
              q -> q.term(t -> t.field("dataProducts.fullyQualifiedName").value(dataProductFqn)));

      // Convert new domains to a format suitable for the script
      List<Map<String, Object>> newDomainsData = new ArrayList<>();
      for (EntityReference domain : newDomains) {
        Map<String, Object> domainMap = new HashMap<>();
        domainMap.put("id", domain.getId().toString());
        domainMap.put("type", domain.getType());
        domainMap.put("name", domain.getName());
        domainMap.put("fullyQualifiedName", domain.getFullyQualifiedName());
        if (domain.getDisplayName() != null) {
          domainMap.put("displayName", domain.getDisplayName());
        }
        newDomainsData.add(domainMap);
      }

      Map<String, JsonData> params =
          Map.of(
              "oldDomainFqns", JsonData.of(oldDomainFqns),
              "newDomains", JsonData.of(newDomainsData));

      UpdateByQueryResponse updateResponse =
          client.updateByQuery(
              req ->
                  req.index(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
                      .query(termQuery)
                      .script(
                          s ->
                              s.source(
                                      ss ->
                                          ss.scriptString(SearchClient.UPDATE_ASSET_DOMAIN_SCRIPT))
                                  .lang(ScriptLanguage.Painless)
                                  .params(params))
                      .refresh(true));

      LOG.info(
          "Successfully updated asset domains for data product {}: removed {}, added {}, updated {} documents",
          dataProductFqn,
          oldDomainFqns,
          newDomains.stream().map(EntityReference::getFullyQualifiedName).toList(),
          updateResponse.updated());

      if (!updateResponse.failures().isEmpty()) {
        String errorMessage =
            updateResponse.failures().stream()
                .map(BulkIndexByScrollFailure::cause)
                .map(ErrorCause::reason)
                .collect(Collectors.joining(", "));
        LOG.error("Failed to update asset domains: {}", errorMessage);
      }

    } catch (Exception e) {
      LOG.error("Error while updating asset domains for data product: {}", e.getMessage(), e);
    }
  }

  @Override
  public void updateAssetDomainsByIds(
      List<UUID> assetIds, List<String> oldDomainFqns, List<EntityReference> newDomains) {
    if (!isClientAvailable) {
      LOG.error("Elasticsearch client is not available. Cannot update asset domains.");
      return;
    }

    if (assetIds == null || assetIds.isEmpty()) {
      LOG.debug("No asset IDs provided for domain update.");
      return;
    }

    try {
      List<String> idValues = assetIds.stream().map(UUID::toString).toList();
      String indexName = Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
      LOG.info(
          "Updating asset domains by IDs: index={}, idCount={}, ids={}",
          indexName,
          idValues.size(),
          idValues);
      Query idsQuery = Query.of(q -> q.ids(i -> i.values(idValues)));

      List<Map<String, Object>> newDomainsData = new ArrayList<>();
      for (EntityReference domain : newDomains) {
        Map<String, Object> domainMap = new HashMap<>();
        domainMap.put("id", domain.getId().toString());
        domainMap.put("type", domain.getType());
        domainMap.put("name", domain.getName());
        domainMap.put("fullyQualifiedName", domain.getFullyQualifiedName());
        if (domain.getDisplayName() != null) {
          domainMap.put("displayName", domain.getDisplayName());
        }
        newDomainsData.add(domainMap);
      }

      Map<String, JsonData> params =
          Map.of(
              "oldDomainFqns", JsonData.of(oldDomainFqns),
              "newDomains", JsonData.of(newDomainsData));

      UpdateByQueryResponse updateResponse =
          client.updateByQuery(
              req ->
                  req.index(indexName)
                      .query(idsQuery)
                      .script(
                          s ->
                              s.source(
                                      ss ->
                                          ss.scriptString(
                                              SearchClient.UPDATE_ASSET_DOMAIN_FQN_SCRIPT))
                                  .lang(ScriptLanguage.Painless)
                                  .params(params))
                      .refresh(true));

      LOG.info(
          "Updated asset domain FQNs by IDs: requested={}, total={}, updated={}, noops={}, newFqns={}",
          assetIds.size(),
          updateResponse.total(),
          updateResponse.updated(),
          updateResponse.noops(),
          oldDomainFqns,
          newDomains.stream().map(EntityReference::getFullyQualifiedName).toList());

      if (!updateResponse.failures().isEmpty()) {
        String errorMessage =
            updateResponse.failures().stream()
                .map(BulkIndexByScrollFailure::cause)
                .map(ErrorCause::reason)
                .collect(Collectors.joining(", "));
        LOG.error("Failed to update asset domains: {}", errorMessage);
      }

    } catch (Exception e) {
      LOG.error("Error while updating asset domains by IDs: {}", e.getMessage(), e);
    }
  }

  @Override
  public void updateDomainFqnByPrefix(String oldFqn, String newFqn) {
    if (!isClientAvailable) {
      LOG.error("Elasticsearch client is not available. Cannot update domain FQNs.");
      return;
    }

    try {
      String domainIndexName = Entity.getSearchRepository().getIndexOrAliasName(Entity.DOMAIN);
      LOG.info(
          "Updating domain FQNs by prefix: index={}, oldFqn={}, newFqn={}",
          domainIndexName,
          oldFqn,
          newFqn);

      Query prefixQuery = Query.of(q -> q.prefix(p -> p.field("fullyQualifiedName").value(oldFqn)));
      Query entityTypeQuery =
          Query.of(q -> q.term(t -> t.field("entityType.keyword").value("domain")));
      Query combinedQuery = Query.of(q -> q.bool(b -> b.must(prefixQuery, entityTypeQuery)));

      Map<String, JsonData> params =
          Map.of(
              "oldFqn", JsonData.of(oldFqn),
              "newFqn", JsonData.of(newFqn));

      UpdateByQueryResponse updateResponse =
          client.updateByQuery(
              req ->
                  req.index(domainIndexName)
                      .query(combinedQuery)
                      .script(
                          s ->
                              s.source(
                                      ss ->
                                          ss.scriptString(
                                              SearchClient.UPDATE_DOMAIN_FQN_BY_PREFIX_SCRIPT))
                                  .lang(ScriptLanguage.Painless)
                                  .params(params))
                      .refresh(true));

      LOG.info(
          "Updated domain FQNs: total={}, updated={}, noops={}",
          updateResponse.total(),
          updateResponse.updated(),
          updateResponse.noops());

      if (!updateResponse.failures().isEmpty()) {
        String errorMessage =
            updateResponse.failures().stream()
                .map(BulkIndexByScrollFailure::cause)
                .map(ErrorCause::reason)
                .collect(Collectors.joining(", "));
        LOG.error("Failed to update domain FQNs: {}", errorMessage);
      }
    } catch (Exception e) {
      LOG.error("Error while updating domain FQNs by prefix: {}", e.getMessage(), e);
    }
  }

  @Override
  public void updateAssetDomainFqnByPrefix(String oldFqn, String newFqn) {
    if (!isClientAvailable) {
      LOG.error("Elasticsearch client is not available. Cannot update asset domain FQNs.");
      return;
    }

    try {
      String indexName = Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
      LOG.info(
          "Updating asset domain FQNs by prefix in search index: index={}, oldFqn={}, newFqn={}",
          indexName,
          oldFqn,
          newFqn);

      // Use match_all query - the script will filter and update only matching documents
      Query matchAllQuery = Query.of(q -> q.matchAll(m -> m));

      Map<String, JsonData> params =
          Map.of(
              "oldFqn", JsonData.of(oldFqn),
              "newFqn", JsonData.of(newFqn));

      UpdateByQueryResponse updateResponse =
          client.updateByQuery(
              req ->
                  req.index(indexName)
                      .query(matchAllQuery)
                      .script(
                          s ->
                              s.source(
                                      ss ->
                                          ss.scriptString(
                                              SearchClient
                                                  .UPDATE_ASSET_DOMAIN_FQN_BY_PREFIX_SCRIPT))
                                  .lang(ScriptLanguage.Painless)
                                  .params(params))
                      .refresh(true));

      LOG.info(
          "Updated asset domain FQNs in search: total={}, updated={}, noops={}",
          updateResponse.total(),
          updateResponse.updated(),
          updateResponse.noops());

      if (!updateResponse.failures().isEmpty()) {
        String errorMessage =
            updateResponse.failures().stream()
                .map(BulkIndexByScrollFailure::cause)
                .map(ErrorCause::reason)
                .collect(Collectors.joining(", "));
        LOG.error("Failed to update asset domain FQNs: {}", errorMessage);
      }
    } catch (Exception e) {
      LOG.error("Error while updating asset domain FQNs by prefix: {}", e.getMessage(), e);
    }
  }

  @Override
  public void reindexEntities(List<EntityReference> entities) throws IOException {
    if (!isClientAvailable) {
      LOG.error("Elasticsearch client is not available. Cannot reindex entities.");
      return;
    }

    if (entities == null || entities.isEmpty()) {
      LOG.debug("No entities to reindex.");
      return;
    }

    List<BulkOperation> operations = new ArrayList<>();

    for (EntityReference entityRef : entities) {
      EntityInterface entity = Entity.getEntity(entityRef, "*", Include.ALL);
      IndexMapping indexMapping = Entity.getSearchRepository().getIndexMapping(entityRef.getType());
      String indexName = indexMapping.getIndexName(Entity.getSearchRepository().getClusterAlias());

      String doc =
          JsonUtils.pojoToJson(
              Objects.requireNonNull(Entity.buildSearchIndex(entityRef.getType(), entity))
                  .buildSearchIndexDoc());

      operations.add(
          BulkOperation.of(
              b ->
                  b.update(
                      u ->
                          u.index(indexName)
                              .id(entity.getId().toString())
                              .action(a -> a.docAsUpsert(true).doc(toJsonData(doc))))));
    }

    BulkResponse response = client.bulk(b -> b.operations(operations).refresh(Refresh.True));

    if (response.errors()) {
      LOG.error(
          "Bulk reindex encountered errors. Total: {}, Failed: {}",
          entities.size(),
          response.items().stream().filter(item -> item.error() != null).count());

      response.items().stream()
          .filter(item -> item.error() != null)
          .forEach(
              item -> LOG.error("Reindex failed for ID {}: {}", item.id(), item.error().reason()));
    } else {
      LOG.info("Successfully reindexed {} entities in ElasticSearch", entities.size());
    }
  }

  @Override
  public SearchSchemaEntityRelationshipResult getSchemaEntityRelationship(
      String schemaFqn,
      String queryFilter,
      String includeSourceFields,
      int offset,
      int limit,
      int from,
      int size,
      boolean deleted)
      throws IOException {
    SearchSchemaEntityRelationshipResult result = new SearchSchemaEntityRelationshipResult();
    result.setData(
        new SearchEntityRelationshipResult()
            .withNodes(new java.util.TreeMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>()));

    String finalQueryFilter = buildERQueryFilter(schemaFqn, queryFilter);
    String tableIndex =
        Entity.getSearchRepository().getIndexOrAliasName(SearchClient.TABLE_SEARCH_INDEX);
    SearchResponse<JsonData> searchResponse =
        EsUtils.searchEntitiesWithLimitOffset(
            client, tableIndex, finalQueryFilter, offset, limit, deleted);
    int total = 0;
    if (searchResponse == null
        || searchResponse.hits() == null
        || searchResponse.hits().total() == null) {
      result.setPaging(
          new org.openmetadata.schema.type.Paging()
              .withOffset(offset)
              .withLimit(limit)
              .withTotal(total));
      return result;
    }
    for (Hit<JsonData> hit : searchResponse.hits().hits()) {
      String sourceJson = hit.source().toJson().toString();
      Map<String, Object> source = JsonUtils.getMapFromJson(sourceJson);
      Object fqn = source.get(SearchClient.FQN_FIELD);
      if (fqn != null) {
        String fqnString = String.valueOf(fqn);
        SearchEntityRelationshipRequest request =
            new SearchEntityRelationshipRequest()
                .withFqn(fqnString)
                .withUpstreamDepth(0)
                .withDownstreamDepth(1)
                .withQueryFilter(queryFilter)
                .withIncludeDeleted(deleted)
                .withLayerFrom(from)
                .withLayerSize(size)
                .withIncludeSourceFields(
                    SearchUtils.getRequiredEntityRelationshipFields(includeSourceFields));
        SearchEntityRelationshipResult tableER =
            ((SearchClient) Entity.getSearchRepository().getSearchClient())
                .searchEntityRelationship(request);
        Map.Entry<String, NodeInformation> tableNode =
            tableER.getNodes().entrySet().stream()
                .filter(e -> fqn.toString().equals(e.getKey()))
                .findFirst()
                .orElse(null);
        result
            .getData()
            .getNodes()
            .putIfAbsent(fqnString, Objects.requireNonNull(tableNode).getValue());
        result.getData().getUpstreamEdges().putAll(tableER.getUpstreamEdges());
        result.getData().getDownstreamEdges().putAll(tableER.getDownstreamEdges());
      }
    }
    total = (int) searchResponse.hits().total().value();
    result.setPaging(
        new org.openmetadata.schema.type.Paging()
            .withOffset(offset)
            .withLimit(limit)
            .withTotal(total));
    return result;
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
    List<String> fieldsToRemove = new ArrayList<>();

    Map<String, JsonData> result =
        JsonUtils.getMap(map).entrySet().stream()
            .filter(
                entry -> {
                  if (entry.getValue() == null
                      && FIELDS_TO_REMOVE_WHEN_NULL.contains(entry.getKey())) {
                    fieldsToRemove.add(entry.getKey());
                    return false;
                  }
                  return entry.getValue() != null;
                })
            .collect(Collectors.toMap(Map.Entry::getKey, entry -> JsonData.of(entry.getValue())));

    if (!fieldsToRemove.isEmpty()) {
      result.put("fieldsToRemove", JsonData.of(fieldsToRemove));
    }

    return result;
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

  private static String buildERQueryFilter(String schemaFqn, String queryFilter) {
    String schemaFqnWildcardClause =
        String.format(
            "{\"wildcard\":{\"fullyQualifiedName\":\"%s.*\"}}",
            ReindexingUtil.escapeDoubleQuotes(schemaFqn));
    String innerBoolFilter;
    if (!CommonUtil.nullOrEmpty(queryFilter) && !"{}".equals(queryFilter)) {
      innerBoolFilter = String.format("[ %s , %s ]", schemaFqnWildcardClause, queryFilter);
    } else {
      innerBoolFilter = String.format("[ %s ]", schemaFqnWildcardClause);
    }
    return String.format("{\"bool\":{\"must\":%s}}", innerBoolFilter);
  }
}
