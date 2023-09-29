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
import static org.openmetadata.service.search.IndexUtil.createElasticSearchSSLContext;
import static org.openmetadata.service.search.SearchIndexDefinition.ENTITY_TO_MAPPING_SCHEMA_MAP;
import static org.openmetadata.service.search.SearchIndexDefinition.ENTITY_TO_SEARCH_ALIAS_MAPPING;
import static org.openmetadata.service.search.UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH;

import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.SSLContext;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpHost;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.DataInsightInterface;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DataInsightChartRepository;
import org.openmetadata.service.search.IndexUtil;
import org.openmetadata.service.search.SearchEventPublisher;
import org.openmetadata.service.search.SearchIndexDefinition;
import org.openmetadata.service.search.SearchIndexFactory;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchRequest;
import org.openmetadata.service.search.SearchRetriableException;
import org.openmetadata.service.search.UpdateSearchEventsConstant;
import org.openmetadata.service.search.indexes.ContainerIndex;
import org.openmetadata.service.search.indexes.DashboardDataModelIndex;
import org.openmetadata.service.search.indexes.DashboardIndex;
import org.openmetadata.service.search.indexes.DomainIndex;
import org.openmetadata.service.search.indexes.ElasticSearchIndex;
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
import org.openmetadata.service.util.JsonUtils;
import org.opensearch.OpenSearchException;
import org.opensearch.action.ActionListener;
import org.opensearch.action.admin.indices.alias.IndicesAliasesRequest;
import org.opensearch.action.admin.indices.delete.DeleteIndexRequest;
import org.opensearch.action.bulk.BulkItemResponse;
import org.opensearch.action.bulk.BulkRequest;
import org.opensearch.action.bulk.BulkResponse;
import org.opensearch.action.delete.DeleteRequest;
import org.opensearch.action.delete.DeleteResponse;
import org.opensearch.action.search.SearchResponse;
import org.opensearch.action.support.WriteRequest;
import org.opensearch.action.support.master.AcknowledgedResponse;
import org.opensearch.action.update.UpdateRequest;
import org.opensearch.action.update.UpdateResponse;
import org.opensearch.client.RequestOptions;
import org.opensearch.client.RestClient;
import org.opensearch.client.RestClientBuilder;
import org.opensearch.client.RestHighLevelClient;
import org.opensearch.client.indices.CreateIndexRequest;
import org.opensearch.client.indices.CreateIndexResponse;
import org.opensearch.client.indices.GetIndexRequest;
import org.opensearch.client.indices.PutMappingRequest;
import org.opensearch.common.lucene.search.function.CombineFunction;
import org.opensearch.common.settings.Settings;
import org.opensearch.common.unit.Fuzziness;
import org.opensearch.common.unit.TimeValue;
import org.opensearch.common.xcontent.LoggingDeprecationHandler;
import org.opensearch.common.xcontent.NamedXContentRegistry;
import org.opensearch.common.xcontent.XContentParser;
import org.opensearch.common.xcontent.XContentType;
import org.opensearch.index.engine.DocumentMissingException;
import org.opensearch.index.query.BoolQueryBuilder;
import org.opensearch.index.query.MatchQueryBuilder;
import org.opensearch.index.query.MultiMatchQueryBuilder;
import org.opensearch.index.query.Operator;
import org.opensearch.index.query.QueryBuilder;
import org.opensearch.index.query.QueryBuilders;
import org.opensearch.index.query.QueryStringQueryBuilder;
import org.opensearch.index.query.RangeQueryBuilder;
import org.opensearch.index.query.ScriptQueryBuilder;
import org.opensearch.index.query.TermQueryBuilder;
import org.opensearch.index.query.functionscore.FieldValueFactorFunctionBuilder;
import org.opensearch.index.query.functionscore.FunctionScoreQueryBuilder;
import org.opensearch.index.query.functionscore.ScoreFunctionBuilders;
import org.opensearch.index.reindex.BulkByScrollResponse;
import org.opensearch.index.reindex.DeleteByQueryRequest;
import org.opensearch.index.reindex.UpdateByQueryRequest;
import org.opensearch.rest.RestStatus;
import org.opensearch.script.Script;
import org.opensearch.script.ScriptType;
import org.opensearch.search.SearchModule;
import org.opensearch.search.aggregations.AggregationBuilder;
import org.opensearch.search.aggregations.AggregationBuilders;
import org.opensearch.search.aggregations.Aggregations;
import org.opensearch.search.aggregations.BucketOrder;
import org.opensearch.search.aggregations.bucket.histogram.DateHistogramAggregationBuilder;
import org.opensearch.search.aggregations.bucket.histogram.DateHistogramInterval;
import org.opensearch.search.aggregations.bucket.terms.IncludeExclude;
import org.opensearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import org.opensearch.search.aggregations.metrics.MaxAggregationBuilder;
import org.opensearch.search.aggregations.metrics.SumAggregationBuilder;
import org.opensearch.search.builder.SearchSourceBuilder;
import org.opensearch.search.fetch.subphase.FetchSourceContext;
import org.opensearch.search.fetch.subphase.highlight.HighlightBuilder;
import org.opensearch.search.sort.SortOrder;
import org.opensearch.search.suggest.Suggest;
import org.opensearch.search.suggest.SuggestBuilder;
import org.opensearch.search.suggest.SuggestBuilders;
import org.opensearch.search.suggest.completion.CompletionSuggestionBuilder;
import org.opensearch.search.suggest.completion.context.CategoryQueryContext;

