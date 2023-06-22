package org.openmetadata.service.search.elasticSearch;

import static javax.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition.ENTITY_TO_MAPPING_SCHEMA_MAP;
import static org.openmetadata.service.search.IndexUtil.createElasticSearchSSLContext;
import static org.openmetadata.service.search.UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH;

import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
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
import org.elasticsearch.ElasticsearchException;
import org.elasticsearch.action.admin.indices.delete.DeleteIndexRequest;
import org.elasticsearch.action.bulk.BulkItemResponse;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.action.delete.DeleteRequest;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.action.support.WriteRequest;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.client.RestClientBuilder;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.client.indices.CreateIndexRequest;
import org.elasticsearch.client.indices.CreateIndexResponse;
import org.elasticsearch.client.indices.GetIndexRequest;
import org.elasticsearch.client.indices.PutMappingRequest;
import org.elasticsearch.common.lucene.search.function.CombineFunction;
import org.elasticsearch.common.settings.Settings;
import org.elasticsearch.common.unit.Fuzziness;
import org.elasticsearch.common.xcontent.LoggingDeprecationHandler;
import org.elasticsearch.core.TimeValue;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.MatchQueryBuilder;
import org.elasticsearch.index.query.MultiMatchQueryBuilder;
import org.elasticsearch.index.query.Operator;
import org.elasticsearch.index.query.QueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.QueryStringQueryBuilder;
import org.elasticsearch.index.query.RangeQueryBuilder;
import org.elasticsearch.index.query.TermQueryBuilder;
import org.elasticsearch.index.query.WildcardQueryBuilder;
import org.elasticsearch.index.query.functionscore.FieldValueFactorFunctionBuilder;
import org.elasticsearch.index.query.functionscore.FunctionScoreQueryBuilder;
import org.elasticsearch.index.query.functionscore.ScoreFunctionBuilders;
import org.elasticsearch.index.reindex.DeleteByQueryRequest;
import org.elasticsearch.index.reindex.UpdateByQueryRequest;
import org.elasticsearch.script.Script;
import org.elasticsearch.script.ScriptType;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.SearchModule;
import org.elasticsearch.search.aggregations.AggregationBuilder;
import org.elasticsearch.search.aggregations.AggregationBuilders;
import org.elasticsearch.search.aggregations.Aggregations;
import org.elasticsearch.search.aggregations.BucketOrder;
import org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramAggregationBuilder;
import org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramInterval;
import org.elasticsearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import org.elasticsearch.search.aggregations.metrics.MaxAggregationBuilder;
import org.elasticsearch.search.aggregations.metrics.SumAggregationBuilder;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.fetch.subphase.FetchSourceContext;
import org.elasticsearch.search.fetch.subphase.highlight.HighlightBuilder;
import org.elasticsearch.search.sort.SortOrder;
import org.elasticsearch.search.suggest.Suggest;
import org.elasticsearch.search.suggest.SuggestBuilder;
import org.elasticsearch.search.suggest.SuggestBuilders;
import org.elasticsearch.search.suggest.completion.CompletionSuggestionBuilder;
import org.elasticsearch.search.suggest.completion.context.CategoryQueryContext;
import org.elasticsearch.xcontent.NamedXContentRegistry;
import org.elasticsearch.xcontent.XContentParser;
import org.elasticsearch.xcontent.XContentType;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.DataInsightInterface;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexFactory;
import org.openmetadata.service.elasticsearch.ElasticSearchRequest;
import org.openmetadata.service.elasticsearch.TestCaseIndex;
import org.openmetadata.service.elasticsearch.indexes.ElasticSearchIndex;
import org.openmetadata.service.elasticsearch.indexes.GlossaryTermIndex;
import org.openmetadata.service.elasticsearch.indexes.TagIndex;
import org.openmetadata.service.elasticsearch.indexes.TeamIndex;
import org.openmetadata.service.elasticsearch.indexes.UserIndex;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DataInsightChartRepository;
import org.openmetadata.service.search.EntityBuilderConstant;
import org.openmetadata.service.search.IndexUtil;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.UpdateSearchEventsConstant;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class ElasticSearchClientImpl implements SearchClient {

  @SuppressWarnings("deprecated")
  private final RestHighLevelClient client;

  private final CollectionDAO dao;

  private static final EnumMap<ElasticSearchIndexDefinition.ElasticSearchIndexType, IndexUtil.ElasticSearchIndexStatus>
      elasticSearchIndexes = new EnumMap<>(ElasticSearchIndexDefinition.ElasticSearchIndexType.class);

  public ElasticSearchClientImpl(ElasticSearchConfiguration esConfig, CollectionDAO dao) {
    this.client = createElasticSearchClient(esConfig);
    this.dao = dao;
  }

  public CollectionDAO getDao() {
    return dao;
  }

  private static final NamedXContentRegistry xContentRegistry;

  static {
    SearchModule searchModule = new SearchModule(Settings.EMPTY, false, List.of());
    xContentRegistry = new NamedXContentRegistry(searchModule.getNamedXContents());
  }

  @Override
  public boolean createIndex(ElasticSearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType, String lang) {
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
      }
      elasticSearchIndexes.put(elasticSearchIndexType, IndexUtil.ElasticSearchIndexStatus.CREATED);
    } catch (Exception e) {
      elasticSearchIndexes.put(elasticSearchIndexType, IndexUtil.ElasticSearchIndexStatus.CREATED);
      updateElasticSearchFailureStatus(
          IndexUtil.getContext("Creating Index", elasticSearchIndexType.indexName),
          String.format(IndexUtil.REASON_TRACE, e.getMessage(), ExceptionUtils.getStackTrace(e)));
      LOG.error("Failed to create Elastic Search indexes due to", e);
      return false;
    }
    return true;
  }

  public void updateIndex(ElasticSearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType, String lang) {
    try {
      GetIndexRequest gRequest = new GetIndexRequest(elasticSearchIndexType.indexName);
      gRequest.local(false);
      boolean exists = client.indices().exists(gRequest, RequestOptions.DEFAULT);
      String elasticSearchIndexMapping = getIndexMapping(elasticSearchIndexType, lang);
      ENTITY_TO_MAPPING_SCHEMA_MAP.put(
          elasticSearchIndexType.entityType, JsonUtils.getMap(JsonUtils.readJson(elasticSearchIndexMapping)));
      if (exists) {
        PutMappingRequest request = new PutMappingRequest(elasticSearchIndexType.indexName);
        request.source(elasticSearchIndexMapping, XContentType.JSON);
        AcknowledgedResponse putMappingResponse = client.indices().putMapping(request, RequestOptions.DEFAULT);
        LOG.info("{} Updated {}", elasticSearchIndexType.indexName, putMappingResponse.isAcknowledged());
      } else {
        CreateIndexRequest request = new CreateIndexRequest(elasticSearchIndexType.indexName);
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
  public void deleteIndex(ElasticSearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType) {
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
  public Response search(ElasticSearchRequest request) throws IOException {
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
      default:
        searchSourceBuilder = buildAggregateSearchBuilder(request.getQuery(), request.getFrom(), request.getSize());
        break;
    }
    if (!nullOrEmpty(request.getQueryFilter())) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(xContentRegistry, LoggingDeprecationHandler.INSTANCE, request.getQueryFilter());
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
                .createParser(xContentRegistry, LoggingDeprecationHandler.INSTANCE, request.getPostFilter());
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        searchSourceBuilder.postFilter(filter);
      } catch (Exception ex) {
        LOG.warn("Error parsing post_filter from query parameters, ignoring filter", ex);
      }
    }

    /* For backward-compatibility we continue supporting the deleted argument, this should be removed in future versions */
    searchSourceBuilder.query(
        QueryBuilders.boolQuery()
            .must(searchSourceBuilder.query())
            .must(QueryBuilders.termQuery("deleted", request.deleted())));

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
      searchSourceBuilder.trackTotalHitsUpTo(EntityBuilderConstant.MAX_RESULT_HITS);
    }

    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    String response =
        client
            .search(new SearchRequest(request.getIndex()).source(searchSourceBuilder), RequestOptions.DEFAULT)
            .toString();
    return Response.status(OK).entity(response).build();
  }

  @Override
  public Response aggregate(String index, String fieldName) throws IOException {
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms(fieldName)
                .field(fieldName)
                .size(EntityBuilderConstant.MAX_AGGREGATE_SIZE)
                .order(BucketOrder.key(true)))
        .size(0);
    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    String response =
        client.search(new SearchRequest(index).source(searchSourceBuilder), RequestOptions.DEFAULT).toString();
    return Response.status(OK).entity(response).build();
  }

  @Override
  public Response suggest(ElasticSearchRequest request) throws IOException {
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
    SearchRequest searchRequest = new SearchRequest(request.getIndex()).source(searchSourceBuilder);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    Suggest suggest = searchResponse.getSuggest();
    return Response.status(OK).entity(suggest.toString()).build();
  }

  private static SearchSourceBuilder buildPipelineSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME, 15.0f)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 15.0f)
            .field(EntityBuilderConstant.FIELD_DESCRIPTION_NGRAM, 1.0f)
            .field(EntityBuilderConstant.DISPLAY_NAME_KEYWORD, 25.0f)
            .field(EntityBuilderConstant.NAME_KEYWORD, 25.0f)
            .field(EntityBuilderConstant.DESCRIPTION, 1.0f)
            .field("tasks.name", 2.0f)
            .field("tasks.description", 1.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    HighlightBuilder.Field highlightPipelineName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightPipelineName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(EntityBuilderConstant.DESCRIPTION);
    highlightDescription.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightTasks = new HighlightBuilder.Field("tasks.name");
    highlightTasks.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightTaskDescriptions = new HighlightBuilder.Field("tasks.description");
    highlightTaskDescriptions.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightPipelineName);
    hb.field(highlightTasks);
    hb.field(highlightTaskDescriptions);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildMlModelSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME, 15.0f)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 15.0f)
            .field(EntityBuilderConstant.FIELD_DESCRIPTION_NGRAM, 1.0f)
            .field(EntityBuilderConstant.DISPLAY_NAME_KEYWORD, 25.0f)
            .field(EntityBuilderConstant.NAME_KEYWORD, 25.0f)
            .field(EntityBuilderConstant.DESCRIPTION, 1.0f)
            .field("mlFeatures.name", 2.0f)
            .field("mlFeatures.description", 1.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    HighlightBuilder.Field highlightPipelineName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightPipelineName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(EntityBuilderConstant.DESCRIPTION);
    highlightDescription.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightTasks = new HighlightBuilder.Field("mlFeatures.name");
    highlightTasks.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightTaskDescriptions = new HighlightBuilder.Field("mlFeatures.description");
    highlightTaskDescriptions.highlighterType(EntityBuilderConstant.UNIFIED);
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
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME, 15.0f)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 15.0f)
            .field(EntityBuilderConstant.FIELD_NAME_NGRAM)
            .field(EntityBuilderConstant.FIELD_DESCRIPTION_NGRAM, 1.0f)
            .field(EntityBuilderConstant.DISPLAY_NAME_KEYWORD, 25.0f)
            .field(EntityBuilderConstant.NAME_KEYWORD, 25.0f)
            .field(EntityBuilderConstant.FIELD_DESCRIPTION, 1.0f)
            .field(EntityBuilderConstant.ES_MESSAGE_SCHEMA_FIELD, 2.0f)
            .field("messageSchema.schemaFields.description", 1.0f)
            .field("messageSchema.schemaFields.children.name", 2.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    HighlightBuilder.Field highlightTopicName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightTopicName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightTopicName);
    hb.field(
        new HighlightBuilder.Field("messageSchema.schemaFields.description")
            .highlighterType(EntityBuilderConstant.UNIFIED));
    hb.field(
        new HighlightBuilder.Field("messageSchema.schemaFields.children.name")
            .highlighterType(EntityBuilderConstant.UNIFIED));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms(EntityBuilderConstant.ES_MESSAGE_SCHEMA_FIELD)
            .field(EntityBuilderConstant.ES_MESSAGE_SCHEMA_FIELD));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildDashboardSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME, 15.0f)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 15.0f)
            .field(EntityBuilderConstant.FIELD_NAME_NGRAM)
            .field(EntityBuilderConstant.FIELD_DESCRIPTION_NGRAM, 1.0f)
            .field(EntityBuilderConstant.DISPLAY_NAME_KEYWORD, 25.0f)
            .field(EntityBuilderConstant.NAME_KEYWORD, 25.0f)
            .field(EntityBuilderConstant.FIELD_DESCRIPTION, 1.0f)
            .field("charts.name", 2.0f)
            .field("charts.description", 1.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    HighlightBuilder.Field highlightDashboardName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightDashboardName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightCharts = new HighlightBuilder.Field("charts.name");
    highlightCharts.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightChartDescriptions = new HighlightBuilder.Field("charts.description");
    highlightChartDescriptions.highlighterType(EntityBuilderConstant.UNIFIED);

    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightDashboardName);
    hb.field(highlightCharts);
    hb.field(highlightChartDescriptions);

    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildTableSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME, 15.0f)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 15.0f)
            .field(EntityBuilderConstant.FIELD_NAME_NGRAM)
            .field(EntityBuilderConstant.DISPLAY_NAME_KEYWORD, 25.0f)
            .field(EntityBuilderConstant.NAME_KEYWORD, 25.0f)
            .field(EntityBuilderConstant.FIELD_DESCRIPTION, 1.0f)
            .field(EntityBuilderConstant.FIELD_DESCRIPTION_NGRAM, 1.0f)
            .field("columns.name.keyword", 10.0f)
            .field("columns.name", 2.0f)
            .field("columns.name.ngram")
            .field("columns.displayName", 2.0f)
            .field("columns.displayName.ngram")
            .field("columns.description", 1.0f)
            .field("columns.children.name", 2.0f)
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
    highlightTableName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(EntityBuilderConstant.DESCRIPTION);
    highlightDescription.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    HighlightBuilder.Field highlightColumns = new HighlightBuilder.Field("columns.name");
    highlightColumns.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightColumnDescriptions = new HighlightBuilder.Field("columns.description");
    highlightColumnDescriptions.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightColumnChildren = new HighlightBuilder.Field("columns.children.name");
    highlightColumnDescriptions.highlighterType(EntityBuilderConstant.UNIFIED);
    hb.field(highlightDescription);
    hb.field(highlightTableName);
    hb.field(highlightColumns);
    hb.field(highlightColumnDescriptions);
    hb.field(highlightColumnChildren);
    hb.preTags(EntityBuilderConstant.PRE_TAG);
    hb.postTags(EntityBuilderConstant.POST_TAG);
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(AggregationBuilders.terms("database.name.keyword").field("database.name.keyword"));
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("databaseSchema.name.keyword").field("databaseSchema.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildUserOrTeamSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME, 3.0f)
            .field(EntityBuilderConstant.DISPLAY_NAME_KEYWORD, 5.0f)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 2.0f)
            .field(EntityBuilderConstant.NAME_KEYWORD, 3.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    return searchBuilder(queryBuilder, null, from, size);
  }

  private static SearchSourceBuilder buildGlossaryTermSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME, 10.0f)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM, 1.0f)
            .field(FIELD_NAME, 10.0f)
            .field(EntityBuilderConstant.NAME_KEYWORD, 10.0f)
            .field(EntityBuilderConstant.DISPLAY_NAME_KEYWORD, 10.0f)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME, 10.0f)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM)
            .field("synonyms", 5.0f)
            .field("synonyms.ngram")
            .field(EntityBuilderConstant.DESCRIPTION, 3.0f)
            .field("glossary.name", 5.0f)
            .field("glossary.displayName", 5.0f)
            .field("glossary.displayName.ngram")
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightGlossaryName = new HighlightBuilder.Field(FIELD_NAME);
    highlightGlossaryName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightGlossaryDisplayName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightGlossaryDisplayName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightSynonym = new HighlightBuilder.Field("synonyms");
    highlightDescription.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightGlossaryName);
    hb.field(highlightGlossaryDisplayName);
    hb.field(highlightSynonym);

    hb.preTags(EntityBuilderConstant.PRE_TAG);
    hb.postTags(EntityBuilderConstant.POST_TAG);
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms(EntityBuilderConstant.ES_TAG_FQN_FIELD)
                .field(EntityBuilderConstant.ES_TAG_FQN_FIELD)
                .size(EntityBuilderConstant.MAX_AGGREGATE_SIZE))
        .aggregation(AggregationBuilders.terms("glossary.name.keyword").field("glossary.name.keyword"));
    return searchSourceBuilder;
  }

  private static SearchSourceBuilder buildTagSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(FIELD_NAME, 10.0f)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME, 10.0f)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM, 1.0f)
            .field(EntityBuilderConstant.DESCRIPTION, 3.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightTagName = new HighlightBuilder.Field(FIELD_NAME);
    highlightTagName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightTagDisplayName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightTagDisplayName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightTagDisplayName);
    hb.field(highlightDescription);
    hb.field(highlightTagName);
    hb.preTags(EntityBuilderConstant.PRE_TAG);
    hb.postTags(EntityBuilderConstant.POST_TAG);
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildContainerSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME, 15.0f)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 15.0f)
            .field(EntityBuilderConstant.FIELD_DESCRIPTION, 1.0f)
            .field(EntityBuilderConstant.FIELD_DESCRIPTION_NGRAM, 1.0f)
            .field(EntityBuilderConstant.DISPLAY_NAME_KEYWORD, 25.0f)
            .field(EntityBuilderConstant.NAME_KEYWORD, 25.0f)
            .field("dataModel.columns.name", 2.0f)
            .field("dataModel.columns.name.keyword", 10.0f)
            .field("dataModel.columns.name.ngram")
            .field("dataModel.columns.displayName", 2.0f)
            .field("dataModel.columns.displayName.ngram")
            .field("dataModel.columns.description", 1.0f)
            .field("dataModel.columns.children.name", 2.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    HighlightBuilder.Field highlightContainerName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightContainerName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(EntityBuilderConstant.DESCRIPTION);
    highlightDescription.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    HighlightBuilder.Field highlightColumns = new HighlightBuilder.Field("dataModel.columns.name");
    highlightColumns.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightColumnDescriptions = new HighlightBuilder.Field("dataModel.columns.description");
    highlightColumnDescriptions.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightColumnChildren = new HighlightBuilder.Field("dataModel.columns.children.name");
    highlightColumnDescriptions.highlighterType(EntityBuilderConstant.UNIFIED);
    hb.field(highlightDescription);
    hb.field(highlightContainerName);
    hb.field(highlightColumns);
    hb.field(highlightColumnDescriptions);
    hb.field(highlightColumnChildren);
    hb.preTags(EntityBuilderConstant.PRE_TAG);
    hb.postTags(EntityBuilderConstant.POST_TAG);
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildQuerySearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(EntityBuilderConstant.DISPLAY_NAME, 10.0f)
            .field(EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM)
            .field(EntityBuilderConstant.QUERY, 10.0f)
            .field(EntityBuilderConstant.QUERY_NGRAM)
            .field(EntityBuilderConstant.DESCRIPTION, 1.0f)
            .field(EntityBuilderConstant.FIELD_DESCRIPTION_NGRAM, 1.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightGlossaryName = new HighlightBuilder.Field(EntityBuilderConstant.DISPLAY_NAME);
    highlightGlossaryName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightQuery = new HighlightBuilder.Field(EntityBuilderConstant.QUERY);
    highlightGlossaryName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightGlossaryName);
    hb.field(highlightQuery);
    hb.preTags(EntityBuilderConstant.PRE_TAG);
    hb.postTags(EntityBuilderConstant.POST_TAG);
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildTestCaseSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(FIELD_NAME, 10.0f)
            .field(EntityBuilderConstant.DESCRIPTION, 3.0f)
            .field("testSuite.fullyQualifiedName", 10.0f)
            .field("testSuite.name", 10.0f)
            .field("testSuite.description", 3.0f)
            .field("entityLink", 3.0f)
            .field("entityFQN", 10.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightTestCaseDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightTestCaseDescription.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightTestCaseName = new HighlightBuilder.Field(FIELD_NAME);
    highlightTestCaseName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightTestSuiteName = new HighlightBuilder.Field("testSuite.name");
    highlightTestSuiteName.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder.Field highlightTestSuiteDescription = new HighlightBuilder.Field("testSuite.description");
    highlightTestSuiteDescription.highlighterType(EntityBuilderConstant.UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightTestCaseDescription);
    hb.field(highlightTestCaseName);
    hb.field(highlightTestSuiteName);
    hb.field(highlightTestSuiteDescription);

    hb.preTags(EntityBuilderConstant.PRE_TAG);
    hb.postTags(EntityBuilderConstant.POST_TAG);

    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildAggregateSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder = QueryBuilders.queryStringQuery(query).lenient(true);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, null, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder addAggregation(SearchSourceBuilder builder) {
    builder
        .aggregation(
            AggregationBuilders.terms("serviceType.keyword")
                .field("serviceType.keyword")
                .size(EntityBuilderConstant.MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("service.name.keyword")
                .field("service.name.keyword")
                .size(EntityBuilderConstant.MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("entityType.keyword")
                .field("entityType.keyword")
                .size(EntityBuilderConstant.MAX_AGGREGATE_SIZE))
        .aggregation(AggregationBuilders.terms("tier.tagFQN").field("tier.tagFQN"));

    return builder;
  }

  private static SearchSourceBuilder searchBuilder(QueryBuilder queryBuilder, HighlightBuilder hb, int from, int size) {
    SearchSourceBuilder builder = new SearchSourceBuilder().query(queryBuilder).from(from).size(size);
    if (hb != null) {
      hb.preTags(EntityBuilderConstant.PRE_TAG);
      hb.postTags(EntityBuilderConstant.POST_TAG);
      builder.highlighter(hb);
    }
    return builder;
  }

  @Override
  public ElasticSearchConfiguration.SearchType getSearchType() {
    return ElasticSearchConfiguration.SearchType.ELASTIC_SEARCH;
  }

  @Override
  public void updateEntity(ChangeEvent event) throws IOException {
    String entityType = event.getEntityType();
    ElasticSearchIndexDefinition.ElasticSearchIndexType indexType =
        ElasticSearchIndexDefinition.getIndexMappingByEntityType(entityType);
    UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, event.getEntityId().toString());
    ElasticSearchIndex index;

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        updateSearchForEntityCreated(indexType, entityType, event);
        break;
      case ENTITY_UPDATED:
        updateSearchForEntityUpdated(indexType, entityType, event);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteRequest deleteRequest = new DeleteRequest(indexType.indexName, event.getEntityId().toString());
        deleteEntityFromElasticSearch(deleteRequest);
        break;
    }
  }

  @Override
  public void updateSearchForEntityCreated(
      ElasticSearchIndexDefinition.ElasticSearchIndexType indexType, String entityType, ChangeEvent event)
      throws IOException {
    UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, event.getEntityId().toString());
    ElasticSearchIndex index = ElasticSearchIndexFactory.buildIndex(entityType, event.getEntity());
    updateRequest.doc(JsonUtils.pojoToJson(index.buildESDoc()), XContentType.JSON);
    updateRequest.docAsUpsert(true);
    updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
    updateElasticSearch(updateRequest);
  }

  public void updateSearchForEntityUpdated(
      ElasticSearchIndexDefinition.ElasticSearchIndexType indexType, String entityType, ChangeEvent event)
      throws IOException {
    UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, event.getEntityId().toString());
    if (Objects.equals(event.getCurrentVersion(), event.getPreviousVersion())) {
      updateRequest = applyESChangeEvent(event);
    } else {
      ElasticSearchIndex elasticSearchIndex = ElasticSearchIndexFactory.buildIndex(entityType, event.getEntity());
      scriptedUpsert(elasticSearchIndex.buildESDoc(), updateRequest);
    }
    updateElasticSearch(updateRequest);
  }

  @Override
  public void updateUser(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(
            ElasticSearchIndexDefinition.ElasticSearchIndexType.USER_SEARCH_INDEX.indexName,
            event.getEntityId().toString());
    UserIndex userIndex;

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        updateSearchForEntityCreated(
            ElasticSearchIndexDefinition.ElasticSearchIndexType.USER_SEARCH_INDEX, USER, event);
        break;
      case ENTITY_UPDATED:
        userIndex = new UserIndex((User) event.getEntity());
        scriptedUserUpsert(userIndex.buildESDoc(), updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteRequest deleteRequest =
            new DeleteRequest(
                ElasticSearchIndexDefinition.ElasticSearchIndexType.USER_SEARCH_INDEX.indexName,
                event.getEntityId().toString());
        deleteEntityFromElasticSearch(deleteRequest);
        break;
    }
  }

  @Override
  public void updateTeam(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(
            ElasticSearchIndexDefinition.ElasticSearchIndexType.TEAM_SEARCH_INDEX.indexName,
            event.getEntityId().toString());
    TeamIndex teamIndex;
    switch (event.getEventType()) {
      case ENTITY_CREATED:
        teamIndex = new TeamIndex((Team) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(teamIndex.buildESDoc()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        teamIndex = new TeamIndex((Team) event.getEntity());
        scriptedTeamUpsert(teamIndex.buildESDoc(), updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteRequest deleteRequest =
            new DeleteRequest(
                ElasticSearchIndexDefinition.ElasticSearchIndexType.TEAM_SEARCH_INDEX.indexName,
                event.getEntityId().toString());
        deleteEntityFromElasticSearch(deleteRequest);
        break;
    }
  }

  @Override
  public void updateGlossaryTerm(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(
            ElasticSearchIndexDefinition.ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX.indexName,
            event.getEntityId().toString());
    GlossaryTermIndex glossaryTermIndex;

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        glossaryTermIndex = new GlossaryTermIndex((GlossaryTerm) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(glossaryTermIndex.buildESDoc()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        glossaryTermIndex = new GlossaryTermIndex((GlossaryTerm) event.getEntity());
        scriptedUpsert(glossaryTermIndex.buildESDoc(), updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteByQueryRequest request =
            new DeleteByQueryRequest(
                ElasticSearchIndexDefinition.ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX.indexName);
        new DeleteRequest(
            ElasticSearchIndexDefinition.ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX.indexName,
            event.getEntityId().toString());
        GlossaryTerm glossaryTerm = (GlossaryTerm) event.getEntity();
        request.setQuery(
            QueryBuilders.boolQuery()
                .should(QueryBuilders.matchQuery("id", glossaryTerm.getId().toString()))
                .should(QueryBuilders.matchQuery("parent.id", glossaryTerm.getId().toString())));
        deleteEntityFromElasticSearchByQuery(request);
        break;
    }
  }

  @Override
  public void updateGlossary(ChangeEvent event) throws IOException {
    if (event.getEventType() == ENTITY_DELETED) {
      Glossary glossary = (Glossary) event.getEntity();
      DeleteByQueryRequest request =
          new DeleteByQueryRequest(ElasticSearchIndexDefinition.ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX.indexName);
      request.setQuery(
          QueryBuilders.boolQuery().should(QueryBuilders.matchQuery("glossary.id", glossary.getId().toString())));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  @Override
  public void updateTag(ChangeEvent event) throws IOException {
    UpdateRequest updateRequest =
        new UpdateRequest(
            ElasticSearchIndexDefinition.ElasticSearchIndexType.TAG_SEARCH_INDEX.indexName,
            event.getEntityId().toString());
    TagIndex tagIndex;

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        tagIndex = new TagIndex((Tag) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(tagIndex.buildESDoc()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        if (Objects.equals(event.getCurrentVersion(), event.getPreviousVersion())) {
          updateRequest = applyESChangeEvent(event);
        } else {
          tagIndex = new TagIndex((Tag) event.getEntity());
          scriptedUpsert(tagIndex.buildESDoc(), updateRequest);
        }
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        DeleteRequest deleteRequest =
            new DeleteRequest(
                ElasticSearchIndexDefinition.ElasticSearchIndexType.TAG_SEARCH_INDEX.indexName,
                event.getEntityId().toString());
        deleteEntityFromElasticSearch(deleteRequest);

        String[] indexes =
            new String[] {
              ElasticSearchIndexDefinition.ElasticSearchIndexType.TABLE_SEARCH_INDEX.indexName,
              ElasticSearchIndexDefinition.ElasticSearchIndexType.TOPIC_SEARCH_INDEX.indexName,
              ElasticSearchIndexDefinition.ElasticSearchIndexType.DASHBOARD_SEARCH_INDEX.indexName,
              ElasticSearchIndexDefinition.ElasticSearchIndexType.PIPELINE_SEARCH_INDEX.indexName,
              ElasticSearchIndexDefinition.ElasticSearchIndexType.GLOSSARY_SEARCH_INDEX.indexName,
              ElasticSearchIndexDefinition.ElasticSearchIndexType.MLMODEL_SEARCH_INDEX.indexName
            };
        BulkRequest request = new BulkRequest();
        SearchRequest searchRequest;
        SearchResponse response;
        int batchSize = 50;
        int totalHits;
        int currentHits = 0;

        do {
          searchRequest =
              searchRequest(indexes, "tags.tagFQN", event.getEntityFullyQualifiedName(), batchSize, currentHits);
          response = client.search(searchRequest, RequestOptions.DEFAULT);
          totalHits = (int) response.getHits().getTotalHits().value;
          for (SearchHit hit : response.getHits()) {
            Map<String, Object> sourceAsMap = hit.getSourceAsMap();
            List<TagLabel> listTags = (List<TagLabel>) sourceAsMap.get("tags");
            Script script = generateTagScript(listTags);
            if (!script.toString().isEmpty()) {
              request.add(
                  updateRequests(sourceAsMap.get("entityType").toString(), sourceAsMap.get("id").toString(), script));
            }
          }
          currentHits += response.getHits().getHits().length;
        } while (currentHits < totalHits);
        if (request.numberOfActions() > 0) {
          client.bulk(request, RequestOptions.DEFAULT);
        }
    }
  }

  @Override
  public void updateDatabase(ChangeEvent event) throws IOException {
    if (event.getEventType() == ENTITY_DELETED) {
      Database database = (Database) event.getEntity();
      DeleteByQueryRequest request =
          new DeleteByQueryRequest(ElasticSearchIndexDefinition.ElasticSearchIndexType.TABLE_SEARCH_INDEX.indexName);
      BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
      queryBuilder.must(new TermQueryBuilder(UpdateSearchEventsConstant.DATABASE_NAME, database.getName()));
      queryBuilder.must(new TermQueryBuilder(UpdateSearchEventsConstant.SERVICE_NAME, database.getService().getName()));
      request.setQuery(queryBuilder);
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  @Override
  public void updateDatabaseSchema(ChangeEvent event) throws IOException {
    if (event.getEventType() == ENTITY_DELETED) {
      DatabaseSchema databaseSchema = (DatabaseSchema) event.getEntity();
      DeleteByQueryRequest request =
          new DeleteByQueryRequest(ElasticSearchIndexDefinition.ElasticSearchIndexType.TABLE_SEARCH_INDEX.indexName);
      BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
      queryBuilder.must(new TermQueryBuilder("databaseSchema.name", databaseSchema.getName()));
      queryBuilder.must(
          new TermQueryBuilder(UpdateSearchEventsConstant.DATABASE_NAME, databaseSchema.getDatabase().getName()));
      request.setQuery(queryBuilder);
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  @Override
  public void updateDatabaseService(ChangeEvent event) throws IOException {
    if (event.getEventType() == ENTITY_DELETED) {
      DatabaseService databaseService = (DatabaseService) event.getEntity();
      DeleteByQueryRequest request =
          new DeleteByQueryRequest(ElasticSearchIndexDefinition.ElasticSearchIndexType.TABLE_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder(UpdateSearchEventsConstant.SERVICE_NAME, databaseService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  @Override
  public void updatePipelineService(ChangeEvent event) throws IOException {
    if (event.getEventType() == ENTITY_DELETED) {
      PipelineService pipelineService = (PipelineService) event.getEntity();
      DeleteByQueryRequest request =
          new DeleteByQueryRequest(ElasticSearchIndexDefinition.ElasticSearchIndexType.PIPELINE_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder(UpdateSearchEventsConstant.SERVICE_NAME, pipelineService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  @Override
  public void updateElasticSearch(UpdateRequest updateRequest) throws IOException {
    if (updateRequest != null) {
      LOG.debug(UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH, updateRequest);
      client.update(updateRequest, RequestOptions.DEFAULT);
    }
  }

  @Override
  public void updateMlModelService(ChangeEvent event) throws IOException {
    if (event.getEventType() == ENTITY_DELETED) {
      MlModelService mlModelService = (MlModelService) event.getEntity();
      DeleteByQueryRequest request =
          new DeleteByQueryRequest(ElasticSearchIndexDefinition.ElasticSearchIndexType.MLMODEL_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder(UpdateSearchEventsConstant.SERVICE_NAME, mlModelService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  @Override
  public void updateStorageService(ChangeEvent event) throws IOException {
    if (event.getEventType() == ENTITY_DELETED) {
      StorageService storageService = (StorageService) event.getEntity();
      DeleteByQueryRequest request =
          new DeleteByQueryRequest(
              ElasticSearchIndexDefinition.ElasticSearchIndexType.CONTAINER_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder(UpdateSearchEventsConstant.SERVICE_NAME, storageService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  @Override
  public void updateMessagingService(ChangeEvent event) throws IOException {
    if (event.getEventType() == ENTITY_DELETED) {
      MessagingService messagingService = (MessagingService) event.getEntity();
      DeleteByQueryRequest request =
          new DeleteByQueryRequest(ElasticSearchIndexDefinition.ElasticSearchIndexType.TOPIC_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder(UpdateSearchEventsConstant.SERVICE_NAME, messagingService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  @Override
  public void updateDashboardService(ChangeEvent event) throws IOException {
    if (event.getEventType() == ENTITY_DELETED) {
      DashboardService dashboardService = (DashboardService) event.getEntity();
      DeleteByQueryRequest request =
          new DeleteByQueryRequest(
              ElasticSearchIndexDefinition.ElasticSearchIndexType.DASHBOARD_SEARCH_INDEX.indexName);
      request.setQuery(new TermQueryBuilder(UpdateSearchEventsConstant.SERVICE_NAME, dashboardService.getName()));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  @Override
  public void updateClassification(ChangeEvent event) throws IOException {
    if (event.getEventType() == ENTITY_DELETED) {
      Classification classification = (Classification) event.getEntity();
      DeleteByQueryRequest request =
          new DeleteByQueryRequest(ElasticSearchIndexDefinition.ElasticSearchIndexType.TAG_SEARCH_INDEX.indexName);
      String fqnMatch = classification.getName() + ".*";
      request.setQuery(new WildcardQueryBuilder("fullyQualifiedName", fqnMatch));
      deleteEntityFromElasticSearchByQuery(request);
    }
  }

  @Override
  public void updateTestSuite(ChangeEvent event) throws IOException {
    ElasticSearchIndexDefinition.ElasticSearchIndexType indexType =
        ElasticSearchIndexDefinition.getIndexMappingByEntityType(Entity.TEST_CASE);
    TestSuite testSuite = (TestSuite) event.getEntity();
    UUID testSuiteId = testSuite.getId();

    if (event.getEventType() == ENTITY_DELETED) {
      if (testSuite.getExecutable()) {
        DeleteByQueryRequest deleteByQueryRequest = new DeleteByQueryRequest(indexType.indexName);
        deleteByQueryRequest.setQuery(new MatchQueryBuilder("testSuites.id", testSuiteId.toString()));
        deleteEntityFromElasticSearchByQuery(deleteByQueryRequest);
      } else {
        UpdateByQueryRequest updateByQueryRequest = new UpdateByQueryRequest(indexType.indexName);
        updateByQueryRequest.setQuery(new MatchQueryBuilder("testSuites.id", testSuiteId.toString()));
        String scriptTxt =
            "for (int i = 0; i < ctx._source.testSuites.length; i++) { if (ctx._source.testSuites[i].id == '%s') { ctx._source.testSuites.remove(i) }}";
        Script script =
            new Script(
                ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, String.format(scriptTxt, testSuiteId), new HashMap<>());
        updateByQueryRequest.setScript(script);
        updateElasticSearchByQuery(updateByQueryRequest);
      }
    }
  }

  private void updateElasticSearchByQuery(UpdateByQueryRequest updateByQueryRequest) throws IOException {
    if (updateByQueryRequest != null) {
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, updateByQueryRequest);
      client.updateByQuery(updateByQueryRequest, RequestOptions.DEFAULT);
    }
  }

  @Override
  public void addTestCaseFromLogicalTestSuite(
      TestSuite testSuite, ChangeEvent event, ElasticSearchIndexDefinition.ElasticSearchIndexType indexType)
      throws IOException {
    // Process creation of test cases (linked to a logical test suite) by adding reference to existing test cases
    List<EntityReference> testCaseReferences = testSuite.getTests();
    TestSuite testSuiteReference =
        new TestSuite()
            .withId(testSuite.getId())
            .withName(testSuite.getName())
            .withDisplayName(testSuite.getDisplayName())
            .withDescription(testSuite.getDescription())
            .withFullyQualifiedName(testSuite.getFullyQualifiedName())
            .withDeleted(testSuite.getDeleted())
            .withHref(testSuite.getHref())
            .withExecutable(testSuite.getExecutable());
    Map<String, Object> testSuiteDoc = JsonUtils.getMap(testSuiteReference);
    if (event.getEventType() == ENTITY_UPDATED) {
      for (EntityReference testcaseReference : testCaseReferences) {
        UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, testcaseReference.getId().toString());
        String scripText = "ctx._source.testSuites.add(params)";
        Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scripText, testSuiteDoc);
        updateRequest.script(script);
        updateElasticSearch(updateRequest);
      }
    }
  }

  public void processTestCase(
      TestCase testCase, ChangeEvent event, ElasticSearchIndexDefinition.ElasticSearchIndexType indexType)
      throws IOException {
    // Process creation of test cases (linked to an executable test suite
    UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, testCase.getId().toString());
    TestCaseIndex testCaseIndex;

    switch (event.getEventType()) {
      case ENTITY_CREATED:
        testCaseIndex = new TestCaseIndex((TestCase) event.getEntity());
        updateRequest.doc(JsonUtils.pojoToJson(testCaseIndex.buildESDocForCreate()), XContentType.JSON);
        updateRequest.docAsUpsert(true);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_UPDATED:
        testCaseIndex = new TestCaseIndex((TestCase) event.getEntity());
        scriptedUpsert(testCaseIndex.buildESDoc(), updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_SOFT_DELETED:
        softDeleteEntity(updateRequest);
        updateElasticSearch(updateRequest);
        break;
      case ENTITY_DELETED:
        EntityReference testSuiteReference = ((TestCase) event.getEntity()).getTestSuite();
        TestSuite testSuite = Entity.getEntity(Entity.TEST_SUITE, testSuiteReference.getId(), "", Include.ALL);
        if (testSuite.getExecutable()) {
          // Delete the test case from the index if deleted from an executable test suite
          DeleteRequest deleteRequest = new DeleteRequest(indexType.indexName, event.getEntityId().toString());
          deleteEntityFromElasticSearch(deleteRequest);
        } else {
          // for non-executable test suites, simply remove the testSuite from the testCase and update the index
          scriptedDeleteTestCase(updateRequest, testSuite.getId());
          updateElasticSearch(updateRequest);
        }
        break;
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

  private void scriptedUpsert(Object doc, UpdateRequest updateRequest) {
    String scriptTxt = "for (k in params.keySet()) { ctx._source.put(k, params.get(k)) }";
    Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, JsonUtils.getMap(doc));
    updateRequest.script(script);
    updateRequest.scriptedUpsert(true);
    updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
  }

  private void scriptedUserUpsert(Object index, UpdateRequest updateRequest) {
    String scriptTxt = "for (k in params.keySet()) {ctx._source.put(k, params.get(k)) }";
    Map<String, Object> doc = JsonUtils.getMap(index);
    Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, doc);
    updateRequest.script(script);
    updateRequest.scriptedUpsert(true);
  }

  private void scriptedTeamUpsert(Object index, UpdateRequest updateRequest) {
    String scriptTxt = "for (k in params.keySet()) { ctx._source.put(k, params.get(k)) }";
    Map<String, Object> doc = JsonUtils.getMap(index);
    Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, doc);
    updateRequest.script(script);
    updateRequest.scriptedUpsert(true);
  }

  private void softDeleteEntity(UpdateRequest updateRequest) {
    String scriptTxt = "ctx._source.deleted=true";
    Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, new HashMap<>());
    updateRequest.script(script);
  }

  private void scriptedDeleteTestCase(UpdateRequest updateRequest, UUID testSuiteId) {
    // Remove logical test suite from test case `testSuite` field
    String scriptTxt =
        "for (int i = 0; i < ctx._source.testSuite.length; i++) { if (ctx._source.testSuite[i].id == '%s') { ctx._source.testSuite.remove(i) }}";
    scriptTxt = String.format(scriptTxt, testSuiteId);
    Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, new HashMap<>());
    updateRequest.script(script);
  }

  //  @Override
  //  public void updateESSearch(UpdateRequest updateRequest) throws IOException {
  //    if (updateRequest != null) {
  //      LOG.debug(UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH, updateRequest);
  //      client.update(updateRequest, RequestOptions.DEFAULT);
  //    }
  //  }

  private void deleteEntityFromElasticSearch(DeleteRequest deleteRequest) throws IOException {
    if (deleteRequest != null) {
      LOG.debug(UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH, deleteRequest);
      deleteRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.WAIT_UNTIL);
      client.delete(deleteRequest, RequestOptions.DEFAULT);
    }
  }

  private void deleteEntityFromElasticSearchByQuery(DeleteByQueryRequest deleteRequest) throws IOException {
    if (deleteRequest != null) {
      LOG.debug(UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH, deleteRequest);
      deleteRequest.setRefresh(true);
      client.deleteByQuery(deleteRequest, RequestOptions.DEFAULT);
    }
  }

  public UpdateRequest applyESChangeEvent(ChangeEvent event) {
    String entityType = event.getEntityType();
    ElasticSearchIndexDefinition.ElasticSearchIndexType esIndexType =
        ElasticSearchIndexDefinition.getIndexMappingByEntityType(entityType);
    UUID entityId = event.getEntityId();

    String scriptTxt = "";
    Map<String, Object> fieldParams = new HashMap<>();

    // TODO : Make it return

    // Populate Script Text
    getScriptWithParams(event, scriptTxt, fieldParams);
    if (!CommonUtil.nullOrEmpty(scriptTxt)) {
      Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, fieldParams);
      UpdateRequest updateRequest = new UpdateRequest(esIndexType.indexName, entityId.toString());
      updateRequest.script(script);
      return updateRequest;
    } else {
      return null;
    }
  }

  private SearchRequest searchRequest(String[] indexes, String field, String value, int batchSize, int from) {
    SearchRequest searchRequest = new SearchRequest(indexes);
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(QueryBuilders.matchQuery(field, value));
    searchSourceBuilder.from(from);
    searchSourceBuilder.size(batchSize);
    searchSourceBuilder.timeout(new TimeValue(60, TimeUnit.SECONDS));
    searchRequest.source(searchSourceBuilder);
    return searchRequest;
  }

  private Script generateTagScript(List<TagLabel> listTags) {
    StringBuilder scriptTxt = new StringBuilder();
    Map<String, Object> fieldRemoveParams = new HashMap<>();
    fieldRemoveParams.put("tags", listTags);
    scriptTxt.append("ctx._source.tags=params.tags;");
    scriptTxt.append("ctx._source.tags.removeAll(params.tags);");
    fieldRemoveParams.put("tags", listTags);
    return new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt.toString(), fieldRemoveParams);
  }

  private UpdateRequest updateRequests(String entityType, String entityId, Script script) {
    return new UpdateRequest(IndexUtil.ENTITY_TYPE_TO_INDEX_MAP.get(entityType), entityId).script(script);
  }

  /**
   * @param data
   * @param options
   * @return
   * @throws IOException
   */
  @Override
  public BulkResponse bulk(BulkRequest data, RequestOptions options) throws IOException {
    BulkResponse response = client.bulk(data, RequestOptions.DEFAULT);
    return response;
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
    SearchRequest searchRequestTotalAssets =
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

  /**
   * @param startTs
   * @param endTs
   * @param tier
   * @param team
   * @param dataInsightChartName
   * @param dataReportIndex
   * @return
   * @throws IOException
   * @throws ParseException
   */
  @Override
  public Response listDataInsightChartResult(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      DataInsightChartResult.DataInsightChartType dataInsightChartName,
      String dataReportIndex)
      throws IOException, ParseException {
    SearchRequest searchRequest = buildSearchRequest(startTs, endTs, tier, team, dataInsightChartName, dataReportIndex);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    return Response.status(OK).entity(processDataInsightChartResult(searchResponse, dataInsightChartName)).build();
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
        return new EsEntitiesDescriptionAggregator(aggregations, dataInsightChartType);
      case PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE:
        return new EsEntitiesOwnerAggregator(aggregations, dataInsightChartType);
      case TOTAL_ENTITIES_BY_TYPE:
        return new EsTotalEntitiesAggregator(aggregations, dataInsightChartType);
      case TOTAL_ENTITIES_BY_TIER:
        return new EsTotalEntitiesByTierAggregator(aggregations, dataInsightChartType);
      case DAILY_ACTIVE_USERS:
        return new EsDailyActiveUsersAggregator(aggregations, dataInsightChartType);
      case PAGE_VIEWS_BY_ENTITIES:
        return new EsPageViewsByEntitiesAggregator(aggregations, dataInsightChartType);
      case MOST_ACTIVE_USERS:
        return new EsMostActiveUsersAggregator(aggregations, dataInsightChartType);
      case MOST_VIEWED_ENTITIES:
        return new EsMostViewedEntitiesAggregator(aggregations, dataInsightChartType);
      default:
        throw new IllegalArgumentException(
            String.format("No processor found for chart Type %s ", dataInsightChartType));
    }
  }

  private static SearchRequest buildSearchRequest(
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

    SearchRequest searchRequest = new SearchRequest(dataReportIndex);
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

  public static RestHighLevelClient createElasticSearchClient(ElasticSearchConfiguration esConfig) {
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
              // Enable TCP keep alive strategy
              if (esConfig.getKeepAliveTimeoutSecs() != null && esConfig.getKeepAliveTimeoutSecs() > 0) {
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
      return new RestHighLevelClient(restClientBuilder);
    } catch (Exception e) {
      throw new ElasticsearchException("Failed to create elastic search client ", e);
    }
  }
}
