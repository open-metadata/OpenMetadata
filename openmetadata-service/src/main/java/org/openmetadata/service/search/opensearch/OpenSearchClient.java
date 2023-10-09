package org.openmetadata.service.search.opensearch;

import static javax.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.search.EntityBuilderConstant.COLUMNS_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.DATA_MODEL_COLUMNS_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.DOMAIN_DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.ES_MESSAGE_SCHEMA_FIELD;
import static org.openmetadata.service.search.EntityBuilderConstant.ES_TAG_FQN_FIELD;
import static org.openmetadata.service.search.EntityBuilderConstant.MAX_AGGREGATE_SIZE;
import static org.openmetadata.service.search.EntityBuilderConstant.MAX_RESULT_HITS;
import static org.openmetadata.service.search.EntityBuilderConstant.OWNER_DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.POST_TAG;
import static org.openmetadata.service.search.EntityBuilderConstant.PRE_TAG;
import static org.openmetadata.service.search.EntityBuilderConstant.UNIFIED;
import static org.openmetadata.service.search.UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH;

import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.TimeUnit;
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
import org.openmetadata.schema.DataInsightInterface;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;
import org.openmetadata.service.jdbi3.DataInsightChartRepository;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRequest;
import org.openmetadata.service.search.indexes.ContainerIndex;
import org.openmetadata.service.search.indexes.DashboardDataModelIndex;
import org.openmetadata.service.search.indexes.DashboardIndex;
import org.openmetadata.service.search.indexes.DomainIndex;
import org.openmetadata.service.search.indexes.GlossaryTermIndex;
import org.openmetadata.service.search.indexes.MlModelIndex;
import org.openmetadata.service.search.indexes.PipelineIndex;
import org.openmetadata.service.search.indexes.QueryIndex;
import org.openmetadata.service.search.indexes.SearchEntityIndex;
import org.openmetadata.service.search.indexes.StoredProcedureIndex;
import org.openmetadata.service.search.indexes.TableIndex;
import org.openmetadata.service.search.indexes.TagIndex;
import org.openmetadata.service.search.indexes.TestCaseIndex;
import org.openmetadata.service.search.indexes.TopicIndex;
import org.openmetadata.service.search.indexes.UserIndex;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchAggregatedUnusedAssetsCountAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchAggregatedUnusedAssetsSizeAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchAggregatedUsedvsUnusedAssetsCountAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchAggregatedUsedvsUnusedAssetsSizeAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchDailyActiveUsersAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchEntitiesDescriptionAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchEntitiesOwnerAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchMostActiveUsersAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchMostViewedEntitiesAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchPageViewsByEntitiesAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchServicesDescriptionAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchServicesOwnerAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchTotalEntitiesAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchTotalEntitiesByTierAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchUnusedAssetsAggregator;
import org.openmetadata.service.util.JsonUtils;
import os.org.opensearch.action.ActionListener;
import os.org.opensearch.action.admin.indices.alias.IndicesAliasesRequest;
import os.org.opensearch.action.admin.indices.delete.DeleteIndexRequest;
import os.org.opensearch.action.bulk.BulkItemResponse;
import os.org.opensearch.action.bulk.BulkRequest;
import os.org.opensearch.action.bulk.BulkResponse;
import os.org.opensearch.action.delete.DeleteRequest;
import os.org.opensearch.action.delete.DeleteResponse;
import os.org.opensearch.action.search.SearchResponse;
import os.org.opensearch.action.support.WriteRequest;
import os.org.opensearch.action.support.master.AcknowledgedResponse;
import os.org.opensearch.action.update.UpdateRequest;
import os.org.opensearch.action.update.UpdateResponse;
import os.org.opensearch.client.RequestOptions;
import os.org.opensearch.client.RestClient;
import os.org.opensearch.client.RestClientBuilder;
import os.org.opensearch.client.RestHighLevelClient;
import os.org.opensearch.client.indices.CreateIndexRequest;
import os.org.opensearch.client.indices.CreateIndexResponse;
import os.org.opensearch.client.indices.GetIndexRequest;
import os.org.opensearch.client.indices.PutMappingRequest;
import os.org.opensearch.common.lucene.search.function.CombineFunction;
import os.org.opensearch.common.settings.Settings;
import os.org.opensearch.common.unit.Fuzziness;
import os.org.opensearch.common.unit.TimeValue;
import os.org.opensearch.common.xcontent.LoggingDeprecationHandler;
import os.org.opensearch.common.xcontent.NamedXContentRegistry;
import os.org.opensearch.common.xcontent.XContentParser;
import os.org.opensearch.common.xcontent.XContentType;
import os.org.opensearch.index.query.BoolQueryBuilder;
import os.org.opensearch.index.query.MatchQueryBuilder;
import os.org.opensearch.index.query.MultiMatchQueryBuilder;
import os.org.opensearch.index.query.Operator;
import os.org.opensearch.index.query.QueryBuilder;
import os.org.opensearch.index.query.QueryBuilders;
import os.org.opensearch.index.query.QueryStringQueryBuilder;
import os.org.opensearch.index.query.RangeQueryBuilder;
import os.org.opensearch.index.query.ScriptQueryBuilder;
import os.org.opensearch.index.query.TermQueryBuilder;
import os.org.opensearch.index.query.functionscore.FieldValueFactorFunctionBuilder;
import os.org.opensearch.index.query.functionscore.FunctionScoreQueryBuilder;
import os.org.opensearch.index.query.functionscore.ScoreFunctionBuilders;
import os.org.opensearch.index.reindex.BulkByScrollResponse;
import os.org.opensearch.index.reindex.DeleteByQueryRequest;
import os.org.opensearch.index.reindex.UpdateByQueryRequest;
import os.org.opensearch.script.Script;
import os.org.opensearch.script.ScriptType;
import os.org.opensearch.search.SearchModule;
import os.org.opensearch.search.aggregations.AggregationBuilder;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.BucketOrder;
import os.org.opensearch.search.aggregations.bucket.histogram.DateHistogramAggregationBuilder;
import os.org.opensearch.search.aggregations.bucket.histogram.DateHistogramInterval;
import os.org.opensearch.search.aggregations.bucket.terms.IncludeExclude;
import os.org.opensearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import os.org.opensearch.search.aggregations.metrics.MaxAggregationBuilder;
import os.org.opensearch.search.aggregations.metrics.SumAggregationBuilder;
import os.org.opensearch.search.builder.SearchSourceBuilder;
import os.org.opensearch.search.fetch.subphase.FetchSourceContext;
import os.org.opensearch.search.fetch.subphase.highlight.HighlightBuilder;
import os.org.opensearch.search.sort.SortOrder;
import os.org.opensearch.search.suggest.Suggest;
import os.org.opensearch.search.suggest.SuggestBuilder;
import os.org.opensearch.search.suggest.SuggestBuilders;
import os.org.opensearch.search.suggest.completion.CompletionSuggestionBuilder;
import os.org.opensearch.search.suggest.completion.context.CategoryQueryContext;

