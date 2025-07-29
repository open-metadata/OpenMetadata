package org.openmetadata.service.resources.services.security;

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
import org.openmetadata.schema.api.services.CreateSecurityService;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.SecurityConnection;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SecurityServiceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.CSVExportResponse;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/services/securityServices")
@Tag(
    name = "Security Services",
    description = "APIs related to Security Service entities, such as Apache Ranger.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "securityServices")
public class SecurityServiceResource
    extends ServiceEntityResource<SecurityService, SecurityServiceRepository, SecurityConnection> {
  private final SecurityServiceMapper mapper = new SecurityServiceMapper();
  public static final String COLLECTION_PATH = "v1/services/securityServices/";
  public static final String FIELDS = "owners,tags,domains,followers";

  @Override
  public SecurityService addHref(UriInfo uriInfo, SecurityService service) {
    super.addHref(uriInfo, service);
    Entity.withHref(uriInfo, service.getOwners());
    return service;
  }

  public SecurityServiceResource(Authorizer authorizer, Limits limits) {
    super(Entity.SECURITY_SERVICE, authorizer, limits, ServiceType.SECURITY);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    return null;
  }

  @Override
  protected SecurityService nullifyConnection(SecurityService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(SecurityService service) {
    return service.getServiceType().value();
  }

  public static class SecurityServiceList extends ResultList<SecurityService> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listSecurityServices",
      summary = "List security services",
      description = "Get a list of security services.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of security service instances",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityServiceList.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public ResultList<SecurityService> list(
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
              description = "Returns list of security services before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of security services after this cursor",
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
      operationId = "getSecurityServiceByID",
      summary = "Get a security service",
      description = "Get a security service by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Security service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Security service for instance {id} is not found")
      })
  public SecurityService get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the security service", schema = @Schema(type = "UUID"))
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
    SecurityService securityService =
        getInternal(uriInfo, securityContext, id, fieldsParam, include);
    return decryptOrNullify(securityContext, securityService);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getSecurityServiceByFQN",
      summary = "Get security service by name",
      description = "Get a security service by the service `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Security service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Security service for instance {name} is not found")
      })
  public SecurityService getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the security service", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
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
    SecurityService securityService =
        getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
    return decryptOrNullify(securityContext, securityService);
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
                    schema = @Schema(implementation = SecurityService.class)))
      })
  public SecurityService addTestConnectionResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Valid TestConnectionResult testConnectionResult) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    SecurityService service = repository.addTestConnectionResult(id, testConnectionResult);
    return decryptOrNullify(securityContext, service);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllSecurityServiceVersion",
      summary = "List security service versions",
      description = "Get a list of all the versions of a security service identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of security service versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the security service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    EntityHistory entityHistory = super.listVersionsInternal(securityContext, id);

    List<Object> versions =
        entityHistory.getVersions().stream()
            .map(
                json -> {
                  try {
                    SecurityService securityService =
                        JsonUtils.readValue((String) json, SecurityService.class);
                    return JsonUtils.pojoToJson(decryptOrNullify(securityContext, securityService));
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
      operationId = "getSpecificSecurityServiceVersion",
      summary = "Get a version of the security service",
      description = "Get a version of the security service by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "security service",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Security service for instance {id} and version {version} is not found")
      })
  public SecurityService getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the security service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "security service version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    SecurityService securityService = super.getVersionInternal(securityContext, id, version);
    return decryptOrNullify(securityContext, securityService);
  }

  @POST
  @Operation(
      operationId = "createSecurityService",
      summary = "Create security service",
      description = "Create a new security service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Security service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateSecurityService create) {
    SecurityService service =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (SecurityService) response.getEntity());
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateSecurityService",
      summary = "Update security service",
      description = "Update an existing or create a new security service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Security service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateSecurityService update) {
    SecurityService service =
        mapper.createToEntity(update, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, unmask(service));
    decryptOrNullify(securityContext, (SecurityService) response.getEntity());
    return response;
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToSecurityService",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as followed of this security service",
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
            description = "Security Service for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Security Service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "string"))
          UUID userId) {
    return repository
        .addFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollower",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the entity.",
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
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId) {
    return repository
        .deleteFollower(securityContext.getUserPrincipal().getName(), id, UUID.fromString(userId))
        .toResponse();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchSecurityService",
      summary = "Update a security service",
      description = "Update an existing security service using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the security service", schema = @Schema(type = "UUID"))
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

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchSecurityService",
      summary = "Update a security service using name.",
      description = "Update an existing security service using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the security service", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, fqn, patch);
  }

  @GET
  @Path("/name/{name}/export")
  @Produces({MediaType.TEXT_PLAIN + "; charset=UTF-8"})
  @Valid
  @Operation(
      operationId = "exportSecurityServices",
      summary = "Export security service in CSV format",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Exported csv with services from the security services",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = String.class)))
      })
  public String exportCsv(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Security Service", schema = @Schema(type = "string"))
          @PathParam("name")
          String name)
      throws IOException {
    return exportCsvInternal(securityContext, name, false);
  }

  @GET
  @Path("/name/{name}/exportAsync")
  @Produces(MediaType.APPLICATION_JSON)
  @Valid
  @Operation(
      operationId = "exportSecurityService",
      summary = "Export security service in CSV format",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Exported csv with security services",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CSVExportResponse.class)))
      })
  public Response exportCsvAsync(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Security Service", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return exportCsvInternalAsync(securityContext, name, false);
  }

  @PUT
  @Path("/name/{name}/import")
  @Consumes({MediaType.TEXT_PLAIN + "; charset=UTF-8"})
  @Valid
  @Operation(
      operationId = "importSecurityService",
      summary = "Import service from CSV to update security service (no creation allowed)",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Import result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CsvImportResult.class)))
      })
  public CsvImportResult importCsv(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Security Service", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description =
                  "Dry-run when true is used for validating the CSV without really importing it. (default=true)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("true")
          @QueryParam("dryRun")
          boolean dryRun,
      String csv)
      throws IOException {
    return importCsvInternal(securityContext, name, csv, dryRun, false);
  }

  @PUT
  @Path("/name/{name}/importAsync")
  @Consumes({MediaType.TEXT_PLAIN + "; charset=UTF-8"})
  @Produces(MediaType.APPLICATION_JSON)
  @Valid
  @Operation(
      operationId = "importSecurityServiceAsync",
      summary =
          "Import service from CSV to update security service asynchronously (no creation allowed)",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Import initiated successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CsvImportResult.class)))
      })
  public Response importCsvAsync(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Security Service", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description =
                  "Dry-run when true is used for validating the CSV without really importing it. (default=true)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("true")
          @QueryParam("dryRun")
          boolean dryRun,
      String csv) {
    return importCsvInternalAsync(securityContext, name, csv, dryRun, false);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteSecurityService",
      summary = "Delete a security service by Id",
      description =
          "Delete a security services. If assets belong the service, it can't be deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "SecurityService service for instance {id} is not found")
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
      @Parameter(description = "Id of the security service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteSecurityServiceAsync",
      summary = "Asynchronously delete a security service by Id",
      description =
          "Asynchronously delete a security services. If assets belong the service, it can't be deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "SecurityService service for instance {id} is not found")
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
      @Parameter(description = "Id of the security service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteSecurityServiceByName",
      summary = "Delete a security service by name",
      description =
          "Delete a security services by `name`. If assets belong the service, it can't be "
              + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "SecurityService service for instance {name} is not found")
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
      @Parameter(description = "Name of the security service", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return deleteByName(uriInfo, securityContext, name, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted security service",
      description = "Restore a soft deleted security service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the SecurityService.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityService.class)))
      })
  public Response restoreSecurityService(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