@Slf4j
public class OpenSearchClientImpl implements SearchRepository {
  private final RestHighLevelClient client;
  private final CollectionDAO dao;
  private final EnumMap<SearchIndexDefinition.ElasticSearchIndexType, IndexUtil.ElasticSearchIndexStatus>
      elasticSearchIndexes = new EnumMap<>(SearchIndexDefinition.ElasticSearchIndexType.class);

  public OpenSearchClientImpl(ElasticSearchConfiguration esConfig, CollectionDAO dao) {
    this.client = createOpenSearchClient(esConfig);
    this.dao = dao;
  }

  private static final NamedXContentRegistry X_CONTENT_REGISTRY;

  static {
    SearchModule searchModule = new SearchModule(Settings.EMPTY, false, List.of());
    X_CONTENT_REGISTRY = new NamedXContentRegistry(searchModule.getNamedXContents());
  }

  @Override
  public boolean createIndex(SearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType, String lang) {
    try {
      GetIndexRequest gRequest = new GetIndexRequest(elasticSearchIndexType.indexName);
      gRequest.local(false);
      boolean exists = client.indices().exists(gRequest, RequestOptions.DEFAULT);
      String elasticSearchIndexMapping = getIndexMapping(elasticSearchIndexType, lang);
      ENTITY_TO_MAPPING_SCHEMA_MAP.put(
          elasticSearchIndexType.entityType, JsonUtils.getMap(JsonUtils.readJson(elasticSearchIndexMapping)));
      if (!exists) {
        CreateIndexRequest request = new CreateIndexRequest(elasticSearchIndexType.indexName);
        request.source(elasticSearchIndexMapping, XContentType.JSON);
        CreateIndexResponse createIndexResponse = client.indices().create(request, RequestOptions.DEFAULT);
        LOG.info("{} Created {}", elasticSearchIndexType.indexName, createIndexResponse.isAcknowledged());
        // creating alias for indexes
        createAliases(elasticSearchIndexType);
      }
      elasticSearchIndexes.put(elasticSearchIndexType, IndexUtil.ElasticSearchIndexStatus.CREATED);
    } catch (Exception e) {
      elasticSearchIndexes.put(elasticSearchIndexType, IndexUtil.ElasticSearchIndexStatus.FAILED);
      updateElasticSearchFailureStatus(
          IndexUtil.getContext("Creating Index", elasticSearchIndexType.indexName),
          String.format(IndexUtil.REASON_TRACE, e.getMessage(), ExceptionUtils.getStackTrace(e)));
      LOG.error("Failed to create Elastic Search indexes due to", e);
      return false;
    }
    return true;
  }

