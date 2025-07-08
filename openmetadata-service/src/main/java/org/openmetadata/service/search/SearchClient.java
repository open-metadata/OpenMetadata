package org.openmetadata.service.search;

import static org.openmetadata.service.exception.CatalogExceptionMessage.NOT_IMPLEMENTED_METHOD;

import jakarta.json.JsonObject;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.entity.data.QueryCostSearchResult;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.ResultList;
import os.org.opensearch.action.bulk.BulkRequest;
import os.org.opensearch.action.bulk.BulkResponse;
import os.org.opensearch.client.RequestOptions;

public interface SearchClient {
  String UPSTREAM_LINEAGE_FIELD = "upstreamLineage";
  String FQN_FIELD = "fullyQualifiedName";
  ExecutorService asyncExecutor = Executors.newFixedThreadPool(1);
  String UPDATE = "update";

  String ADD = "add";

  String DELETE = "delete";
  String GLOBAL_SEARCH_ALIAS = "all";
  String DATA_ASSET_SEARCH_ALIAS = "dataAsset";
  String GLOSSARY_TERM_SEARCH_INDEX = "glossary_term_search_index";
  String TAG_SEARCH_INDEX = "tag_search_index";
  String DEFAULT_UPDATE_SCRIPT = "for (k in params.keySet()) { ctx._source.put(k, params.get(k)) }";
  String REMOVE_DOMAINS_CHILDREN_SCRIPT = "ctx._source.remove('domain')";

  // Updates field if null or if inherited is true and the parent is the same (matched by previous
  // ID), setting inherited=true on the new object.
  String PROPAGATE_ENTITY_REFERENCE_FIELD_SCRIPT =
      "if (ctx._source.%s == null || (ctx._source.%s != null && ctx._source.%s.inherited == true)) { "
          + "def newObject = params.%s; "
          + "newObject.inherited = true; "
          + "ctx._source.put('%s', newObject); "
          + "}";

  String PROPAGATE_FIELD_SCRIPT = "ctx._source.put('%s', '%s')";

  String PROPAGATE_NESTED_FIELD_SCRIPT = "ctx._source.%s = params.%s";

  String REMOVE_PROPAGATED_ENTITY_REFERENCE_FIELD_SCRIPT =
      "if ((ctx._source.%s != null) && (ctx._source.%s.inherited == true)){ ctx._source.remove('%s');}";
  String REMOVE_PROPAGATED_FIELD_SCRIPT = "ctx._source.remove('%s')";

  // Updates field if inherited is true and the parent is the same (matched by previous ID), setting
  // inherited=true on the new object.
  String UPDATE_PROPAGATED_ENTITY_REFERENCE_FIELD_SCRIPT =
      "if (ctx._source.%s == null || (ctx._source.%s.inherited == true && ctx._source.%s.id == params.entityBeforeUpdate.id)) { "
          + "def newObject = params.%s; "
          + "newObject.inherited = true; "
          + "ctx._source.put('%s', newObject); "
          + "}";
  String SOFT_DELETE_RESTORE_SCRIPT = "ctx._source.put('deleted', '%s')";
  String REMOVE_TAGS_CHILDREN_SCRIPT =
      "for (int i = 0; i < ctx._source.tags.length; i++) { if (ctx._source.tags[i].tagFQN == params.fqn) { ctx._source.tags.remove(i) }}";

  String REMOVE_DATA_PRODUCTS_CHILDREN_SCRIPT =
      "for (int i = 0; i < ctx._source.dataProducts.length; i++) { if (ctx._source.dataProducts[i].fullyQualifiedName == params.fqn) { ctx._source.dataProducts.remove(i) }}";
  String UPDATE_CERTIFICATION_SCRIPT =
      "if (ctx._source.certification != null && ctx._source.certification.tagLabel != null) {ctx._source.certification.tagLabel.style = params.style; ctx._source.certification.tagLabel.description = params.description; ctx._source.certification.tagLabel.tagFQN = params.tagFQN; ctx._source.certification.tagLabel.name = params.name;  }";

  String UPDATE_GLOSSARY_TERM_TAG_FQN_BY_PREFIX_SCRIPT =
      "if (ctx._source.containsKey('tags')) { "
          + "    for (int i = 0; i < ctx._source.tags.size(); i++) { "
          + "        if (ctx._source.tags[i].containsKey('tagFQN') && "
          + "            ctx._source.tags[i].containsKey('source') && "
          + "            ctx._source.tags[i].source == 'Glossary' && "
          + "            ctx._source.tags[i].tagFQN.startsWith(params.oldParentFQN)) { "
          + "            ctx._source.tags[i].tagFQN = ctx._source.tags[i].tagFQN.replace(params.oldParentFQN, params.newParentFQN); "
          + "        } "
          + "    } "
          + "}";

