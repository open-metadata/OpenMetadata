package org.openmetadata.service.resources.storages;

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
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContainerRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@Path("/v1/containers")
@Tag(
    name = "Containers",
    description =
        "A Container is an abstraction for any path(including the top level eg. bucket in S3) storing "
            + "data in an Object store such as S3, GCP, Azure. It maps a tree-like structure, where each Container "
            + "can have a parent and a list of sub-folders, and it can be structured - where it contains structured data, or unstructured where no schema for its data is defined.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "containers")
public class ContainerResource extends EntityResource<Container, ContainerRepository> {
  private final ContainerMapper mapper = new ContainerMapper();
  public static final String COLLECTION_PATH = "v1/containers/";
  static final String FIELDS =
      "parent,children,dataModel,owners,tags,followers,extension,domains,sourceHash";

  @Override
  public Container addHref(UriInfo uriInfo, Container container) {
    super.addHref(uriInfo, container);
    Entity.withHref(uriInfo, container.getService());
    Entity.withHref(uriInfo, container.getParent());
    return container;
  }

  public ContainerResource(Authorizer authorizer, Limits limits) {
    super(Entity.CONTAINER, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("parent,children,dataModel", MetadataOperation.VIEW_BASIC);
    return null;
  }

  public static class ContainerList extends ResultList<Container> {
    /* Required for serde */
  }

  @GET
  @Valid
  @Operation(
      operationId = "listContainers",
      summary = "List Containers",
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
          @QueryParam("service")
          String service,
      @Parameter(
              description = "Filter by Containers at the root level. E.g., without parent",
              schema = @Schema(type = "boolean", example = "true"))
          @QueryParam("root")
          @DefaultValue("false")
          Boolean root,
      @Parameter(description = "Limit the number containers returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of containers before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of containers after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include).addQueryParam("service", service);
    if (root != null) {
      filter.addQueryParam("root", root.toString());
    }
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getContainerByID",
      summary = "Get an Object Store Container",
      description = "Get an Object Store container by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The container",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Container.class))),
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
          Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getContainerByFQN",
      summary = "Get an Container by name",
      description = "Get an Container by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The container",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Container.class))),
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
          Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @POST
  @Operation(
      operationId = "createContainer",
      summary = "Create a Container",
      description = "Create a new Container.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Container",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Container.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateContainer create) {
    Container container =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, container);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchContainer",
      summary = "Update a Container",
      description = "Update an existing Container using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Container", schema = @Schema(type = "string"))
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
      operationId = "patchContainer",
      summary = "Update a Container using name.",
      description = "Update an existing Container using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Container", schema = @Schema(type = "string"))
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

  @PUT
  @Operation(
      operationId = "createOrUpdateContainer",
      summary = "Create or update a Container",
      description = "Create a new Container, if it does not exist or update an existing container.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Container",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Container.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateContainer create) {
    Container container =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, container);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollower",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as follower of this container",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "container for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the container", schema = @Schema(type = "UUID"))
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
      operationId = "deleteFollower",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the container.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
      })
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the container", schema = @Schema(type = "string"))
          @PathParam("id")
          String id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId) {
    return repository
        .deleteFollower(
            securityContext.getUserPrincipal().getName(),
            UUID.fromString(id),
            UUID.fromString(userId))
        .toResponse();
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllContainerVersion",
      summary = "List Container versions",
      description = "Get a list of all the versions of a container identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Container versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Container Id", schema = @Schema(type = "string")) @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificContainerVersion",
      summary = "Get a version of the Container",
      description = "Get a version of the Container by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Container",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Container.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Container for instance {id} and version {version} is not found")
      })
  public Container getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Container Id", schema = @Schema(type = "string")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Container version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteContainer",
      summary = "Delete a Container",
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
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Container Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteContainerAsync",
      summary = "Asynchronously delete a Container",
      description = "Asynchronously delete a Container by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "container for instance {id} is not found")
      })
  public Response deleteByIdAsync(
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
      @Parameter(description = "Container Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @PUT
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVoteForEntity",
      summary = "Update Vote for a Entity",
      description = "Update vote for a Entity",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response updateVote(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid VoteRequest request) {
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteContainerByFQN",
      summary = "Delete a Container by fully qualified name",
      description = "Delete a Container by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "container for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the Container", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted Container.",
      description = "Restore a soft deleted Container.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Container ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Container.class)))
      })
  public Response restoreContainer(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/name/{fqn}/children")
  @Operation(
      operationId = "listContainerChildren",
      summary = "List children containers",
      description = "Get a list of children containers with pagination.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of children containers",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContainerList.class)))
      })
  public ResultList<Container> listChildren(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the container") @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Limit the number of children returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          Integer limit,
      @Parameter(description = "Returns list of children after the given offset")
          @DefaultValue("0")
          @QueryParam("offset")
          @Min(value = 0, message = "must be greater than or equal to 0")
          Integer offset) {
    return repository.listChildren(fqn, limit, offset);
  }
}