  private void createAliases(SearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType) {
    ActionListener<AcknowledgedResponse> listener =
        new ActionListener<>() {
          @Override
          public void onResponse(AcknowledgedResponse acknowledgedResponse) {
            LOG.info("Created successfully: " + acknowledgedResponse.toString());
          }

          @Override
          public void onFailure(Exception e) {
            LOG.error("Creation failed: " + e.getMessage());
          }
        };
    IndicesAliasesRequest aliasesRequest = new IndicesAliasesRequest();
    IndicesAliasesRequest.AliasActions aliasAction;
    if (!CommonUtil.nullOrEmpty(
        ENTITY_TO_SEARCH_ALIAS_MAPPING.getOrDefault(elasticSearchIndexType.entityType, new ArrayList<>()))) {
      List<String> aliases = ENTITY_TO_SEARCH_ALIAS_MAPPING.get(elasticSearchIndexType.entityType);
      aliasAction =
          IndicesAliasesRequest.AliasActions.add()
              .index(elasticSearchIndexType.indexName)
              .aliases(aliases.toArray(new String[0]));
    } else {
      aliasAction =
          IndicesAliasesRequest.AliasActions.add().index(elasticSearchIndexType.indexName).aliases(GLOBAL_SEARCH_ALIAS);
    }
    aliasesRequest.addAliasAction(aliasAction);
    client.indices().updateAliasesAsync(aliasesRequest, RequestOptions.DEFAULT, listener);
  }

  @Override
  public void updateIndex(SearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType, String lang) {
    try {
      GetIndexRequest gRequest = new GetIndexRequest(elasticSearchIndexType.indexName);
      gRequest.local(false);
      boolean exists = client.indices().exists(gRequest, RequestOptions.DEFAULT);
      String elasticSearchIndexMapping = getIndexMapping(elasticSearchIndexType, lang);
      ENTITY_TO_MAPPING_SCHEMA_MAP.put(
          elasticSearchIndexType.entityType, JsonUtils.getMap(JsonUtils.readJson(elasticSearchIndexMapping)));
      // creating alias for indexes
      IndicesAliasesRequest aliasesRequest = new IndicesAliasesRequest();
      IndicesAliasesRequest.AliasActions aliasAction =
          IndicesAliasesRequest.AliasActions.add().index(elasticSearchIndexType.indexName).alias(GLOBAL_SEARCH_ALIAS);
      aliasesRequest.addAliasAction(aliasAction);
      client.indices().updateAliases(aliasesRequest, RequestOptions.DEFAULT);
      if (exists) {
        PutMappingRequest request = new PutMappingRequest(elasticSearchIndexType.indexName);
        request.source(elasticSearchIndexMapping, XContentType.JSON);
        AcknowledgedResponse putMappingResponse = client.indices().putMapping(request, RequestOptions.DEFAULT);
        LOG.info("{} Updated {}", elasticSearchIndexType.indexName, putMappingResponse.isAcknowledged());
      } else {
        CreateIndexRequest request = new CreateIndexRequest(elasticSearchIndexType.indexName);
        request.source(elasticSearchIndexMapping, XContentType.JSON);
        CreateIndexResponse createIndexResponse = client.indices().create(request, RequestOptions.DEFAULT);
        LOG.info("{} Created {}", elasticSearchIndexType.indexName, createIndexResponse.isAcknowledged());
      }
      elasticSearchIndexes.put(elasticSearchIndexType, IndexUtil.ElasticSearchIndexStatus.CREATED);
    } catch (Exception e) {
      elasticSearchIndexes.put(elasticSearchIndexType, IndexUtil.ElasticSearchIndexStatus.FAILED);
      updateElasticSearchFailureStatus(
          IndexUtil.getContext("Updating Index", elasticSearchIndexType.indexName),
          String.format(IndexUtil.REASON_TRACE, e.getMessage(), ExceptionUtils.getStackTrace(e)));
      LOG.error("Failed to update Elastic Search indexes due to", e);
    }
  }

