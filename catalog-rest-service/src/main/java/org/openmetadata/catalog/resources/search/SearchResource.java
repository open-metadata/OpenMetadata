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

package org.openmetadata.catalog.resources.search;

import static javax.ws.rs.core.Response.Status.OK;
import static org.openmetadata.catalog.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.catalog.Entity.FIELD_NAME;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
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
import org.elasticsearch.common.unit.Fuzziness;
import org.elasticsearch.common.unit.TimeValue;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.QueryStringQueryBuilder;
import org.elasticsearch.search.aggregations.AggregationBuilders;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.fetch.subphase.highlight.HighlightBuilder;
import org.elasticsearch.search.sort.SortOrder;
import org.elasticsearch.search.suggest.Suggest;
import org.elasticsearch.search.suggest.SuggestBuilder;
import org.elasticsearch.search.suggest.SuggestBuilders;
import org.elasticsearch.search.suggest.completion.CompletionSuggestionBuilder;
import org.openmetadata.catalog.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.catalog.util.ElasticSearchClientUtils;

@Slf4j
@Path("/v1/search")
@Api(value = "Search collection", tags = "Search collection")
@Produces(MediaType.APPLICATION_JSON)
public class SearchResource {
  private final RestHighLevelClient client;
  private static final Integer MAX_AGGREGATE_SIZE = 50;
  private static final Integer MAX_RESULT_HITS = 10000;
  private static final String NAME = "name";
  private static final String DISPLAY_NAME = "display_name";
  private static final String DESCRIPTION = "description";
  private static final String UNIFIED = "unified";

  public SearchResource(ElasticSearchConfiguration esConfig) {
    this.client = ElasticSearchClientUtils.createElasticSearchClient(esConfig);
  }

  @GET
  @Path("/query")
  @Operation(
      operationId = "searchEntitiesWithQuery",
      summary = "Search entities",
      tags = "search",
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
          @javax.ws.rs.QueryParam("q")
          String query,
      @Parameter(description = "ElasticSearch Index name, defaults to table_search_index")
          @DefaultValue("table_search_index")
          @QueryParam("index")
          String index,
      @Parameter(description = "Filter documents by deleted param. By default deleted is false")
          @DefaultValue("false")
          @QueryParam("deleted")
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
          @QueryParam("sort_field")
          String sortFieldParam,
      @Parameter(description = "Sort order asc for ascending or desc for descending, " + "defaults to desc")
          @DefaultValue("desc")
          @QueryParam("sort_order")
          String sortOrderParam,
      @Parameter(description = "Track Total Hits") @DefaultValue("false") @QueryParam("track_total_hits")
          boolean trackTotalHits)
      throws IOException {

    SearchRequest searchRequest = new SearchRequest(index);
    SortOrder sortOrder = SortOrder.DESC;
    SearchSourceBuilder searchSourceBuilder;
    if (sortOrderParam.equals("asc")) {
      sortOrder = SortOrder.ASC;
    }
    // add deleted flag
    query += " AND deleted:" + deleted;

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
      default:
        searchSourceBuilder = buildAggregateSearchBuilder(query, from, size);
        break;
    }