@Slf4j
// Not tagged with Repository annotation as it is programmatically initialized
public class OpenSearchClient implements SearchClient {
  private final RestHighLevelClient client;
  private static final NamedXContentRegistry X_CONTENT_REGISTRY;
  private final boolean isClientAvailable;

  static {
    SearchModule searchModule = new SearchModule(Settings.EMPTY, List.of());
    X_CONTENT_REGISTRY = new NamedXContentRegistry(searchModule.getNamedXContents());
  }

  public OpenSearchClient(ElasticSearchConfiguration esConfig) {
    client = createOpenSearchClient(esConfig);
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
  public boolean createIndex(IndexMapping indexMapping, String indexMappingContent) {
    if (Boolean.TRUE.equals(isClientAvailable)) {
      try {
        CreateIndexRequest request = new CreateIndexRequest(indexMapping.getIndexName());
        request.source(indexMappingContent, XContentType.JSON);
        CreateIndexResponse createIndexResponse = client.indices().create(request, RequestOptions.DEFAULT);
        LOG.debug("{} Created {}", indexMapping.getIndexName(), createIndexResponse.isAcknowledged());
        // creating alias for indexes
        createAliases(indexMapping);
      } catch (Exception e) {
        LOG.error("Failed to create Open Search indexes due to", e);
        return false;
      }
      return true;
    } else {
      LOG.error(
          "Failed to create Open Search index as client is not property configured, Please check your OpenMetadata configuration");
      return false;
    }
  }

  @Override
  public void createAliases(IndexMapping indexMapping) {
    try {
      List<String> aliases = indexMapping.getParentAliases();
      aliases.add(indexMapping.getAlias());
      IndicesAliasesRequest.AliasActions aliasAction =
          IndicesAliasesRequest.AliasActions.add()
              .index(indexMapping.getIndexName())
              .aliases(aliases.toArray(new String[0]));
      IndicesAliasesRequest aliasesRequest = new IndicesAliasesRequest();
      aliasesRequest.addAliasAction(aliasAction);
      client.indices().updateAliases(aliasesRequest, RequestOptions.DEFAULT);
    } catch (Exception e) {
      LOG.error(String.format("Failed to create alias for %s due to", indexMapping.getIndexName()), e);
    }
  }

  @Override
  public void updateIndex(IndexMapping indexMapping, String indexMappingContent) {
    try {
      PutMappingRequest request = new PutMappingRequest(indexMapping.getIndexName());
      request.source(indexMappingContent, XContentType.JSON);
      AcknowledgedResponse putMappingResponse = client.indices().putMapping(request, RequestOptions.DEFAULT);
      LOG.debug("{} Updated {}", indexMapping.getIndexMappingFile(), putMappingResponse.isAcknowledged());
    } catch (Exception e) {
      LOG.error(String.format("Failed to Update Open Search index %s due to", indexMapping.getIndexName()), e);
    }
  }

  @Override
  public void deleteIndex(IndexMapping indexMapping) {
    try {
      DeleteIndexRequest request = new DeleteIndexRequest(indexMapping.getIndexName());
      AcknowledgedResponse deleteIndexResponse = client.indices().delete(request, RequestOptions.DEFAULT);
      LOG.debug("{} Deleted {}", indexMapping.getIndexName(), deleteIndexResponse.isAcknowledged());
    } catch (IOException e) {
      LOG.error("Failed to delete Open Search indexes due to", e);
    }
  }

  @Override
  public Response search(SearchRequest request) throws IOException {
    SearchSourceBuilder searchSourceBuilder;
    switch (request.getIndex()) {
      case "topic_search_index":
        searchSourceBuilder = buildTopicSearchBuilder(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "dashboard_search_index":
        searchSourceBuilder = buildDashboardSearchBuilder(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "pipeline_search_index":
        searchSourceBuilder = buildPipelineSearchBuilder(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "mlmodel_search_index":
        searchSourceBuilder = buildMlModelSearchBuilder(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "table_search_index":
        searchSourceBuilder = buildTableSearchBuilder(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "user_search_index":
      case "team_search_index":
        searchSourceBuilder = buildUserOrTeamSearchBuilder(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "glossary_term_search_index":
        searchSourceBuilder = buildGlossaryTermSearchBuilder(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "tag_search_index":
        searchSourceBuilder = buildTagSearchBuilder(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "container_search_index":
        searchSourceBuilder = buildContainerSearchBuilder(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "query_search_index":
        searchSourceBuilder = buildQuerySearchBuilder(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "test_case_search_index":
        searchSourceBuilder = buildTestCaseSearch(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "stored_procedure_search_index":
        searchSourceBuilder = buildStoredProcedureSearch(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "dashboard_data_model_search_index":
        searchSourceBuilder = buildDashboardDataModelsSearch(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "domain_search_index":
        searchSourceBuilder = buildDomainsSearch(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "search_entity_index":
        searchSourceBuilder = buildSearchEntitySearch(request.getQuery(), request.getFrom(), request.getSize());
        break;
      case "raw_cost_analysis_report_data_index":
      case "aggregated_cost_analysis_report_data_index":
        searchSourceBuilder =
            buildCostAnalysisReportDataSearch(request.getQuery(), request.getFrom(), request.getSize());
        break;
      default:
        searchSourceBuilder = buildAggregateSearchBuilder(request.getQuery(), request.getFrom(), request.getSize());
        break;
    }
    if (!nullOrEmpty(request.getQueryFilter()) && !request.getQueryFilter().equals("{}")) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(X_CONTENT_REGISTRY, LoggingDeprecationHandler.INSTANCE, request.getQueryFilter());
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        BoolQueryBuilder newQuery = QueryBuilders.boolQuery().must(searchSourceBuilder.query()).filter(filter);
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
                .createParser(X_CONTENT_REGISTRY, LoggingDeprecationHandler.INSTANCE, request.getPostFilter());
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        searchSourceBuilder.postFilter(filter);
      } catch (Exception ex) {
        LOG.warn("Error parsing post_filter from query parameters, ignoring filter", ex);
      }
    }

    /* For backward-compatibility we continue supporting the deleted argument, this should be removed in future versions */
    if (request.getIndex().equalsIgnoreCase("domain_search_index")
        || request.getIndex().equalsIgnoreCase("data_products_search_index")
        || request.getIndex().equalsIgnoreCase("query_search_index")
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
      searchSourceBuilder.sort(request.getSortFieldParam(), SortOrder.fromString(request.getSortOrder()));
    }

    /* for performance reasons OpenSearch doesn't provide accurate hits
    if we enable trackTotalHits parameter it will try to match every result, count and return hits
    however in most cases for search results an approximate value is good enough.
    we are displaying total entity counts in landing page and explore page where we need the total count
    https://github.com/Open/Opensearch/issues/33028 */
    searchSourceBuilder.fetchSource(
        new FetchSourceContext(
            request.fetchSource(), request.getIncludeSourceFields().toArray(String[]::new), new String[] {}));

    if (request.trackTotalHits()) {
      searchSourceBuilder.trackTotalHits(true);
    } else {
      searchSourceBuilder.trackTotalHitsUpTo(MAX_RESULT_HITS);
    }

    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    String response =
        client
            .search(
                new os.org.opensearch.action.search.SearchRequest(request.getIndex()).source(searchSourceBuilder),
                RequestOptions.DEFAULT)
            .toString();
    return Response.status(OK).entity(response).build();
  }

  @Override
  public Response searchBySourceUrl(String sourceUrl) throws IOException {
    QueryBuilder wildcardQuery = QueryBuilders.queryStringQuery(sourceUrl).field("sourceUrl").escape(true);
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(GLOBAL_SEARCH_ALIAS);
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(wildcardQuery);
    searchRequest.source(searchSourceBuilder);
    String response = client.search(searchRequest, RequestOptions.DEFAULT).toString();
    return Response.status(OK).entity(response).build();
  }

  @Override
  public Response searchByField(String fieldName, String fieldValue, String index) throws IOException {
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(index);
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(QueryBuilders.wildcardQuery(fieldName, fieldValue));
    searchRequest.source(searchSourceBuilder);
    String response = client.search(searchRequest, RequestOptions.DEFAULT).toString();
    return Response.status(OK).entity(response).build();
  }

  public Response aggregate(String index, String fieldName, String value, String query) throws IOException {
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    XContentParser filterParser =
        XContentType.JSON.xContent().createParser(X_CONTENT_REGISTRY, LoggingDeprecationHandler.INSTANCE, query);
    QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();

    BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery().must(filter);
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms(fieldName)
                .field(fieldName)
                .size(MAX_AGGREGATE_SIZE)
                .includeExclude(new IncludeExclude(value, null))
                .order(BucketOrder.key(true)))
        .query(boolQueryBuilder)
        .size(0);
    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    String response =
        client
            .search(
                new os.org.opensearch.action.search.SearchRequest(index).source(searchSourceBuilder),
                RequestOptions.DEFAULT)
            .toString();
    return Response.status(OK).entity(response).build();
  }

  public void updateSearch(UpdateRequest updateRequest) {
    if (updateRequest != null) {
      updateRequest.docAsUpsert(true);
      updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, updateRequest);
      ActionListener<UpdateResponse> listener =
          new ActionListener<>() {
            @Override
            public void onResponse(UpdateResponse updateResponse) {
              LOG.debug("Entity Updated successfully: " + updateResponse.toString());
            }

            @Override
            public void onFailure(Exception e) {
              LOG.error("Entity Update failed: " + e.getMessage());
            }
          };
      client.updateAsync(updateRequest, RequestOptions.DEFAULT, listener);
    }
  }

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
                  CategoryQueryContext.builder().setCategory(String.valueOf(request.deleted())).build())));
    }
    SuggestBuilder suggestBuilder = new SuggestBuilder();
    suggestBuilder.addSuggestion("metadata-suggest", suggestionBuilder);
    searchSourceBuilder
        .suggest(suggestBuilder)
        .timeout(new TimeValue(30, TimeUnit.SECONDS))
        .fetchSource(
            new FetchSourceContext(
                request.fetchSource(), request.getIncludeSourceFields().toArray(String[]::new), new String[] {}));
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(request.getIndex()).source(searchSourceBuilder);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    Suggest suggest = searchResponse.getSuggest();
    return Response.status(OK).entity(suggest.toString()).build();
  }

  private static SearchSourceBuilder buildPipelineSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(PipelineIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    HighlightBuilder.Field highlightPipelineName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightPipelineName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightTasks = new HighlightBuilder.Field("tasks.name");
    highlightTasks.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightTaskDescriptions = new HighlightBuilder.Field("tasks.description");
    highlightTaskDescriptions.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightPipelineName);
    hb.field(highlightTasks);
    hb.field(highlightTaskDescriptions);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("tasks.displayName.keyword").field("tasks.displayName.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildMlModelSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(MlModelIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    HighlightBuilder.Field highlightPipelineName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightPipelineName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightTasks = new HighlightBuilder.Field("mlFeatures.name");
    highlightTasks.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightTaskDescriptions = new HighlightBuilder.Field("mlFeatures.description");
    highlightTaskDescriptions.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightPipelineName);
    hb.field(highlightTasks);
    hb.field(highlightTaskDescriptions);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildTopicSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(TopicIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    HighlightBuilder.Field highlightTopicName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightTopicName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightTopicName);
    hb.field(new HighlightBuilder.Field("messageSchema.schemaFields.description").highlighterType(UNIFIED));
    hb.field(new HighlightBuilder.Field("messageSchema.schemaFields.children.name").highlighterType(UNIFIED));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder.aggregation(AggregationBuilders.terms(ES_MESSAGE_SCHEMA_FIELD).field(ES_MESSAGE_SCHEMA_FIELD));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildDashboardSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(DashboardIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    HighlightBuilder.Field highlightDashboardName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightDashboardName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightCharts = new HighlightBuilder.Field("charts.name");
    highlightCharts.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightChartDescriptions = new HighlightBuilder.Field("charts.description");
    highlightChartDescriptions.highlighterType(UNIFIED);

    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightDashboardName);
    hb.field(highlightCharts);
    hb.field(highlightChartDescriptions);

    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms("dataModels.displayName.keyword").field("dataModels.displayName.keyword"))
        .aggregation(AggregationBuilders.terms("charts.displayName.keyword").field("charts.displayName.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildTableSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(TableIndex.getFields())
            .type(MultiMatchQueryBuilder.Type.BEST_FIELDS)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    FieldValueFactorFunctionBuilder boostScoreBuilder =
        ScoreFunctionBuilders.fieldValueFactorFunction("usageSummary.weeklyStats.count").missing(0).factor(0.2f);
    FunctionScoreQueryBuilder.FilterFunctionBuilder[] functions =
        new FunctionScoreQueryBuilder.FilterFunctionBuilder[] {
          new FunctionScoreQueryBuilder.FilterFunctionBuilder(boostScoreBuilder)
        };
    FunctionScoreQueryBuilder queryBuilder = QueryBuilders.functionScoreQuery(queryStringBuilder, functions);
    queryBuilder.boostMode(CombineFunction.SUM);
    HighlightBuilder.Field highlightTableName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightTableName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    HighlightBuilder.Field highlightColumns = new HighlightBuilder.Field("columns.name");
    highlightColumns.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightColumnDescriptions = new HighlightBuilder.Field("columns.description");
    highlightColumnDescriptions.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightColumnChildren = new HighlightBuilder.Field("columns.children.name");
    highlightColumnDescriptions.highlighterType(UNIFIED);
    hb.field(highlightDescription);
    hb.field(highlightTableName);
    hb.field(highlightColumns);
    hb.field(highlightColumnDescriptions);
    hb.field(highlightColumnChildren);
    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(AggregationBuilders.terms("database.name.keyword").field("database.name.keyword"));
    searchSourceBuilder
        .aggregation(AggregationBuilders.terms("databaseSchema.name.keyword").field("databaseSchema.name.keyword"))
        .aggregation(AggregationBuilders.terms(COLUMNS_NAME_KEYWORD).field(COLUMNS_NAME_KEYWORD))
        .aggregation(AggregationBuilders.terms("tableType").field("tableType"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildUserOrTeamSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(UserIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    return searchBuilder(queryBuilder, null, from, size);
  }

  private static SearchSourceBuilder buildGlossaryTermSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(GlossaryTermIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightGlossaryName = new HighlightBuilder.Field(FIELD_NAME);
    highlightGlossaryName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightGlossaryDisplayName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightGlossaryDisplayName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightSynonym = new HighlightBuilder.Field("synonyms");
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightGlossaryName);
    hb.field(highlightGlossaryDisplayName);
    hb.field(highlightSynonym);

    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(AggregationBuilders.terms("glossary.name.keyword").field("glossary.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildTagSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(TagIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightTagName = new HighlightBuilder.Field(FIELD_NAME);
    highlightTagName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightTagDisplayName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightTagDisplayName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightTagDisplayName);
    hb.field(highlightDescription);
    hb.field(highlightTagName);
    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("classification.name.keyword").field("classification.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildContainerSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(ContainerIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    HighlightBuilder.Field highlightContainerName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightContainerName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    HighlightBuilder.Field highlightColumns = new HighlightBuilder.Field("dataModel.columns.name");
    highlightColumns.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightColumnDescriptions = new HighlightBuilder.Field("dataModel.columns.description");
    highlightColumnDescriptions.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightColumnChildren = new HighlightBuilder.Field("dataModel.columns.children.name");
    highlightColumnDescriptions.highlighterType(UNIFIED);
    hb.field(highlightDescription);
    hb.field(highlightContainerName);
    hb.field(highlightColumns);
    hb.field(highlightColumnDescriptions);
    hb.field(highlightColumnChildren);
    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms(DATA_MODEL_COLUMNS_NAME_KEYWORD).field(DATA_MODEL_COLUMNS_NAME_KEYWORD));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildQuerySearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(QueryIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightGlossaryName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightGlossaryName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightQuery = new HighlightBuilder.Field(QUERY);
    highlightGlossaryName.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightGlossaryName);
    hb.field(highlightQuery);
    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildTestCaseSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(TestCaseIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightTestCaseDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightTestCaseDescription.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightTestCaseName = new HighlightBuilder.Field(FIELD_NAME);
    highlightTestCaseName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightTestSuiteName = new HighlightBuilder.Field("testSuite.name");
    highlightTestSuiteName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightTestSuiteDescription = new HighlightBuilder.Field("testSuite.description");
    highlightTestSuiteDescription.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightTestCaseDescription);
    hb.field(highlightTestCaseName);
    hb.field(highlightTestSuiteName);
    hb.field(highlightTestSuiteDescription);

    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);

    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildStoredProcedureSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(StoredProcedureIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightName = new HighlightBuilder.Field(FIELD_NAME);
    highlightName.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightName);
    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);

    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildDashboardDataModelsSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(DashboardDataModelIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightName = new HighlightBuilder.Field(FIELD_NAME);
    highlightName.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightName);

    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);

    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder
        .aggregation(AggregationBuilders.terms("dataModelType").field("dataModelType"))
        .aggregation(AggregationBuilders.terms(COLUMNS_NAME_KEYWORD).field(COLUMNS_NAME_KEYWORD))
        .aggregation(AggregationBuilders.terms("project.keyword").field("project.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildCostAnalysisReportDataSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder = QueryBuilders.queryStringQuery(query);
    return searchBuilder(queryBuilder, null, from, size);
  }

  private static SearchSourceBuilder buildDomainsSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(DomainIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightName = new HighlightBuilder.Field(FIELD_NAME);
    highlightName.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightName);

    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);

    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildSearchEntitySearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(SearchEntityIndex.getFields())
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightName = new HighlightBuilder.Field(FIELD_NAME);
    highlightName.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightName);

    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);

    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(AggregationBuilders.terms("fields.name.keyword").field("fields.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildAggregateSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder = QueryBuilders.queryStringQuery(query).lenient(true);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, null, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder addAggregation(SearchSourceBuilder builder) {
    builder
        .aggregation(AggregationBuilders.terms("serviceType").field("serviceType").size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("service.name.keyword").field("service.name.keyword").size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("entityType.keyword").field("entityType.keyword").size(MAX_AGGREGATE_SIZE))
        .aggregation(AggregationBuilders.terms("tier.tagFQN").field("tier.tagFQN").size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms(OWNER_DISPLAY_NAME_KEYWORD)
                .field(OWNER_DISPLAY_NAME_KEYWORD)
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms(DOMAIN_DISPLAY_NAME_KEYWORD)
                .field(DOMAIN_DISPLAY_NAME_KEYWORD)
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(AggregationBuilders.terms(ES_TAG_FQN_FIELD).field(ES_TAG_FQN_FIELD));
    return builder;
  }

  private static SearchSourceBuilder searchBuilder(QueryBuilder queryBuilder, HighlightBuilder hb, int from, int size) {
    SearchSourceBuilder builder = new SearchSourceBuilder().query(queryBuilder).from(from).size(size);
    if (hb != null) {
      hb.preTags(PRE_TAG);
      hb.postTags(POST_TAG);
      builder.highlighter(hb);
    }
    return builder;
  }

  @Override
  public ElasticSearchConfiguration.SearchType getSearchType() {
    return ElasticSearchConfiguration.SearchType.OPENSEARCH;
  }

  @Override
  public void createEntity(String indexName, String docId, String doc) {
    if (isClientAvailable) {
      UpdateRequest updateRequest = new UpdateRequest(indexName, docId);
      updateRequest.doc(doc, XContentType.JSON);
      updateSearch(updateRequest);
    }
  }

  @Override
  public void createTimeSeriesEntity(String indexName, String docId, String doc) {
    if (isClientAvailable) {
      UpdateRequest updateRequest = new UpdateRequest(indexName, docId);
      updateRequest.doc(doc, XContentType.JSON);
      updateSearch(updateRequest);
    }
  }

  @Override
  public void deleteByScript(String indexName, String scriptTxt, Map<String, Object> params) {
    if (isClientAvailable) {
      Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, params);
      ScriptQueryBuilder scriptQuery = new ScriptQueryBuilder(script);
      DeleteByQueryRequest deleteByQueryRequest = new DeleteByQueryRequest(indexName);
      deleteByQueryRequest.setQuery(scriptQuery);
      deleteEntityFromOpenSearchByQuery(deleteByQueryRequest);
    }
  }

  @Override
  public void deleteEntity(String indexName, String docId) {
    if (isClientAvailable) {
      DeleteRequest deleteRequest = new DeleteRequest(indexName, docId);
      deleteEntityFromOpenSearch(deleteRequest);
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
      deleteEntityFromOpenSearchByQuery(deleteByQueryRequest);
    }
  }

  @Override
  public void softDeleteOrRestoreEntity(String indexName, String docId, String scriptTxt) {
    if (isClientAvailable) {
      UpdateRequest updateRequest = new UpdateRequest(indexName, docId);
      Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, new HashMap<>());
      updateRequest.script(script);
      updateSearch(updateRequest);
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
      Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, new HashMap<>());
      updateByQueryRequest.setScript(script);
      updateOpenSearchByQuery(updateByQueryRequest);
    }
  }

  @Override
  public void updateEntity(String indexName, String docId, Map<String, Object> doc, String scriptTxt) {
    if (isClientAvailable) {
      UpdateRequest updateRequest = new UpdateRequest(indexName, docId);
      Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, JsonUtils.getMap(doc));
      updateRequest.scriptedUpsert(true);
      updateRequest.script(script);
      updateOpenSearch(updateRequest);
    }
  }

  @Override
  public void updateChildren(
      String indexName, Pair<String, String> fieldAndValue, Pair<String, EntityReference> updates) {
    if (isClientAvailable) {
      UpdateByQueryRequest updateByQueryRequest = new UpdateByQueryRequest(indexName);
      updateByQueryRequest.setQuery(new MatchQueryBuilder(fieldAndValue.getKey(), fieldAndValue.getValue()));
      Script script =
          new Script(
              ScriptType.INLINE,
              Script.DEFAULT_SCRIPT_LANG,
              updates.getKey(),
              JsonUtils.getMap(updates.getValue() == null ? new HashMap<>() : updates.getValue()));
      updateByQueryRequest.setScript(script);
      updateOpenSearchByQuery(updateByQueryRequest);
    }
  }

  private void updateOpenSearchByQuery(UpdateByQueryRequest updateByQueryRequest) {
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

  public void updateOpenSearch(UpdateRequest updateRequest) {
    if (updateRequest != null && isClientAvailable) {
      updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, updateRequest);
      ActionListener<UpdateResponse> listener =
          new ActionListener<>() {
            @Override
            public void onResponse(UpdateResponse updateResponse) {
              LOG.debug("Entity Updated successfully: " + updateResponse.toString());
            }

            @Override
            public void onFailure(Exception e) {
              LOG.error("Entity Update failed: " + e.getMessage());
            }
          };
      client.updateAsync(updateRequest, RequestOptions.DEFAULT, listener);
    }
  }

  private void deleteEntityFromOpenSearch(DeleteRequest deleteRequest) {
    if (deleteRequest != null && isClientAvailable) {
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, deleteRequest);
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

  private void deleteEntityFromOpenSearchByQuery(DeleteByQueryRequest deleteRequest) {
    if (deleteRequest != null && isClientAvailable) {
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

  /** */
  @Override
  public void close() {
    try {
      this.client.close();
    } catch (Exception e) {
      LOG.error("Failed to close open search", e);
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
    os.org.opensearch.action.search.SearchRequest searchRequestTotalAssets =
        buildSearchRequest(scheduleTime, currentTime, null, team, chartType, null, null, null, indexName);
    SearchResponse searchResponseTotalAssets = client.search(searchRequestTotalAssets, RequestOptions.DEFAULT);
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
    os.org.opensearch.action.search.SearchRequest searchRequest =
        buildSearchRequest(startTs, endTs, tier, team, dataInsightChartName, size, from, queryFilter, dataReportIndex);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    return Response.status(OK).entity(processDataInsightChartResult(searchResponse, dataInsightChartName)).build();
  }

  private static DataInsightChartResult processDataInsightChartResult(
      SearchResponse searchResponse, DataInsightChartResult.DataInsightChartType dataInsightChartName)
      throws ParseException {
    DataInsightAggregatorInterface processor = createDataAggregator(searchResponse, dataInsightChartName);
    return processor.process(dataInsightChartName);
  }

  private static DataInsightAggregatorInterface createDataAggregator(
      SearchResponse aggregations, DataInsightChartResult.DataInsightChartType dataInsightChartType)
      throws IllegalArgumentException {
    switch (dataInsightChartType) {
      case PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE:
        return new OpenSearchEntitiesDescriptionAggregator(aggregations.getAggregations());
      case PERCENTAGE_OF_SERVICES_WITH_DESCRIPTION:
        return new OpenSearchServicesDescriptionAggregator(aggregations.getAggregations());
      case PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE:
        return new OpenSearchEntitiesOwnerAggregator(aggregations.getAggregations());
      case PERCENTAGE_OF_SERVICES_WITH_OWNER:
        return new OpenSearchServicesOwnerAggregator(aggregations.getAggregations());
      case TOTAL_ENTITIES_BY_TYPE:
        return new OpenSearchTotalEntitiesAggregator(aggregations.getAggregations());
      case TOTAL_ENTITIES_BY_TIER:
        return new OpenSearchTotalEntitiesByTierAggregator(aggregations.getAggregations());
      case DAILY_ACTIVE_USERS:
        return new OpenSearchDailyActiveUsersAggregator(aggregations.getAggregations());
      case PAGE_VIEWS_BY_ENTITIES:
        return new OpenSearchPageViewsByEntitiesAggregator(aggregations.getAggregations());
      case MOST_ACTIVE_USERS:
        return new OpenSearchMostActiveUsersAggregator(aggregations.getAggregations());
      case MOST_VIEWED_ENTITIES:
        return new OpenSearchMostViewedEntitiesAggregator(aggregations.getAggregations());
      case UNUSED_ASSETS:
        return new OpenSearchUnusedAssetsAggregator(aggregations.getHits());
      case AGGREGATED_UNUSED_ASSETS_SIZE:
        return new OpenSearchAggregatedUnusedAssetsSizeAggregator(aggregations.getAggregations());
      case AGGREGATED_UNUSED_ASSETS_COUNT:
        return new OpenSearchAggregatedUnusedAssetsCountAggregator(aggregations.getAggregations());
      case AGGREGATED_USED_VS_UNUSED_ASSETS_COUNT:
        return new OpenSearchAggregatedUsedvsUnusedAssetsCountAggregator(aggregations.getAggregations());
      case AGGREGATED_USED_VS_UNUSED_ASSETS_SIZE:
        return new OpenSearchAggregatedUsedvsUnusedAssetsSizeAggregator(aggregations.getAggregations());
      default:
        throw new IllegalArgumentException(
            String.format("No processor found for chart Type %s ", dataInsightChartType));
    }
  }

  private static os.org.opensearch.action.search.SearchRequest buildSearchRequest(
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
      searchSourceBuilder.fetchSource(true);
      searchSourceBuilder.from(from);
      searchSourceBuilder.size(size);
      searchSourceBuilder.sort("data.lifeCycle.accessed.timestamp", SortOrder.DESC);
    }

    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(dataReportIndex);
    searchRequest.source(searchSourceBuilder);
    return searchRequest;
  }

  private static SearchSourceBuilder buildQueryFilter(
      Long startTs, Long endTs, String tier, String team, String queryFilter, String dataInsightChartName) {

    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    BoolQueryBuilder searchQueryFiler = new BoolQueryBuilder();

    if (team != null && DataInsightChartRepository.SUPPORTS_TEAM_FILTER.contains(dataInsightChartName)) {
      List<String> teamArray = Arrays.asList(team.split("\\s*,\\s*"));

      BoolQueryBuilder teamQueryFilter = QueryBuilders.boolQuery();
      teamQueryFilter.should(QueryBuilders.termsQuery(DataInsightChartRepository.DATA_TEAM, teamArray));
      searchQueryFiler.must(teamQueryFilter);
    }

    if (tier != null && DataInsightChartRepository.SUPPORTS_TIER_FILTER.contains(dataInsightChartName)) {
      List<String> tierArray = Arrays.asList(tier.split("\\s*,\\s*"));

      BoolQueryBuilder tierQueryFilter = QueryBuilders.boolQuery();
      tierQueryFilter.should(QueryBuilders.termsQuery(DataInsightChartRepository.DATA_ENTITY_TIER, tierArray));
      searchQueryFiler.must(tierQueryFilter);
    }

    if (!DataInsightChartRepository.SUPPORTS_NULL_DATE_RANGE.contains(dataInsightChartName)) {
      if (startTs == null || endTs == null) {
        throw new IllegalArgumentException(
            String.format("Start and End date are required for chart type %s ", dataInsightChartName));
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
                .createParser(X_CONTENT_REGISTRY, LoggingDeprecationHandler.INSTANCE, queryFilter);
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        BoolQueryBuilder newQuery = QueryBuilders.boolQuery().must(searchSourceBuilder.query()).filter(filter);
        searchSourceBuilder.query(newQuery);
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }

    return searchSourceBuilder;
  }

  private static AggregationBuilder buildQueryAggregation(
      DataInsightChartResult.DataInsightChartType dataInsightChartName) throws IllegalArgumentException {
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
      case AGGREGATED_UNUSED_ASSETS_COUNT:
      case AGGREGATED_UNUSED_ASSETS_SIZE:
        boolean isSize =
            dataInsightChartName.equals(DataInsightChartResult.DataInsightChartType.AGGREGATED_UNUSED_ASSETS_SIZE);
        String fieldType = isSize ? "size" : "count";
        String totalField = isSize ? "totalSize" : "totalCount";
        SumAggregationBuilder threeDaysAgg =
            AggregationBuilders.sum("threeDays").field(String.format("data.unusedDataAssets.%s.threeDays", fieldType));
        SumAggregationBuilder sevenDaysAgg =
            AggregationBuilders.sum("sevenDays").field(String.format("data.unusedDataAssets.%s.sevenDays", fieldType));
        SumAggregationBuilder fourteenDaysAgg =
            AggregationBuilders.sum("fourteenDays")
                .field(String.format("data.unusedDataAssets.%s.fourteenDays", fieldType));
        SumAggregationBuilder thirtyDaysAgg =
            AggregationBuilders.sum("thirtyDays")
                .field(String.format("data.unusedDataAssets.%s.thirtyDays", fieldType));
        SumAggregationBuilder sixtyDaysAgg =
            AggregationBuilders.sum("sixtyDays").field(String.format("data.unusedDataAssets.%s.sixtyDays", fieldType));
        SumAggregationBuilder totalUnused =
            AggregationBuilders.sum("totalUnused").field(String.format("data.unusedDataAssets.%s", totalField));
        SumAggregationBuilder totalUsed =
            AggregationBuilders.sum("totalUsed").field(String.format("data.unusedDataAssets.%s", totalField));
        return dateHistogramAggregationBuilder
            .subAggregation(threeDaysAgg)
            .subAggregation(sevenDaysAgg)
            .subAggregation(fourteenDaysAgg)
            .subAggregation(thirtyDaysAgg)
            .subAggregation(sixtyDaysAgg)
            .subAggregation(totalUnused)
            .subAggregation(totalUsed);
      case AGGREGATED_USED_VS_UNUSED_ASSETS_SIZE:
      case AGGREGATED_USED_VS_UNUSED_ASSETS_COUNT:
        boolean isSizeReport =
            dataInsightChartName.equals(
                DataInsightChartResult.DataInsightChartType.AGGREGATED_USED_VS_UNUSED_ASSETS_SIZE);
        String totalFieldString = isSizeReport ? "totalSize" : "totalCount";
        SumAggregationBuilder totalUnusedAssets =
            AggregationBuilders.sum("totalUnused").field(String.format("data.unusedDataAssets.%s", totalFieldString));
        SumAggregationBuilder totalUsedAssets =
            AggregationBuilders.sum("totalUsed")
                .field(String.format("data.frequentlyUsedDataAssets.%s", totalFieldString));
        return dateHistogramAggregationBuilder.subAggregation(totalUnusedAssets).subAggregation(totalUsedAssets);
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
            AggregationBuilders.sum(DataInsightChartRepository.PAGE_VIEWS).field(DataInsightChartRepository.DATA_VIEWS);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder.subAggregation(sumPageViewsByEntityTypes));
      case MOST_VIEWED_ENTITIES:
        termsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_FQN)
                .field(DataInsightChartRepository.DATA_ENTITY_FQN)
                .size(10)
                .order(BucketOrder.aggregation(DataInsightChartRepository.PAGE_VIEWS, false));

        TermsAggregationBuilder ownerTermsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.OWNER).field(DataInsightChartRepository.DATA_OWNER);
        TermsAggregationBuilder entityTypeTermsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_TYPE)
                .field(DataInsightChartRepository.DATA_ENTITY_TYPE);
        TermsAggregationBuilder entityHrefAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_HREF)
                .field(DataInsightChartRepository.DATA_ENTITY_HREF);
        SumAggregationBuilder sumEntityPageViewsAggregationBuilder =
            AggregationBuilders.sum(DataInsightChartRepository.PAGE_VIEWS).field(DataInsightChartRepository.DATA_VIEWS);

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
            AggregationBuilders.terms(DataInsightChartRepository.TEAM).field(DataInsightChartRepository.DATA_TEAM);
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
        throw new IllegalArgumentException(String.format("Invalid dataInsightChartType name %s", dataInsightChartName));
    }
  }

  public RestHighLevelClient createOpenSearchClient(ElasticSearchConfiguration esConfig) {
    if (esConfig != null) {
      try {
        RestClientBuilder restClientBuilder =
            RestClient.builder(new HttpHost(esConfig.getHost(), esConfig.getPort(), esConfig.getScheme()));
        if (StringUtils.isNotEmpty(esConfig.getUsername()) && StringUtils.isNotEmpty(esConfig.getPassword())) {
          CredentialsProvider credentialsProvider = new BasicCredentialsProvider();
          credentialsProvider.setCredentials(
              AuthScope.ANY, new UsernamePasswordCredentials(esConfig.getUsername(), esConfig.getPassword()));
          SSLContext sslContext = createElasticSearchSSLContext(esConfig);
          restClientBuilder.setHttpClientConfigCallback(
              httpAsyncClientBuilder -> {
                httpAsyncClientBuilder.setDefaultCredentialsProvider(credentialsProvider);
                if (sslContext != null) {
                  httpAsyncClientBuilder.setSSLContext(sslContext);
                }
                return httpAsyncClientBuilder;
              });
        }
        restClientBuilder.setRequestConfigCallback(
            requestConfigBuilder ->
                requestConfigBuilder
                    .setConnectTimeout(esConfig.getConnectionTimeoutSecs() * 1000)
                    .setSocketTimeout(esConfig.getSocketTimeoutSecs() * 1000));
        return new RestHighLevelClient(restClientBuilder);
      } catch (Exception e) {
        LOG.error("Failed to create open search client ", e);
        return null;
      }
    } else {
      return null;
    }
  }
}
