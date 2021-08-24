/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.search;


import org.elasticsearch.search.fetch.subphase.highlight.HighlightBuilder;
import org.elasticsearch.search.suggest.Suggest;
import org.elasticsearch.search.suggest.SuggestBuilder;
import org.elasticsearch.search.suggest.SuggestBuilders;
import org.elasticsearch.search.suggest.completion.CompletionSuggestionBuilder;
import org.openmetadata.catalog.ElasticSearchConfiguration;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.apache.http.HttpHost;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.unit.TimeValue;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.aggregations.AggregationBuilders;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
import java.io.IOException;
import java.util.concurrent.TimeUnit;

import static javax.ws.rs.core.Response.Status.OK;

@Path("/v1/search")
@Api(value = "Search collection", tags = "Search collection")
@Produces(MediaType.APPLICATION_JSON)
public class SearchResource {
  private final RestHighLevelClient client;
  private static final Logger LOG = LoggerFactory.getLogger(SearchResource.class);

  public SearchResource(ElasticSearchConfiguration esConfig) {
    this.client = new RestHighLevelClient(
            RestClient.builder(new HttpHost(esConfig.getHost(), esConfig.getPort(), "http"))
    );
  }

  @GET
  @Path("/query")
  @Operation(summary = "Search entities", tags = "search",
          description = "Search entities using query test. Use query params `from` and `size` for pagination. Use " +
                  "`sort_field` to sort the results in `sort_order`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "search response",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = SearchResponse.class)))
          })
  public Response search(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Search Query Text, Pass *text* for substring match; " +
                                 "Pass without wildcards for exact match. <br/> " +
                                 "1. For listing all tables pass q=* <br/>" +
                                 "2. For search tables pass q=*search_term* <br/>" +
                                 "3. For searching field names such as search by column_name " +
                                 "pass q=column_names:address <br/>" +
                                 "4. For searching by tag names pass q=tags:user.email <br/>" +
                                 "5. When user selects a filter pass q=query_text AND tags:user.email " +
                                 "AND platform:MYSQL <br/>" +
                                 "6. Search with multiple values of same filter q=tags:user.email " +
                                 "AND tags:user.address <br/>" +
                                 " logic operators such as AND and OR must be in uppercase ", required = true)
                         @javax.ws.rs.QueryParam("q") String query,
                         @Parameter(description = "ElasticSearch Index name, defaults to table_search_index")
                           @DefaultValue("table_search_index") @QueryParam("index") String index,
                         @Parameter(description = "From field to paginate the results, defaults to 1")
                           @DefaultValue("0") @QueryParam("from") int from,
                         @Parameter(description = "Size field to limit the no.of results returned, defaults to 10")
                           @DefaultValue("10") @QueryParam("size") int size,
                         @Parameter(description = "Sort the search results by field, available fields to " +
                                 "sort weekly_stats" +
                                 " , daily_stats, monthly_stats, last_updated_timestamp defaults to weekly_stats")
                                  @QueryParam("sort_field") String sortFieldParam,
                         @Parameter(description = "Sort order asc for ascending or desc for descending, " +
                                 "defaults to desc")
                           @DefaultValue("desc") @QueryParam("sort_order") String sortOrderParam) throws IOException {

    SearchRequest searchRequest = new SearchRequest(index);
    SortOrder sortOrder = SortOrder.DESC;
    SearchSourceBuilder searchSourceBuilder;
    if (sortOrderParam.equals("asc")) {
      sortOrder = SortOrder.ASC;
    }
    if (index.equals("topic_search_index")) {
      searchSourceBuilder = buildTopicSearchBuilder(query, from, size);
    } else {
      searchSourceBuilder = buildTableSearchBuilder(query, from, size);
    }
    if (sortFieldParam != null && !sortFieldParam.isEmpty()) {
      searchSourceBuilder.sort(sortFieldParam, sortOrder);
    }
    LOG.info(searchSourceBuilder.toString());
    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    searchRequest.source(searchSourceBuilder);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    return Response.status(OK).entity(searchResponse.toString()).build();
  }

  @GET
  @Path("/suggest")
  @Operation(summary = "Suggest entities", tags = "search",
          description = "Get suggested entities used for auto-completion.",
          responses = {
                  @ApiResponse(responseCode = "200",
                          description = "Table Suggestion API",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = SearchResponse.class)))
          })
  public Response suggest(@Context UriInfo uriInfo,
                          @Context SecurityContext securityContext,
                          @Parameter(description = "Suggest API can be used to auto-fill the entities name while " +
                                  "use is typing search text <br/>" +
                                  " 1. To get suggest results pass q=us or q=user etc.. <br/>" +
                                  " 2. Do not add any wild-cards such as * like in search api <br/>"+
                                  " 3. suggest api is a prefix suggestion <br/>", required = true)
                          @javax.ws.rs.QueryParam("q") String query,
                          @DefaultValue("table_search_index") @javax.ws.rs.QueryParam("index") String index)
          throws IOException {
    SearchRequest searchRequest = new SearchRequest(index);
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    CompletionSuggestionBuilder suggestionBuilder = SuggestBuilders.completionSuggestion("suggest")
            .prefix(query);
    SuggestBuilder suggestBuilder = new SuggestBuilder();
    suggestBuilder.addSuggestion("table-suggest", suggestionBuilder);
    searchSourceBuilder.suggest(suggestBuilder);
    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    searchRequest.source(searchSourceBuilder);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    Suggest suggest = searchResponse.getSuggest();
    return Response.status(OK)
            .entity(suggest.toString())
            .build();
  }

  private SearchSourceBuilder buildTableSearchBuilder(String query, int from, int size) {
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    HighlightBuilder.Field highlightTableName =
            new HighlightBuilder.Field("table_name");
    highlightTableName.highlighterType("unified");
    HighlightBuilder.Field highlightDescription =
            new HighlightBuilder.Field("description");
    highlightDescription.highlighterType("unified");
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightTableName);
    hb.preTags("<b>");
    hb.postTags("</b>");
    searchSourceBuilder.query(QueryBuilders.queryStringQuery(query)
            .field("table_name", 5.0f)
            .field("description")
            .field("column_names")
            .field("column_descriptions")
            .lenient(true))
            .aggregation(AggregationBuilders.terms("Service Type").field("service_type"))
            .aggregation(AggregationBuilders.terms("Tier").field("tier"))
            .aggregation(AggregationBuilders.terms("Tags").field("tags"))
            .highlighter(hb)
            .from(from).size(size);

   return searchSourceBuilder;
  }

  private SearchSourceBuilder buildTopicSearchBuilder(String query, int from, int size) {
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    HighlightBuilder.Field highlightTableName =
            new HighlightBuilder.Field("topic_name");
    highlightTableName.highlighterType("unified");
    HighlightBuilder.Field highlightDescription =
            new HighlightBuilder.Field("description");
    highlightDescription.highlighterType("unified");
    HighlightBuilder hb = new HighlightBuilder();
    hb.field(highlightDescription);
    hb.field(highlightTableName);
    hb.preTags("<b>");
    hb.postTags("</b>");
    searchSourceBuilder.query(QueryBuilders.queryStringQuery(query)
            .field("topic_name", 5.0f)
            .field("description")
            .lenient(true))
            .aggregation(AggregationBuilders.terms("Service Type").field("service_type"))
            .aggregation(AggregationBuilders.terms("Tier").field("tier"))
            .aggregation(AggregationBuilders.terms("Tags").field("tags"))
            .highlighter(hb)
            .from(from).size(size);

    return searchSourceBuilder;
  }
}