  @Override
  public void deleteIndex(SearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType) {
    try {
      GetIndexRequest gRequest = new GetIndexRequest(elasticSearchIndexType.indexName);
      gRequest.local(false);
      boolean exists = client.indices().exists(gRequest, RequestOptions.DEFAULT);
      if (exists) {
        DeleteIndexRequest request = new DeleteIndexRequest(elasticSearchIndexType.indexName);
        AcknowledgedResponse deleteIndexResponse = client.indices().delete(request, RequestOptions.DEFAULT);
        LOG.info("{} Deleted {}", elasticSearchIndexType.indexName, deleteIndexResponse.isAcknowledged());
      }
    } catch (IOException e) {
      updateElasticSearchFailureStatus(
          IndexUtil.getContext("Deleting Index", elasticSearchIndexType.indexName),
          String.format(IndexUtil.REASON_TRACE, e.getMessage(), ExceptionUtils.getStackTrace(e)));
      LOG.error("Failed to delete Elastic Search indexes due to", e);
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
      case "glossary_search_index":
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
        || request.getIndex().equalsIgnoreCase("query_search_index")) {
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

    /* for performance reasons ElasticSearch doesn't provide accurate hits
    if we enable trackTotalHits parameter it will try to match every result, count and return hits
    however in most cases for search results an approximate value is good enough.
    we are displaying total entity counts in landing page and explore page where we need the total count
    https://github.com/elastic/elasticsearch/issues/33028 */
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
                new org.opensearch.action.search.SearchRequest(request.getIndex()).source(searchSourceBuilder),
                RequestOptions.DEFAULT)
            .toString();
    return Response.status(OK).entity(response).build();
  }

  @Override
  public Response searchBySourceUrl(String sourceUrl) throws IOException {
    QueryBuilder wildcardQuery = QueryBuilders.queryStringQuery(sourceUrl).field("sourceUrl").escape(true);
    org.opensearch.action.search.SearchRequest searchRequest =
        new org.opensearch.action.search.SearchRequest(GLOBAL_SEARCH_ALIAS);
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(wildcardQuery);
    searchRequest.source(searchSourceBuilder);
    String response = client.search(searchRequest, RequestOptions.DEFAULT).toString();
    return Response.status(OK).entity(response).build();
  }

