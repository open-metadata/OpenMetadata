package org.openmetadata.service.resources.services.objectstore;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
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
import org.openmetadata.schema.api.services.CreateObjectStoreService;
import org.openmetadata.schema.entity.services.ObjectStoreService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ObjectStoreConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.ObjectStoreServiceRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/services/objectstoreServices")
@Api(value = "Object store service collection", tags = "Services -> Object store service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "objectstoreServices")
public class ObjectStoreServiceResource
    extends ServiceEntityResource<ObjectStoreService, ObjectStoreServiceRepository, ObjectStoreConnection> {

  public static final String COLLECTION_PATH = "v1/services/objectstoreServices/";
  static final String FIELDS = "pipelines,owner,tags";

  @Override
  public ObjectStoreService addHref(UriInfo uriInfo, ObjectStoreService service) {
    service.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, service.getId()));
    Entity.withHref(uriInfo, service.getOwner());
    Entity.withHref(uriInfo, service.getPipelines());
    return service;
  }

  public ObjectStoreServiceResource(CollectionDAO dao, Authorizer authorizer) {
    super(ObjectStoreService.class, new ObjectStoreServiceRepository(dao), authorizer, ServiceType.OBJECT_STORE);
  }

  public static class ObjectStoreServiceList extends ResultList<ObjectStoreService> {
    @SuppressWarnings("unused") /* Required for tests */
    public ObjectStoreServiceList() {}
  }

  @GET
  @Operation(
      operationId = "listObjectStoreServices",
      summary = "List object store services",
      tags = "objectStoreServices",
      description = "Get a list of object store services.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of object store service instances",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ObjectStoreServiceResource.ObjectStoreServiceList.class)))
      })
  public ResultList<ObjectStoreService> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @DefaultValue("10") @Min(0) @Max(1000000) @QueryParam("limit") int limitParam,
      @Parameter(
              description = "Returns list of object store services before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of object store services after this cursor",
              schema = @Schema(type = "string"))
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
    ResultList<ObjectStoreService> objectStoreServices;

    ListFilter filter = new ListFilter(include);
    if (before != null) {
      objectStoreServices = dao.listBefore(uriInfo, fields, filter, limitParam, before);
    } else {
      objectStoreServices = dao.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, decryptOrNullify(securityContext, objectStoreServices));
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getObjectStoreServiceByID",
      summary = "Get an object store service",
      tags = "objectStoreServices",
      description = "Get an object store service by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Object store service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = ObjectStoreService.class))),
        @ApiResponse(responseCode = "404", description = "Object store service for instance {id} is not found")
      })
  public ObjectStoreService get(
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
    ObjectStoreService objectStoreService = getInternal(uriInfo, securityContext, id, fieldsParam, include);
    return decryptOrNullify(securityContext, objectStoreService);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getObjectStoreServiceByFQN",
      summary = "Get object store service by name",
      tags = "objectStoreServices",
      description = "Get a object store service by the service `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Object store service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = ObjectStoreService.class))),
        @ApiResponse(responseCode = "404", description = "Object store service for instance {id} is not found")
      })
  public ObjectStoreService getByName(
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
    ObjectStoreService objectStoreService = getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
    return decryptOrNullify(securityContext, objectStoreService);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllObjectStoreServiceVersion",
      summary = "List object store service versions",
      tags = "objectStoreServices",
      description = "Get a list of all the versions of an object store service identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of object store service versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "object store service Id", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    EntityHistory entityHistory = super.listVersionsInternal(securityContext, id);

    List<Object> versions =
        entityHistory.getVersions().stream()
            .map(
                json -> {
                  try {
                    ObjectStoreService objectStoreService =
                        JsonUtils.readValue((String) json, ObjectStoreService.class);
                    return JsonUtils.pojoToJson(decryptOrNullify(securityContext, objectStoreService));
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
      operationId = "getSpecificObjectStoreServiceVersion",
      summary = "Get a version of the object store service",
      tags = "objectStoreServices",
      description = "Get a version of the object store service by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "object service",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = ObjectStoreService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Object store service for instance {id} and version " + "{version} is not found")
      })
  public ObjectStoreService getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "object store service Id", schema = @Schema(type = "string")) @PathParam("id") UUID id,
      @Parameter(
              description = "object store service version number in the form `major`" + ".`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    ObjectStoreService objectStoreService = super.getVersionInternal(securityContext, id, version);
    return decryptOrNullify(securityContext, objectStoreService);
  }

  @POST
  @Operation(
      operationId = "createObjectStoreService",
      summary = "Create object store service",
      tags = "objectStoreServices",
      description = "Create a new object store service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Object store service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = ObjectStoreService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateObjectStoreService create)
      throws IOException {
    ObjectStoreService service = getService(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (ObjectStoreService) response.getEntity());
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateObjectStoreService",
      summary = "Update object store service",
      tags = "objectStoreServices",
      description = "Update an existing or create a new object store service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Object store service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = ObjectStoreService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateObjectStoreService update)
      throws IOException {
    ObjectStoreService service = getService(update, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (ObjectStoreService) response.getEntity());
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchObjectStoreService",
      summary = "Update an object store service",
      tags = "objectStoreServices",
      description = "Update an existing object store service using JsonPatch.",
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
      operationId = "deleteObjectStoreService",
      summary = "Delete an object store service",
      tags = "objectStoreServices",
      description = "Delete an object store services. If containers belong the service, it can't be " + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "ObjectStoreService service for instance {id} " + "is not found")
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
      @Parameter(description = "Id of the object store service", schema = @Schema(type = "string")) @PathParam("id")
          UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted ObjectStoreService.",
      tags = "objectStoreServices",
      description = "Restore a soft deleted ObjectStoreService.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the ObjectStoreService.",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = ObjectStoreService.class)))
      })
  public Response restoreObjectStoreService(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private ObjectStoreService getService(CreateObjectStoreService create, String user) throws IOException {
    return copy(new ObjectStoreService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection());
  }

  @Override
  protected ObjectStoreService nullifyConnection(ObjectStoreService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(ObjectStoreService service) {
    return service.getServiceType().value();
  }
}
