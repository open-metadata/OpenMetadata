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

package org.openmetadata.service.resources;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeSummaryMap;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.change.ChangeSummary;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Slf4j
@Path("/v1/changeSummary")
@Tag(
    name = "ChangeSummary",
    description =
        "APIs to retrieve change summary metadata for entities. "
            + "Change summary tracks who changed each field, the source of the change "
            + "(e.g., Suggested for AI-generated, Manual for user edits), and when the change occurred.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "changeSummary")
public class ChangeSummaryResource {

  private final Authorizer authorizer;

  public ChangeSummaryResource(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  @GET
  @Path("/{entityType}/{id}")
  @Operation(
      operationId = "getChangeSummaryById",
      summary = "Get change summary for an entity by ID",
      description =
          "Returns the change summary map for the specified entity, showing who changed each field, "
              + "the source of the change (Manual, Suggested, Automated, etc.), and when it was changed. "
              + "Use fieldPrefix to filter entries (e.g., 'columns.' for column-level changes only).",
      responses = {
        @ApiResponse(responseCode = "200", description = "Change summary map"),
        @ApiResponse(responseCode = "404", description = "Entity not found")
      })
  public Response getChangeSummaryById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity type (e.g., table, topic, dashboard)",
              schema = @Schema(type = "string"))
          @PathParam("entityType")
          String entityType,
      @Parameter(description = "Entity ID", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description =
                  "Filter entries by field name prefix (e.g., 'columns.' to get only column-level changes)",
              schema = @Schema(type = "string"))
          @QueryParam("fieldPrefix")
          String fieldPrefix,
      @Parameter(
              description = "Limit the number of entries returned (1-1000)",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("10")
          @Min(1)
          @Max(1000)
          int limit,
      @Parameter(description = "Offset for pagination", schema = @Schema(type = "integer"))
          @QueryParam("offset")
          @DefaultValue("0")
          @Min(0)
          int offset) {

    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    ResourceContext<?> resourceContext = new ResourceContext<>(entityType, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    EntityRepository<?> repository = Entity.getEntityRepository(entityType);
    EntityInterface entity =
        (EntityInterface) repository.get(uriInfo, id, repository.getFields("changeDescription"));

    return buildResponse(entity, fieldPrefix, limit, offset);
  }

  @GET
  @Path("/{entityType}/name/{fqn}")
  @Operation(
      operationId = "getChangeSummaryByFqn",
      summary = "Get change summary for an entity by fully qualified name",
      description =
          "Returns the change summary map for the specified entity identified by its "
              + "fully qualified name (FQN). Use fieldPrefix to filter entries "
              + "(e.g., 'columns.' for column-level changes only).",
      responses = {
        @ApiResponse(responseCode = "200", description = "Change summary map"),
        @ApiResponse(responseCode = "404", description = "Entity not found")
      })
  public Response getChangeSummaryByFqn(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity type (e.g., table, topic, dashboard)",
              schema = @Schema(type = "string"))
          @PathParam("entityType")
          String entityType,
      @Parameter(
              description = "Fully qualified name of the entity",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description =
                  "Filter entries by field name prefix (e.g., 'columns.' to get only column-level changes)",
              schema = @Schema(type = "string"))
          @QueryParam("fieldPrefix")
          String fieldPrefix,
      @Parameter(
              description = "Limit the number of entries returned (1-1000)",
              schema = @Schema(type = "integer"))
          @QueryParam("limit")
          @DefaultValue("10")
          @Min(1)
          @Max(1000)
          int limit,
      @Parameter(description = "Offset for pagination", schema = @Schema(type = "integer"))
          @QueryParam("offset")
          @DefaultValue("0")
          @Min(0)
          int offset) {

    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    ResourceContext<?> resourceContext = new ResourceContext<>(entityType, null, fqn);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    EntityRepository<?> repository = Entity.getEntityRepository(entityType);
    EntityInterface entity =
        (EntityInterface)
            repository.getByName(uriInfo, fqn, repository.getFields("changeDescription"));

    return buildResponse(entity, fieldPrefix, limit, offset);
  }

  private Response buildResponse(
      EntityInterface entity, String fieldPrefix, int limit, int offset) {
    ChangeDescription changeDescription = entity.getChangeDescription();
    ChangeSummaryMap changeSummaryMap =
        changeDescription != null ? changeDescription.getChangeSummary() : null;
    Map<String, ChangeSummary> changeSummary =
        changeSummaryMap != null ? changeSummaryMap.getAdditionalProperties() : null;

    if (changeSummary == null || changeSummary.isEmpty()) {
      return Response.ok(Map.of("changeSummary", Map.of(), "totalEntries", 0)).build();
    }

    // Apply field prefix filter
    Map<String, ChangeSummary> filtered;
    if (fieldPrefix != null && !fieldPrefix.isEmpty()) {
      filtered = new LinkedHashMap<>();
      for (Map.Entry<String, ChangeSummary> entry : changeSummary.entrySet()) {
        if (entry.getKey().startsWith(fieldPrefix)) {
          filtered.put(entry.getKey(), entry.getValue());
        }
      }
    } else {
      filtered = changeSummary;
    }

    // Apply pagination
    Map<String, ChangeSummary> paginated = new LinkedHashMap<>();
    int count = 0;
    int added = 0;
    for (Map.Entry<String, ChangeSummary> entry : filtered.entrySet()) {
      if (count >= offset) {
        if (added >= limit) {
          break;
        }
        paginated.put(entry.getKey(), entry.getValue());
        added++;
      }
      count++;
    }
    return Response.ok(
            Map.of(
                "changeSummary", paginated,
                "totalEntries", filtered.size(),
                "offset", offset,
                "limit", limit))
        .build();
  }
}
