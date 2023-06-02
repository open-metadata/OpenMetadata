package org.openmetadata.service.resources.knowledgeasset;

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
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateKnowledgeAsset;
import org.openmetadata.schema.entity.data.knowledge.KnowledgeAsset;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.KnowledgeAssetRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@Path("/v1/knowledgeAssets")
@Tag(
    name = "KnowledgeAssets",
    description =
        "A `Knowledge Asset` entity represents a Knowledge asset entity that might holds info about Data Assets.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "knowledgeAssets")
public class KnowledgeAssetResource extends EntityResource<KnowledgeAsset, KnowledgeAssetRepository> {

  public static final String COLLECTION_PATH = "v1/knowledgeAssets/";

  public KnowledgeAssetResource(CollectionDAO dao, Authorizer authorizer) {
    super(KnowledgeAsset.class, new KnowledgeAssetRepository(dao), authorizer);
  }

  @Override
  public KnowledgeAsset addHref(UriInfo uriInfo, KnowledgeAsset entity) {
    Entity.withHref(uriInfo, entity.getOwner());
    Entity.withHref(uriInfo, entity.getFollowers());
    return entity;
  }

  public static class KnowledgeAssetList extends ResultList<KnowledgeAsset> {}

  static final String FIELDS = "owner,followers,votes,tags";

  @GET
  @Operation(
      operationId = "listKnowledgeAssets",
      summary = "Get a list of Knowledge Asset",
      description =
          "Get a list of Knowledge Asset. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Get List of Knowledge Asset",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = KnowledgeAssetResource.KnowledgeAssetList.class)))
      })
  public ResultList<KnowledgeAsset> listKnowledgeAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number Knowledge Asset returned. " + "(1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of Knowledge Asset before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of Knowledge Asset after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include);
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getKnowledgeAssetById",
      summary = "Get a Knowledge Asset",
      description = "Get a Knowledge Asset by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Knowledge Asset",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = KnowledgeAsset.class))),
        @ApiResponse(responseCode = "404", description = "Knowledge Asset for instance {id} is not found")
      })
  public KnowledgeAsset getKnowledgeAssetById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "KnowledgeAsset Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "getKnowledgeAssetFqn",
      summary = "Get a Knowledge Asset by name",
      description = "Get a Knowledge Asset by fully qualified table name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Knowledge Asset",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = KnowledgeAsset.class))),
        @ApiResponse(responseCode = "404", description = "Knowledge Asset for instance {id} is not found")
      })
  public KnowledgeAsset getKnowledgeAssetByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the Knowledge Asset", schema = @Schema(type = "string"))
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
          Include include)
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllKnowledgeAssetVersion",
      summary = "Get List of all Knowledge Asset versions",
      description = "Get a list of all the versions of a Knowledge Asset identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Knowledge Asset versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Knowledge Asset Id", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificKnowledgeAssetVersion",
      summary = "Get a specific version of the Knowledge Asset",
      description = "Get a version of the Knowledge Asset by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "KnowledgeAsset",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = KnowledgeAsset.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Knowledge Asset for instance {id} and version {version} is " + "not found")
      })
  public KnowledgeAsset getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Knowledge Asset Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Knowledge Asset version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createKnowledgeAsset",
      summary = "Create a Knowledge Asset",
      description = "Create a Knowledge Asset under an existing entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Knowledge Asset",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = KnowledgeAssetResource.KnowledgeAssetList.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateKnowledgeAsset create)
      throws IOException {
    KnowledgeAsset KnowledgeAsset = getKnowledgeAsset(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, KnowledgeAsset);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateKnowledgeAsset",
      summary = "Create or update a Knowledge Asset",
      description =
          "Create a Knowledge Asset, if it does not exist. If a Knowledge Asset already exists, update the Knowledge Asset.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Knowledge Asset",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = KnowledgeAsset.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateKnowledgeAsset create)
      throws IOException {
    KnowledgeAsset KnowledgeAsset = getKnowledgeAsset(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, KnowledgeAsset);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchKnowledgeAsset",
      summary = "Update a KnowledgeAsset",
      description = "Update an existing KnowledgeAsset using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KnowledgeAsset", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollower",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as follower of this model",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KnowledgeAsset", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "UUID")) UUID userId)
      throws IOException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @PUT
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVote",
      summary = "Update Vote for a KnowledgeAsset",
      description = "Update vote for a KnowledgeAsset",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response updateVote(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KnowledgeAsset", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid VoteRequest request)
      throws IOException {
    return dao.updateVote(securityContext.getUserPrincipal().getName(), id, request).toResponse();
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class))),
      })
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KnowledgeAsset", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user being removed as follower", schema = @Schema(type = "UUID"))
          @PathParam("userId")
          UUID userId)
      throws IOException {
    return dao.deleteFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteKnowledgeAsset",
      summary = "Delete a KnowledgeAsset",
      description = "Delete a KnowledgeAsset by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "KnowledgeAsset for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the KnowledgeAsset", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, true);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteKnowledgeAssetByFQN",
      summary = "Delete a KnowledgeAsset",
      description = "Delete a KnowledgeAsset by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "KnowledgeAsset for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the KnowledgeAsset", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, true);
  }

  private KnowledgeAsset getKnowledgeAsset(CreateKnowledgeAsset create, String user) throws IOException {
    // TODO:
    return copy(new KnowledgeAsset(), create, user)
        .withTags(create.getTags())
        .withVotes(new Votes().withUpVotes(0).withDownVotes(0));
  }
}