  @Override
  public Response searchByField(String fieldName, String fieldValue, String index) throws IOException {
    org.opensearch.action.search.SearchRequest searchRequest = new org.opensearch.action.search.SearchRequest(index);
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
                new org.opensearch.action.search.SearchRequest(index).source(searchSourceBuilder),
                RequestOptions.DEFAULT)
            .toString();
    return Response.status(OK).entity(response).build();
  }

  @Override
  public void updateElasticSearch(UpdateRequest updateRequest) throws IOException {
    if (updateRequest != null) {
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, updateRequest);
      ActionListener<UpdateResponse> listener =
          new ActionListener<>() {
            @Override
            public void onResponse(UpdateResponse updateResponse) {
              LOG.info("Created successfully: " + updateResponse.toString());
            }

            @Override
            public void onFailure(Exception e) {
              LOG.error("Creation failed: " + e.getMessage());
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
    org.opensearch.action.search.SearchRequest searchRequest =
        new org.opensearch.action.search.SearchRequest(request.getIndex()).source(searchSourceBuilder);
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
  public void createEntity(EntityInterface entity) {
    if (entity != null) {
      String entityType = entity.getEntityReference().getType();
      SearchIndexDefinition.ElasticSearchIndexType indexType = IndexUtil.getIndexMappingByEntityType(entityType);
      UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, entity.getId().toString());
      ElasticSearchIndex index = SearchIndexFactory.buildIndex(entityType, entity);
      updateRequest.doc(JsonUtils.pojoToJson(index.buildESDoc()), XContentType.JSON);
      updateRequest.docAsUpsert(true);
      updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
      try {
        updateElasticSearch(updateRequest);
      } catch (DocumentMissingException ex) {
        handleDocumentMissingException(entity, ex);
      } catch (OpenSearchException e) {
        handleOpenSearchException(entity, e);
      } catch (IOException ie) {
        handleIOException(entity, ie);
      }
    }
  }

  @Override
  public void createTimeSeriesEntity(EntityTimeSeriesInterface entity) {
    if (entity == null) {
      LOG.error("Entity is null");
      return;
    }
    String contextInfo = String.format("Entity Info : %s", entity);
    String entityTimeSeriesType;
    if (entity instanceof ReportData) {
      // Report data type is an entity itself where each report data type has its own index
      entityTimeSeriesType = ((ReportData) entity).getReportDataType().toString();
    } else {
      entityTimeSeriesType = entity.getClass().getSimpleName().toLowerCase(Locale.ROOT);
    }
    SearchIndexDefinition.ElasticSearchIndexType indexType =
        IndexUtil.getIndexMappingByEntityType(entityTimeSeriesType);
    UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, entity.getId().toString());
    ElasticSearchIndex index = SearchIndexFactory.buildIndex(entityTimeSeriesType, entity);
    updateRequest.doc(JsonUtils.pojoToJson(index.buildESDoc()), XContentType.JSON);
    updateRequest.docAsUpsert(true);
    updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
    try {
      updateElasticSearch(updateRequest);
    } catch (DocumentMissingException ex) {
      handleDocumentMissingException(contextInfo, ex);
    } catch (OpenSearchException e) {
      handleOpenSearchException(contextInfo, e);
    } catch (IOException ie) {
      handleIOException(contextInfo, ie);
    }
  }

  @Override
  public void deleteByScript(String index, String scriptTxt, HashMap<String, Object> params) {
    if (index == null) {
      LOG.error("Index is null");
      return;
    }
    String contextInfo = String.format("Index Info : %s", index);
    SearchIndexDefinition.ElasticSearchIndexType indexType = IndexUtil.getIndexMappingByEntityType(index);
    Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, params);
    ScriptQueryBuilder scriptQuery = new ScriptQueryBuilder(script);
    DeleteByQueryRequest deleteByQueryRequest = new DeleteByQueryRequest(indexType.indexName);
    deleteByQueryRequest.setQuery(scriptQuery);
    deleteByQueryRequest.setRefresh(true);
    try {
      deleteEntityFromElasticSearchByQuery(deleteByQueryRequest);
    } catch (DocumentMissingException ex) {
      handleDocumentMissingException(contextInfo, ex);
    } catch (OpenSearchException e) {
      handleOpenSearchException(contextInfo, e);
    } catch (IOException ie) {
      handleIOException(contextInfo, ie);
    }
  }

  @Override
  public void deleteEntity(EntityInterface entity, String scriptTxt, String field, String alias) {
    if (entity != null) {
      String entityType = entity.getEntityReference().getType();
      SearchIndexDefinition.ElasticSearchIndexType indexType = IndexUtil.getIndexMappingByEntityType(entityType);
      DeleteRequest deleteRequest = new DeleteRequest(indexType.indexName, entity.getId().toString());
      deleteRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
      try {
        deleteEntityFromElasticSearch(deleteRequest);
        if (!CommonUtil.nullOrEmpty(field)) {
          BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
          DeleteByQueryRequest request = new DeleteByQueryRequest(alias);
          request.setRefresh(true);
          queryBuilder.must(new TermQueryBuilder(field, entity.getId().toString()));
          request.setQuery(queryBuilder);
        }
      } catch (DocumentMissingException ex) {
        handleDocumentMissingException(entity, ex);
      } catch (OpenSearchException e) {
        handleOpenSearchException(entity, e);
      } catch (IOException ie) {
        handleIOException(entity, ie);
      }
    }
  }

  @Override
  public void softDeleteOrRestoreEntity(EntityInterface entity, boolean delete) {
    if (entity != null) {
      String entityType = entity.getEntityReference().getType();
      SearchIndexDefinition.ElasticSearchIndexType indexType = IndexUtil.getIndexMappingByEntityType(entityType);
      UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, entity.getId().toString());
      String scriptTxt = String.format(SOFT_DELETE_RESTORE_SCRIPT, delete);
      Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, new HashMap<>());
      updateRequest.script(script);
      updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
      try {
        updateElasticSearch(updateRequest);
      } catch (DocumentMissingException ex) {
        handleDocumentMissingException(entity, ex);
      } catch (OpenSearchException e) {
        handleOpenSearchException(entity, e);
      } catch (IOException ie) {
        handleIOException(entity, ie);
      }
    }
  }

  @Override
  public void softDeleteOrRestoreChildren(EntityInterface entity, boolean delete, String field, String alias) {
    if (entity != null) {
      UpdateByQueryRequest updateByQueryRequest = new UpdateByQueryRequest(alias);
      updateByQueryRequest.setQuery(new MatchQueryBuilder(field, entity.getId().toString()));
      String scriptTxt = String.format(SOFT_DELETE_RESTORE_SCRIPT, delete);
      Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, new HashMap<>());
      updateByQueryRequest.setScript(script);
      try {
        updateElasticSearchByQuery(updateByQueryRequest);
      } catch (DocumentMissingException ex) {
        handleDocumentMissingException(entity, ex);
      } catch (OpenSearchException e) {
        handleOpenSearchException(entity, e);
      } catch (IOException ie) {
        handleIOException(entity, ie);
      }
    }
  }

  @Override
  public void updateEntity(EntityInterface entity, String scriptTxt, String field) {
    String entityType = entity.getEntityReference().getType();
    SearchIndexDefinition.ElasticSearchIndexType indexType = IndexUtil.getIndexMappingByEntityType(entityType);
    UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, entity.getId().toString());
    updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
    if (entity.getChangeDescription() != null
        && Objects.equals(entity.getVersion(), entity.getChangeDescription().getPreviousVersion())) {
      updateRequest = applyOSChangeEvent(entity);
    } else {
      ElasticSearchIndex elasticSearchIndex = SearchIndexFactory.buildIndex(entityType, entity);
      Map<String, Object> doc = elasticSearchIndex.buildESDoc();
      Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, JsonUtils.getMap(doc));
      updateRequest.script(script);
      updateRequest.scriptedUpsert(true);
      updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
    }
    try {
      updateElasticSearch(updateRequest);
    } catch (DocumentMissingException ex) {
      handleDocumentMissingException(entity, ex);
    } catch (OpenSearchException e) {
      handleOpenSearchException(entity, e);
    } catch (IOException ie) {
      handleIOException(entity, ie);
    }
  }

  @Override
  public void updateChildren(
      EntityInterface entity, String scriptTxt, String field, String value, String alias, Object data) {
    if (entity != null) {
      UpdateByQueryRequest updateByQueryRequest = new UpdateByQueryRequest(alias);
      updateByQueryRequest.setQuery(new MatchQueryBuilder(field, value));
      updateByQueryRequest.setRefresh(true);
      Script script =
          new Script(
              ScriptType.INLINE,
              Script.DEFAULT_SCRIPT_LANG,
              scriptTxt,
              JsonUtils.getMap(data == null ? new HashMap<>() : data));
      updateByQueryRequest.setScript(script);
      try {
        updateElasticSearchByQuery(updateByQueryRequest);
      } catch (DocumentMissingException ex) {
        handleDocumentMissingException(entity, ex);
      } catch (OpenSearchException e) {
        handleOpenSearchException(entity, e);
      } catch (IOException ie) {
        handleIOException(entity, ie);
      }
    }
  }

  public void handleDocumentMissingException(Object entity, DocumentMissingException ex) {
    LOG.error("Missing Document", ex);
    SearchEventPublisher.updateElasticSearchFailureStatus(
        entity,
        EventPublisherJob.Status.ACTIVE_WITH_ERROR,
        String.format(
            "Missing Document while Updating ES. Reason[%s], Cause[%s], Stack [%s]",
            ex.getMessage(), ex.getCause(), ExceptionUtils.getStackTrace(ex)));
  }

  public void handleOpenSearchException(Object entity, OpenSearchException e) {
    if (e.status() == RestStatus.GATEWAY_TIMEOUT || e.status() == RestStatus.REQUEST_TIMEOUT) {
      LOG.error("Error in publishing to ElasticSearch");
      SearchEventPublisher.updateElasticSearchFailureStatus(
          entity,
          EventPublisherJob.Status.ACTIVE_WITH_ERROR,
          String.format(
              "Timeout when updating ES request. Reason[%s], Cause[%s], Stack [%s]",
              e.getMessage(), e.getCause(), ExceptionUtils.getStackTrace(e)));
      throw new SearchRetriableException(e.getMessage());
    } else {
      SearchEventPublisher.updateElasticSearchFailureStatus(
          entity,
          EventPublisherJob.Status.ACTIVE_WITH_ERROR,
          String.format(
              "Failed while updating ES. Reason[%s], Cause[%s], Stack [%s]",
              e.getMessage(), e.getCause(), ExceptionUtils.getStackTrace(e)));
      LOG.error(e.getMessage(), e);
    }
  }

  public void handleIOException(Object entity, IOException ie) {
    SearchEventPublisher.updateElasticSearchFailureStatus(
        entity,
        EventPublisherJob.Status.ACTIVE_WITH_ERROR,
        String.format(
            "Issue in updating ES request. Reason[%s], Cause[%s], Stack [%s]",
            ie.getMessage(), ie.getCause(), ExceptionUtils.getStackTrace(ie)));
    LOG.error(ie.getMessage(), ie);
  }

  private void updateElasticSearchByQuery(UpdateByQueryRequest updateByQueryRequest) throws IOException {
    if (updateByQueryRequest != null) {
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, updateByQueryRequest);
      ActionListener<BulkByScrollResponse> listener =
          new ActionListener<BulkByScrollResponse>() {
            @Override
            public void onResponse(BulkByScrollResponse response) {
              LOG.info("Update by query succeeded: " + response.toString());
            }

            @Override
            public void onFailure(Exception e) {
              LOG.error("Update by query failed: " + e.getMessage());
            }
          };
      client.updateByQueryAsync(updateByQueryRequest, RequestOptions.DEFAULT, listener);
    }
  }

  private void deleteEntityFromElasticSearch(DeleteRequest deleteRequest) throws IOException {
    if (deleteRequest != null) {
      LOG.debug(UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH, deleteRequest);
      ActionListener<DeleteResponse> listener =
          new ActionListener<>() {
            @Override
            public void onResponse(DeleteResponse response) {
              LOG.info("Delete succeeded: " + response.toString());
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

  private void deleteEntityFromElasticSearchByQuery(DeleteByQueryRequest deleteRequest) throws IOException {
    if (deleteRequest != null) {
      LOG.debug(UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH, deleteRequest);
      deleteRequest.setRefresh(true);
      ActionListener<BulkByScrollResponse> listener =
          new ActionListener<>() {
            @Override
            public void onResponse(BulkByScrollResponse response) {
              LOG.info("Delete by query succeeded: " + response.toString());
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

  public UpdateRequest applyOSChangeEvent(EntityInterface entity) {
    String entityType = entity.getEntityReference().getType();
    SearchIndexDefinition.ElasticSearchIndexType esIndexType = IndexUtil.getIndexMappingByEntityType(entityType);
    UUID entityId = entity.getId();

    StringBuilder scriptTxt = new StringBuilder();
    Map<String, Object> fieldParams = new HashMap<>();

    // TODO : Make it return

    // Populate Script Text
    getScriptWithParams(entity, scriptTxt, fieldParams);
    if (!CommonUtil.nullOrEmpty(scriptTxt)) {
      Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt.toString(), fieldParams);
      UpdateRequest updateRequest = new UpdateRequest(esIndexType.indexName, entityId.toString());
      updateRequest.script(script);
      return updateRequest;
    } else {
      return null;
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
    org.opensearch.action.search.SearchRequest searchRequestTotalAssets =
        buildSearchRequest(scheduleTime, currentTime, null, team, chartType, indexName);
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
      String dataReportIndex)
      throws IOException, ParseException {
    org.opensearch.action.search.SearchRequest searchRequest =
        buildSearchRequest(startTs, endTs, tier, team, dataInsightChartName, dataReportIndex);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    return Response.status(OK).entity(processDataInsightChartResult(searchResponse, dataInsightChartName)).build();
  }

  @Override
  public CollectionDAO getDao() {
    return dao;
  }

  private static DataInsightChartResult processDataInsightChartResult(
      SearchResponse searchResponse, DataInsightChartResult.DataInsightChartType dataInsightChartName)
      throws ParseException {
    DataInsightAggregatorInterface processor =
        createDataAggregator(searchResponse.getAggregations(), dataInsightChartName);
    return processor.process();
  }

  private static DataInsightAggregatorInterface createDataAggregator(
      Aggregations aggregations, DataInsightChartResult.DataInsightChartType dataInsightChartType)
      throws IllegalArgumentException {
    switch (dataInsightChartType) {
      case PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE:
        return new OsEntitiesDescriptionAggregator(aggregations, dataInsightChartType);
      case PERCENTAGE_OF_SERVICES_WITH_DESCRIPTION:
        return new OsServicesDescriptionAggregator(aggregations, dataInsightChartType);
      case PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE:
        return new OsEntitiesOwnerAggregator(aggregations, dataInsightChartType);
      case PERCENTAGE_OF_SERVICES_WITH_OWNER:
        return new OsServicesOwnerAggregator(aggregations, dataInsightChartType);
      case TOTAL_ENTITIES_BY_TYPE:
        return new OsTotalEntitiesAggregator(aggregations, dataInsightChartType);
      case TOTAL_ENTITIES_BY_TIER:
        return new OsTotalEntitiesByTierAggregator(aggregations, dataInsightChartType);
      case DAILY_ACTIVE_USERS:
        return new OsDailyActiveUsersAggregator(aggregations, dataInsightChartType);
      case PAGE_VIEWS_BY_ENTITIES:
        return new OsPageViewsByEntitiesAggregator(aggregations, dataInsightChartType);
      case MOST_ACTIVE_USERS:
        return new OsMostActiveUsersAggregator(aggregations, dataInsightChartType);
      case MOST_VIEWED_ENTITIES:
        return new OsMostViewedEntitiesAggregator(aggregations, dataInsightChartType);
      default:
        throw new IllegalArgumentException(
            String.format("No processor found for chart Type %s ", dataInsightChartType));
    }
  }

  private static org.opensearch.action.search.SearchRequest buildSearchRequest(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      DataInsightChartResult.DataInsightChartType dataInsightChartName,
      String dataReportIndex) {
    SearchSourceBuilder searchSourceBuilder =
        buildQueryFilter(startTs, endTs, tier, team, dataInsightChartName.value());
    AggregationBuilder aggregationBuilder = buildQueryAggregation(dataInsightChartName);
    searchSourceBuilder.aggregation(aggregationBuilder);
    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));

    org.opensearch.action.search.SearchRequest searchRequest =
        new org.opensearch.action.search.SearchRequest(dataReportIndex);
    searchRequest.source(searchSourceBuilder);
    return searchRequest;
  }

  private static SearchSourceBuilder buildQueryFilter(
      Long startTs, Long endTs, String tier, String team, String dataInsightChartName) {

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

    RangeQueryBuilder dateQueryFilter =
        QueryBuilders.rangeQuery(DataInsightChartRepository.TIMESTAMP).gte(startTs).lte(endTs);

    searchQueryFiler.must(dateQueryFilter);
    return searchSourceBuilder.query(searchQueryFiler).fetchSource(false);
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

  public static RestHighLevelClient createOpenSearchClient(ElasticSearchConfiguration esConfig) {
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
      throw new OpenSearchException("Failed to create open search client ", e);
    }
  }
}
