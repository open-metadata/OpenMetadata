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
import org.openmetadata.schema.api.data.CreateSpreadsheet;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.SpreadsheetRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@Path("/v1/drives/spreadsheets")
@Tag(
    name = "Spreadsheets",
    description =
        "A `Spreadsheet` is a file format for organizing data in a tabular format, like Google Sheets or Excel files.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "spreadsheets")
public class SpreadsheetResource extends EntityResource<Spreadsheet, SpreadsheetRepository> {
  public static final String COLLECTION_PATH = "v1/drives/spreadsheets/";
  static final String FIELDS =
      "owners,directory,worksheets,usageSummary,tags,extension,domains,sourceHash,lifeCycle,votes,followers";
  private final SpreadsheetMapper mapper = new SpreadsheetMapper();

  @Override
  public Spreadsheet addHref(UriInfo uriInfo, Spreadsheet spreadsheet) {
    super.addHref(uriInfo, spreadsheet);
    Entity.withHref(uriInfo, spreadsheet.getDirectory());
    Entity.withHref(uriInfo, spreadsheet.getService());
    Entity.withHref(uriInfo, spreadsheet.getWorksheets());
    return spreadsheet;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("directory", MetadataOperation.VIEW_BASIC);
    addViewOperation("worksheets", MetadataOperation.VIEW_BASIC);
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE);
  }

  public SpreadsheetResource(Authorizer authorizer, Limits limits) {
    super(Entity.SPREADSHEET, authorizer, limits);
  }

  public static class SpreadsheetList extends ResultList<Spreadsheet> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listSpreadsheets",
      summary = "List spreadsheets",
      description =
          "Get a list of spreadsheets, optionally filtered by `service` or `directory` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of spreadsheets",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SpreadsheetList.class)))
      })
  public ResultList<Spreadsheet> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter spreadsheets by service name",
              schema = @Schema(type = "string", example = "googleDrive"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(
              description = "Filter spreadsheets by directory fully qualified name",
              schema = @Schema(type = "string"))
          @QueryParam("directory")
          String directoryParam,
      @Parameter(
              description = "Limit the number spreadsheets returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of spreadsheets before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of spreadsheets after this cursor",
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
            .addQueryParam("directory", directoryParam);
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getSpreadsheetByID",
      summary = "Get a spreadsheet by Id",
      description = "Get a spreadsheet by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The spreadsheet",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Spreadsheet.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Spreadsheet for instance {id} is not found")
      })
  public Spreadsheet get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the spreadsheet", schema = @Schema(type = "UUID"))
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
      operationId = "getSpreadsheetByFQN",
      summary = "Get a spreadsheet by fully qualified name",
      description = "Get a spreadsheet by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The spreadsheet",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Spreadsheet.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Spreadsheet for instance {fqn} is not found")
      })
  public Spreadsheet getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the spreadsheet",
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
      operationId = "createSpreadsheet",
      summary = "Create a spreadsheet",
      description = "Create a new spreadsheet under an existing `directory`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The spreadsheet",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Spreadsheet.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateSpreadsheet create) {
    Spreadsheet spreadsheet =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, spreadsheet);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchSpreadsheet",
      summary = "Update a spreadsheet",
      description = "Update an existing spreadsheet using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the spreadsheet", schema = @Schema(type = "UUID"))
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
      operationId = "createOrUpdateSpreadsheet",
      summary = "Create or update a spreadsheet",
      description =
          "Create a new spreadsheet, if it does not exist or update an existing spreadsheet.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The spreadsheet",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Spreadsheet.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateSpreadsheet create) {
    Spreadsheet spreadsheet =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, spreadsheet);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteSpreadsheet",
      summary = "Delete a spreadsheet by Id",
      description = "Delete a spreadsheet by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Spreadsheet for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Id of the spreadsheet", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteSpreadsheetByFQN",
      summary = "Delete a spreadsheet by fully qualified name",
      description = "Delete a spreadsheet by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Spreadsheet for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(
              description = "Fully qualified name of the spreadsheet",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restoreSpreadsheet",
      summary = "Restore a soft deleted spreadsheet",
      description = "Restore a soft deleted spreadsheet.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the spreadsheet ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Spreadsheet.class)))
      })
  public Response restoreSpreadsheet(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllSpreadsheetVersion",
      summary = "List spreadsheet versions",
      description = "Get a list of all the versions of a spreadsheet identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of spreadsheet versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the spreadsheet", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificSpreadsheetVersion",
      summary = "Get a specific version of the spreadsheet",
      description = "Get a specific version of the spreadsheet identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Spreadsheet",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Spreadsheet.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Spreadsheet for instance {id} and version {version} is not found")
      })
  public Spreadsheet getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the spreadsheet", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Spreadsheet version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToSpreadsheet",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as follower of this spreadsheet",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Spreadsheet for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the spreadsheet", schema = @Schema(type = "UUID"))
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
      operationId = "removeFollowerFromSpreadsheet",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the spreadsheet.",
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
      @Parameter(description = "Id of the spreadsheet", schema = @Schema(type = "UUID"))
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
      operationId = "updateVoteForSpreadsheet",
      summary = "Update Vote for a spreadsheet",
      description = "Update vote for a spreadsheet",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Spreadsheet for instance {id} is not found")
      })
  public Response updateVote(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the spreadsheet", schema = @Schema(type = "UUID"))
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
      operationId = "deleteSpreadsheetAsync",
      summary = "Asynchronously delete a spreadsheet by Id",
      description = "Asynchronously delete a spreadsheet by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Spreadsheet for instance {id} is not found")
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
      @Parameter(description = "Id of the spreadsheet", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }
}
