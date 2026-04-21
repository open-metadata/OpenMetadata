package org.openmetadata.service.resources.knowledge;

import static org.openmetadata.service.Entity.BOT;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.jdbi3.KnowledgePageRepository.KNOWLEDGE_PAGE_ENTITY;

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
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageHierarchy;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DaoListFilter;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;

@Slf4j
@Tag(name = "Knowledge", description = "APIs related knowledge pages of data assets.")
@Path("/v1/knowledgeCenter")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "KnowledgeCenter")
public class KnowledgePageResource extends EntityResource<Page, KnowledgePageRepository> {
  public static final String INVALID_ENTITY_MSG =
      "Given Entity Type : %s does not support Knowledge Pages.";
  public static final Set<String> EXCLUDED_ENTITIES = Set.of(USER, BOT, TEST_SUITE, TEST_CASE);
  public static final String COLLECTION_PATH = "v1/knowledgeCenter";
  public static final String FIELDS =
      "owners,tags,followers,votes,page,parent,childrenCount,relatedEntities,relatedArticles,attachments,domains,dataProducts";
  private final KnowledgePageMapper mapper = new KnowledgePageMapper();

  public KnowledgePageResource(Authorizer authorizer, Limits limits) {
    super(KNOWLEDGE_PAGE_ENTITY, authorizer, limits);
  }

  public static class PageList extends ResultList<Page> {
    /* Required for serde */
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    this.allowedFields.add("relatedArticles");
    addViewOperation(
        "pageType,page,parent,children,relatedEntities,relatedArticles",
        MetadataOperation.VIEW_BASIC);
    return null;
  }

  @Override
  public Page addHref(UriInfo uriInfo, Page entity) {
    super.addHref(uriInfo, entity);
    Entity.withHref(uriInfo, entity.getRelatedEntities());
    return entity;
  }

