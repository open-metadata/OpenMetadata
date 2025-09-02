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

package org.openmetadata.service.resources.glossary;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;

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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.ValidateGlossaryTagsRequest;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.LoadGlossary;
import org.openmetadata.schema.api.data.MoveGlossaryTermRequest;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.MoveGlossaryTermResponse;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Path("/v1/glossaryTerms")
@Tag(
    name = "Glossaries",
    description = "A `Glossary` is collection of hierarchical `GlossaryTerms`.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(
    name = "glossaryTerms",
    order = 7) // Initialized after Glossary, Classification, and Tags
public class GlossaryTermResource extends EntityResource<GlossaryTerm, GlossaryTermRepository> {
  private final GlossaryTermMapper mapper = new GlossaryTermMapper();
  private final GlossaryMapper glossaryMapper = new GlossaryMapper();
  public static final String COLLECTION_PATH = "v1/glossaryTerms/";
  static final String FIELDS =
      "children,relatedTerms,reviewers,owners,tags,usageCount,domains,extension,childrenCount";

  @Override
  public GlossaryTerm addHref(UriInfo uriInfo, GlossaryTerm term) {
    super.addHref(uriInfo, term);
    Entity.withHref(uriInfo, term.getGlossary());
    Entity.withHref(uriInfo, term.getParent());
    Entity.withHref(uriInfo, term.getRelatedTerms());
    return term;
  }

