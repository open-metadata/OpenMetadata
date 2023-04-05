/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.search;

import static javax.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.lucene.search.function.CombineFunction;
import org.elasticsearch.common.settings.Settings;
import org.elasticsearch.common.unit.Fuzziness;
import org.elasticsearch.common.unit.TimeValue;
import org.elasticsearch.common.xcontent.LoggingDeprecationHandler;
import org.elasticsearch.common.xcontent.NamedXContentRegistry;
import org.elasticsearch.common.xcontent.XContentParser;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.MultiMatchQueryBuilder;
import org.elasticsearch.index.query.Operator;
import org.elasticsearch.index.query.QueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.QueryStringQueryBuilder;
import org.elasticsearch.index.query.functionscore.FieldValueFactorFunctionBuilder;
import org.elasticsearch.index.query.functionscore.FunctionScoreQueryBuilder;
import org.elasticsearch.index.query.functionscore.ScoreFunctionBuilders;
import org.elasticsearch.search.SearchModule;
import org.elasticsearch.search.aggregations.AggregationBuilders;
import org.elasticsearch.search.aggregations.BucketOrder;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.fetch.subphase.FetchSourceContext;
import org.elasticsearch.search.fetch.subphase.highlight.HighlightBuilder;
import org.elasticsearch.search.sort.SortOrder;
import org.elasticsearch.search.suggest.Suggest;
import org.elasticsearch.search.suggest.SuggestBuilder;
import org.elasticsearch.search.suggest.SuggestBuilders;
import org.elasticsearch.search.suggest.completion.CompletionSuggestionBuilder;
import org.elasticsearch.search.suggest.completion.context.CategoryQueryContext;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.util.ElasticSearchClientUtils;