  @GET
  @Operation(
      operationId = "listKnowledgePages",
      summary = "Get a list of Knowledge Pages",
      description =
          "Get a list of Knowledge Pages. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Get List of Knowledge Pages",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PageList.class)))
      })
  public ResultList<Page> listKnowledgePage(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Type of the entity for which to list the Knowledge Pages",
              schema = @Schema(type = "string"))
          @QueryParam("entityType")
          String entityType,
      @Parameter(description = "Knowledge Page Type", schema = @Schema(type = "string"))
          @QueryParam("pageType")
          PageType knowledgePageType,
      @Parameter(
              description = "UUID of the entity for which to list the Knowledge Pages",
              schema = @Schema(type = "UUID"))
          @QueryParam("entityId")
          UUID entityId,
      @Parameter(
              description =
                  "Limit the number Knowledge Pages returned. " + "(1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "UUID of the entity for which to list the Knowledge Pages",
              schema = @Schema(type = "UUID"))
          @QueryParam("tagFQN")
          String tagFQN,
      @Parameter(
              description = "Returns list of Knowledge Pages before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of Knowledge Pages after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    if ((!CommonUtil.nullOrEmpty(entityId) && CommonUtil.nullOrEmpty(entityType))
        || (CommonUtil.nullOrEmpty(entityId) && !CommonUtil.nullOrEmpty(entityType))) {
      throw new IllegalArgumentException(
          "Query Param Entity Id and Entity Type both needs to be provided.");
    } else if (!CommonUtil.nullOrEmpty(entityId) && !CommonUtil.nullOrEmpty(entityType)) {
      filter.addQueryParam("entityType", entityType);
      List<String> fromIds = new ArrayList<>();
      // Add the User
      fromIds.add(entityId.toString());
      // Add team and domain if exists
      if (entityType.equals(USER)) {
        User user = Entity.getEntity(USER, entityId, "domains,teams", include);
        // Add Teams
        if (user.getTeams() != null) {
          user.getTeams().forEach(team -> fromIds.add(team.getId().toString()));
        }
        // Add Domains
        if (user.getDomains() != null) {
          user.getDomains().forEach(domain -> fromIds.add(domain.getId().toString()));
        }
      }
      filter.addQueryParam("entityId", getUsersFromIdList(fromIds));
    }
    if (knowledgePageType != null) {
      filter.addQueryParam("pageType", knowledgePageType.value());
    }

    if (!CommonUtil.nullOrEmpty(tagFQN)) {
      filter.addQueryParam("tagFQN", tagFQN);
    }
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/hierarchy")
  @Valid
  @Operation(
      operationId = "listPageHierarchy",
      summary = "List Page with hierarchy",
      description = "Get a list of pages with hierarchy.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pages with hierarchy",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = KnowledgePageResource.PageList.class)))
      })
  public ResultList<PageHierarchy> listHierarchy(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Knowledge Page Type", schema = @Schema(type = "string"))
          @QueryParam("pageType")
          PageType knowledgePageType,
      @Parameter(description = "Limit the number of pages returned. (1 to 1000000, default = 10)")
          @DefaultValue("10000")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam) {
    DaoListFilter filter = new DaoListFilter(Include.NON_DELETED);
    if (knowledgePageType != null) {
      filter.addQueryParam("pageType", knowledgePageType.value());
    }
    return new ResultList<>(repository.listHierarchy(filter, limitParam));
  }

  @GET
  @Path("/search/hierarchy")
  @Valid
  @Operation(
      operationId = "listPageHierarchySearch",
      summary = "List Page with hierarchy from Search",
      description = "Get a list of pages with hierarchy from Search.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pages with hierarchy from Search",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = KnowledgePageResource.PageList.class)))
      })
  public ResultList<PageHierarchy> listHierarchyWithSearch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Knowledge Page Type", schema = @Schema(type = "string"))
          @QueryParam("pageType")
          PageType knowledgePageType,
      @Parameter(description = "Offset for pagination") @QueryParam("offset") @DefaultValue("0")
          int offset,
      @Parameter(description = "Limit the number of pages returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          int limit,
      @Parameter(description = "Parent Fully Qualified Name") @QueryParam("parent") String parent,
      @Parameter(
              description =
                  "FQN of the active page to show the active page correctly in  the hierarchy , while showing other root nodes at level 1.")
          @QueryParam("activeFqn")
          String activeFqn) {
    if (!CommonUtil.nullOrEmpty(activeFqn)) {
      return repository.getHierarchyWithSearchForActivePage(
          activeFqn, knowledgePageType, offset, limit);
    } else {
      return repository.getHierarchyWithSearch(parent, knowledgePageType, offset, limit);
    }
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getKnowledgePageById",
      summary = "Get a Knowledge Page",
      description = "Get a KnowledgePage by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "KnowledgePage",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Page.class))),
        @ApiResponse(
            responseCode = "404",
            description = "KnowledgePage for instance {id} is not found")
      })
  public Page getKnowledgePageById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "KnowledgePage Id", schema = @Schema(type = "UUID")) @PathParam("id")
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
          Include include,
      @Parameter(
              description =
                  "Per-relation include control. Format: field:value,field2:value2. "
                      + "Example: owners:non-deleted,followers:all. "
                      + "Valid values: all, deleted, non-deleted. "
                      + "If not specified for a field, uses the entity's include value.",
              schema = @Schema(type = "string", example = "owners:non-deleted,followers:all"))
          @QueryParam("includeRelations")
          String includeRelations) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include, includeRelations);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getKnowledgePageFqn",
      summary = "Get a KnowledgePage by name",
      description = "Get a KnowledgePage by fully qualified table name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "KnowledgePage",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Page.class))),
        @ApiResponse(
            responseCode = "404",
            description = "KnowledgePage for instance {id} is not found")
      })
  public Page getKnowledgePageByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the KnowledgePage",
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
          Include include,
      @Parameter(
              description =
                  "Per-relation include control. Format: field:value,field2:value2. "
                      + "Example: owners:non-deleted,followers:all. "
                      + "Valid values: all, deleted, non-deleted. "
                      + "If not specified for a field, uses the entity's include value.",
              schema = @Schema(type = "string", example = "owners:non-deleted,followers:all"))
          @QueryParam("includeRelations")
          String includeRelations) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include, includeRelations);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllKnowledgePageVersion",
      summary = "Get List of all KnowledgePage versions",
      description = "Get a list of all the versions of a KnowledgePage identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of KnowledgePage versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "KnowledgePage Id", schema = @Schema(type = "string"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificKnowledgePageVersion",
      summary = "Get a specific version of the KnowledgePage",
      description = "Get a version of the KnowledgePage by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "KnowledgePage",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Page.class))),
        @ApiResponse(
            responseCode = "404",
            description = "KnowledgePage for instance {id} and version {version} is " + "not found")
      })
  public Page getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "KnowledgePage Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "KnowledgePage version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createKnowledgePage",
      summary = "Create a Knowledge Page",
      description = "Create a Knowledge Page.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Knowledge Page",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Page.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreatePage create) {
    Page page = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, page);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateKnowledgePage",
      summary = "Create or update a Knowledge Page",
      description =
          "Create a Knowledge Page, if it does not exist. If a knowledge page already exists, update the Knowledge Page.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Knowledge Page",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Page.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreatePage create) {
    Page page = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, page);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchKnowledgePage",
      summary = "Update a Knowledge Page",
      description = "Update an existing Knowledge Page using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Knowledge Page", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject(
                            "[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
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
      @Parameter(description = "Id of the Knowledge Page", schema = @Schema(type = "UUID"))
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

  @PUT
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVote",
      summary = "Update Vote for a this entity",
      description = "Update vote for a entity",
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
      @Parameter(description = "Id of the Query", schema = @Schema(type = "UUID")) @PathParam("id")
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
      @Parameter(description = "Id of the Knowledge Page", schema = @Schema(type = "UUID"))
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
  @Path("/{id}/usage")
  @Operation(
      operationId = "addKnowledgePageUsage",
      summary = "Add Knowledge Page usage",
      description = "Add Knowledge Page usage",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Page.class)))
      })
  public Response addKnowledgePageUsage(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Knowledge Page", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Valid List<EntityReference> entityIds) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository
        .addKnowledgePageUsage(uriInfo, securityContext.getUserPrincipal().getName(), id, entityIds)
        .toResponse();
  }

  @DELETE
  @Path("/{id}/usage")
  @Operation(
      operationId = "removeKnowledgePageUsage",
      summary = "remove Knowledge Page usage",
      description = "remove Knowledge Page Usage",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Page.class)))
      })
  public Response removeKnowledgePageUsage(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the knowledge page", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Valid List<EntityReference> entityIds) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository
        .removeKnowledgePageUsedIn(
            uriInfo, securityContext.getUserPrincipal().getName(), id, entityIds)
        .toResponse();
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted Knowledge Page",
      description = "Restore a soft deleted Knowledge Page.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Knowledge Page ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Page.class)))
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
      operationId = "deleteKnowledgePage",
      summary = "Delete a Knowledge Page",
      description = "Delete a knowledge page by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Knowledge Page for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Knowledge Page", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive) {
    return delete(uriInfo, securityContext, id, recursive, true);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteKnowledgePageAsync",
      summary = "Asynchronously delete a Knowledge Page",
      description = "Asynchronously delete a knowledge page by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Knowledge Page for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Knowledge Page", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, true);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteKnowledgePageByFQN",
      summary = "Delete a Knowledge Page",
      description = "Delete a KnowledgePage by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Knowledge Page for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the Knowledge Page",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive) {
    return deleteByName(uriInfo, securityContext, fqn, recursive, true);
  }

  private String getUsersFromIdList(List<String> fromIds) {
    return fromIds.stream().map(item -> "'" + item + "'").collect(Collectors.joining(","));
  }
}
