package org.openmetadata.service.resources.services.storage;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.PATCH;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.StorageConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.StorageServiceRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/services/storageServices")
@Tag(
    name = "Object Store Services",
    description = "APIs related `Object Store Service` entities, such as S3, GCS or " + "AZURE.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "storageServices")
public class StorageServiceResource
    extends ServiceEntityResource<StorageService, StorageServiceRepository, StorageConnection> {

  public static final String COLLECTION_PATH = "v1/services/storageServices/";
  static final String FIELDS = "pipelines,owner,tags";

  @Override
  public StorageService addHref(UriInfo uriInfo, StorageService service) {
    service.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, service.getId()));
    Entity.withHref(uriInfo, service.getOwner());
    Entity.withHref(uriInfo, service.getPipelines());
    return service;
  }

  public StorageServiceResource(CollectionDAO dao, Authorizer authorizer) {
    super(StorageService.class, new StorageServiceRepository(dao), authorizer, ServiceType.STORAGE);
  }

  public static class StorageServiceList extends ResultList<StorageService> {
    @SuppressWarnings("unused") /* Required for tests */
    public StorageServiceList() {}
  }

  @GET
  @Operation(
      operationId = "listStorageServices",
      summary = "List storage services",
      description = "Get a list of storage services.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of storage service instances",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = StorageServiceResource.StorageServiceList.class)))
      })
  public ResultList<StorageService> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @DefaultValue("10") @Min(0) @Max(1000000) @QueryParam("limit") int limitParam,
      @Parameter(description = "Returns list of storage services before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of storage services after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    RestUtil.validateCursors(before, after);
    EntityUtil.Fields fields = getFields(fieldsParam);
    ResultList<StorageService> storageServices;

    ListFilter filter = new ListFilter(include);
    if (before != null) {
      storageServices = dao.listBefore(uriInfo, fields, filter, limitParam, before);
    } else {
      storageServices = dao.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, decryptOrNullify(securityContext, storageServices));
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getStorageServiceByID",
      summary = "Get an storage service",
      description = "Get an storage service by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Object store service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = StorageService.class))),
        @ApiResponse(responseCode = "404", description = "Object store service for instance {id} is not found")
      })
  public StorageService get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
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
          Include include)
      throws IOException {
    StorageService storageService = getInternal(uriInfo, securityContext, id, fieldsParam, include);
    return decryptOrNullify(securityContext, storageService);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getStorageServiceByFQN",
      summary = "Get storage service by name",
      description = "Get a storage service by the service `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Object store service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = StorageService.class))),
        @ApiResponse(responseCode = "404", description = "Object store service for instance {id} is not found")
      })
  public StorageService getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("name") String name,
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
          Include include)
      throws IOException {
    StorageService storageService = getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
    return decryptOrNullify(securityContext, storageService);
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
                @Content(mediaType = "application/json", schema = @Schema(implementation = DatabaseService.class)))
      })
  public StorageService addTestConnectionResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid TestConnectionResult testConnectionResult)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    StorageService service = dao.addTestConnectionResult(id, testConnectionResult);
    return decryptOrNullify(securityContext, service);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllStorageServiceVersion",
      summary = "List storage service versions",
      description = "Get a list of all the versions of an storage service identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of storage service versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "storage service Id", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    EntityHistory entityHistory = super.listVersionsInternal(securityContext, id);

    List<Object> versions =
        entityHistory.getVersions().stream()
            .map(
                json -> {
                  try {
                    StorageService storageService = JsonUtils.readValue((String) json, StorageService.class);
                    return JsonUtils.pojoToJson(decryptOrNullify(securityContext, storageService));
                  } catch (IOException e) {
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
      operationId = "getSpecificStorageServiceVersion",
      summary = "Get a version of the storage service",
      description = "Get a version of the storage service by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "storage service",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = StorageService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Object store service for instance {id} and version " + "{version} is not found")
      })
  public StorageService getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "storage service Id", schema = @Schema(type = "string")) @PathParam("id") UUID id,
      @Parameter(
              description = "storage service version number in the form `major`" + ".`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    StorageService storageService = super.getVersionInternal(securityContext, id, version);
    return decryptOrNullify(securityContext, storageService);
  }

  @POST
  @Operation(
      operationId = "createStorageService",
      summary = "Create storage service",
      description = "Create a new storage service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Object store service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = StorageService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateStorageService create)
      throws IOException {
    StorageService service = getService(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (StorageService) response.getEntity());
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateStorageService",
      summary = "Update storage service",
      description = "Update an existing or create a new storage service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Object store service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = StorageService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateStorageService update)
      throws IOException {
    StorageService service = getService(update, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, unmask(service));
    decryptOrNullify(securityContext, (StorageService) response.getEntity());
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchStorageService",
      summary = "Update an storage service",
      description = "Update an existing storage service using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch)
      throws IOException {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteStorageService",
      summary = "Delete an storage service",
      description = "Delete an storage services. If containers belong the service, it can't be " + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "StorageService service for instance {id} " + "is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the storage service", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteStorageServiceByFQN",
      summary = "Delete an StorageService by fully qualified name",
      description = "Delete an StorageService by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "StorageService for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the StorageService", schema = @Schema(type = "string")) @PathParam("fqn")
          String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted StorageService.",
      description = "Restore a soft deleted StorageService.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the StorageService.",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = StorageService.class)))
      })
  public Response restoreStorageService(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private StorageService getService(CreateStorageService create, String user) throws IOException {
    return copy(new StorageService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection());
  }

  @Override
  protected StorageService nullifyConnection(StorageService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(StorageService service) {
    return service.getServiceType().value();
  }
}