@Slf4j
@Path("/v1/search")
@Tag(name = "Search", description = "APIs related to search and suggest.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "search")
public class SearchResource {
  private RestHighLevelClient client;
  private static final Integer MAX_AGGREGATE_SIZE = 50;
  private static final Integer MAX_RESULT_HITS = 10000;
  private static final String NAME_KEYWORD = "name.keyword";
  private static final String DISPLAY_NAME = "displayName";
  private static final String DISPLAY_NAME_KEYWORD = "displayName.keyword";
  private static final String FIELD_DISPLAY_NAME_NGRAM = "displayName.ngram";
  private static final String QUERY = "query";
  private static final String QUERY_NGRAM = "query.ngram";
  private static final String DESCRIPTION = "description";
  private static final String UNIFIED = "unified";

  private static final NamedXContentRegistry xContentRegistry;

  static {
    SearchModule searchModule = new SearchModule(Settings.EMPTY, false, List.of());

    xContentRegistry = new NamedXContentRegistry(searchModule.getNamedXContents());
  }

  public SearchResource() {}

  public void initialize(OpenMetadataApplicationConfig config) {
    if (config.getElasticSearchConfiguration() != null) {
      this.client = ElasticSearchClientUtils.createElasticSearchClient(config.getElasticSearchConfiguration());
    }
  }

  @GET
  @Path("/query")
  @Operation(
      operationId = "searchEntitiesWithQuery",
      summary = "Search entities",
      description =
          "Search entities using query test. Use query params `from` and `size` for pagination. Use "
              + "`sort_field` to sort the results in `sort_order`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "search response",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = SearchResponse.class)))
      })
  public Response search(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Search Query Text, Pass *text* for substring match; "
                      + "Pass without wildcards for exact match. <br/> "
                      + "1. For listing all tables or topics pass q=* <br/>"
                      + "2. For search tables or topics pass q=*search_term* <br/>"
                      + "3. For searching field names such as search by column_name "
                      + "pass q=column_names:address <br/>"
                      + "4. For searching by tag names pass q=tags:user.email <br/>"
                      + "5. When user selects a filter pass q=query_text AND tags:user.email "
                      + "AND platform:MYSQL <br/>"
                      + "6. Search with multiple values of same filter q=tags:user.email "
                      + "AND tags:user.address <br/>"
                      + " logic operators such as AND and OR must be in uppercase ",
              required = true)
          @DefaultValue("*")
          @QueryParam("q")
          String query,
      @Parameter(description = "ElasticSearch Index name, defaults to table_search_index")
          @DefaultValue("table_search_index")
          @QueryParam("index")
          String index,
      @Parameter(description = "Filter documents by deleted param. By default deleted is false")
          @DefaultValue("false")
          @QueryParam("deleted")
          @Deprecated(forRemoval = true)
          boolean deleted,
      @Parameter(description = "From field to paginate the results, defaults to 0")
          @DefaultValue("0")
          @QueryParam("from")
          int from,
      @Parameter(description = "Size field to limit the no.of results returned, defaults to 10")
          @DefaultValue("10")
          @QueryParam("size")
          int size,
      @Parameter(
              description =
                  "Sort the search results by field, available fields to "
                      + "sort weekly_stats"
                      + " , daily_stats, monthly_stats, last_updated_timestamp")
          @DefaultValue("_score")
          @QueryParam("sort_field")
          String sortFieldParam,
      @Parameter(description = "Sort order asc for ascending or desc for descending, " + "defaults to desc")
          @DefaultValue("desc")
          @QueryParam("sort_order")
          SortOrder sortOrder,
      @Parameter(description = "Track Total Hits") @DefaultValue("false") @QueryParam("track_total_hits")
          boolean trackTotalHits,
      @Parameter(
              description =
                  "Elasticsearch query that will be combined with the query_string query generator from the `query` argument")
          @QueryParam("query_filter")
          String queryFilter,
      @Parameter(description = "Elasticsearch query that will be used as a post_filter") @QueryParam("post_filter")
          String postFilter,
      @Parameter(description = "Get document body for each hit") @DefaultValue("true") @QueryParam("fetch_source")
          boolean fetchSource,
      @Parameter(
              description =
                  "Get only selected fields of the document body for each hit. Empty value will return all fields")
          @QueryParam("include_source_fields")
          List<String> includeSourceFields)
      throws IOException {

    if (nullOrEmpty(query)) {
      query = "*";
    }

    SearchSourceBuilder searchSourceBuilder;

    switch (index) {
      case "topic_search_index":
        searchSourceBuilder = buildTopicSearchBuilder(query, from, size);
        break;
      case "dashboard_search_index":
        searchSourceBuilder = buildDashboardSearchBuilder(query, from, size);
        break;
      case "pipeline_search_index":
        searchSourceBuilder = buildPipelineSearchBuilder(query, from, size);
        break;
      case "mlmodel_search_index":
        searchSourceBuilder = buildMlModelSearchBuilder(query, from, size);
        break;
      case "table_search_index":
        searchSourceBuilder = buildTableSearchBuilder(query, from, size);
        break;
      case "user_search_index":
        searchSourceBuilder = buildUserSearchBuilder(query, from, size);
        break;
      case "team_search_index":
        searchSourceBuilder = buildTeamSearchBuilder(query, from, size);
        break;
      case "glossary_search_index":
        searchSourceBuilder = buildGlossaryTermSearchBuilder(query, from, size);
        break;
      case "tag_search_index":
        searchSourceBuilder = buildTagSearchBuilder(query, from, size);
        break;
      case "container_search_index":
        searchSourceBuilder = buildContainerSearchBuilder(query, from, size);
        break;
      case "query_search_index":
        searchSourceBuilder = buildQuerySearchBuilder(query, from, size);
        break;
      default:
        searchSourceBuilder = buildAggregateSearchBuilder(query, from, size);
        break;
    }

    if (!nullOrEmpty(queryFilter)) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(xContentRegistry, LoggingDeprecationHandler.INSTANCE, queryFilter);
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        BoolQueryBuilder newQuery = QueryBuilders.boolQuery().must(searchSourceBuilder.query()).filter(filter);
        searchSourceBuilder.query(newQuery);
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }

    if (!nullOrEmpty(postFilter)) {
      try {
        XContentParser filterParser =
            XContentType.JSON.xContent().createParser(xContentRegistry, LoggingDeprecationHandler.INSTANCE, postFilter);
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        searchSourceBuilder.postFilter(filter);
      } catch (Exception ex) {
        LOG.warn("Error parsing post_filter from query parameters, ignoring filter", ex);
      }
    }

    /* For backward-compatibility we continue supporting the deleted argument, this should be removed in future versions */
    searchSourceBuilder.query(
        QueryBuilders.boolQuery().must(searchSourceBuilder.query()).must(QueryBuilders.termQuery("deleted", deleted)));

    if (!nullOrEmpty(sortFieldParam)) {
      searchSourceBuilder.sort(sortFieldParam, sortOrder);
    }

    /* for performance reasons ElasticSearch doesn't provide accurate hits
    if we enable trackTotalHits parameter it will try to match every result, count and return hits
    however in most cases for search results an approximate value is good enough.
    we are displaying total entity counts in landing page and explore page where we need the total count
    https://github.com/elastic/elasticsearch/issues/33028 */
    searchSourceBuilder.fetchSource(
        new FetchSourceContext(fetchSource, includeSourceFields.toArray(String[]::new), new String[] {}));

    if (trackTotalHits) {
      searchSourceBuilder.trackTotalHits(true);
    } else {
      searchSourceBuilder.trackTotalHitsUpTo(MAX_RESULT_HITS);
    }

    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    String response =
        client.search(new SearchRequest(index).source(searchSourceBuilder), RequestOptions.DEFAULT).toString();

    return Response.status(OK).entity(response).build();
  }

  @GET
  @Path("/suggest")
  @Operation(
      operationId = "getSuggestedEntities",
      summary = "Suggest entities",
      description = "Get suggested entities used for auto-completion.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Table Suggestion API",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Suggest.class)))
      })
  public Response suggest(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Suggest API can be used to auto-fill the entities name while "
                      + "use is typing search text <br/>"
                      + " 1. To get suggest results pass q=us or q=user etc.. <br/>"
                      + " 2. Do not add any wild-cards such as * like in search api <br/>"
                      + " 3. suggest api is a prefix suggestion <br/>",
              required = true)
          @QueryParam("q")
          String query,
      @DefaultValue("table_search_index") @QueryParam("index") String index,
      @Parameter(
              description =
                  "Field in object containing valid suggestions. Defaults to 'suggest`. "
                      + "All indices has a `suggest` field, only some indices have other `suggest_*` fields.")
          @DefaultValue("suggest")
          @QueryParam("field")
          String fieldName,
      @Parameter(description = "Size field to limit the no.of results returned, defaults to 10")
          @DefaultValue("10")
          @QueryParam("size")
          int size,
      @Parameter(description = "Get document body for each hit") @DefaultValue("true") @QueryParam("fetch_source")
          boolean fetchSource,
      @Parameter(
              description =
                  "Get only selected fields of the document body for each hit. Empty value will return all fields")
          @QueryParam("include_source_fields")
          List<String> includeSourceFields,
      @DefaultValue("false") @QueryParam("deleted") String deleted)
      throws IOException {

    if (nullOrEmpty(query)) {
      query = "*";
    }

    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    CompletionSuggestionBuilder suggestionBuilder =
        SuggestBuilders.completionSuggestion(fieldName).prefix(query, Fuzziness.AUTO).size(size).skipDuplicates(true);
    if (fieldName.equalsIgnoreCase("suggest")) {
      suggestionBuilder.contexts(
          Collections.singletonMap(
              "deleted", Collections.singletonList(CategoryQueryContext.builder().setCategory(deleted).build())));
    }
    SuggestBuilder suggestBuilder = new SuggestBuilder();
    suggestBuilder.addSuggestion("metadata-suggest", suggestionBuilder);
    searchSourceBuilder
        .suggest(suggestBuilder)
        .timeout(new TimeValue(30, TimeUnit.SECONDS))
        .fetchSource(new FetchSourceContext(fetchSource, includeSourceFields.toArray(String[]::new), new String[] {}));
    SearchRequest searchRequest = new SearchRequest(index).source(searchSourceBuilder);

    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    Suggest suggest = searchResponse.getSuggest();

    return Response.status(OK).entity(suggest.toString()).build();
  }

  @GET
  @Path("/aggregate")
  @Operation(
      operationId = "getAggregateFields",
      summary = "Get aggregated fields",
      description = "Get aggregated fields from entities.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Table Aggregate API",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Suggest.class)))
      })
  public Response aggregate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @DefaultValue("table_search_index") @QueryParam("index") String index,
      @Parameter(description = "Field in an entity.") @QueryParam("field") String fieldName,
      @Parameter(description = "Size field to limit the no.of results returned, defaults to 10")
          @DefaultValue("10")
          @QueryParam("size")
          int size,
      @DefaultValue("false") @QueryParam("deleted") String deleted)
      throws IOException {

    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms(fieldName).field(fieldName).size(MAX_AGGREGATE_SIZE).order(BucketOrder.key(true)))
        .size(0);
    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    String response =
        client.search(new SearchRequest(index).source(searchSourceBuilder), RequestOptions.DEFAULT).toString();
    return Response.status(OK).entity(response).build();
  }

  private SearchSourceBuilder buildAggregateSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder = QueryBuilders.queryStringQuery(query).lenient(true);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, null, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildTableSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(FIELD_DISPLAY_NAME, 15.0f)
            .field(FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 15.0f)
            .field(DISPLAY_NAME_KEYWORD, 25.0f)
            .field(NAME_KEYWORD, 25.0f)
            .field(FIELD_DESCRIPTION, 1.0f)
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
    highlightTableName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(DESCRIPTION);
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
    hb.preTags("<span class=\"text-highlighter\">");
    hb.postTags("</span>");
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(AggregationBuilders.terms("database.name.keyword").field("database.name.keyword"));
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("databaseSchema.name.keyword").field("databaseSchema.name.keyword"));

    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildTopicSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(FIELD_DISPLAY_NAME, 15.0f)
            .field(FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 15.0f)
            .field(DISPLAY_NAME_KEYWORD, 25.0f)
            .field(NAME_KEYWORD, 25.0f)
            .field(FIELD_DESCRIPTION, 1.0f)
            .field("messageSchema.schemaFields.name", 2.0f)
            .field("messageSchema.schemaFields.description", 1.0f)
            .field("messageSchema.schemaFields.children.name", 2.0f)
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
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("messageSchema.schemaFields.name").field("messageSchema.schemaFields.name"));
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildDashboardSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(FIELD_DISPLAY_NAME, 15.0f)
            .field(FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 15.0f)
            .field(DISPLAY_NAME_KEYWORD, 25.0f)
            .field(NAME_KEYWORD, 25.0f)
            .field(FIELD_DESCRIPTION, 1.0f)
            .field("charts.name", 2.0f)
            .field("charts.description", 1.0f)
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
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildPipelineSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(FIELD_DISPLAY_NAME, 15.0f)
            .field(FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 15.0f)
            .field(DISPLAY_NAME_KEYWORD, 25.0f)
            .field(NAME_KEYWORD, 25.0f)
            .field(DESCRIPTION, 1.0f)
            .field("tasks.name", 2.0f)
            .field("tasks.description", 1.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    HighlightBuilder.Field highlightPipelineName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightPipelineName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(DESCRIPTION);
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
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildMlModelSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(FIELD_DISPLAY_NAME, 15.0f)
            .field(FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 15.0f)
            .field(DISPLAY_NAME_KEYWORD, 25.0f)
            .field(NAME_KEYWORD, 25.0f)
            .field(DESCRIPTION, 1.0f)
            .field("mlFeatures.name", 2.0f)
            .field("mlFeatures.description", 1.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    HighlightBuilder.Field highlightPipelineName = new HighlightBuilder.Field(FIELD_DISPLAY_NAME);
    highlightPipelineName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(DESCRIPTION);
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

  private SearchSourceBuilder buildContainerSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(FIELD_DISPLAY_NAME, 15.0f)
            .field(FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 15.0f)
            .field(FIELD_DESCRIPTION, 1.0f)
            .field(DISPLAY_NAME_KEYWORD, 25.0f)
            .field(NAME_KEYWORD, 25.0f)
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
    highlightContainerName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(DESCRIPTION);
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
    hb.preTags("<span class=\"text-highlighter\">");
    hb.postTags("</span>");
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildQuerySearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(DISPLAY_NAME, 10.0f)
            .field(FIELD_DISPLAY_NAME_NGRAM)
            .field(QUERY, 10.0f)
            .field(QUERY_NGRAM)
            .field(DESCRIPTION, 3.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightGlossaryName = new HighlightBuilder.Field(DISPLAY_NAME);
    highlightGlossaryName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightQuery = new HighlightBuilder.Field(QUERY);
    highlightGlossaryName.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightGlossaryName);
    hb.field(highlightQuery);
    hb.preTags("<span class=\"text-highlighter\">");
    hb.postTags("</span>");

    return searchBuilder(queryBuilder, hb, from, size);
  }

  private SearchSourceBuilder searchBuilder(QueryBuilder queryBuilder, HighlightBuilder hb, int from, int size) {
    SearchSourceBuilder builder = new SearchSourceBuilder().query(queryBuilder).from(from).size(size);
    if (hb != null) {
      hb.preTags("<span class=\"text-highlighter\">");
      hb.postTags("</span>");
      builder.highlighter(hb);
    }
    return builder;
  }

  private SearchSourceBuilder addAggregation(SearchSourceBuilder builder) {
    builder
        .aggregation(AggregationBuilders.terms("serviceType").field("serviceType").size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("service.name.keyword").field("service.name.keyword").size(MAX_AGGREGATE_SIZE))
        .aggregation(AggregationBuilders.terms("entityType").field("entityType").size(MAX_AGGREGATE_SIZE))
        .aggregation(AggregationBuilders.terms("tier.tagFQN").field("tier.tagFQN"))
        .aggregation(AggregationBuilders.terms("tags.tagFQN").field("tags.tagFQN").size(MAX_AGGREGATE_SIZE));

    return builder;
  }

  private SearchSourceBuilder buildUserSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(DISPLAY_NAME, 3.0f)
            .field(DISPLAY_NAME_KEYWORD, 5.0f)
            .field(FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 2.0f)
            .field(NAME_KEYWORD, 3.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    return searchBuilder(queryBuilder, null, from, size);
  }

  private SearchSourceBuilder buildTeamSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(DISPLAY_NAME, 3.0f)
            .field(DISPLAY_NAME_KEYWORD, 5.0f)
            .field(FIELD_DISPLAY_NAME_NGRAM)
            .field(FIELD_NAME, 2.0f)
            .field(NAME_KEYWORD, 3.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);
    return searchBuilder(queryBuilder, null, from, size);
  }

  private SearchSourceBuilder buildGlossaryTermSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(FIELD_NAME, 10.0f)
            .field(NAME_KEYWORD, 10.0f)
            .field(DISPLAY_NAME_KEYWORD, 10.0f)
            .field(FIELD_DISPLAY_NAME, 10.0f)
            .field(FIELD_DISPLAY_NAME_NGRAM)
            .field("synonyms", 5.0f)
            .field("synonyms.ngram")
            .field(DESCRIPTION, 3.0f)
            .field("glossary.name", 5.0f)
            .field("glossary.displayName", 5.0f)
            .field("glossary.displayName.ngram")
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightGlossaryName = new HighlightBuilder.Field(FIELD_NAME);
    highlightGlossaryName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightSynonym = new HighlightBuilder.Field("synonyms");
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightGlossaryName);
    hb.field(highlightSynonym);
    hb.preTags("<span class=\"text-highlighter\">");
    hb.postTags("</span>");
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder
        .aggregation(AggregationBuilders.terms("tags.tagFQN").field("tags.tagFQN").size(MAX_AGGREGATE_SIZE))
        .aggregation(AggregationBuilders.terms("glossary.name").field("glossary.name.keyword"));
    return searchSourceBuilder;
  }

  private SearchSourceBuilder buildTagSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(FIELD_NAME, 10.0f)
            .field(DESCRIPTION, 3.0f)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO);

    HighlightBuilder.Field highlightTagName = new HighlightBuilder.Field(FIELD_NAME);
    highlightTagName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightTagName);
    hb.preTags("<span class=\"text-highlighter\">");
    hb.postTags("</span>");

    return searchBuilder(queryBuilder, hb, from, size);
  }
}
