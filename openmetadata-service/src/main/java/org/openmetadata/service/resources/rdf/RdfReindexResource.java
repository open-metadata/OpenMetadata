/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.resources.rdf;

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
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfIndexFailureDAO.RdfIndexFailureRecord;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;

@Slf4j
@Path("/v1/rdf/reindex")
@Tag(name = "RDF Reindex", description = "APIs related to RDF reindexing failures and status.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "rdfReindex")
public class RdfReindexResource {
  private final CollectionDAO collectionDAO;
  private final Authorizer authorizer;

  public RdfReindexResource(Authorizer authorizer) {
    this.collectionDAO = Entity.getCollectionDAO();
    this.authorizer = authorizer;
  }

  @GET
  @Path("/failures")
  @Operation(
      operationId = "getRdfReindexFailures",
      summary = "Get RDF reindex failures",
      description =
          "Get paginated list of failures from the last RDF reindexing run. "
              + "The failure table is cleared at the start of each run, so this always "
              + "reflects the most recent run. Use `offset` and `limit` for pagination.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of RDF reindex failures",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = RdfReindexFailuresResponse.class)))
      })
  public RdfReindexFailuresResponse getFailures(
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

    // Failure rows carry entity FQNs and raw error text, and this is an operations
    // endpoint surfaced only from the admin-only Applications screen.
    authorizer.authorizeAdmin(securityContext);

    int totalCount;
    List<RdfIndexFailureRecord> failures;

    // Trim before deciding: a blank or padded value is a client artifact, not a filter,
    // and passing it through returns a confusingly empty page.
    String filter = entityType == null ? null : entityType.trim();
    if (filter != null && !filter.isEmpty()) {
      totalCount = collectionDAO.rdfIndexFailureDAO().countByEntityType(filter);
      failures = collectionDAO.rdfIndexFailureDAO().findByEntityType(filter, limit, offset);
    } else {
      totalCount = collectionDAO.rdfIndexFailureDAO().countAll();
      failures = collectionDAO.rdfIndexFailureDAO().findAll(limit, offset);
    }

    return new RdfReindexFailuresResponse(failures, totalCount, offset, limit);
  }

  @Schema(description = "Response containing paginated RDF reindex failures")
  public record RdfReindexFailuresResponse(
      @Schema(description = "List of failure records") List<RdfIndexFailureRecord> data,
      @Schema(description = "Total number of failures") int total,
      @Schema(description = "Current offset") int offset,
      @Schema(description = "Page size limit") int limit) {}
}