  String REMOVE_LINEAGE_SCRIPT =
      "for (int i = 0; i < ctx._source.upstreamLineage.length; i++) { if (ctx._source.upstreamLineage[i].docUniqueId == '%s') { ctx._source.upstreamLineage.remove(i) }}";

  String REMOVE_ENTITY_RELATIONSHIP =
      "for (int i = 0; i < ctx._source.entityRelationship.length; i++) { if (ctx._source.entityRelationship[i].docId == '%s') { ctx._source.entityRelationship.remove(i) }}";

  String ADD_UPDATE_LINEAGE =
      "boolean docIdExists = false; for (int i = 0; i < ctx._source.upstreamLineage.size(); i++) { if (ctx._source.upstreamLineage[i].docUniqueId.equalsIgnoreCase(params.lineageData.docUniqueId)) { ctx._source.upstreamLineage[i] = params.lineageData; docIdExists = true; break;}}if (!docIdExists) {ctx._source.upstreamLineage.add(params.lineageData);}";

  // The script is used for updating the entityRelationship attribute of the entity in ES
  // It checks if any duplicate entry is present based on the docId and updates only if it is not
  // present
  String ADD_UPDATE_ENTITY_RELATIONSHIP =
      "boolean docIdExists = false; for (int i = 0; i < ctx._source.entityRelationship.size(); i++) { if (ctx._source.entityRelationship[i].docId.equalsIgnoreCase(params.entityRelationshipData.docId)) { ctx._source.entityRelationship[i] = params.entityRelationshipData; docIdExists = true; break;}}if (!docIdExists) {ctx._source.entityRelationship.add(params.entityRelationshipData);}";
  String UPDATE_ADDED_DELETE_GLOSSARY_TAGS =
      "if (ctx._source.tags != null) { for (int i = ctx._source.tags.size() - 1; i >= 0; i--) { if (params.tagDeleted != null) { for (int j = 0; j < params.tagDeleted.size(); j++) { if (ctx._source.tags[i].tagFQN.equalsIgnoreCase(params.tagDeleted[j].tagFQN)) { ctx._source.tags.remove(i); } } } } } if (ctx._source.tags == null) { ctx._source.tags = []; } if (params.tagAdded != null) { ctx._source.tags.addAll(params.tagAdded); } ctx._source.tags = ctx._source.tags .stream() .distinct() .sorted((o1, o2) -> o1.tagFQN.compareTo(o2.tagFQN)) .collect(Collectors.toList());";
  String REMOVE_TEST_SUITE_CHILDREN_SCRIPT =
      "for (int i = 0; i < ctx._source.testSuites.length; i++) { if (ctx._source.testSuites[i].id == '%s') { ctx._source.testSuites.remove(i) }}";

  String ADD_OWNERS_SCRIPT =
      "if (ctx._source.owners == null || ctx._source.owners.isEmpty() || "
          + "(ctx._source.owners.size() > 0 && ctx._source.owners[0] != null && ctx._source.owners[0].inherited == true)) { "
          + "ctx._source.owners = params.updatedOwners; "
          + "}";

  String PROPAGATE_TEST_SUITES_SCRIPT = "ctx._source.testSuites = params.testSuites";

  String REMOVE_OWNERS_SCRIPT =
      "if (ctx._source.owners != null) { "
          + "ctx._source.owners.removeIf(owner -> owner.inherited == true); "
          + "ctx._source.owners.addAll(params.deletedOwners); "
          + "}";

  String UPDATE_TAGS_FIELD_SCRIPT =
      "if (ctx._source.tags != null) { "
          + "for (int i = 0; i < ctx._source.tags.size(); i++) { "
          + "if (ctx._source.tags[i].tagFQN == params.tagFQN) { "
          + "for (String field : params.updates.keySet()) { "
          + "if (field != null && params.updates[field] != null) { "
          + "ctx._source.tags[i][field] = params.updates[field]; "
          + "} "
          + "} "
          + "} "
          + "} "
          + "}";

  String NOT_IMPLEMENTED_ERROR_TYPE = "NOT_IMPLEMENTED";

  String ENTITY_RELATIONSHIP_DIRECTION_ENTITY = "entityRelationship.entity.fqnHash.keyword";

