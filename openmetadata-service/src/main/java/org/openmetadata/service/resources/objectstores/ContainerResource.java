package org.openmetadata.service.resources.objectstores;

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
import java.util.UUID;
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
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ContainerRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Path("/v1/containers")
@Api(value = "Containers collection", tags = "Containers collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "containers")
public class ContainerResource extends EntityResource<Container, ContainerRepository> {
  public static final String COLLECTION_PATH = "v1/containers/";

  @Override
  public Container addHref(UriInfo uriInfo, Container container) {
    container.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, container.getId()));
    Entity.withHref(uriInfo, container.getOwner());
    Entity.withHref(uriInfo, container.getService());
    Entity.withHref(uriInfo, container.getParent());
    Entity.withHref(uriInfo, container.getChildren());
    Entity.withHref(uriInfo, container.getFollowers());
    return container;
  }

  public ContainerResource(CollectionDAO dao, Authorizer authorizer) {
    super(Container.class, new ContainerRepository(dao), authorizer);
  }

  public static class ContainerList extends ResultList<Container> {
    @SuppressWarnings("unused")
    ContainerList() {
      // Empty constructor needed for deserialization
    }
  }

  /* List of fields that are not stored as a property in the json document.
     These are typically relationships or properties that could have a lot of data.
  */
  static final String FIELDS = "parent,children,dataModel,owner,tags,followers,extension";

  @GET
  @Valid
  @Operation(
      operationId = "listContainers",
      summary = "List Containers",
      tags = "containers",
      description =
          "Get a list of containers, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of containers",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContainerResource.ContainerList.class)))
      })
  public ResultList<Container> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter Containers by Object Store Service name",
              schema = @Schema(type = "string", example = "s3West"))
          @QueryParam("objectStoreService")
          String objectStoreServiceParam,
      @Parameter(
              description = "Filter by Containers at the root level. E.g., without parent",
              schema = @Schema(type = "boolean", example = "true"))
          @QueryParam("root")
          @DefaultValue("false")
          Boolean root,
      @Parameter(description = "Limit the number containers returned. (1 to 1000000, " + "default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of containers before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of containers after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include).addQueryParam("objectStoreService", objectStoreServiceParam);
    if (root != null) {
      filter.addQueryParam("root", root.toString());
    }
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getContainerByID",
      summary = "Get an Object Store Container",
      tags = "containers",
      description = "Get an Object Store container by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The container",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Container.class))),
        @ApiResponse(responseCode = "404", description = "Container for instance {id} is not found")
      })
  public Container get(
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
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getContainerByFQN",
      summary = "Get an Container by name",
      tags = "containers",
      description = "Get an Container by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The container",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Container.class))),
        @ApiResponse(responseCode = "404", description = "Container for instance {id} is not found")
      })
  public Container getByName(
      @Context UriInfo uriInfo,
      @PathParam("fqn") String fqn,
      @Context SecurityContext securityContext,
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
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @POST
  @Operation(
      operationId = "createContainer",
      summary = "Create a Container",
      tags = "containers",
      description = "Create a new Container.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Container",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Container.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateContainer create)
      throws IOException {
    Container container = getContainer(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, container);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchContainer",
      summary = "Update a Container",
      tags = "containers",
      description = "Update an existing Container using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Container", schema = @Schema(type = "string")) @PathParam("id") UUID id,
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

  @PUT
  @Operation(
      operationId = "createOrUpdateContainer",
      summary = "Create or update a Container",
      tags = "containers",
      description = "Create a new Container, if it does not exist or update an existing container.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Container",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Container.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateContainer create)
      throws IOException {
    Container container = getContainer(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, container);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollower",
      summary = "Add a follower",
      tags = "containers",
      description = "Add a user identified by `userId` as follower of this container",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "container for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the container", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "UUID")) UUID userId)
      throws IOException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollower",
      summary = "Remove a follower",
      tags = "containers",
      description = "Remove the user identified `userId` as a follower of the container.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class))),
      })
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the container", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Id of the user being removed as follower", schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId)
      throws IOException {
    return dao.deleteFollower(
            securityContext.getUserPrincipal().getName(), UUID.fromString(id), UUID.fromString(userId))
        .toResponse();
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllContainerVersion",
      summary = "List Container versions",
      tags = "containers",
      description = "Get a list of all the versions of a container identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Container versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Container Id", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificContainerVersion",
      summary = "Get a version of the Container",
      tags = "containers",
      description = "Get a version of the Container by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Container",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Container.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Container for instance {id} and version {version} is " + "not found")
      })
  public Container getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Container Id", schema = @Schema(type = "string")) @PathParam("id") UUID id,
      @Parameter(
              description = "Container version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteContainer",
      summary = "Delete a Container",
      tags = "containers",
      description = "Delete a Container by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "container for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Container Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteContainerByFQN",
      summary = "Delete a Container by fully qualified name",
      tags = "containers",
      description = "Delete a Container by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "container for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the Container", schema = @Schema(type = "string")) @PathParam("fqn") String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted Container.",
      tags = "containers",
      description = "Restore a soft deleted Container.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Container ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Container.class)))
      })
  public Response restoreContainer(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private Container getContainer(CreateContainer create, String user) throws IOException {
    return copy(new Container(), create, user)
        .withService(getEntityReference(Entity.OBJECT_STORE_SERVICE, create.getService()))
        .withParent(create.getParent())
        .withDataModel(create.getDataModel())
        .withPrefix(create.getPrefix())
        .withNumberOfObjects(create.getNumberOfObjects())
        .withSize(create.getSize())
        .withFileFormats(create.getFileFormats())
        .withTags(create.getTags());
  }
}
