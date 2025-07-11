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

package org.openmetadata.service.resources.services;

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
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DriveServiceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/services/driveServices")
@Tag(
    name = "Drive Services",
    description =
        "`Drive Service` is a cloud file storage service such as Google Drive, OneDrive, "
            + "SharePoint, Box, or Dropbox where documents, spreadsheets, and other files are stored.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "driveServices")
public class DriveServiceResource
    extends ServiceEntityResource<DriveService, DriveServiceRepository, DriveConnection> {
  public static final String COLLECTION_PATH = "v1/services/driveServices/";
  public static final String FIELDS = "pipelines,owners,tags,domain,followers";

  @Override
  public DriveService addHref(UriInfo uriInfo, DriveService service) {
    super.addHref(uriInfo, service);
    Entity.withHref(uriInfo, service.getPipelines());
    return service;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("pipelines", MetadataOperation.VIEW_BASIC);
    return null;
  }

  public DriveServiceResource(Authorizer authorizer, Limits limits) {
    super(Entity.DRIVE_SERVICE, authorizer, limits, ServiceType.DRIVE);
  }

  public static class DriveServiceList extends ResultList<DriveService> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listDriveServices",
      summary = "List drive services",
      description = "Get a list of drive services.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of drive service instances",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DriveServiceList.class)))
      })
  public ResultList<DriveService> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter services by domain",
              schema = @Schema(type = "string", example = "Marketing"))
          @QueryParam("domain")
          String domain,
      @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of drive services before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of drive services after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return listInternal(
        uriInfo, securityContext, fieldsParam, include, domain, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDriveServiceByID",
      summary = "Get a drive service",
      description = "Get a drive service by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Drive service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DriveService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Drive service for instance {id} is not found")
      })
  public DriveService get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the drive service", schema = @Schema(type = "UUID"))
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
    DriveService driveService = getInternal(uriInfo, securityContext, id, fieldsParam, include);
    return decryptOrNullify(securityContext, driveService);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getDriveServiceByFQN",
      summary = "Get a drive service by name",
      description = "Get a drive service by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Drive service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DriveService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Drive service for instance {fqn} is not found")
      })
  public DriveService getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the drive service",
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
    DriveService driveService =
        getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
    return decryptOrNullify(securityContext, driveService);
  }

  @POST
  @Operation(
      operationId = "createDriveService",
      summary = "Create a drive service",
      description = "Create a new drive service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Drive service created",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DriveService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDriveService create) {
    DriveService service = getService(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (DriveService) response.getEntity());
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateDriveService",
      summary = "Update drive service",
      description = "Create a new drive service or update an existing one.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Drive service created or updated",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DriveService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDriveService create) {
    DriveService service = getService(create, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (DriveService) response.getEntity());
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDriveService",
      summary = "Update a drive service",
      description = "Update an existing drive service using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the drive service", schema = @Schema(type = "UUID"))
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
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted drive service",
      description = "Restore a soft deleted drive service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the drive service.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DriveService.class)))
      })
  public Response restoreDriveService(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllDriveServiceVersion",
      summary = "List drive service versions",
      description = "Get a list of all the versions of a drive service identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of drive service versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the drive service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    EntityHistory entityHistory = super.listVersionsInternal(securityContext, id);
    List<Object> versions =
        entityHistory.getVersions().stream()
            .map(
                json -> {
                  try {
                    DriveService driveService =
                        JsonUtils.readValue((String) json, DriveService.class);
                    return JsonUtils.pojoToJson(decryptOrNullify(securityContext, driveService));
                  } catch (Exception e) {
                    return json;
                  }
                })
            .collect(Collectors.toList());
    entityHistory.setVersions(versions);
    return entityHistory;
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificDriveServiceVersion",
      summary = "Get a version of the drive service",
      description = "Get a version of the drive service by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Drive service",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DriveService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Drive service for instance {id} and version {version} is not found")
      })
  public DriveService getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the drive service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Drive service version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    DriveService driveService = super.getVersionInternal(securityContext, id, version);
    return decryptOrNullify(securityContext, driveService);
  }

  @PUT
  @Path("/{id}/testConnectionResult")
  @Operation(
      operationId = "addTestConnectionResult",
      summary = "Add test connection result",
      description = "Add test connection result to the service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the service",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DriveService.class)))
      })
  public DriveService addTestConnectionResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Valid TestConnectionResult testConnectionResult) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    DriveService service = repository.addTestConnectionResult(id, testConnectionResult);
    return decryptOrNullify(securityContext, service);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToDriveService",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as follower of this drive service",
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
            description = "Drive service for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the drive service", schema = @Schema(type = "UUID"))
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
      operationId = "deleteFollowerFromDriveService",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the drive service.",
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
      @Parameter(description = "Id of the drive service", schema = @Schema(type = "UUID"))
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
  @Path("/name/{name}/import")
  @Consumes({MediaType.TEXT_PLAIN + "; charset=UTF-8"})
  @Operation(
      operationId = "importDriveService",
      summary = "Import service from CSV to update drive service (no creation allowed)",
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
      @Parameter(description = "Name of the Drive Service", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description =
                  "Dry-run when true is used for validating the CSV without really importing it. (default=true)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("true")
          @QueryParam("dryRun")
          boolean dryRun,
      @Parameter(description = "If true, recursive import", schema = @Schema(type = "boolean"))
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      String csv)
      throws IOException {
    return importCsvInternal(securityContext, name, csv, dryRun, recursive);
  }

  @GET
  @Path("/name/{name}/export")
  @Operation(
      operationId = "exportDriveService",
      summary = "Export drive service in CSV format",
      description = "Export drive service to CSV file.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Exported csv with drive service",
            content = @Content(mediaType = "application/json"))
      })
  public String exportCsv(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Drive Service", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description =
                  "If true, export will include child entities (directories, files, spreadsheets, worksheets)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive)
      throws IOException {
    return exportCsvInternal(securityContext, name, recursive);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDriveService",
      summary = "Delete a drive service by Id",
      description =
          "Delete a drive service. If entities (directories, files) belong to the service, it can't be deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Drive service for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the drive service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteDriveServiceAsync",
      summary = "Asynchronously delete a drive service by Id",
      description =
          "Asynchronously delete a drive service. If entities (directories, files) belong to the service, it can't be deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Drive service for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the drive service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteDriveServiceByName",
      summary = "Delete a drive service by name",
      description =
          "Delete a drive service by `name`. If entities (directories, files) belong to the service, it can't be deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Drive service for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the drive service", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return deleteByName(uriInfo, securityContext, name, recursive, hardDelete);
  }

  private DriveService getService(CreateDriveService create, String user) {
    return repository
        .copy(new DriveService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection());
  }

  @Override
  protected DriveService nullifyConnection(DriveService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(DriveService service) {
    return service.getServiceType().value();
  }
}
