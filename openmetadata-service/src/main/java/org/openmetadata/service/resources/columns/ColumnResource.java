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

package org.openmetadata.service.resources.columns;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.type.Column;
import org.openmetadata.service.jdbi3.ColumnRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;

@Slf4j
@Path("/v1/columns")
@Tag(
    name = "Columns",
    description =
        "Columns represent individual data fields within tables and dashboard data models. "
            + "This API provides operations to update column metadata such as tags, glossary terms, "
            + "descriptions, and other properties using the column's fully qualified name.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "columns")
public class ColumnResource {

  private final ColumnRepository repository;
  private final Authorizer authorizer;

  public ColumnResource(Authorizer authorizer) {
    this.authorizer = authorizer;
    this.repository = new ColumnRepository(authorizer);
  }

  @PUT
  @Path("/name/{fqn}")
  @Operation(
      operationId = "updateColumnByFQN",
      summary = "Update a column by fully qualified name",
      description =
          "Update column metadata such as display name, description, tags, glossary terms, "
              + "and other properties. This API works for columns in both tables and dashboard data models. "
              + "The column is identified by its fully qualified name and the parent entity type is specified. "
              + "\n\nTag Management Examples:"
              + "\n• Add tags: {\"tags\": [{\"tagFQN\": \"PersonalData.PII\", \"source\": \"Classification\"}]}"
              + "\n• Remove specific tag: {\"tags\": []} (specify only tags you want to keep)"
              + "\n• Remove all tags: {\"tags\": []}"
              + "\n• Mix classifications and glossary terms: {\"tags\": [{\"tagFQN\": \"PII.Sensitive\", \"source\": \"Classification\"}, {\"tagFQN\": \"Glossary.CustomerData\", \"source\": \"Glossary\"}]}"
              + "\n• Don't change tags: omit the 'tags' field entirely"
              + "\n\nValidation Rules:"
              + "\n• Invalid or non-existent tags/glossary terms will result in a 404 error"
              + "\n• All tags and glossary terms must exist and be valid before the request succeeds",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated column",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Column.class))),
        @ApiResponse(responseCode = "400", description = "Bad request"),
        @ApiResponse(responseCode = "404", description = "Column not found")
      })
  public Response updateColumnByFQN(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the column",
              schema = @Schema(type = "string"),
              example = "sample_data.ecommerce_db.shopify.dim_address.address_id")
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Entity type of the parent entity (table or dashboardDataModel)",
              schema =
                  @Schema(
                      type = "string",
                      allowableValues = {"table", "dashboardDataModel"}),
              example = "table",
              required = true)
          @QueryParam("entityType")
          @NotNull
          String entityType,
      @RequestBody(
              description = "Column update payload",
              content =
                  @Content(
                      mediaType = "application/json",
                      schema = @Schema(implementation = UpdateColumn.class)))
          @Valid
          UpdateColumn updateColumn) {

    Column updatedColumn =
        repository.updateColumnByFQN(uriInfo, securityContext, fqn, entityType, updateColumn);

    return Response.ok(updatedColumn).build();
  }
}