  public GlossaryTermResource(Authorizer authorizer, Limits limits) {
    super(Entity.GLOSSARY_TERM, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("children,relatedTerms,reviewers,usageCount", MetadataOperation.VIEW_BASIC);
    return null;
  }

  public static class GlossaryTermList extends ResultList<GlossaryTerm> {
    /* Required for serde */
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    super.initialize(config);
    // Load glossaries provided by OpenMetadata
    GlossaryRepository glossaryRepository =
        (GlossaryRepository) Entity.getEntityRepository(GLOSSARY);
    List<LoadGlossary> loadGlossaries =
        EntityRepository.getEntitiesFromSeedData(
            GLOSSARY, ".*json/data/glossary/.*Glossary\\.json$", LoadGlossary.class);
    for (LoadGlossary loadGlossary : loadGlossaries) {
      Glossary glossary =
          glossaryMapper.createToEntity(loadGlossary.getCreateGlossary(), ADMIN_USER_NAME);
      glossary.setFullyQualifiedName(glossary.getName());
      glossaryRepository.initializeEntity(glossary);

      List<GlossaryTerm> termsToCreate = new ArrayList<>();
      for (CreateGlossaryTerm createTerm : loadGlossary.getCreateTerms()) {
        createTerm.withGlossary(glossary.getName());
        createTerm.withProvider(glossary.getProvider());
        GlossaryTerm term = mapper.createToEntity(createTerm, ADMIN_USER_NAME);
        repository.setFullyQualifiedName(term); // FQN required for ordering tags based on hierarchy
        termsToCreate.add(term);
      }

      // Sort tags based on tag hierarchy
      EntityUtil.sortByFQN(termsToCreate);

      for (GlossaryTerm term : termsToCreate) {
        repository.initializeEntity(term);
      }
    }
  }

  @GET
  @Valid
  @Operation(
      operationId = "listGlossaryTerm",
      summary = "List glossary terms",
      description =
          "Get a list of glossary terms. Use `fields` parameter to get only necessary fields. "
              + " Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of glossary terms",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTermList.class)))
      })
  public ResultList<GlossaryTerm> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "List glossary terms filtered by glossary identified by Id given in `glossary` parameter.",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("glossary")
          String glossaryIdParam,
      @Parameter(
              description =
                  "List glossary terms filtered by children of glossary term identified by Id given in "
                      + "`parent` parameter.",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("parent")
          UUID parentTermParam,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description =
                  "Limit the number glossary terms returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of glossary terms before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of glossary terms after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include,
      @Parameter(
              description =
                  "List glossary terms filtered to retrieve the first level/immediate children of the glossary term "
                      + "`directChildrenOf` parameter.",
              schema = @Schema(type = "string"))
          @QueryParam("directChildrenOf")
          String parentTermFQNParam) {
    RestUtil.validateCursors(before, after);
    Fields fields = getFields(fieldsParam);

    ResourceContextInterface glossaryResourceContext = new ResourceContext<>(GLOSSARY);
    OperationContext glossaryOperationContext =
        new OperationContext(GLOSSARY, getViewOperations(fields));
    OperationContext glossaryTermOperationContext =
        new OperationContext(entityType, getViewOperations(fields));
    ResourceContextInterface glossaryTermResourceContext = new ResourceContext<>(GLOSSARY_TERM);

    List<AuthRequest> authRequests =
        List.of(
            new AuthRequest(glossaryOperationContext, glossaryResourceContext),
            new AuthRequest(glossaryTermOperationContext, glossaryTermResourceContext));
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);

    // Filter by glossary
    String fqn = null;
    EntityReference glossary = null;
    if (glossaryIdParam != null) {
      glossary = repository.getGlossary(glossaryIdParam);
      fqn = glossary.getFullyQualifiedName();
    }

    // Filter by glossary parent term
    if (parentTermParam != null) {
      GlossaryTerm parentTerm =
          repository.get(null, parentTermParam, repository.getFields("parent"));
      fqn = parentTerm.getFullyQualifiedName();

      // Ensure parent glossary term belongs to the glossary
      if ((glossary != null) && (!parentTerm.getGlossary().getId().equals(glossary.getId()))) {
        throw new IllegalArgumentException(
            CatalogExceptionMessage.glossaryTermMismatch(
                parentTermParam.toString(), glossaryIdParam));
      }
    }
    ListFilter filter =
        new ListFilter(include)
            .addQueryParam("parent", fqn)
            .addQueryParam("directChildrenOf", parentTermFQNParam);

    ResultList<GlossaryTerm> terms;
    if (before != null) { // Reverse paging
      terms =
          repository.listBefore(
              uriInfo, fields, filter, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      terms = repository.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, terms);
  }

  @GET
  @Path("/search")
  @Operation(
      operationId = "searchGlossaryTerms",
      summary = "Search glossary terms with pagination",
      description =
          "Search glossary terms by name, display name, or description with server-side pagination. "
              + "This endpoint provides efficient search functionality for glossaries with large numbers of terms.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of matching glossary terms",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTermList.class)))
      })
  public ResultList<GlossaryTerm> searchGlossaryTerms(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Search query for term names, display names, or descriptions")
          @QueryParam("q")
          String query,
      @Parameter(description = "Filter by glossary ID") @QueryParam("glossary") UUID glossaryId,
      @Parameter(description = "Filter by glossary FQN") @QueryParam("glossaryFqn")
          String glossaryFqn,
      @Parameter(description = "Filter by parent term ID") @QueryParam("parent") UUID parentId,
      @Parameter(description = "Filter by parent term FQN") @QueryParam("parentFqn")
          String parentFqn,
      @Parameter(description = "Limit the number of terms returned (1 to 1000, default = 50)")
          @DefaultValue("50")
          @Min(value = 1, message = "must be greater than or equal to 1")
          @Max(value = 1000, message = "must be less than or equal to 1000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Offset for pagination (default = 0)")
          @DefaultValue("0")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @QueryParam("offset")
          int offsetParam,
      @Parameter(
              description = "Fields requested in the returned terms",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {

    Fields fields = getFields(fieldsParam);
    ResourceContextInterface glossaryResourceContext = new ResourceContext<>(GLOSSARY);
    OperationContext glossaryOperationContext =
        new OperationContext(GLOSSARY, getViewOperations(fields));
    OperationContext glossaryTermOperationContext =
        new OperationContext(entityType, getViewOperations(fields));
    ResourceContextInterface glossaryTermResourceContext = new ResourceContext<>(GLOSSARY_TERM);

    List<AuthRequest> authRequests =
        List.of(
            new AuthRequest(glossaryOperationContext, glossaryResourceContext),
            new AuthRequest(glossaryTermOperationContext, glossaryTermResourceContext));
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);

    ResultList<GlossaryTerm> result;
    if (glossaryId != null) {
      result =
          repository.searchGlossaryTermsById(
              glossaryId, query, limitParam, offsetParam, fieldsParam, include);
    } else if (glossaryFqn != null) {
      result =
          repository.searchGlossaryTermsByFQN(
              glossaryFqn, query, limitParam, offsetParam, fieldsParam, include);
    } else if (parentId != null) {
      result =
          repository.searchGlossaryTermsByParentId(
              parentId, query, limitParam, offsetParam, fieldsParam, include);
    } else if (parentFqn != null) {
      result =
          repository.searchGlossaryTermsByParentFQN(
              parentFqn, query, limitParam, offsetParam, fieldsParam, include);
    } else {
      // Search across all glossary terms without parent filter
      ListFilter filter = new ListFilter(include);
      ResultList<GlossaryTerm> allTerms =
          repository.listAfter(uriInfo, fields, filter, Integer.MAX_VALUE, null);
      List<GlossaryTerm> matchingTerms;
      if (query == null || query.trim().isEmpty()) {
        matchingTerms = allTerms.getData();
      } else {
        String searchTerm = query.toLowerCase().trim();
        matchingTerms =
            allTerms.getData().stream()
                .filter(
                    term -> {
                      if (term.getName() != null
                          && term.getName().toLowerCase().contains(searchTerm)) {
                        return true;
                      }
                      if (term.getDisplayName() != null
                          && term.getDisplayName().toLowerCase().contains(searchTerm)) {
                        return true;
                      }
                      if (term.getDescription() != null
                          && term.getDescription().toLowerCase().contains(searchTerm)) {
                        return true;
                      }
                      return false;
                    })
                .collect(Collectors.toList());
      }
      int total = matchingTerms.size();
      int startIndex = Math.min(offsetParam, total);
      int endIndex = Math.min(offsetParam + limitParam, total);
      List<GlossaryTerm> paginatedResults =
          startIndex < total ? matchingTerms.subList(startIndex, endIndex) : List.of();
      String before =
          offsetParam > 0 ? String.valueOf(Math.max(0, offsetParam - limitParam)) : null;
      String after = endIndex < total ? String.valueOf(endIndex) : null;
      result = new ResultList<>(paginatedResults, before, after, total);
    }

    return addHref(uriInfo, result);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getGlossaryTermByID",
      summary = "Get a glossary term by Id",
      description = "Get a glossary term by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Glossary term for instance {id} is not found")
      })
  public GlossaryTerm get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
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
      operationId = "getGlossaryTermByFQN",
      summary = "Get a glossary term by fully qualified name",
      description = "Get a glossary term by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Glossary term for instance {fqn} is not found")
      })
  public GlossaryTerm getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the glossary term",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
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

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllGlossaryTermVersion",
      summary = "List glossary term versions",
      description = "Get a list of all the versions of a glossary terms identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of glossary term versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificGlossaryTermVersion",
      summary = "Get a version of the glossary term",
      description = "Get a version of the glossary term by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Glossary term for instance {id} and version {version} is not found")
      })
  public GlossaryTerm getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "glossary term version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createGlossaryTerm",
      summary = "Create a glossary term",
      description = "Create a new glossary term.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateGlossaryTerm create) {
    GlossaryTerm term = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, term);
  }

  @POST
  @Path("/createMany")
  @Operation(
      operationId = "createManyGlossaryTerm",
      summary = "Create multiple glossary terms at once",
      description = "Create multiple new glossary terms.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createMany(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid List<CreateGlossaryTerm> creates) {
    List<GlossaryTerm> terms =
        creates.stream()
            .map(
                create ->
                    mapper.createToEntity(create, securityContext.getUserPrincipal().getName()))
            .toList();
    List<GlossaryTerm> result = repository.createMany(uriInfo, terms);
    return Response.ok(result).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchGlossaryTerm",
      summary = "Update a glossary term",
      description = "Update an existing glossary term using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
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
      operationId = "patchGlossaryTerm",
      summary = "Update a glossary term by name.",
      description = "Update an existing glossary term using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the glossary term", schema = @Schema(type = "string"))
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
      operationId = "createOrUpdateGlossaryTerm",
      summary = "Create or update a glossary term",
      description =
          "Create a new glossary term, if it does not exist or update an existing glossary term.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateGlossaryTerm create) {
    GlossaryTerm term = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, term);
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

  @PUT
  @Path("/{id}/assets/add")
  @Operation(
      operationId = "bulkAddGlossaryTermToAssets",
      summary = "Bulk Add Glossary Term to Assets",
      description = "Bulk Add Glossary Term to Assets",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response bulkAddGlossaryToAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid AddGlossaryToAssetsRequest request) {
    return Response.ok().entity(repository.bulkAddAndValidateGlossaryToAssets(id, request)).build();
  }

  @PUT
  @Path("/{id}/tags/validate")
  @Operation(
      operationId = "validateGlossaryTermTagsAddition",
      summary = "Validate Tags Addition to Glossary Term",
      description = "Validate Tags Addition to Glossary Term",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response validateGlossaryTermTagsAddition(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid ValidateGlossaryTagsRequest request) {
    return Response.ok().entity(repository.validateGlossaryTagsAddition(id, request)).build();
  }

  @PUT
  @Path("/{id}/assets/remove")
  @Operation(
      operationId = "bulkRemoveGlossaryTermFromAssets",
      summary = "Bulk Remove Glossary Term from Assets",
      description = "Bulk Remove Glossary Term from Assets",
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
  public Response bulkRemoveGlossaryFromAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid AddGlossaryToAssetsRequest request) {
    return Response.ok().entity(repository.bulkRemoveGlossaryToAssets(id, request)).build();
  }

  @PUT
  @Path("/{id}/moveAsync")
  @Operation(
      operationId = "moveGlossaryTerm",
      summary = "Move a glossary term to a new parent or glossary",
      description =
          "Move a glossary term to a new parent term or glossary. Only parent or glossary can be changed.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The moved glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class)))
      })
  @Consumes(MediaType.APPLICATION_JSON)
  public Response moveGlossaryTerm(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "MoveGlossaryTermRequest with new parent or glossary",
              required = true,
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON,
                      schema = @Schema(implementation = MoveGlossaryTermRequest.class)))
          MoveGlossaryTermRequest moveRequest) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_GLOSSARY_TERMS);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextById(id, ResourceContextInterface.Operation.PUT));

    String jobId = UUID.randomUUID().toString();
    GlossaryTerm glossaryTerm =
        repository.get(uriInfo, id, repository.getFields("name"), Include.ALL, false);
    String userName = securityContext.getUserPrincipal().getName();

    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            GlossaryTerm movedGlossaryTerm = repository.moveGlossaryTerm(id, moveRequest, userName);
            WebsocketNotificationHandler.sendMoveOperationCompleteNotification(
                jobId, securityContext, movedGlossaryTerm);
          } catch (Exception e) {
            WebsocketNotificationHandler.sendMoveOperationFailedNotification(
                jobId, securityContext, glossaryTerm, e.getMessage());
          }
        });

    return Response.accepted()
        .entity(
            new MoveGlossaryTermResponse(
                jobId,
                "Move operation initiated for " + glossaryTerm.getName(),
                glossaryTerm.getName()))
        .build();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a glossary term by Id",
      description = "Delete a glossary term by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "glossaryTerm for instance {id} is not found")
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
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      summary = "Asynchronously delete a glossary term by Id",
      description = "Asynchronously delete a glossary term by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "glossaryTerm for instance {id} is not found")
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
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteGlossaryTermByName",
      summary = "Delete a glossary term by fully qualified name",
      description = "Delete a glossary term by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "glossaryTerm for instance {fqn} is not found")
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
              description = "Fully qualified name of the glossary term",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted glossary term",
      description = "Restore a soft deleted glossary term.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Chart ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class)))
      })
  public Response restoreTable(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
