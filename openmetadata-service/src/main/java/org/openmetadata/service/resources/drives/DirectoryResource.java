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
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateDirectory;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DirectoryRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@Path("/v1/drives/directories")
@Tag(
    name = "Directories",
    description =
        "A `Directory` is a folder or organizational unit in a Drive Service that can contain files, spreadsheets, and other directories.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "directories")
public class DirectoryResource extends EntityResource<Directory, DirectoryRepository> {
  public static final String COLLECTION_PATH = "v1/drives/directories/";
  static final String FIELDS =
      "owners,children,parent,usageSummary,tags,extension,domain,sourceHash,lifeCycle,votes,followers";
  private final DirectoryMapper mapper = new DirectoryMapper();

  @Override
  public Directory addHref(UriInfo uriInfo, Directory directory) {
    super.addHref(uriInfo, directory);
    Entity.withHref(uriInfo, directory.getChildren());
    Entity.withHref(uriInfo, directory.getParent());
    Entity.withHref(uriInfo, directory.getService());
    return directory;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("children,parent", MetadataOperation.VIEW_BASIC);
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE);
  }

  public DirectoryResource(Authorizer authorizer, Limits limits) {
    super(Entity.DIRECTORY, authorizer, limits);
  }

  public static class DirectoryList extends ResultList<Directory> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listDirectories",
      summary = "List directories",
      description =
          "Get a list of directories, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of directories",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DirectoryList.class)))
      })
  public ResultList<Directory> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter directories by service name",
              schema = @Schema(type = "string", example = "googleDrive"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(
              description = "Filter directories by parent directory fully qualified name",
              schema = @Schema(type = "string"))
          @QueryParam("parent")
          String parentParam,
      @Parameter(
              description = "Include only root directories (directories without parent)",
              schema = @Schema(type = "boolean"))
          @QueryParam("root")
          @DefaultValue("false")
          boolean root,
      @Parameter(
              description = "Limit the number directories returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of directories before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of directories after this cursor",
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
            .addQueryParam("parent", parentParam)
            .addQueryParam("root", String.valueOf(root));
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDirectoryByID",
      summary = "Get a directory by Id",
      description = "Get a directory by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The directory",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Directory.class))),
        @ApiResponse(responseCode = "404", description = "Directory for instance {id} is not found")
      })
  public Directory get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the directory", schema = @Schema(type = "UUID"))
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
      operationId = "getDirectoryByFQN",
      summary = "Get a directory by fully qualified name",
      description = "Get a directory by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The directory",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Directory.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Directory for instance {fqn} is not found")
      })
  public Directory getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the directory",
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
      operationId = "createDirectory",
      summary = "Create a directory",
      description = "Create a new directory under an existing `service` or `parent` directory.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The directory",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Directory.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDirectory create) {
    Directory directory =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, directory);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDirectory",
      summary = "Update a directory",
      description = "Update an existing directory using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the directory", schema = @Schema(type = "UUID"))
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
      operationId = "createOrUpdateDirectory",
      summary = "Create or update a directory",
      description = "Create a new directory, if it does not exist or update an existing directory.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The directory",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Directory.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDirectory create) {
    Directory directory =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, directory);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDirectory",
      summary = "Delete a directory by Id",
      description = "Delete a directory by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Directory for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the directory", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteDirectoryByFQN",
      summary = "Delete a directory by fully qualified name",
      description = "Delete a directory by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Directory for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Fully qualified name of the directory",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  @PUT
  @Path("/{id}/restore")
  @Operation(
      operationId = "restoreDirectory",
      summary = "Restore a soft deleted directory",
      description = "Restore a soft deleted directory.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the directory ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Directory.class)))
      })
  public Response restoreDirectory(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restoreDirectoryById",
      summary = "Restore a soft deleted directory by id",
      description = "Restore a soft deleted directory by id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the directory",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Directory.class)))
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
      operationId = "listAllDirectoryVersion",
      summary = "List directory versions",
      description = "Get a list of all the versions of a directory identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of directory versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the directory", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificDirectoryVersion",
      summary = "Get a specific version of the directory",
      description = "Get a specific version of the directory identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Directory",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Directory.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Directory for instance {id} and version {version} is not found")
      })
  public Directory getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the directory", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Directory version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToDirectory",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as follower of this directory",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Directory for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the directory", schema = @Schema(type = "UUID"))
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
      operationId = "removeFollowerFromDirectory",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the directory.",
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
      @Parameter(description = "Id of the directory", schema = @Schema(type = "UUID"))
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
      operationId = "updateVoteForDirectory",
      summary = "Update Vote for a directory",
      description = "Update vote for a directory",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Directory for instance {id} is not found")
      })
  public Response updateVote(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the directory", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Valid VoteRequest request) {
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
  }

  @POST
  @Path("/import")
  @Operation(
      operationId = "importDirectory",
      summary = "Import directory from CSV",
      description = "Import a CSV file generated by the export service endpoint.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "CSV import result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CsvImportResult.class)))
      })
  public CsvImportResult importCsv(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Dry run when true is passed for testing the CSV",
              schema = @Schema(type = "boolean"))
          @DefaultValue("false")
          @QueryParam("dryRun")
          boolean dryRun,
      String csv)
      throws IOException {
    return importCsvInternal(securityContext, null, csv, dryRun, false);
  }

  @GET
  @Path("/export")
  @Operation(
      operationId = "exportDirectories",
      summary = "Export directories to CSV",
      description = "Export directories to CSV file.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "CSV file with directories",
            content = @Content(mediaType = "application/json"))
      })
  public String exportCsv(
      @Context SecurityContext securityContext,
      @Parameter(description = "Directory filter pattern", schema = @Schema(type = "string"))
          @QueryParam("name")
          String name)
      throws IOException {
    return exportCsvInternal(securityContext, name, false);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteDirectoryAsync",
      summary = "Asynchronously delete a directory by Id",
      description = "Asynchronously delete a directory by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Directory for instance {id} is not found")
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
      @Parameter(description = "Id of the directory", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }
}
