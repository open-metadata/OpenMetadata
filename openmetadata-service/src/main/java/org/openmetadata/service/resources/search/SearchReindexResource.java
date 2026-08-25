/*
 *  Copyright 2024 Collate
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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexFailureDAO.SearchIndexFailureRecord;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;

@Slf4j
@Path("/v1/search/reindex")
@Tag(
    name = "Search Reindex",
    description = "APIs related to search reindexing failures and status.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "searchReindex")
public class SearchReindexResource {
  private final CollectionDAO collectionDAO;
  private final Authorizer authorizer;

  public SearchReindexResource(Authorizer authorizer) {
    this.collectionDAO = Entity.getCollectionDAO();
    this.authorizer = authorizer;
  }

  @GET
  @Path("/failures")
  @Operation(
      operationId = "getReindexFailures",
      summary = "Get reindex failures",
      description =
          "Get paginated list of failures from the last reindexing run. "
              + "Use `offset` and `limit` for pagination.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of reindex failures",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ReindexFailuresResponse.class)))
      })
  public ReindexFailuresResponse getFailures(
      @Context SecurityContext securityContext,
      @Parameter(description = "Offset for pagination", schema = @Schema(type = "integer"))
          @QueryParam("offset")
          @DefaultValue("0")
          int offset,
      @Parameter(
              description = "Limit the number of results returned",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("50")
          int limit,
      @Parameter(description = "Filter by entity type", schema = @Schema(type = "string"))
          @QueryParam("entityType")
          String entityType) {

    // Get total count
    int totalCount;
    List<SearchIndexFailureRecord> failures;

    if (entityType != null && !entityType.isEmpty()) {
      totalCount = collectionDAO.searchIndexFailureDAO().countByEntityType(entityType);
      failures = collectionDAO.searchIndexFailureDAO().findByEntityType(entityType, limit, offset);
    } else {
      totalCount = collectionDAO.searchIndexFailureDAO().countAll();
      failures = collectionDAO.searchIndexFailureDAO().findAll(limit, offset);
    }

    return new ReindexFailuresResponse(failures, totalCount, offset, limit);
  }

  @Schema(description = "Response containing paginated reindex failures")
  public record ReindexFailuresResponse(
      @Schema(description = "List of failure records") List<SearchIndexFailureRecord> data,
      @Schema(description = "Total number of failures") int total,
      @Schema(description = "Current offset") int offset,
      @Schema(description = "Page size limit") int limit) {}
}
