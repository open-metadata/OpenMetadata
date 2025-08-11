package org.openmetadata.service.resources.query;

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
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.QueryRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.mask.PIIMasker;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.ResultList;

@Path("/v1/queries")
@Tag(
    name = "Queries",
    description =
        "A `Query` entity represents a SQL query associated with data assets it is run against.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "queries")
public class QueryResource extends EntityResource<Query, QueryRepository> {
  private final QueryMapper mapper = new QueryMapper();
  public static final String COLLECTION_PATH = "v1/queries/";
  static final String FIELDS = "owners,followers,users,votes,tags,queryUsedIn";

  public QueryResource(Authorizer authorizer, Limits limits) {
    super(Entity.QUERY, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("users,queryUsedIn", MetadataOperation.VIEW_BASIC);
    return null;
  }

  @Override
  public Query addHref(UriInfo uriInfo, Query entity) {
    super.addHref(uriInfo, entity);
    Entity.withHref(uriInfo, entity.getUsers());
    Entity.withHref(uriInfo, entity.getQueryUsedIn());
    return entity;
  }

  public static class QueryList extends ResultList<Query> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listQueries",
      summary = "Get a list of Queries",
      description =
          "Get a list of queries. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Get List of queries",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = QueryResource.QueryList.class)))
      })
  public ResultList<Query> listQueries(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "UUID of the entity for which to list the Queries",
              schema = @Schema(type = "UUID"))
          @QueryParam("entityId")
          UUID entityId,
      @Parameter(
              description = "Filter Queries by service Fully Qualified Name",
              schema = @Schema(type = "string"))
          @QueryParam("service")
          String service,
      @Parameter(description = "Limit the number queries returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of queries before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of queries after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after) {
    ListFilter filter = new ListFilter(null);
    if (!CommonUtil.nullOrEmpty(entityId)) {
      filter.addQueryParam("entityId", entityId.toString());
    }
    filter.addQueryParam("service", service);
    ResultList<Query> queries =
        super.listInternal(
            uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
    return PIIMasker.getQueries(queries, authorizer, securityContext);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getQueryById",
      summary = "Get a query",
      description = "Get a Query by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "query",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Query.class))),
        @ApiResponse(responseCode = "404", description = "Query for instance {id} is not found")
      })
  public Query getQueryById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "query Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, null);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getQueryFqn",
      summary = "Get a query by name",
      description = "Get a query by fully qualified table name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "query",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Query.class))),
        @ApiResponse(responseCode = "404", description = "Query for instance {id} is not found")
      })
  public Query getQueryByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the query",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, null);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllQueryVersion",
      summary = "Get List of all query versions",
      description = "Get a list of all the versions of a query identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of query versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Query Id", schema = @Schema(type = "string")) @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificQueryVersion",
      summary = "Get a specific version of the query",
      description = "Get a version of the query by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "query",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Query.class))),
        @ApiResponse(
            responseCode = "404",
            description = "query for instance {id} and version {version} is not found")
      })
  public Query getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Query Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Query version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createQuery",
      summary = "Create a query",
      description = "Create a query under an existing entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The query",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = QueryResource.QueryList.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateQuery create) {
    Query query = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, query);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateQuery",
      summary = "Create or update a query",
      description =
          "Create a query, if it does not exist. If a query already exists, update the query.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The query",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Query.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateQuery create) {
    Query query = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, query);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchQuery",
      summary = "Update a query",
      description = "Update an existing query using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the query", schema = @Schema(type = "UUID")) @PathParam("id")
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
      operationId = "patchQuery",
      summary = "Update a query using name.",
      description = "Update an existing query using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the query", schema = @Schema(type = "string"))
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
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollower",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as follower of this model",
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
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Query", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "UUID"))
          UUID userId) {
    return repository
        .addFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
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
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollower",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the model.",
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
      @Parameter(description = "Id of the Query", schema = @Schema(type = "UUID")) @PathParam("id")
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
  @Path("/{id}/usage")
  @Operation(
      operationId = "addQueryUsage",
      summary = "Add query usage",
      description = "Add query usage",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Query.class)))
      })
  public Response addQueryUsage(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the query", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid List<EntityReference> entityIds) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository
        .addQueryUsage(uriInfo, securityContext.getUserPrincipal().getName(), id, entityIds)
        .toResponse();
  }

  @PUT
  @Path("/{id}/users")
  @Operation(
      operationId = "addQueryUsers",
      summary = "Add query users",
      description = "Add query users",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Query.class)))
      })
  public Response addQueryUsers(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the query", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid List<String> userFqnList) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository
        .addQueryUser(uriInfo, securityContext.getUserPrincipal().getName(), id, userFqnList)
        .toResponse();
  }

  @PUT
  @Path("/{id}/usedBy")
  @Operation(
      operationId = "addQueryUsedBy",
      summary = "Populate Used By Field",
      description = "Add query users",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Query.class)))
      })
  public Response addQueryUsedBy(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the query", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid List<String> usedByList) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository
        .addQueryUsedBy(uriInfo, securityContext.getUserPrincipal().getName(), id, usedByList)
        .toResponse();
  }

  @DELETE
  @Path("/{id}/usage")
  @Operation(
      operationId = "removeQueryUsedIn",
      summary = "remove query used in",
      description = "remove Query Used in",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Query.class)))
      })
  public Response removeQueryUsedIn(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the query", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid List<EntityReference> entityIds) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository
        .removeQueryUsedIn(uriInfo, securityContext.getUserPrincipal().getName(), id, entityIds)
        .toResponse();
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted Query",
      description = "Restore a soft deleted Query.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Query ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Query.class)))
      })
  public Response restoreQuery(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteQuery",
      summary = "Delete a query",
      description = "Delete a query by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Query for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the query", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, false, true);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteQueryAsync",
      summary = "Asynchronously delete a query",
      description = "Asynchronously delete a query by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Query for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the query", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, false, true);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteQueryByFQN",
      summary = "Delete a query",
      description = "Delete a query by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Query for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the location",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, false, true);
  }
}