  String ENTITY_RELATIONSHIP_DIRECTION_RELATED_ENTITY =
      "entityRelationship.relatedEntity.fqnHash.keyword";

  Set<String> FIELDS_TO_REMOVE_ENTITY_RELATIONSHIP =
      Set.of(
          "suggest",
          "service_suggest",
          "column_suggest",
          "schema_suggest",
          "database_suggest",
          "lifeCycle",
          "fqnParts",
          "chart_suggest",
          "field_suggest",
          "lineage",
          "entityRelationship",
          "customMetrics",
          "descriptionStatus",
          "columnNames",
          "totalVotes",
          "usageSummary",
          "dataProducts",
          "tags",
          "followers",
          "domains",
          "votes",
          "tier",
          "changeDescription");

  boolean isClientAvailable();

  ElasticSearchConfiguration.SearchType getSearchType();

  boolean indexExists(String indexName);

  void createIndex(IndexMapping indexMapping, String indexMappingContent);

  void updateIndex(IndexMapping indexMapping, String indexMappingContent);

  void deleteIndex(IndexMapping indexMapping);

  void createAliases(IndexMapping indexMapping);

  void addIndexAlias(IndexMapping indexMapping, String... aliasName);

  Response previewSearch(
      SearchRequest request, SubjectContext subjectContext, SearchSettings searchSettings)
      throws IOException;

  Response search(SearchRequest request, SubjectContext subjectContext) throws IOException;

  Response searchWithNLQ(SearchRequest request, SubjectContext subjectContext) throws IOException;

  Response getDocByID(String indexName, String entityId) throws IOException;

  default ExecutorService getAsyncExecutor() {
    return asyncExecutor;
  }

  SearchResultListMapper listWithOffset(
      String filter,
      int limit,
      int offset,
      String index,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString)
      throws IOException;

  SearchResultListMapper listWithDeepPagination(
      String index,
      String query,
      String filter,
      String[] fields,
      SearchSortFilter searchSortFilter,
      int size,
      Object[] searchAfter)
      throws IOException;

  Response searchBySourceUrl(String sourceUrl) throws IOException;

  SearchLineageResult searchLineage(SearchLineageRequest lineageRequest) throws IOException;

  SearchLineageResult searchLineageWithDirection(SearchLineageRequest lineageRequest)
      throws IOException;

  SearchLineageResult searchPlatformLineage(String index, String queryFilter, boolean deleted)
      throws IOException;

