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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.jdbi3.RoleRepository.DOMAIN_ONLY_ACCESS_ROLE;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.search.suggest.Suggest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.PreviewSearchRequest;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
@Path("/v1/search")
@Tag(name = "Search", description = "APIs related to search and suggest.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "search")
public class SearchResource {
  private final SearchRepository searchRepository;

  public SearchResource(Authorizer authorizer) {
    this.searchRepository = Entity.getSearchRepository();
  }

  @GET
  @Path("/query")
  @Operation(
      operationId = "searchEntitiesWithQuery",
      summary = "Search entities",
      description =
          "Search entities using query text. Use query params `from` and `size` for pagination. Use "
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
                      + "3. For searching field names such as search by columnNames "
                      + "pass q=columnNames:address , for searching deleted entities, use q=deleted:true <br/> "
                      + "4. For searching by tag names pass q=tags.tagFQN:user.email <br/>"
                      + "5. When user selects a filter pass q=query_text AND q=tags.tagFQN:user.email "
                      + "AND platform:MYSQL <br/>"
                      + "6. Search with multiple values of same filter q=tags.tagFQN:user.email "
                      + "AND tags.tagFQN:user.address <br/> "
                      + "7. Search by service version and type q=service.type:databaseService AND version:0.1 <br/> "
                      + "8. Search Tables with Specific Constraints q=tableConstraints.constraintType.keyword:PRIMARY_KEY AND NOT tier.tagFQN:Tier.Tier1 <br/> "
                      + "9. Search with owners q=owner.displayName.keyword:owner_name <br/> "
                      + "NOTE: logic operators such as AND, OR and NOT must be in uppercase ",
              required = true)
          @DefaultValue("*")
          @QueryParam("q")
          String query,
      @Parameter(description = "ElasticSearch Index name, defaults to table_search_index")
          @DefaultValue("table_search_index")
          @QueryParam("index")
          String index,
      @Parameter(description = "Filter documents by deleted param. By default deleted is false")
          @QueryParam("deleted")
          @Deprecated(forRemoval = true)
          Boolean deleted,
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
                  "When paginating, specify the search_after values. Use it ass search_after=<val1>,<val2>,...")
          @QueryParam("search_after")
          String searchAfter,
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
          List<String> includeSourceFields,
      @Parameter(
              description =
                  "Exclude specified fields from the document body for each hit. Use this to exclude heavy fields like 'columns' for better performance")
          @QueryParam("exclude_source_fields")
          List<String> excludeSourceFields,
      @Parameter(
              description =
                  "Fetch search results in hierarchical order of children elements. By default hierarchy is not fetched. Currently only supported for glossary_term_search_index.")
          @DefaultValue("false")
          @QueryParam("getHierarchy")
          boolean getHierarchy,
      @Parameter(
              description =
                  "Explain the results of the query. Defaults to false. Only for debugging purposes.")
          @DefaultValue("false")
          @QueryParam("explain")
          boolean explain)
      throws IOException {

    if (nullOrEmpty(query)) {
      query = "*";
    }
    // Add Domain Filter
    List<EntityReference> domains = new ArrayList<>();
    SubjectContext subjectContext = getSubjectContext(securityContext);
    if (!subjectContext.isAdmin()) {
      domains = subjectContext.getUserDomains();
    }

    SearchRequest request =
        new SearchRequest()
            .withQuery(query)
            .withSize(size)
            .withIndex(Entity.getSearchRepository().getIndexOrAliasName(index))
            .withFrom(from)
            .withQueryFilter(queryFilter)
            .withPostFilter(postFilter)
            .withFetchSource(fetchSource)
            .withTrackTotalHits(trackTotalHits)
            .withSortFieldParam(sortFieldParam)
            .withDeleted(deleted)
            .withSortOrder(sortOrder)
            .withIncludeSourceFields(includeSourceFields)
            .withExcludeSourceFields(excludeSourceFields)
            .withIsHierarchy(getHierarchy)
            .withDomains(domains)
            .withApplyDomainFilter(
                !subjectContext.isAdmin() && subjectContext.hasAnyRole(DOMAIN_ONLY_ACCESS_ROLE))
            .withSearchAfter(SearchUtils.searchAfter(searchAfter))
            .withExplain(explain);
    return searchRepository.search(request, subjectContext);
  }

  @POST
  @Path("/preview")
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "previewSearch",
      summary = "Preview Search Results",
      description =
          "Preview search results based on provided SearchSettings without saving changes.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Search preview response",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchResponse.class)))
      })
  public Response previewSearch(
      @Context SecurityContext securityContext,
      @RequestBody(description = "Preview request containing search settings", required = true)
          PreviewSearchRequest previewRequest)
      throws IOException {

    SubjectContext subjectContext = getSubjectContext(securityContext);

    SearchRequest searchRequest =
        new SearchRequest()
            .withQuery(previewRequest.getQuery())
            .withSize(previewRequest.getSize())
            .withIndex(Entity.getSearchRepository().getIndexOrAliasName(previewRequest.getIndex()))
            .withFrom(previewRequest.getFrom())
            .withQueryFilter(previewRequest.getQueryFilter())
            .withPostFilter(previewRequest.getPostFilter())
            .withFetchSource(previewRequest.getFetchSource())
            .withTrackTotalHits(previewRequest.getTrackTotalHits())
            .withSortFieldParam(previewRequest.getSortField())
            .withSortOrder(previewRequest.getSortOrder().value())
            .withIncludeSourceFields(previewRequest.getIncludeSourceFields())
            .withExplain(previewRequest.getExplain());

    return searchRepository.previewSearch(
        searchRequest, subjectContext, previewRequest.getSearchSettings());
  }

  @GET
  @Path("/nlq/query")
  @Operation(
      operationId = "searchEntitiesWithNLQ",
      summary = "Search entities using Natural Language Query (NLQ)",
      description =
          "Search entities using Natural Language Queries (NLQ) with full search capabilities.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "NLQ search response",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchResponse.class)))
      })
  public Response searchWithNLQ(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "NLQ query string in natural language") @QueryParam("q")
          String nlqQuery,
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
      @Parameter(description = "When paginating, specify the search_after values")
          @QueryParam("search_after")
          String searchAfter,
      @Parameter(description = "Sort the search results by field")
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
      @Parameter(description = "Additional filters to apply") @QueryParam("query_filter")
          String queryFilter,
      @Parameter(description = "Post-filters to apply") @QueryParam("post_filter")
          String postFilter,
      @Parameter(description = "Get document body for each hit")
          @DefaultValue("true")
          @QueryParam("fetch_source")
          boolean fetchSource,
      @Parameter(description = "Get only selected fields of the document body")
          @QueryParam("include_source_fields")
          List<String> includeSourceFields,
      @Parameter(description = "Exclude specified fields from the document body for each hit")
          @QueryParam("exclude_source_fields")
          List<String> excludeSourceFields,
      @Parameter(description = "Fetch results in hierarchical order")
          @DefaultValue("false")
          @QueryParam("getHierarchy")
          boolean getHierarchy,
      @Parameter(description = "Explain the results of the query")
          @DefaultValue("false")
          @QueryParam("explain")
          boolean explain)
      throws IOException {

    // Add Domain Filter
    List<EntityReference> domains = new ArrayList<>();
    SubjectContext subjectContext = getSubjectContext(securityContext);
    if (!subjectContext.isAdmin()) {
      domains = subjectContext.getUserDomains();
    }

    SearchRequest request =
        new SearchRequest()
            .withQuery(nlqQuery)
            .withSize(size)
            .withIndex(Entity.getSearchRepository().getIndexOrAliasName(index))
            .withFrom(from)
            .withQueryFilter(queryFilter)
            .withPostFilter(postFilter)
            .withFetchSource(fetchSource)
            .withTrackTotalHits(trackTotalHits)
            .withSortFieldParam(sortFieldParam)
            .withDeleted(deleted)
            .withSortOrder(sortOrder)
            .withIncludeSourceFields(includeSourceFields)
            .withExcludeSourceFields(excludeSourceFields)
            .withIsHierarchy(getHierarchy)
            .withDomains(domains)
            .withApplyDomainFilter(
                !subjectContext.isAdmin() && subjectContext.hasAnyRole(DOMAIN_ONLY_ACCESS_ROLE))
            .withSearchAfter(SearchUtils.searchAfter(searchAfter))
            .withExplain(explain);

    return searchRepository.searchWithNLQ(request, subjectContext);
  }

  @GET
  @Path("/get/{index}/doc/{id}")
  @Operation(
      operationId = "searchEntityInEsIndexWithId",
      summary = "Search entities in ES index with Id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "search response",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchResponse.class)))
      })
  public Response searchEntityInEsIndexWithId(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "document Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(description = "Index Name", schema = @Schema(type = "string")) @PathParam("index")
          String indexName)
      throws IOException {
    return searchRepository.getDocument(indexName, id);
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
          String index,
      @Parameter(description = "Filter documents by deleted param. By default deleted is false")
          @DefaultValue("false")
          @QueryParam("deleted")
          boolean deleted)
      throws IOException {

    return searchRepository.searchByField(fieldName, fieldValue, index, deleted);
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
      @Parameter(description = "List of fields to fetch from _source per bucket.")
          @QueryParam("sourceFields")
          String sourceFieldsParam,
      @Parameter(
              description =
                  "Search Query Text, Pass *text* for substring match; "
                      + "Pass without wildcards for exact match. <br/> "
                      + "1. For listing all tables or topics pass q=* <br/>"
                      + "2. For search tables or topics pass q=*search_term* <br/>"
                      + "3. For searching field names such as search by columnNames "
                      + "pass q=columnNames:address, for searching deleted entities, use q=deleted:true <br/>"
                      + "4. For searching by tag names pass q=tags.tagFQN:user.email <br/>"
                      + "5. When user selects a filter pass q=query_text AND tags.tagFQN:user.email "
                      + "AND platform:MYSQL <br/>"
                      + "6. Search with multiple values of same filter q=tags.tagFQN:user.email "
                      + "AND tags.tagFQN:user.address <br/>"
                      + "NOTE: logic operators such as AND, OR and NOT must be in uppercase ",
              required = true)
          @QueryParam("q")
          String query,
      @Parameter(description = "Size field to limit the no.of results returned, defaults to 10")
          @DefaultValue("10")
          @QueryParam("size")
          int size,
      @DefaultValue("false") @QueryParam("deleted") boolean deleted)
      throws IOException {

    AggregationRequest aggregationRequest =
        new AggregationRequest()
            .withQuery(query)
            .withSize(size)
            .withIndex(index)
            .withFieldName(fieldName)
            .withFieldValue(value)
            .withSourceFields(SearchUtils.sourceFields(sourceFieldsParam))
            .withDeleted(deleted);

    return searchRepository.aggregate(aggregationRequest);
  }

  @POST
  @Path("/aggregate")
  @Operation(
      operationId = "aggregateSearchRequest",
      summary = "Get aggregated Search Request",
      description = "Get aggregated fields from entities.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Table Aggregate API",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SearchResponse.class)))
      })
  public Response aggregateSearchRequest(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid AggregationRequest aggregationRequest)
      throws IOException {
    return searchRepository.aggregate(aggregationRequest);
  }
}
