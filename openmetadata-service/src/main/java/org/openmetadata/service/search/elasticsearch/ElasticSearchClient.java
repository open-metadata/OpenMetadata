package org.openmetadata.service.search.elasticsearch;

import static javax.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.search.EntityBuilderConstant.COLUMNS_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.DATA_MODEL_COLUMNS_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.DOMAIN_DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.ES_MESSAGE_SCHEMA_FIELD_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.ES_TAG_FQN_FIELD;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_COLUMN_NAMES;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.MAX_AGGREGATE_SIZE;
import static org.openmetadata.service.search.EntityBuilderConstant.MAX_RESULT_HITS;
import static org.openmetadata.service.search.EntityBuilderConstant.OWNER_DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.POST_TAG;
import static org.openmetadata.service.search.EntityBuilderConstant.PRE_TAG;
import static org.openmetadata.service.search.EntityBuilderConstant.SCHEMA_FIELD_NAMES;
import static org.openmetadata.service.search.EntityBuilderConstant.UNIFIED;
import static org.openmetadata.service.search.UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH;

import com.fasterxml.jackson.databind.JsonNode;
import es.org.elasticsearch.ElasticsearchStatusException;
import es.org.elasticsearch.action.ActionListener;
import es.org.elasticsearch.action.admin.indices.alias.IndicesAliasesRequest;
import es.org.elasticsearch.action.admin.indices.delete.DeleteIndexRequest;
import es.org.elasticsearch.action.bulk.BulkItemResponse;
import es.org.elasticsearch.action.bulk.BulkRequest;
import es.org.elasticsearch.action.bulk.BulkResponse;
import es.org.elasticsearch.action.delete.DeleteRequest;
import es.org.elasticsearch.action.delete.DeleteResponse;
import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.action.support.WriteRequest;
import es.org.elasticsearch.action.support.master.AcknowledgedResponse;
import es.org.elasticsearch.action.update.UpdateRequest;
import es.org.elasticsearch.action.update.UpdateResponse;
import es.org.elasticsearch.client.RequestOptions;
import es.org.elasticsearch.client.RestClient;
import es.org.elasticsearch.client.RestClientBuilder;
import es.org.elasticsearch.client.RestHighLevelClient;
import es.org.elasticsearch.client.RestHighLevelClientBuilder;
import es.org.elasticsearch.client.indices.CreateIndexRequest;
import es.org.elasticsearch.client.indices.CreateIndexResponse;
import es.org.elasticsearch.client.indices.GetIndexRequest;
import es.org.elasticsearch.client.indices.PutMappingRequest;
import es.org.elasticsearch.common.lucene.search.function.CombineFunction;
import es.org.elasticsearch.common.settings.Settings;
import es.org.elasticsearch.common.unit.Fuzziness;
import es.org.elasticsearch.common.xcontent.LoggingDeprecationHandler;
import es.org.elasticsearch.core.TimeValue;
import es.org.elasticsearch.index.query.BoolQueryBuilder;
import es.org.elasticsearch.index.query.MatchQueryBuilder;
import es.org.elasticsearch.index.query.MultiMatchQueryBuilder;
import es.org.elasticsearch.index.query.Operator;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import es.org.elasticsearch.index.query.QueryStringQueryBuilder;
import es.org.elasticsearch.index.query.RangeQueryBuilder;
import es.org.elasticsearch.index.query.ScriptQueryBuilder;
import es.org.elasticsearch.index.query.TermQueryBuilder;
import es.org.elasticsearch.index.query.functionscore.FunctionScoreQueryBuilder;
import es.org.elasticsearch.index.query.functionscore.ScoreFunctionBuilders;
import es.org.elasticsearch.index.query.functionscore.ScriptScoreFunctionBuilder;
import es.org.elasticsearch.index.reindex.BulkByScrollResponse;
import es.org.elasticsearch.index.reindex.DeleteByQueryRequest;
import es.org.elasticsearch.index.reindex.UpdateByQueryRequest;
import es.org.elasticsearch.rest.RestStatus;
import es.org.elasticsearch.script.Script;
import es.org.elasticsearch.script.ScriptType;
import es.org.elasticsearch.search.SearchModule;
import es.org.elasticsearch.search.aggregations.AggregationBuilder;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.BucketOrder;
import es.org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramAggregationBuilder;
import es.org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramInterval;
import es.org.elasticsearch.search.aggregations.bucket.terms.IncludeExclude;
import es.org.elasticsearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import es.org.elasticsearch.search.aggregations.metrics.MaxAggregationBuilder;
import es.org.elasticsearch.search.aggregations.metrics.SumAggregationBuilder;
import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import es.org.elasticsearch.search.fetch.subphase.FetchSourceContext;
import es.org.elasticsearch.search.fetch.subphase.highlight.HighlightBuilder;
import es.org.elasticsearch.search.sort.SortOrder;
import es.org.elasticsearch.search.suggest.Suggest;
import es.org.elasticsearch.search.suggest.SuggestBuilder;
import es.org.elasticsearch.search.suggest.SuggestBuilders;
import es.org.elasticsearch.search.suggest.completion.CompletionSuggestionBuilder;
import es.org.elasticsearch.search.suggest.completion.context.CategoryQueryContext;
import es.org.elasticsearch.xcontent.NamedXContentRegistry;
import es.org.elasticsearch.xcontent.XContentParser;
import es.org.elasticsearch.xcontent.XContentType;
import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import javax.json.JsonObject;
import javax.net.ssl.SSLContext;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.http.HttpHost;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.DataInsightInterface;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.sdk.exception.SearchIndexNotFoundException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;
import org.openmetadata.service.jdbi3.DataInsightChartRepository;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRequest;
import org.openmetadata.service.search.UpdateSearchEventsConstant;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchAggregatedUnusedAssetsCountAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchAggregatedUnusedAssetsSizeAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchAggregatedUsedvsUnusedAssetsCountAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchAggregatedUsedvsUnusedAssetsSizeAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchDailyActiveUsersAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchEntitiesDescriptionAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchEntitiesOwnerAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchMostActiveUsersAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchMostViewedEntitiesAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchPageViewsByEntitiesAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchServicesDescriptionAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchServicesOwnerAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchTotalEntitiesAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchTotalEntitiesByTierAggregator;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchUnusedAssetsAggregator;
import org.openmetadata.service.search.indexes.ContainerIndex;
import org.openmetadata.service.search.indexes.DashboardDataModelIndex;
import org.openmetadata.service.search.indexes.DashboardIndex;
import org.openmetadata.service.search.indexes.DataProductIndex;
import org.openmetadata.service.search.indexes.DomainIndex;
import org.openmetadata.service.search.indexes.GlossaryTermIndex;
import org.openmetadata.service.search.indexes.MlModelIndex;
import org.openmetadata.service.search.indexes.PipelineIndex;
import org.openmetadata.service.search.indexes.QueryIndex;
import org.openmetadata.service.search.indexes.SearchEntityIndex;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.indexes.StoredProcedureIndex;
import org.openmetadata.service.search.indexes.TableIndex;
import org.openmetadata.service.search.indexes.TagIndex;
import org.openmetadata.service.search.indexes.TestCaseIndex;
import org.openmetadata.service.search.indexes.TestCaseResolutionStatusIndex;
import org.openmetadata.service.search.indexes.TopicIndex;
import org.openmetadata.service.search.indexes.UserIndex;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
// Not tagged with Repository annotation as it is programmatically initialized
public class ElasticSearchClient implements SearchClient {

  @SuppressWarnings("deprecated")
  private final RestHighLevelClient client;

  private final boolean isClientAvailable;
  private static final NamedXContentRegistry xContentRegistry;

  private final String clusterAlias;

  private static final Set<String> FIELDS_TO_REMOVE =
      Set.of(
          "suggest",
          "service_suggest",
          "column_suggest",
          "schema_suggest",
          "database_suggest",
          "lifeCycle",
          "fqnParts",
          "chart_suggest",
          "field_suggest");

  static {
    SearchModule searchModule = new SearchModule(Settings.EMPTY, false, List.of());
    xContentRegistry = new NamedXContentRegistry(searchModule.getNamedXContents());
  }

  public ElasticSearchClient(ElasticSearchConfiguration config) {
    client = createElasticSearchClient(config);
    clusterAlias = config != null ? config.getClusterAlias() : "";
    isClientAvailable = client != null;
  }

  @Override
  public boolean isClientAvailable() {
    return isClientAvailable;
  }