  Response searchEntityRelationship(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException;

  Response searchDataQualityLineage(
      String fqn, int upstreamDepth, String queryFilter, boolean deleted) throws IOException;

  Response searchSchemaEntityRelationship(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException;

  /*
   Used for listing knowledge page hierarchy for a given parent and page type, used in Elastic/Open SearchClientExtension
  */
  @SuppressWarnings("unused")
  default ResultList listPageHierarchy(String parent, String pageType, int offset, int limit) {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  /*
   Used for listing knowledge page hierarchy for a given active Page and page type, used in Elastic/Open SearchClientExtension
  */
  @SuppressWarnings("unused")
  default ResultList listPageHierarchyForActivePage(
      String activeFqn, String pageType, int offset, int limit) {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  @SuppressWarnings("unused")
  default ResultList searchPageHierarchy(String query, String pageType, int offset, int limit) {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  Response searchByField(String fieldName, String fieldValue, String index, Boolean deleted)
      throws IOException;

  Response aggregate(AggregationRequest request) throws IOException;

  JsonObject aggregate(
      String query, String index, SearchAggregation searchAggregation, String filters)
      throws IOException;

  DataQualityReport genericAggregation(
      String query, String index, SearchAggregation aggregationMetadata) throws IOException;

  void createEntity(String indexName, String docId, String doc);

  void createEntities(String indexName, List<Map<String, String>> docsAndIds) throws IOException;

  void createTimeSeriesEntity(String indexName, String docId, String doc);

  void updateEntity(String indexName, String docId, Map<String, Object> doc, String scriptTxt);

  /* This function takes in Entity Reference, Search for occurances of those  entity across ES, and perform an update for that with reindexing the data from the database to ES */
  void reindexAcrossIndices(String matchingKey, EntityReference sourceRef);

  void deleteByScript(String indexName, String scriptTxt, Map<String, Object> params);

  void deleteEntity(String indexName, String docId);

  void deleteEntityByFields(List<String> indexName, List<Pair<String, String>> fieldAndValue);

  void deleteEntityByFQNPrefix(String indexName, String fqnPrefix);

  void softDeleteOrRestoreEntity(String indexName, String docId, String scriptTxt);

  void softDeleteOrRestoreChildren(
      List<String> indexName, String scriptTxt, List<Pair<String, String>> fieldAndValue);

  void updateChildren(
      String indexName,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates);

  void updateByFqnPrefix(
      String indexName, String oldParentFQN, String newParentFQN, String prefixFieldCondition);

  void updateChildren(
      List<String> indexName,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates);

  void updateLineage(
      String indexName, Pair<String, String> fieldAndValue, EsLineageData lineageData);

  void updateEntityRelationship(
      String indexName,
      Pair<String, String> fieldAndValue,
      Map<String, Object> entityRelationshipData);

  void reindexWithEntityIds(
      List<String> sourceIndices,
      String destinationIndex,
      String pipelineName,
      String entityType,
      List<UUID> entityIds);

  Response listDataInsightChartResult(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      DataInsightChartResult.DataInsightChartType dataInsightChartName,
      Integer size,
      Integer from,
      String queryFilter,
      String dataReportIndex)
      throws IOException;

  // TODO: Think if it makes sense to have this or maybe a specific deleteByRange
  void deleteByQuery(String index, String query);

  void deleteByRangeAndTerm(String index, String rangeQueryStr, String termKey, String termValue);

  default BulkResponse bulk(BulkRequest data, RequestOptions options) throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  default es.org.elasticsearch.action.bulk.BulkResponse bulk(
      es.org.elasticsearch.action.bulk.BulkRequest data,
      es.org.elasticsearch.client.RequestOptions options)
      throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  void close();

  default DataInsightCustomChartResultList buildDIChart(
      DataInsightCustomChart diChart, long start, long end) throws IOException {
    return null;
  }

  default List<Map<String, String>> fetchDIChartFields() throws IOException {
    return null;
  }

  Object getLowLevelClient();

  Object getClient();

  SearchHealthStatus getSearchHealthStatus() throws IOException;

  QueryCostSearchResult getQueryCostRecords(String serviceName) throws IOException;

  /**
   * Get a list of data stream names that match the given prefix.
   *
   * @param prefix The prefix to match data stream names against
   * @return List of data stream names that match the prefix
   * @throws IOException if there is an error communicating with the search engine
   */
  default List<String> getDataStreams(String prefix) throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  /**
   * Delete data streams that match the given name or pattern.
   *
   * @param dataStreamName The name or pattern of data streams to delete
   * @throws IOException if there is an error communicating with the search engine
   */
  default void deleteDataStream(String dataStreamName) throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  /**
   * Delete an Index Lifecycle Management (ILM) policy.
   *
   * @param policyName The name of the ILM policy to delete
   * @throws IOException if there is an error communicating with the search engine
   */
  default void deleteILMPolicy(String policyName) throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  /**
   * Delete an index template.
   *
   * @param templateName The name of the index template to delete
   * @throws IOException if there is an error communicating with the search engine
   */
  default void deleteIndexTemplate(String templateName) throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  /**
   * Delete a component template.
   *
   * @param componentTemplateName The name of the component template to delete
   * @throws IOException if there is an error communicating with the search engine
   */
  default void deleteComponentTemplate(String componentTemplateName) throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  /**
   * Detach an ILM policy from indexes matching the given pattern.
   *
   * @param indexPattern The pattern of indexes to detach the ILM policy from
   * @throws IOException if there is an error communicating with the search engine
   */
  default void dettachIlmPolicyFromIndexes(String indexPattern) throws IOException {
    throw new CustomExceptionMessage(
        Response.Status.NOT_IMPLEMENTED, NOT_IMPLEMENTED_ERROR_TYPE, NOT_IMPLEMENTED_METHOD);
  }

  /**
   * Removes ILM policy from a component template while preserving all other settings.
   * This is only implemented for Elasticsearch as OpenSearch handles ILM differently.
   *
   * @param componentTemplateName The name of the component template to update
   * @throws IOException if there is an error communicating with the search engine
   */
  default void removeILMFromComponentTemplate(String componentTemplateName) throws IOException {
    // Default implementation does nothing as this is only needed for Elasticsearch
  }

  void updateGlossaryTermByFqnPrefix(
      String indexName, String oldFqnPrefix, String newFqnPrefix, String prefixFieldCondition);
}
