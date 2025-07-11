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

package org.openmetadata.service.resources.drives;

import static org.openmetadata.common.utils.CommonUtil.listOf;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
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
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateWorksheet;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorksheetRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@Path("/v1/drives/worksheets")
@Tag(
    name = "Worksheets",
    description = "A `Worksheet` is an individual sheet or tab within a Spreadsheet.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "worksheets")
public class WorksheetResource extends EntityResource<Worksheet, WorksheetRepository> {
  public static final String COLLECTION_PATH = "v1/drives/worksheets/";
  static final String FIELDS =
      "owners,spreadsheet,columns,sampleData,usageSummary,tags,extension,domain,sourceHash,lifeCycle,votes,followers";
  private final WorksheetMapper mapper = new WorksheetMapper();

  @Override
  public Worksheet addHref(UriInfo uriInfo, Worksheet worksheet) {
    super.addHref(uriInfo, worksheet);
    Entity.withHref(uriInfo, worksheet.getSpreadsheet());
    Entity.withHref(uriInfo, worksheet.getService());
    return worksheet;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("spreadsheet", MetadataOperation.VIEW_BASIC);
    addViewOperation("columns", MetadataOperation.VIEW_BASIC);
    addViewOperation("sampleData", MetadataOperation.VIEW_SAMPLE_DATA);
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    return listOf(
        MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE,
        MetadataOperation.VIEW_SAMPLE_DATA, MetadataOperation.EDIT_SAMPLE_DATA);
  }

  public WorksheetResource(Authorizer authorizer, Limits limits) {
    super(Entity.WORKSHEET, authorizer, limits);
  }

  public static class WorksheetList extends ResultList<Worksheet> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listWorksheets",
      summary = "List worksheets",
      description =
          "Get a list of worksheets, optionally filtered by `service` or `spreadsheet` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of worksheets",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorksheetList.class)))
      })
  public ResultList<Worksheet> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter worksheets by service name",
              schema = @Schema(type = "string", example = "googleDrive"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(
              description = "Filter worksheets by spreadsheet fully qualified name",
              schema = @Schema(type = "string"))
          @QueryParam("spreadsheet")
          String spreadsheetParam,
      @Parameter(description = "Limit the number worksheets returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of worksheets before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of worksheets after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter =
        new ListFilter(include)
            .addQueryParam("service", serviceParam)
            .addQueryParam("spreadsheet", spreadsheetParam);
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getWorksheetByID",
      summary = "Get a worksheet by Id",
      description = "Get a worksheet by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The worksheet",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Worksheet.class))),
        @ApiResponse(responseCode = "404", description = "Worksheet for instance {id} is not found")
      })
  public Worksheet get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the worksheet", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getWorksheetByFQN",
      summary = "Get a worksheet by fully qualified name",
      description = "Get a worksheet by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The worksheet",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Worksheet.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Worksheet for instance {fqn} is not found")
      })
  public Worksheet getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the worksheet",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @POST
  @Operation(
      operationId = "createWorksheet",
      summary = "Create a worksheet",
      description = "Create a new worksheet under an existing `spreadsheet`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The worksheet",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Worksheet.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateWorksheet create) {
    Worksheet worksheet =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, worksheet);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchWorksheet",
      summary = "Update a worksheet",
      description = "Update an existing worksheet using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the worksheet", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateWorksheet",
      summary = "Create or update a worksheet",
      description = "Create a new worksheet, if it does not exist or update an existing worksheet.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The worksheet",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Worksheet.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateWorksheet create) {
    Worksheet worksheet =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, worksheet);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteWorksheet",
      summary = "Delete a worksheet by Id",
      description = "Delete a worksheet by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Worksheet for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the worksheet", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteWorksheetByFQN",
      summary = "Delete a worksheet by fully qualified name",
      description = "Delete a worksheet by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Worksheet for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Fully qualified name of the worksheet",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restoreWorksheetById",
      summary = "Restore a soft deleted worksheet by id",
      description = "Restore a soft deleted worksheet by id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the worksheet",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Worksheet.class)))
      })
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllWorksheetVersion",
      summary = "List worksheet versions",
      description = "Get a list of all the versions of a worksheet identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of worksheet versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the worksheet", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificWorksheetVersion",
      summary = "Get a specific version of the worksheet",
      description = "Get a specific version of the worksheet identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Worksheet",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Worksheet.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Worksheet for instance {id} and version {version} is not found")
      })
  public Worksheet getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the worksheet", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Worksheet version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToWorksheet",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as follower of this worksheet",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Worksheet for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the worksheet", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "UUID"))
          UUID userId) {
    return repository
        .addFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "removeFollowerFromWorksheet",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the worksheet.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class)))
      })
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the worksheet", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "UUID"))
          @PathParam("userId")
          UUID userId) {
    return repository
        .deleteFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @PUT
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVoteForWorksheet",
      summary = "Update Vote for a worksheet",
      description = "Update vote for a worksheet",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Worksheet for instance {id} is not found")
      })
  public Response updateVote(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the worksheet", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Valid VoteRequest request) {
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteWorksheetAsync",
      summary = "Asynchronously delete a worksheet by Id",
      description = "Asynchronously delete a worksheet by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Worksheet for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Recursively delete related entities. (Default = `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Id of the worksheet", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }
}