  @Override
  public boolean indexExists(String indexName) {
    try {
      GetIndexRequest gRequest = new GetIndexRequest(indexName);
      gRequest.local(false);
      return client.indices().exists(gRequest, RequestOptions.DEFAULT);
    } catch (Exception e) {
      LOG.error(String.format("Failed to check if index %s exists due to", indexName), e);
      return false;
    }
  }

  @Override
  public void createIndex(IndexMapping indexMapping, String indexMappingContent) {
    if (Boolean.TRUE.equals(isClientAvailable)) {
      try {
        CreateIndexRequest request =
            new CreateIndexRequest(indexMapping.getIndexName(clusterAlias));
        request.source(indexMappingContent, XContentType.JSON);
        CreateIndexResponse createIndexResponse =
            client.indices().create(request, RequestOptions.DEFAULT);
        LOG.debug(
            "{} Created {}",
            indexMapping.getIndexName(clusterAlias),
            createIndexResponse.isAcknowledged());
        // creating alias for indexes
        createAliases(indexMapping);
      } catch (Exception e) {
        LOG.error(
            String.format(
                "Failed to create index for %s due to", indexMapping.getIndexName(clusterAlias)),
            e);
      }
    } else {
      LOG.error(
          "Failed to create Elastic Search index as client is not property configured, Please check your OpenMetadata configuration");
    }
  }

  @Override
  public void createAliases(IndexMapping indexMapping) {
    try {
      Set<String> aliases = new HashSet<>(indexMapping.getParentAliases(clusterAlias));
      aliases.add(indexMapping.getAlias(clusterAlias));
      IndicesAliasesRequest.AliasActions aliasAction =
          IndicesAliasesRequest.AliasActions.add()
              .index(indexMapping.getIndexName(clusterAlias))
              .aliases(aliases.toArray(new String[0]));
      IndicesAliasesRequest aliasesRequest = new IndicesAliasesRequest();
      aliasesRequest.addAliasAction(aliasAction);
      client.indices().updateAliases(aliasesRequest, RequestOptions.DEFAULT);
    } catch (Exception e) {
      LOG.error(
          String.format(
              "Failed to create alias for %s due to", indexMapping.getAlias(clusterAlias)),
          e);
    }
  }

  @Override
  public void updateIndex(IndexMapping indexMapping, String indexMappingContent) {
    try {
      PutMappingRequest request = new PutMappingRequest(indexMapping.getIndexName(clusterAlias));
      JsonNode readProperties = JsonUtils.readTree(indexMappingContent).get("mappings");
      request.source(JsonUtils.getMap(readProperties));
      AcknowledgedResponse putMappingResponse =
          client.indices().putMapping(request, RequestOptions.DEFAULT);
      LOG.debug(
          "{} Updated {}", indexMapping.getIndexMappingFile(), putMappingResponse.isAcknowledged());
    } catch (Exception e) {
      LOG.warn(
          String.format(
              "Failed to Update Elastic Search index %s", indexMapping.getIndexName(clusterAlias)));
    }
  }

  @Override
  public void deleteIndex(IndexMapping indexMapping) {
    try {
      DeleteIndexRequest request = new DeleteIndexRequest(indexMapping.getIndexName(clusterAlias));
      AcknowledgedResponse deleteIndexResponse =
          client.indices().delete(request, RequestOptions.DEFAULT);
      LOG.debug(
          "{} Deleted {}",
          indexMapping.getIndexName(clusterAlias),
          deleteIndexResponse.isAcknowledged());
    } catch (IOException e) {
      LOG.error("Failed to delete Elastic Search indexes due to", e);
    }
  }

  @Override
  public Response search(SearchRequest request) throws IOException {
    SearchSourceBuilder searchSourceBuilder =
        switch (request.getIndex()) {
          case "topic_search_index", "topic" -> buildTopicSearchBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
          case "dashboard_search_index", "dashboard" -> buildDashboardSearchBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
          case "pipeline_search_index", "pipeline" -> buildPipelineSearchBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
          case "mlmodel_search_index", "mlmodel" -> buildMlModelSearchBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
          case "table_search_index", "table" -> buildTableSearchBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
          case "database_schema_search_index",
              "databaseSchema",
              "database_search_index",
              "database" -> buildGenericDataAssetSearchBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
          case "user_search_index",
              "user",
              "team_search_index",
              "team" -> buildUserOrTeamSearchBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
          case "glossary_term_search_index", "glossaryTerm" -> buildGlossaryTermSearchBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
          case "tag_search_index", "tag" -> buildTagSearchBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
          case "container_search_index", "container" -> buildContainerSearchBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
          case "query_search_index", "query" -> buildQuerySearchBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
          case "test_case_search_index",
              "testCase",
              "test_suite_search_index",
              "testSuite" -> buildTestCaseSearch(
              request.getQuery(), request.getFrom(), request.getSize());
          case "stored_procedure_search_index", "storedProcedure" -> buildStoredProcedureSearch(
              request.getQuery(), request.getFrom(), request.getSize());
          case "dashboard_data_model_search_index",
              "dashboardDataModel" -> buildDashboardDataModelsSearch(
              request.getQuery(), request.getFrom(), request.getSize());
          case "search_entity_search_index", "searchIndex" -> buildSearchEntitySearch(
              request.getQuery(), request.getFrom(), request.getSize());
          case "domain_search_index", "domain" -> buildDomainsSearch(
              request.getQuery(), request.getFrom(), request.getSize());
          case "raw_cost_analysis_report_data_index",
              "aggregated_cost_analysis_report_data_index" -> buildCostAnalysisReportDataSearch(
              request.getQuery(), request.getFrom(), request.getSize());
          case "data_product_search_index" -> buildDataProductSearch(
              request.getQuery(), request.getFrom(), request.getSize());
          case "test_case_resolution_status_search_index" -> buildTestCaseResolutionStatusSearch(
              request.getQuery(), request.getFrom(), request.getSize());
          case "mlmodel_service_search_index",
              "database_service_search_index",
              "messaging_service_index",
              "dashboard_service_index",
              "pipeline_service_index",
              "storage_service_index",
              "search_service_index",
              "metadata_service_index" -> buildServiceSearchBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
          case "all", "dataAsset" -> buildSearchAcrossIndexesBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
          default -> buildAggregateSearchBuilder(
              request.getQuery(), request.getFrom(), request.getSize());
        };
    if (!nullOrEmpty(request.getQueryFilter()) && !request.getQueryFilter().equals("{}")) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(
                    xContentRegistry, LoggingDeprecationHandler.INSTANCE, request.getQueryFilter());
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        BoolQueryBuilder newQuery =
            QueryBuilders.boolQuery().must(searchSourceBuilder.query()).filter(filter);
        searchSourceBuilder.query(newQuery);
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }

