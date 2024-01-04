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

import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.search.suggest.Suggest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchRequest;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.JsonUtils;

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
import java.util.List;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.search.SearchRepository.ELASTIC_SEARCH_EXTENSION;

@Slf4j
@Path("/v1/search")
@Tag(name = "Search", description = "APIs related to search and suggest.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "elasticsearch")
public class SearchResource {
  private final Authorizer authorizer;
  private final SearchRepository searchRepository;

  public static final String ELASTIC_SEARCH_ENTITY_FQN_STREAM =
      "eventPublisher:ElasticSearch:STREAM";

  public SearchResource(Authorizer authorizer) {
    this.authorizer = authorizer;
    this.searchRepository = Entity.getSearchRepository();
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchResponse.class)))
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
      @Parameter(
              description = "Sort order asc for ascending or desc for descending, defaults to desc")
          @DefaultValue("desc")
          @QueryParam("sort_order")
          String sortOrder,
      @Parameter(description = "Track Total Hits")
          @DefaultValue("false")
          @QueryParam("track_total_hits")
          boolean trackTotalHits,
      @Parameter(
              description =
                  "Elasticsearch query that will be combined with the query_string query generator from the `query` argument")
          @QueryParam("query_filter")
          String queryFilter,
      @Parameter(description = "Elasticsearch query that will be used as a post_filter")
          @QueryParam("post_filter")
          String postFilter,
      @Parameter(description = "Get document body for each hit")
          @DefaultValue("true")
          @QueryParam("fetch_source")
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

    SearchRequest request =
        new SearchRequest.ElasticSearchRequestBuilder(query, size, index)
            .from(from)
            .queryFilter(queryFilter)
            .postFilter(postFilter)
            .fetchSource(fetchSource)
            .trackTotalHits(trackTotalHits)
            .sortFieldParam(sortFieldParam)
            .deleted(deleted)
            .sortOrder(sortOrder)
            .includeSourceFields(includeSourceFields)
            .build();
    return searchRepository.search(request);
  }

  @GET
  @Path("/fieldQuery")
  @Operation(
      operationId = "searchEntitiesWithSpecificFieldAndValue",
      summary = "Search entities",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "search response",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchResponse.class)))
      })
  public Response searchByField(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "field name") @QueryParam("fieldName") String fieldName,
      @Parameter(description = "field value") @QueryParam("fieldValue") String fieldValue,
      @Parameter(description = "Search Index name, defaults to table_search_index")
          @DefaultValue("table_search_index")
          @QueryParam("index")
          String index)
      throws IOException {

    return searchRepository.searchByField(fieldName, fieldValue, index);
  }

  @GET
  @Path("/sourceUrl")
  @Operation(
      operationId = "searchEntitiesWithSourceUrl",
      summary = "Search entities",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "search response",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchResponse.class)))
      })
  public Response searchBySourceUrl(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "source url") @QueryParam("sourceUrl") String sourceUrl)
      throws IOException {

    return searchRepository.searchBySourceUrl(sourceUrl);
  }

  @GET
  @Path("/getLineage")
  @Operation(
      operationId = "searchLineage",
      summary = "Search lineage",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "search response",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = SearchResponse.class)))
      })
  public Response searchLineage(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "fqn") @QueryParam("fqn") String fqn,
      @Parameter(description = "upstreamDepth") @QueryParam("upstreamDepth") int upstreamDepth,
      @Parameter(description = "downstreamDepth") @QueryParam("downstreamDepth") int downstreamDepth,
      @Parameter(
              description =
                  "Elasticsearch query that will be combined with the query_string query generator from the `query` argument")
          @QueryParam("query_filter")
          String queryFilter,
      @Parameter(description = "Filter documents by deleted param. By default deleted is false")
      @QueryParam("deleted")
      boolean deleted)
      throws IOException {

    return searchRepository.searchLineage(fqn, upstreamDepth, downstreamDepth, queryFilter, deleted);
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Suggest.class)))
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
      @Parameter(description = "Get document body for each hit")
          @DefaultValue("true")
          @QueryParam("fetch_source")
          boolean fetchSource,
      @Parameter(
              description =
                  "Get only selected fields of the document body for each hit. Empty value will return all fields")
          @QueryParam("include_source_fields")
          List<String> includeSourceFields,
      @DefaultValue("false") @QueryParam("deleted") boolean deleted)
      throws IOException {

    if (nullOrEmpty(query)) {
      query = "*";
    }

    SearchRequest request =
        new SearchRequest.ElasticSearchRequestBuilder(query, size, index)
            .fieldName(fieldName)
            .deleted(deleted)
            .fetchSource(fetchSource)
            .includeSourceFields(includeSourceFields)
            .build();
    return searchRepository.suggest(request);
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
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Suggest.class)))
      })
  public Response aggregate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @DefaultValue("table_search_index") @QueryParam("index") String index,
      @Parameter(description = "Field in an entity.") @QueryParam("field") String fieldName,
      @Parameter(description = "value for searching in aggregation")
          @DefaultValue("")
          @QueryParam("value")
          String value,
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
      @Parameter(description = "Size field to limit the no.of results returned, defaults to 10")
          @DefaultValue("10")
          @QueryParam("size")
          int size,
      @DefaultValue("false") @QueryParam("deleted") String deleted)
      throws IOException {

    return searchRepository.aggregate(index, fieldName, value, query);
  }

  @GET
  @Path("/reindex/stream/status")
  @Operation(
      operationId = "getStreamJobStatus",
      summary = "Get Stream Job Latest Status",
      description = "Stream Job Status",
      responses = {
        @ApiResponse(responseCode = "200", description = "Success"),
        @ApiResponse(responseCode = "404", description = "Status not found")
      })
  public Response reindexAllJobLastStatus(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    // Only admins  can issue a reindex request
    authorizer.authorizeAdmin(securityContext);
    // Check if there is a running job for reindex for requested entity
    String jobRecord;
    jobRecord =
        Entity.getCollectionDAO()
            .entityExtensionTimeSeriesDao()
            .getLatestExtension(ELASTIC_SEARCH_ENTITY_FQN_STREAM, ELASTIC_SEARCH_EXTENSION);
    if (jobRecord != null) {
      return Response.status(Response.Status.OK)
          .entity(JsonUtils.readValue(jobRecord, EventPublisherJob.class))
          .build();
    }
    return Response.status(Response.Status.NOT_FOUND).entity("No Last Run.").build();
  }
}