    if (!nullOrEmpty(sortFieldParam)) {
      searchSourceBuilder.sort(sortFieldParam, sortOrder);
    }
    LOG.debug(searchSourceBuilder.toString());
    /* for performance reasons ElasticSearch doesn't provide accurate hits
    if we enable trackTotalHits parameter it will try to match every result, count and return hits
    however in most cases for search results an approximate value is good enough.
    we are displaying total entity counts in landing page and explore page where we need the total count
    https://github.com/elastic/elasticsearch/issues/33028 */
    if (trackTotalHits) {
      searchSourceBuilder.trackTotalHits(true);
    } else {
      searchSourceBuilder.trackTotalHitsUpTo(MAX_RESULT_HITS);
    }
    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    searchRequest.source(searchSourceBuilder);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    return Response.status(OK).entity(searchResponse.toString()).build();
  }

  @GET
  @Path("/suggest")
  @Operation(
      operationId = "getSuggestedEntities",
      summary = "Suggest Entities",
      tags = "search",
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
          @javax.ws.rs.QueryParam("q")
          String query,
      @DefaultValue("table_search_index") @javax.ws.rs.QueryParam("index") String index,
      @DefaultValue("suggest") @javax.ws.rs.QueryParam("field") String fieldName)
      throws IOException {
    SearchRequest searchRequest = new SearchRequest(index);
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    CompletionSuggestionBuilder suggestionBuilder = SuggestBuilders.completionSuggestion(fieldName).prefix(query);
    SuggestBuilder suggestBuilder = new SuggestBuilder();
    suggestBuilder.addSuggestion("metadata-suggest", suggestionBuilder);
    searchSourceBuilder.suggest(suggestBuilder);
    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    searchRequest.source(searchSourceBuilder);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    Suggest suggest = searchResponse.getSuggest();
    return Response.status(OK).entity(suggest.toString()).build();
  }

  private SearchSourceBuilder buildAggregateSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder = QueryBuilders.queryStringQuery(query).lenient(true);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, null, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildTableSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(FIELD_NAME, 10.0f)
            .field(FIELD_DESCRIPTION, 1.0f)
            .field("columns.name", 5.0f)
            .field("columns.description", 1.0f)
            .field("columns.children.name", 5.0f)
            .lenient(true)
            .fuzziness(Fuzziness.AUTO);
    HighlightBuilder.Field highlightTableName = new HighlightBuilder.Field(NAME);
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
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder().query(queryStringBuilder).from(from).size(size);
    searchSourceBuilder.aggregation(AggregationBuilders.terms("Database").field("database.name.keyword"));
    searchSourceBuilder.aggregation(AggregationBuilders.terms("DatabaseSchema").field("databaseSchema.name.keyword"));

    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildTopicSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query).field(FIELD_NAME, 10.0f).field(FIELD_DESCRIPTION, 2.0f).lenient(true);
    HighlightBuilder.Field highlightTopicName = new HighlightBuilder.Field(FIELD_NAME);
    highlightTopicName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightTopicName);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildDashboardSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .field(NAME, 10.0f)
            .field(FIELD_DESCRIPTION, 2.0f)
            .field("chars.name")
            .field("charts.description")
            .lenient(true);
    HighlightBuilder.Field highlightDashboardName = new HighlightBuilder.Field(NAME);
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
            .field(NAME, 5.0f)
            .field(DESCRIPTION)
            .field("tasks.name")
            .field("tasks.description")
            .lenient(true);
    HighlightBuilder.Field highlightPipelineName = new HighlightBuilder.Field(NAME);
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

  private SearchSourceBuilder searchBuilder(
      QueryStringQueryBuilder queryBuilder, HighlightBuilder hb, int from, int size) {
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
        .aggregation(AggregationBuilders.terms("Service").field("serviceType"))
        .size(MAX_AGGREGATE_SIZE)
        .aggregation(AggregationBuilders.terms("ServiceName").field("service.name.keyword").size(MAX_AGGREGATE_SIZE))
        .aggregation(AggregationBuilders.terms("ServiceCategory").field("service.type").size(MAX_AGGREGATE_SIZE))
        .aggregation(AggregationBuilders.terms("EntityType").field("entityType").size(MAX_AGGREGATE_SIZE))
        .aggregation(AggregationBuilders.terms("Tier").field("tier.tagFQN"))
        .aggregation(AggregationBuilders.terms("Tags").field("tags.tagFQN").size(MAX_AGGREGATE_SIZE));

    return builder;
  }

  private SearchSourceBuilder buildUserSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query).field(NAME, 5.0f).field(DISPLAY_NAME, 1.0f).lenient(true);
    return searchBuilder(queryBuilder, null, from, size);
  }

  private SearchSourceBuilder buildTeamSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query).field(NAME, 5.0f).field(DISPLAY_NAME, 3.0f).lenient(true);
    return searchBuilder(queryBuilder, null, from, size);
  }

  private SearchSourceBuilder buildGlossaryTermSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query).field(NAME, 5.0f).field(DESCRIPTION, 3.0f).lenient(true);

    HighlightBuilder.Field highlightGlossaryName = new HighlightBuilder.Field(NAME);
    highlightGlossaryName.highlighterType(UNIFIED);
    HighlightBuilder.Field highlightDescription = new HighlightBuilder.Field(FIELD_DESCRIPTION);
    highlightDescription.highlighterType(UNIFIED);
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightGlossaryName);
    hb.preTags("<span class=\"text-highlighter\">");
    hb.postTags("</span>");

    return searchBuilder(queryBuilder, hb, from, size);
  }
}