    if (!nullOrEmpty(request.getPostFilter())) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(
                    xContentRegistry, LoggingDeprecationHandler.INSTANCE, request.getPostFilter());
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        searchSourceBuilder.postFilter(filter);
      } catch (Exception ex) {
        LOG.warn("Error parsing post_filter from query parameters, ignoring filter", ex);
      }
    }

    /* For backward-compatibility we continue supporting the deleted argument, this should be removed in future versions */
    if (request.getIndex().equalsIgnoreCase("all")
        || request.getIndex().equalsIgnoreCase("dataAsset")) {
      BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery();
      boolQueryBuilder.should(
          QueryBuilders.boolQuery()
              .must(searchSourceBuilder.query())
              .must(QueryBuilders.existsQuery("deleted"))
              .must(QueryBuilders.termQuery("deleted", request.deleted())));
      boolQueryBuilder.should(
          QueryBuilders.boolQuery()
              .must(searchSourceBuilder.query())
              .mustNot(QueryBuilders.existsQuery("deleted")));
      searchSourceBuilder.query(boolQueryBuilder);
    } else if (request.getIndex().equalsIgnoreCase("domain_search_index")
        || request.getIndex().equalsIgnoreCase("data_product_search_index")
        || request.getIndex().equalsIgnoreCase("query_search_index")
        || request.getIndex().equalsIgnoreCase("knowledge_page_search_index")
        || request.getIndex().equalsIgnoreCase("raw_cost_analysis_report_data_index")
        || request.getIndex().equalsIgnoreCase("aggregated_cost_analysis_report_data_index")) {
      searchSourceBuilder.query(QueryBuilders.boolQuery().must(searchSourceBuilder.query()));
    } else {
      searchSourceBuilder.query(
          QueryBuilders.boolQuery()
              .must(searchSourceBuilder.query())
              .must(QueryBuilders.termQuery("deleted", request.deleted())));
    }

    if (!nullOrEmpty(request.getSortFieldParam())) {
      searchSourceBuilder.sort(
          request.getSortFieldParam(), SortOrder.fromString(request.getSortOrder()));
    }

    if (request.getIndex().equalsIgnoreCase("glossary_term_search_index")) {
      searchSourceBuilder.query(
          QueryBuilders.boolQuery()
              .must(searchSourceBuilder.query())
              .must(QueryBuilders.matchQuery("status", "Approved")));
    }

    /* for performance reasons ElasticSearch doesn't provide accurate hits
    if we enable trackTotalHits parameter it will try to match every result, count and return hits
    however in most cases for search results an approximate value is good enough.
    we are displaying total entity counts in landing page and explore page where we need the total count
    https://github.com/elastic/elasticsearch/issues/33028 */
    searchSourceBuilder.fetchSource(
        new FetchSourceContext(
            request.fetchSource(),
            request.getIncludeSourceFields().toArray(String[]::new),
            new String[] {}));

    if (request.trackTotalHits()) {
      searchSourceBuilder.trackTotalHits(true);
    } else {
      searchSourceBuilder.trackTotalHitsUpTo(MAX_RESULT_HITS);
    }

    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    try {
      String response =
          client
              .search(
                  new es.org.elasticsearch.action.search.SearchRequest(request.getIndex())
                      .source(searchSourceBuilder),
                  RequestOptions.DEFAULT)
              .toString();
      return Response.status(OK).entity(response).build();
    } catch (ElasticsearchStatusException e) {
      if (e.status() == RestStatus.NOT_FOUND) {
        throw new SearchIndexNotFoundException(
            String.format("Failed to to find index %s", request.getIndex()));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getMessage()));
      }
    }
  }

  @Override
  public Response searchLineage(
      String fqn,
      int upstreamDepth,
      int downstreamDepth,
      String queryFilter,
      boolean deleted,
      String entityType)
      throws IOException {
    Map<String, Object> responseMap = new HashMap<>();
    Set<Map<String, Object>> edges = new HashSet<>();
    Set<Map<String, Object>> nodes = new HashSet<>();
    if (entityType.equalsIgnoreCase(Entity.PIPELINE)
        || entityType.equalsIgnoreCase(Entity.STORED_PROCEDURE)) {
      return searchPipelineLineage(
          fqn, upstreamDepth, downstreamDepth, queryFilter, deleted, responseMap);
    }
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(GLOBAL_SEARCH_ALIAS);
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery().must(QueryBuilders.termQuery("fullyQualifiedName", fqn)));
    searchRequest.source(searchSourceBuilder.size(1000));
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    for (var hit : searchResponse.getHits().getHits()) {
      HashMap<String, Object> tempMap = new HashMap<>(JsonUtils.getMap(hit.getSourceAsMap()));
      tempMap.keySet().removeAll(FIELDS_TO_REMOVE);
      responseMap.put("entity", tempMap);
    }
    getLineage(
        fqn, downstreamDepth, edges, nodes, queryFilter, "lineage.fromEntity.fqn.keyword", deleted);
    getLineage(
        fqn, upstreamDepth, edges, nodes, queryFilter, "lineage.toEntity.fqn.keyword", deleted);
    responseMap.put("edges", edges);
    responseMap.put("nodes", nodes);
    return Response.status(OK).entity(responseMap).build();
  }

  private void getLineage(
      String fqn,
      int depth,
      Set<Map<String, Object>> edges,
      Set<Map<String, Object>> nodes,
      String queryFilter,
      String direction,
      boolean deleted)
      throws IOException {
    if (depth <= 0) {
      return;
    }
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(GLOBAL_SEARCH_ALIAS);
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery().must(QueryBuilders.termQuery(direction, fqn)));
    if (CommonUtil.nullOrEmpty(deleted)) {
      searchSourceBuilder.query(
          QueryBuilders.boolQuery()
              .must(QueryBuilders.termQuery(direction, fqn))
              .must(QueryBuilders.termQuery("deleted", deleted)));
    }
    if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(xContentRegistry, LoggingDeprecationHandler.INSTANCE, queryFilter);
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        BoolQueryBuilder newQuery =
            QueryBuilders.boolQuery().must(searchSourceBuilder.query()).filter(filter);
        searchSourceBuilder.query(newQuery);
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }
    searchRequest.source(searchSourceBuilder.size(1000));
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    for (var hit : searchResponse.getHits().getHits()) {
      List<Map<String, Object>> lineage =
          (List<Map<String, Object>>) hit.getSourceAsMap().get("lineage");
      HashMap<String, Object> tempMap = new HashMap<>(JsonUtils.getMap(hit.getSourceAsMap()));
      tempMap.keySet().removeAll(FIELDS_TO_REMOVE);
      nodes.add(tempMap);
      for (Map<String, Object> lin : lineage) {
        HashMap<String, String> fromEntity = (HashMap<String, String>) lin.get("fromEntity");
        HashMap<String, String> toEntity = (HashMap<String, String>) lin.get("toEntity");
        if (direction.equalsIgnoreCase("lineage.fromEntity.fqn.keyword")) {
          if (!edges.contains(lin) && fromEntity.get("fqn").equals(fqn)) {
            edges.add(lin);
            getLineage(
                toEntity.get("fqn"), depth - 1, edges, nodes, queryFilter, direction, deleted);
          }
        } else {
          if (!edges.contains(lin) && toEntity.get("fqn").equals(fqn)) {
            edges.add(lin);
            getLineage(
                fromEntity.get("fqn"), depth - 1, edges, nodes, queryFilter, direction, deleted);
          }
        }
      }
    }
  }

  private Response searchPipelineLineage(
      String fqn,
      int upstreamDepth,
      int downstreamDepth,
      String queryFilter,
      boolean deleted,
      Map<String, Object> responseMap)
      throws IOException {
    Set<Map<String, Object>> edges = new HashSet<>();
    Set<Map<String, Object>> nodes = new HashSet<>();
    responseMap.put("entity", null);
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(GLOBAL_SEARCH_ALIAS);
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery()
            .must(QueryBuilders.termQuery("lineage.pipeline.fullyQualifiedName.keyword", fqn)));
    if (CommonUtil.nullOrEmpty(deleted)) {
      searchSourceBuilder.query(
          QueryBuilders.boolQuery()
              .must(QueryBuilders.termQuery("lineage.pipeline.fullyQualifiedName.keyword", fqn))
              .must(QueryBuilders.termQuery("deleted", deleted)));
    }
    if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(xContentRegistry, LoggingDeprecationHandler.INSTANCE, queryFilter);
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        BoolQueryBuilder newQuery =
            QueryBuilders.boolQuery().must(searchSourceBuilder.query()).filter(filter);
        searchSourceBuilder.query(newQuery);
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }
    searchRequest.source(searchSourceBuilder);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    for (var hit : searchResponse.getHits().getHits()) {
      List<Map<String, Object>> lineage =
          (List<Map<String, Object>>) hit.getSourceAsMap().get("lineage");
      HashMap<String, Object> tempMap = new HashMap<>(JsonUtils.getMap(hit.getSourceAsMap()));
      tempMap.keySet().removeAll(FIELDS_TO_REMOVE);
      nodes.add(tempMap);
      for (Map<String, Object> lin : lineage) {
        HashMap<String, String> fromEntity = (HashMap<String, String>) lin.get("fromEntity");
        HashMap<String, String> toEntity = (HashMap<String, String>) lin.get("toEntity");
        HashMap<String, String> pipeline = (HashMap<String, String>) lin.get("pipeline");
        if (pipeline != null && pipeline.get("fullyQualifiedName").equalsIgnoreCase(fqn)) {
          edges.add(lin);
          getLineage(
              fromEntity.get("fqn"),
              upstreamDepth,
              edges,
              nodes,
              queryFilter,
              "lineage.toEntity.fqn.keyword",
              deleted);
          getLineage(
              toEntity.get("fqn"),
              downstreamDepth,
              edges,
              nodes,
              queryFilter,
              "lineage.fromEntity.fqn.keyword",
              deleted);
        }
      }
    }
    responseMap.put("edges", edges);
    responseMap.put("nodes", nodes);
    return Response.status(OK).entity(responseMap).build();
  }

  @Override
  public Response searchBySourceUrl(String sourceUrl) throws IOException {
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery().must(QueryBuilders.termQuery("sourceUrl", sourceUrl)));
    searchRequest.source(searchSourceBuilder);
    String response = client.search(searchRequest, RequestOptions.DEFAULT).toString();
    return Response.status(OK).entity(response).build();
  }

  @Override
  public Response searchByField(String fieldName, String fieldValue, String index)
      throws IOException {
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(index));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(QueryBuilders.wildcardQuery(fieldName, fieldValue));
    searchRequest.source(searchSourceBuilder);
    String response = client.search(searchRequest, RequestOptions.DEFAULT).toString();
    return Response.status(OK).entity(response).build();
  }

  @Override
  public Response aggregate(String index, String fieldName, String value, String query)
      throws IOException {
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    XContentParser filterParser =
        XContentType.JSON
            .xContent()
            .createParser(xContentRegistry, LoggingDeprecationHandler.INSTANCE, query);
    QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();

    BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery().must(filter);
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms(fieldName)
                .field(fieldName)
                .size(MAX_AGGREGATE_SIZE)
                .includeExclude(new IncludeExclude(value.toLowerCase(), null))
                .order(BucketOrder.key(true)))
        .query(boolQueryBuilder)
        .size(0);
    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    String response =
        client
            .search(
                new es.org.elasticsearch.action.search.SearchRequest(
                        Entity.getSearchRepository().getIndexOrAliasName(index))
                    .source(searchSourceBuilder),
                RequestOptions.DEFAULT)
            .toString();
    return Response.status(OK).entity(response).build();
  }

  /*
  Build dynamic aggregation from elasticsearch JSON like aggregation query.
  See TestSuiteResourceTest for example usage (ln. 506) for tested aggregation query.

  @param aggregations - JsonObject containing the aggregation query
   */
  public static List<AggregationBuilder> buildAggregation(JsonObject aggregations) {
    List<AggregationBuilder> aggregationBuilders = new ArrayList<>();
    for (String key : aggregations.keySet()) {
      JsonObject aggregation = aggregations.getJsonObject(key);
      for (String aggregationType : aggregation.keySet()) {
        switch (aggregationType) {
          case "terms":
            JsonObject termAggregation = aggregation.getJsonObject(aggregationType);
            TermsAggregationBuilder termsAggregationBuilder =
                AggregationBuilders.terms(key).field(termAggregation.getString("field"));
            aggregationBuilders.add(termsAggregationBuilder);
            break;
          case "nested":
            JsonObject nestedAggregation = aggregation.getJsonObject("nested");
            AggregationBuilder nestedAggregationBuilder =
                AggregationBuilders.nested(
                    nestedAggregation.getString("path"), nestedAggregation.getString("path"));
            JsonObject nestedAggregations = aggregation.getJsonObject("aggs");

            List<AggregationBuilder> nestedAggregationBuilders =
                buildAggregation(nestedAggregations);
            for (AggregationBuilder nestedAggregationBuilder1 : nestedAggregationBuilders) {
              nestedAggregationBuilder.subAggregation(nestedAggregationBuilder1);
            }
            aggregationBuilders.add(nestedAggregationBuilder);
            break;
          default:
            break;
        }
      }
    }
    return aggregationBuilders;
  }

  @Override
  public JsonObject aggregate(String query, String index, JsonObject aggregationJson)
      throws IOException {
    JsonObject aggregations = aggregationJson.getJsonObject("aggregations");
    if (aggregations == null) {
      return null;
    }

    List<AggregationBuilder> aggregationBuilder = buildAggregation(aggregations);
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(index));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    if (query != null) {
      XContentParser queryParser =
          XContentType.JSON
              .xContent()
              .createParser(xContentRegistry, LoggingDeprecationHandler.INSTANCE, query);
      QueryBuilder parsedQuery = SearchSourceBuilder.fromXContent(queryParser).query();
      BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery().must(parsedQuery);
      searchSourceBuilder.query(boolQueryBuilder);
    }

    searchSourceBuilder.size(0).timeout(new TimeValue(30, TimeUnit.SECONDS));

    for (AggregationBuilder aggregation : aggregationBuilder) {
      searchSourceBuilder.aggregation(aggregation);
    }

    searchRequest.source(searchSourceBuilder);

    String response = client.search(searchRequest, RequestOptions.DEFAULT).toString();
    JsonObject jsonResponse = JsonUtils.readJson(response).asJsonObject();
    return jsonResponse.getJsonObject("aggregations");
  }

  private static ScriptScoreFunctionBuilder boostScore() {
    return ScoreFunctionBuilders.scriptFunction(
        "double score = _score;"
            + "if (doc.containsKey('totalVotes') && doc['totalVotes'].value != null) { score = score + doc['totalVotes'].value; }"
            + "if (doc.containsKey('usageSummary') && doc['usageSummary.weeklyStats.count'].value != null) { score = score + doc['usageSummary.weeklyStats.count'].value; }"
            + "if (doc.containsKey('tier.tagFQN') && !doc['tier.tagFQN'].empty) { if (doc['tier.tagFQN'].value == 'Tier.Tier2') { score = score + 10; }"
            + " else if (doc['tier.tagFQN'].value == 'Tier.Tier1') { score = score + 20; }}"
            + "return score;");
  }

  private static HighlightBuilder buildHighlights(List<String> fields) {
    List<String> defaultFields =
        List.of(
            FIELD_DISPLAY_NAME,
            FIELD_NAME,
            FIELD_DESCRIPTION,
            FIELD_DISPLAY_NAME_NGRAM,
            FIELD_NAME_NGRAM);
    defaultFields = Stream.concat(defaultFields.stream(), fields.stream()).toList();
    HighlightBuilder hb = new HighlightBuilder();
    for (String field : defaultFields) {
      HighlightBuilder.Field highlightField = new HighlightBuilder.Field(field);
      highlightField.highlighterType(UNIFIED);
      hb.field(highlightField);
    }
    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);
    return hb;
  }

  @Override
  public Response suggest(SearchRequest request) throws IOException {
    String fieldName = request.getFieldName();
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    CompletionSuggestionBuilder suggestionBuilder =
        SuggestBuilders.completionSuggestion(fieldName)
            .prefix(request.getQuery(), Fuzziness.AUTO)
            .size(request.getSize())
            .skipDuplicates(true);
    if (fieldName.equalsIgnoreCase("suggest")) {
      suggestionBuilder.contexts(
          Collections.singletonMap(
              "deleted",
              Collections.singletonList(
                  CategoryQueryContext.builder()
                      .setCategory(String.valueOf(request.deleted()))
                      .build())));
    }
    SuggestBuilder suggestBuilder = new SuggestBuilder();
    suggestBuilder.addSuggestion("metadata-suggest", suggestionBuilder);
    searchSourceBuilder
        .suggest(suggestBuilder)
        .timeout(new TimeValue(30, TimeUnit.SECONDS))
        .fetchSource(
            new FetchSourceContext(
                request.fetchSource(),
                request.getIncludeSourceFields().toArray(String[]::new),
                new String[] {}));
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
                Entity.getSearchRepository().getIndexOrAliasName(request.getIndex()))
            .source(searchSourceBuilder);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    Suggest suggest = searchResponse.getSuggest();
    return Response.status(OK).entity(suggest.toString()).build();
  }

  private static SearchSourceBuilder buildPipelineSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, PipelineIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    HighlightBuilder hb = buildHighlights(List.of("tasks.name", "tasks.description"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("tasks.displayName.keyword").field("tasks.displayName.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildMlModelSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, MlModelIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    HighlightBuilder hb = buildHighlights(List.of("mlFeatures.name", "mlFeatures.description"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildTopicSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, TopicIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms(ES_MESSAGE_SCHEMA_FIELD_KEYWORD)
                .field(ES_MESSAGE_SCHEMA_FIELD_KEYWORD))
        .aggregation(AggregationBuilders.terms(SCHEMA_FIELD_NAMES).field(SCHEMA_FIELD_NAMES));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildDashboardSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, DashboardIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    HighlightBuilder hb = buildHighlights(List.of("charts.name", "charts.description"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms("dataModels.displayName.keyword")
                .field("dataModels.displayName.keyword"))
        .aggregation(
            AggregationBuilders.terms("charts.displayName.keyword")
                .field("charts.displayName.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildSearchAcrossIndexesBuilder(
      String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, SearchIndex.getAllFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    queryBuilder.boostMode(CombineFunction.SUM);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, null, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildGenericDataAssetSearchBuilder(
      String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, SearchIndex.getDefaultFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildTableSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, TableIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    queryBuilder.boostMode(CombineFunction.SUM);

    HighlightBuilder hb =
        buildHighlights(List.of("columns.name", "columns.description", "columns.children.name"));
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("database.displayName.keyword")
            .field("database.displayName.keyword"));
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms("databaseSchema.displayName.keyword")
                .field("databaseSchema.displayName.keyword"))
        .aggregation(AggregationBuilders.terms(COLUMNS_NAME_KEYWORD).field(COLUMNS_NAME_KEYWORD))
        .aggregation(AggregationBuilders.terms(FIELD_COLUMN_NAMES).field(FIELD_COLUMN_NAMES))
        .aggregation(AggregationBuilders.terms("tableType").field("tableType"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildUserOrTeamSearchBuilder(
      String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder = buildSearchQueryBuilder(query, UserIndex.getFields());
    return searchBuilder(queryBuilder, null, from, size);
  }

  private static SearchSourceBuilder buildGlossaryTermSearchBuilder(
      String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, GlossaryTermIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    queryBuilder.boostMode(CombineFunction.SUM);
    HighlightBuilder hb = buildHighlights(List.of("synonyms"));
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("glossary.name.keyword").field("glossary.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildTagSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, TagIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    queryBuilder.boostMode(CombineFunction.SUM);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("classification.name.keyword")
            .field("classification.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildContainerSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, ContainerIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    queryBuilder.boostMode(CombineFunction.SUM);
    HighlightBuilder hb =
        buildHighlights(
            List.of(
                "dataModel.columns.name",
                "dataModel.columns.description",
                "dataModel.columns.children.name"));
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms(DATA_MODEL_COLUMNS_NAME_KEYWORD)
                .field(DATA_MODEL_COLUMNS_NAME_KEYWORD))
        .aggregation(AggregationBuilders.terms(FIELD_COLUMN_NAMES).field(FIELD_COLUMN_NAMES));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildQuerySearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, QueryIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    queryBuilder.boostMode(CombineFunction.SUM);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildTestCaseSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        buildSearchQueryBuilder(query, TestCaseIndex.getFields());
    HighlightBuilder hb = buildHighlights(List.of("testSuite.name", "testSuite.description"));
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildStoredProcedureSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, StoredProcedureIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    queryBuilder.boostMode(CombineFunction.SUM);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildDashboardDataModelsSearch(
      String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, DashboardDataModelIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    queryBuilder.boostMode(CombineFunction.SUM);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder
        .aggregation(AggregationBuilders.terms("dataModelType").field("dataModelType"))
        .aggregation(AggregationBuilders.terms(COLUMNS_NAME_KEYWORD).field(COLUMNS_NAME_KEYWORD))
        .aggregation(AggregationBuilders.terms("project.keyword").field("project.keyword"))
        .aggregation(AggregationBuilders.terms(FIELD_COLUMN_NAMES).field(FIELD_COLUMN_NAMES));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildDomainsSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, DomainIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    queryBuilder.boostMode(CombineFunction.SUM);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildCostAnalysisReportDataSearch(
      String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder = QueryBuilders.queryStringQuery(query);
    return searchBuilder(queryBuilder, null, from, size);
  }

  private static SearchSourceBuilder buildSearchEntitySearch(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, SearchEntityIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    queryBuilder.boostMode(CombineFunction.SUM);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("fields.name.keyword").field("fields.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildTestCaseResolutionStatusSearch(
      String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        buildSearchQueryBuilder(query, TestCaseResolutionStatusIndex.getFields());
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildServiceSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        buildSearchQueryBuilder(query, SearchIndex.getDefaultFields());
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildDataProductSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, DataProductIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder =
        QueryBuilders.functionScoreQuery(queryStringBuilder, boostScore());
    queryBuilder.boostMode(CombineFunction.SUM);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    return addAggregation(searchSourceBuilder);
  }

  private static QueryStringQueryBuilder buildSearchQueryBuilder(
      String query, Map<String, Float> fields) {
    return QueryBuilders.queryStringQuery(query)
        .fields(fields)
        .type(MultiMatchQueryBuilder.Type.MOST_FIELDS)
        .defaultOperator(Operator.AND)
        .fuzziness(Fuzziness.AUTO)
        .tieBreaker(0.9f);
  }

  private static SearchSourceBuilder buildAggregateSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(SearchIndex.getAllFields())
            .fuzziness(Fuzziness.AUTO);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, null, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder addAggregation(SearchSourceBuilder builder) {
    builder
        .aggregation(
            AggregationBuilders.terms("serviceType").field("serviceType").size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("service.displayName.keyword")
                .field("service.displayName.keyword")
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("entityType").field("entityType").size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("tier.tagFQN").field("tier.tagFQN").size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms(OWNER_DISPLAY_NAME_KEYWORD)
                .field(OWNER_DISPLAY_NAME_KEYWORD)
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("owner.displayName")
                .field("owner.displayName")
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms(DOMAIN_DISPLAY_NAME_KEYWORD)
                .field(DOMAIN_DISPLAY_NAME_KEYWORD)
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(AggregationBuilders.terms(ES_TAG_FQN_FIELD).field(ES_TAG_FQN_FIELD))
        .aggregation(
            AggregationBuilders.terms("index_count").field("_index").size(MAX_AGGREGATE_SIZE));

    return builder;
  }

  private static SearchSourceBuilder searchBuilder(
      QueryBuilder queryBuilder, HighlightBuilder hb, int from, int size) {
    SearchSourceBuilder builder =
        new SearchSourceBuilder().query(queryBuilder).from(from).size(size);
    if (hb != null) {
      hb.preTags(PRE_TAG);
      hb.postTags(POST_TAG);
      builder.highlighter(hb);
    }
    return builder;
  }

  @Override
  public ElasticSearchConfiguration.SearchType getSearchType() {
    return ElasticSearchConfiguration.SearchType.ELASTICSEARCH;
  }

  @Override
  public void createEntity(String indexName, String docId, String doc) {
    if (isClientAvailable) {
      UpdateRequest updateRequest = new UpdateRequest(indexName, docId);
      updateRequest.doc(doc, XContentType.JSON);
      updateRequest.docAsUpsert(true);
      updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
      updateElasticSearch(updateRequest);
    }
  }

  @Override
  public void createTimeSeriesEntity(String indexName, String docId, String doc) {
    if (isClientAvailable) {
      UpdateRequest updateRequest = new UpdateRequest(indexName, docId);
      updateRequest.doc(doc, XContentType.JSON);
      updateRequest.docAsUpsert(true);
      updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
      updateElasticSearch(updateRequest);
    }
  }

  @Override
  public void deleteByScript(String indexName, String scriptTxt, Map<String, Object> params) {
    if (isClientAvailable) {
      Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, params);
      ScriptQueryBuilder scriptQuery = new ScriptQueryBuilder(script);
      DeleteByQueryRequest deleteByQueryRequest = new DeleteByQueryRequest(indexName);
      deleteByQueryRequest.setQuery(scriptQuery);
      deleteEntityFromElasticSearchByQuery(deleteByQueryRequest);
    }
  }

  @Override
  public void deleteEntity(String indexName, String docId) {
    if (isClientAvailable) {
      DeleteRequest deleteRequest = new DeleteRequest(indexName, docId);
      deleteEntityFromElasticSearch(deleteRequest);
    }
  }

  @Override
  public void deleteEntityByFields(String indexName, List<Pair<String, String>> fieldAndValue) {
    if (isClientAvailable) {
      BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
      DeleteByQueryRequest deleteByQueryRequest = new DeleteByQueryRequest(indexName);
      for (Pair<String, String> p : fieldAndValue) {
        queryBuilder.must(new TermQueryBuilder(p.getKey(), p.getValue()));
      }
      deleteByQueryRequest.setQuery(queryBuilder);
      deleteEntityFromElasticSearchByQuery(deleteByQueryRequest);
    }
  }

  @Override
  public void softDeleteOrRestoreEntity(String indexName, String docId, String scriptTxt) {
    if (isClientAvailable) {
      UpdateRequest updateRequest = new UpdateRequest(indexName, docId);
      Script script =
          new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, new HashMap<>());
      updateRequest.script(script);
      updateElasticSearch(updateRequest);
    }
  }

  @Override
  public void softDeleteOrRestoreChildren(
      String indexName, String scriptTxt, List<Pair<String, String>> fieldAndValue) {
    if (isClientAvailable) {
      UpdateByQueryRequest updateByQueryRequest = new UpdateByQueryRequest(indexName);
      BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
      for (Pair<String, String> p : fieldAndValue) {
        queryBuilder.must(new TermQueryBuilder(p.getKey(), p.getValue()));
      }
      updateByQueryRequest.setQuery(queryBuilder);
      Script script =
          new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, new HashMap<>());
      updateByQueryRequest.setScript(script);
      updateElasticSearchByQuery(updateByQueryRequest);
    }
  }

  @Override
  public void updateEntity(
      String indexName, String docId, Map<String, Object> doc, String scriptTxt) {
    if (isClientAvailable) {
      UpdateRequest updateRequest = new UpdateRequest(indexName, docId);
      Script script =
          new Script(
              ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, JsonUtils.getMap(doc));
      updateRequest.scriptedUpsert(true);
      updateRequest.script(script);
      updateElasticSearch(updateRequest);
    }
  }

  @Override
  public void updateChildren(
      String indexName,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates) {
    if (isClientAvailable) {
      UpdateByQueryRequest updateByQueryRequest = new UpdateByQueryRequest(indexName);
      updateByQueryRequest.setQuery(
          new MatchQueryBuilder(fieldAndValue.getKey(), fieldAndValue.getValue())
              .operator(Operator.AND));
      Script script =
          new Script(
              ScriptType.INLINE,
              Script.DEFAULT_SCRIPT_LANG,
              updates.getKey(),
              JsonUtils.getMap(updates.getValue() == null ? new HashMap<>() : updates.getValue()));
      updateByQueryRequest.setScript(script);
      updateElasticSearchByQuery(updateByQueryRequest);
    }
  }

  /**
   * @param indexName
   * @param fieldAndValue
   */
  @Override
  public void updateLineage(
      String indexName, Pair<String, String> fieldAndValue, Map<String, Object> lineageData) {
    if (isClientAvailable) {
      UpdateByQueryRequest updateByQueryRequest = new UpdateByQueryRequest(indexName);
      updateByQueryRequest.setQuery(
          new MatchQueryBuilder(fieldAndValue.getKey(), fieldAndValue.getValue())
              .operator(Operator.AND));
      Map<String, Object> params = Collections.singletonMap("lineageData", lineageData);
      Script script =
          new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, ADD_UPDATE_LINEAGE, params);
      updateByQueryRequest.setScript(script);
      updateElasticSearchByQuery(updateByQueryRequest);
    }
  }

  public void updateElasticSearch(UpdateRequest updateRequest) {
    if (updateRequest != null && isClientAvailable) {
      updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
      LOG.debug(UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH, updateRequest);
      ActionListener<UpdateResponse> listener =
          new ActionListener<>() {
            @Override
            public void onResponse(UpdateResponse updateResponse) {
              LOG.debug("Created successfully: " + updateResponse.toString());
            }

            @Override
            public void onFailure(Exception e) {
              LOG.error("Creation failed: " + e.getMessage());
            }
          };
      client.updateAsync(updateRequest, RequestOptions.DEFAULT, listener);
    }
  }

  private void updateElasticSearchByQuery(UpdateByQueryRequest updateByQueryRequest) {
    if (updateByQueryRequest != null && isClientAvailable) {
      updateByQueryRequest.setRefresh(true);
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, updateByQueryRequest);
      ActionListener<BulkByScrollResponse> listener =
          new ActionListener<>() {
            @Override
            public void onResponse(BulkByScrollResponse response) {
              LOG.debug("Update by query succeeded: " + response.toString());
            }

            @Override
            public void onFailure(Exception e) {
              LOG.error("Update by query failed: " + e.getMessage());
            }
          };
      client.updateByQueryAsync(updateByQueryRequest, RequestOptions.DEFAULT, listener);
    }
  }

  /** */
  @Override
  public void close() {
    try {
      this.client.close();
    } catch (Exception e) {
      LOG.error("Failed to close elastic search", e);
    }
  }

  private void deleteEntityFromElasticSearch(DeleteRequest deleteRequest) {
    if (deleteRequest != null && isClientAvailable) {
      deleteRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
      LOG.debug(UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH, deleteRequest);
      ActionListener<DeleteResponse> listener =
          new ActionListener<>() {
            @Override
            public void onResponse(DeleteResponse response) {
              LOG.debug("Delete succeeded: " + response.toString());
            }

            @Override
            public void onFailure(Exception e) {
              LOG.error("Delete failed: " + e.getMessage());
            }
          };
      deleteRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.WAIT_UNTIL);
      client.deleteAsync(deleteRequest, RequestOptions.DEFAULT, listener);
    }
  }

  private void deleteEntityFromElasticSearchByQuery(DeleteByQueryRequest deleteRequest) {
    if (deleteRequest != null && isClientAvailable) {
      LOG.debug(UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH, deleteRequest);
      deleteRequest.setRefresh(true);
      ActionListener<BulkByScrollResponse> listener =
          new ActionListener<>() {
            @Override
            public void onResponse(BulkByScrollResponse response) {
              LOG.debug("Delete by query succeeded: " + response.toString());
            }

            @Override
            public void onFailure(Exception e) {
              LOG.error("Delete by query failed: " + e.getMessage());
            }
          };
      client.deleteByQueryAsync(deleteRequest, RequestOptions.DEFAULT, listener);
    }
  }

  @Override
  public BulkResponse bulk(BulkRequest data, RequestOptions options) throws IOException {
    return client.bulk(data, RequestOptions.DEFAULT);
  }

  @Override
  public int getSuccessFromBulkResponse(BulkResponse response) {
    int success = 0;
    for (BulkItemResponse bulkItemResponse : response) {
      if (!bulkItemResponse.isFailed()) {
        success++;
      }
    }
    return success;
  }

  @Override
  public TreeMap<Long, List<Object>> getSortedDate(
      String team,
      Long scheduleTime,
      Long currentTime,
      DataInsightChartResult.DataInsightChartType chartType,
      String indexName)
      throws IOException, ParseException {
    es.org.elasticsearch.action.search.SearchRequest searchRequestTotalAssets =
        buildSearchRequest(
            scheduleTime, currentTime, null, team, chartType, null, null, null, indexName);
    SearchResponse searchResponseTotalAssets =
        client.search(searchRequestTotalAssets, RequestOptions.DEFAULT);
    DataInsightChartResult processedDataTotalAssets =
        processDataInsightChartResult(searchResponseTotalAssets, chartType);
    TreeMap<Long, List<Object>> dateWithDataMap = new TreeMap<>();
    for (Object data : processedDataTotalAssets.getData()) {
      DataInsightInterface convertedData = (DataInsightInterface) data;
      Long timestamp = convertedData.getTimestamp();
      List<Object> totalEntitiesByTypeList = new ArrayList<>();
      if (dateWithDataMap.containsKey(timestamp)) {
        totalEntitiesByTypeList = dateWithDataMap.get(timestamp);
      }
      totalEntitiesByTypeList.add(convertedData);
      dateWithDataMap.put(timestamp, totalEntitiesByTypeList);
    }
    return dateWithDataMap;
  }

  @Override
  public Response listDataInsightChartResult(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      DataInsightChartResult.DataInsightChartType dataInsightChartName,
      Integer size,
      Integer from,
      String queryFilter,
      String dataReportIndex)
      throws IOException, ParseException {
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        buildSearchRequest(
            startTs,
            endTs,
            tier,
            team,
            dataInsightChartName,
            size,
            from,
            queryFilter,
            dataReportIndex);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    return Response.status(OK)
        .entity(processDataInsightChartResult(searchResponse, dataInsightChartName))
        .build();
  }

  private static DataInsightChartResult processDataInsightChartResult(
      SearchResponse searchResponse,
      DataInsightChartResult.DataInsightChartType dataInsightChartType)
      throws ParseException {
    DataInsightAggregatorInterface processor =
        createDataAggregator(searchResponse, dataInsightChartType);
    return processor.process(dataInsightChartType);
  }

  private static DataInsightAggregatorInterface createDataAggregator(
      SearchResponse aggregations, DataInsightChartResult.DataInsightChartType dataInsightChartType)
      throws IllegalArgumentException {
    return switch (dataInsightChartType) {
      case PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE -> new ElasticSearchEntitiesDescriptionAggregator(
          aggregations.getAggregations());
      case PERCENTAGE_OF_SERVICES_WITH_DESCRIPTION -> new ElasticSearchServicesDescriptionAggregator(
          aggregations.getAggregations());
      case PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE -> new ElasticSearchEntitiesOwnerAggregator(
          aggregations.getAggregations());
      case PERCENTAGE_OF_SERVICES_WITH_OWNER -> new ElasticSearchServicesOwnerAggregator(
          aggregations.getAggregations());
      case TOTAL_ENTITIES_BY_TYPE -> new ElasticSearchTotalEntitiesAggregator(
          aggregations.getAggregations());
      case TOTAL_ENTITIES_BY_TIER -> new ElasticSearchTotalEntitiesByTierAggregator(
          aggregations.getAggregations());
      case DAILY_ACTIVE_USERS -> new ElasticSearchDailyActiveUsersAggregator(
          aggregations.getAggregations());
      case PAGE_VIEWS_BY_ENTITIES -> new ElasticSearchPageViewsByEntitiesAggregator(
          aggregations.getAggregations());
      case MOST_ACTIVE_USERS -> new ElasticSearchMostActiveUsersAggregator(
          aggregations.getAggregations());
      case MOST_VIEWED_ENTITIES -> new ElasticSearchMostViewedEntitiesAggregator(
          aggregations.getAggregations());
      case UNUSED_ASSETS -> new ElasticSearchUnusedAssetsAggregator(aggregations.getHits());
      case AGGREGATED_UNUSED_ASSETS_SIZE -> new ElasticSearchAggregatedUnusedAssetsSizeAggregator(
          aggregations.getAggregations());
      case AGGREGATED_UNUSED_ASSETS_COUNT -> new ElasticSearchAggregatedUnusedAssetsCountAggregator(
          aggregations.getAggregations());
      case AGGREGATED_USED_VS_UNUSED_ASSETS_COUNT -> new ElasticSearchAggregatedUsedvsUnusedAssetsCountAggregator(
          aggregations.getAggregations());
      case AGGREGATED_USED_VS_UNUSED_ASSETS_SIZE -> new ElasticSearchAggregatedUsedvsUnusedAssetsSizeAggregator(
          aggregations.getAggregations());
    };
  }

  private static es.org.elasticsearch.action.search.SearchRequest buildSearchRequest(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      DataInsightChartResult.DataInsightChartType dataInsightChartName,
      Integer size,
      Integer from,
      String queryFilter,
      String dataReportIndex) {
    SearchSourceBuilder searchSourceBuilder =
        buildQueryFilter(startTs, endTs, tier, team, queryFilter, dataInsightChartName.value());
    if (!dataInsightChartName
        .toString()
        .equalsIgnoreCase(DataInsightChartResult.DataInsightChartType.UNUSED_ASSETS.toString())) {
      AggregationBuilder aggregationBuilder = buildQueryAggregation(dataInsightChartName);
      searchSourceBuilder.aggregation(aggregationBuilder);
      searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    } else {
      // get raw doc for unused assets
      searchSourceBuilder.fetchSource(true);
      searchSourceBuilder.from(from);
      searchSourceBuilder.size(size);
      searchSourceBuilder.sort("data.lifeCycle.accessed.timestamp", SortOrder.DESC);
    }

    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(dataReportIndex);
    searchRequest.source(searchSourceBuilder);
    return searchRequest;
  }

  private static SearchSourceBuilder buildQueryFilter(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      String queryFilter,
      String dataInsightChartName) {

    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    BoolQueryBuilder searchQueryFiler = new BoolQueryBuilder();

    // Add team filter
    if (team != null
        && DataInsightChartRepository.SUPPORTS_TEAM_FILTER.contains(dataInsightChartName)) {
      List<String> teamArray = Arrays.asList(team.split("\\s*,\\s*"));

      BoolQueryBuilder teamQueryFilter = QueryBuilders.boolQuery();
      teamQueryFilter.should(
          QueryBuilders.termsQuery(DataInsightChartRepository.DATA_TEAM, teamArray));
      searchQueryFiler.must(teamQueryFilter);
    }

    // Add tier filter
    if (tier != null
        && DataInsightChartRepository.SUPPORTS_TIER_FILTER.contains(dataInsightChartName)) {
      List<String> tierArray = Arrays.asList(tier.split("\\s*,\\s*"));

      BoolQueryBuilder tierQueryFilter = QueryBuilders.boolQuery();
      tierQueryFilter.should(
          QueryBuilders.termsQuery(DataInsightChartRepository.DATA_ENTITY_TIER, tierArray));
      searchQueryFiler.must(tierQueryFilter);
    }

    // Add date range filter
    if (!DataInsightChartRepository.SUPPORTS_NULL_DATE_RANGE.contains(dataInsightChartName)) {
      if (startTs == null || endTs == null) {
        throw new IllegalArgumentException(
            String.format(
                "Start and End date are required for chart type %s ", dataInsightChartName));
      }
      RangeQueryBuilder dateQueryFilter =
          QueryBuilders.rangeQuery(DataInsightChartRepository.TIMESTAMP).gte(startTs).lte(endTs);
      searchQueryFiler.must(dateQueryFilter);
    }

    searchSourceBuilder.query(searchQueryFiler).fetchSource(false);

    if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(xContentRegistry, LoggingDeprecationHandler.INSTANCE, queryFilter);
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        BoolQueryBuilder newQuery =
            QueryBuilders.boolQuery().must(searchSourceBuilder.query()).filter(filter);
        searchSourceBuilder.query(newQuery);
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }

    return searchSourceBuilder;
  }

  private static AggregationBuilder buildQueryAggregation(
      DataInsightChartResult.DataInsightChartType dataInsightChartName)
      throws IllegalArgumentException {
    DateHistogramAggregationBuilder dateHistogramAggregationBuilder =
        AggregationBuilders.dateHistogram(DataInsightChartRepository.TIMESTAMP)
            .field(DataInsightChartRepository.TIMESTAMP)
            .calendarInterval(DateHistogramInterval.DAY);

    TermsAggregationBuilder termsAggregationBuilder;
    SumAggregationBuilder sumAggregationBuilder;
    SumAggregationBuilder sumEntityCountAggregationBuilder =
        AggregationBuilders.sum(DataInsightChartRepository.ENTITY_COUNT)
            .field(DataInsightChartRepository.DATA_ENTITY_COUNT);

    switch (dataInsightChartName) {
      case PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE:
        termsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_TYPE)
                .field(DataInsightChartRepository.DATA_ENTITY_TYPE)
                .size(1000);
        sumAggregationBuilder =
            AggregationBuilders.sum(DataInsightChartRepository.COMPLETED_DESCRIPTION_FRACTION)
                .field(DataInsightChartRepository.DATA_COMPLETED_DESCRIPTIONS);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder
                .subAggregation(sumAggregationBuilder)
                .subAggregation(sumEntityCountAggregationBuilder));
      case AGGREGATED_UNUSED_ASSETS_SIZE, AGGREGATED_UNUSED_ASSETS_COUNT:
        boolean isSize =
            dataInsightChartName.equals(
                DataInsightChartResult.DataInsightChartType.AGGREGATED_UNUSED_ASSETS_SIZE);
        String[] types = new String[] {"frequentlyUsedDataAssets", "unusedDataAssets"};
        String fieldType = isSize ? "size" : "count";

        for (String type : types) {
          SumAggregationBuilder threeDaysAgg =
              AggregationBuilders.sum(String.format("%sThreeDays", type))
                  .field(String.format("data.%s.%s.threeDays", type, fieldType));
          SumAggregationBuilder sevenDaysAgg =
              AggregationBuilders.sum(String.format("%sSevenDays", type))
                  .field(String.format("data.%s.%s.sevenDays", type, fieldType));
          SumAggregationBuilder fourteenDaysAgg =
              AggregationBuilders.sum(String.format("%sFourteenDays", type))
                  .field(String.format("data.%s.%s.fourteenDays", type, fieldType));
          SumAggregationBuilder thirtyDaysAgg =
              AggregationBuilders.sum(String.format("%sThirtyDays", type))
                  .field(String.format("data.%s.%s.thirtyDays", type, fieldType));
          SumAggregationBuilder sixtyDaysAgg =
              AggregationBuilders.sum(String.format("%sSixtyDays", type))
                  .field(String.format("data.%s.%s.sixtyDays", type, fieldType));

          dateHistogramAggregationBuilder
              .subAggregation(threeDaysAgg)
              .subAggregation(sevenDaysAgg)
              .subAggregation(fourteenDaysAgg)
              .subAggregation(thirtyDaysAgg)
              .subAggregation(sixtyDaysAgg);
        }

        return dateHistogramAggregationBuilder;
      case AGGREGATED_USED_VS_UNUSED_ASSETS_SIZE, AGGREGATED_USED_VS_UNUSED_ASSETS_COUNT:
        boolean isSizeReport =
            dataInsightChartName.equals(
                DataInsightChartResult.DataInsightChartType.AGGREGATED_USED_VS_UNUSED_ASSETS_SIZE);
        String totalFieldString = isSizeReport ? "totalSize" : "totalCount";
        SumAggregationBuilder totalUnusedAssets =
            AggregationBuilders.sum("totalUnused")
                .field(String.format("data.unusedDataAssets.%s", totalFieldString));
        SumAggregationBuilder totalUsedAssets =
            AggregationBuilders.sum("totalUsed")
                .field(String.format("data.frequentlyUsedDataAssets.%s", totalFieldString));
        return dateHistogramAggregationBuilder
            .subAggregation(totalUnusedAssets)
            .subAggregation(totalUsedAssets);
      case PERCENTAGE_OF_SERVICES_WITH_DESCRIPTION:
        termsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.SERVICE_NAME)
                .field(DataInsightChartRepository.DATA_SERVICE_NAME)
                .size(1000);
        sumAggregationBuilder =
            AggregationBuilders.sum(DataInsightChartRepository.COMPLETED_DESCRIPTION_FRACTION)
                .field(DataInsightChartRepository.DATA_COMPLETED_DESCRIPTIONS);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder
                .subAggregation(sumAggregationBuilder)
                .subAggregation(sumEntityCountAggregationBuilder));
      case PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE:
        termsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_TYPE)
                .field(DataInsightChartRepository.DATA_ENTITY_TYPE)
                .size(1000);
        sumAggregationBuilder =
            AggregationBuilders.sum(DataInsightChartRepository.HAS_OWNER_FRACTION)
                .field(DataInsightChartRepository.DATA_HAS_OWNER);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder
                .subAggregation(sumAggregationBuilder)
                .subAggregation(sumEntityCountAggregationBuilder));
      case PERCENTAGE_OF_SERVICES_WITH_OWNER:
        termsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.SERVICE_NAME)
                .field(DataInsightChartRepository.DATA_SERVICE_NAME)
                .size(1000);
        sumAggregationBuilder =
            AggregationBuilders.sum(DataInsightChartRepository.HAS_OWNER_FRACTION)
                .field(DataInsightChartRepository.DATA_HAS_OWNER);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder
                .subAggregation(sumAggregationBuilder)
                .subAggregation(sumEntityCountAggregationBuilder));
      case TOTAL_ENTITIES_BY_TIER:
        termsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_TIER)
                .field(DataInsightChartRepository.DATA_ENTITY_TIER)
                .missing("NoTier")
                .size(1000);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder.subAggregation(sumEntityCountAggregationBuilder));
      case TOTAL_ENTITIES_BY_TYPE:
        termsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_TYPE)
                .field(DataInsightChartRepository.DATA_ENTITY_TYPE)
                .size(1000);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder.subAggregation(sumEntityCountAggregationBuilder));
      case DAILY_ACTIVE_USERS:
        return dateHistogramAggregationBuilder;
      case PAGE_VIEWS_BY_ENTITIES:
        termsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_TYPE)
                .field(DataInsightChartRepository.DATA_ENTITY_TYPE)
                .size(1000);
        SumAggregationBuilder sumPageViewsByEntityTypes =
            AggregationBuilders.sum(DataInsightChartRepository.PAGE_VIEWS)
                .field(DataInsightChartRepository.DATA_VIEWS);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder.subAggregation(sumPageViewsByEntityTypes));
      case MOST_VIEWED_ENTITIES:
        termsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_FQN)
                .field(DataInsightChartRepository.DATA_ENTITY_FQN)
                .size(10)
                .order(BucketOrder.aggregation(DataInsightChartRepository.PAGE_VIEWS, false));

        TermsAggregationBuilder ownerTermsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.OWNER)
                .field(DataInsightChartRepository.DATA_OWNER);
        TermsAggregationBuilder entityTypeTermsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_TYPE)
                .field(DataInsightChartRepository.DATA_ENTITY_TYPE);
        TermsAggregationBuilder entityHrefAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_HREF)
                .field(DataInsightChartRepository.DATA_ENTITY_HREF);
        SumAggregationBuilder sumEntityPageViewsAggregationBuilder =
            AggregationBuilders.sum(DataInsightChartRepository.PAGE_VIEWS)
                .field(DataInsightChartRepository.DATA_VIEWS);

        return termsAggregationBuilder
            .subAggregation(sumEntityPageViewsAggregationBuilder)
            .subAggregation(ownerTermsAggregationBuilder)
            .subAggregation(entityTypeTermsAggregationBuilder)
            .subAggregation(entityHrefAggregationBuilder);
      case MOST_ACTIVE_USERS:
        termsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.USER_NAME)
                .field(DataInsightChartRepository.DATA_USER_NAME)
                .size(10)
                .order(BucketOrder.aggregation(DataInsightChartRepository.SESSIONS, false));
        TermsAggregationBuilder teamTermsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.TEAM)
                .field(DataInsightChartRepository.DATA_TEAM);
        SumAggregationBuilder sumSessionAggregationBuilder =
            AggregationBuilders.sum(DataInsightChartRepository.SESSIONS)
                .field(DataInsightChartRepository.DATA_SESSIONS);
        SumAggregationBuilder sumUserPageViewsAggregationBuilder =
            AggregationBuilders.sum(DataInsightChartRepository.PAGE_VIEWS)
                .field(DataInsightChartRepository.DATA_PAGE_VIEWS);
        MaxAggregationBuilder lastSessionAggregationBuilder =
            AggregationBuilders.max(DataInsightChartRepository.LAST_SESSION)
                .field(DataInsightChartRepository.DATA_LAST_SESSION);
        SumAggregationBuilder sumSessionDurationAggregationBuilder =
            AggregationBuilders.sum(DataInsightChartRepository.SESSION_DURATION)
                .field(DataInsightChartRepository.DATA_TOTAL_SESSION_DURATION);
        return termsAggregationBuilder
            .subAggregation(sumSessionAggregationBuilder)
            .subAggregation(sumUserPageViewsAggregationBuilder)
            .subAggregation(lastSessionAggregationBuilder)
            .subAggregation(sumSessionDurationAggregationBuilder)
            .subAggregation(teamTermsAggregationBuilder);
      default:
        throw new IllegalArgumentException(
            String.format("Invalid dataInsightChartType name %s", dataInsightChartName));
    }
  }

  public RestHighLevelClient createElasticSearchClient(ElasticSearchConfiguration esConfig) {
    if (esConfig != null) {
      try {
        RestClientBuilder restClientBuilder =
            RestClient.builder(
                new HttpHost(esConfig.getHost(), esConfig.getPort(), esConfig.getScheme()));

        if (StringUtils.isNotEmpty(esConfig.getUsername())
            && StringUtils.isNotEmpty(esConfig.getPassword())) {
          CredentialsProvider credentialsProvider = new BasicCredentialsProvider();
          credentialsProvider.setCredentials(
              AuthScope.ANY,
              new UsernamePasswordCredentials(esConfig.getUsername(), esConfig.getPassword()));
          SSLContext sslContext = createElasticSearchSSLContext(esConfig);
          restClientBuilder.setHttpClientConfigCallback(
              httpAsyncClientBuilder -> {
                httpAsyncClientBuilder.setDefaultCredentialsProvider(credentialsProvider);
                if (sslContext != null) {
                  httpAsyncClientBuilder.setSSLContext(sslContext);
                }
                // Enable TCP keep alive strategy
                if (esConfig.getKeepAliveTimeoutSecs() != null
                    && esConfig.getKeepAliveTimeoutSecs() > 0) {
                  httpAsyncClientBuilder.setKeepAliveStrategy(
                      (response, context) -> esConfig.getKeepAliveTimeoutSecs() * 1000);
                }
                return httpAsyncClientBuilder;
              });
        }
        restClientBuilder.setRequestConfigCallback(
            requestConfigBuilder ->
                requestConfigBuilder
                    .setConnectTimeout(esConfig.getConnectionTimeoutSecs() * 1000)
                    .setSocketTimeout(esConfig.getSocketTimeoutSecs() * 1000));
        return new RestHighLevelClientBuilder(restClientBuilder.build())
            .setApiCompatibilityMode(true)
            .build();
      } catch (Exception e) {
        LOG.error("Failed to create elastic search client ", e);
        return null;
      }
    } else {
      return null;
    }
  }
}
