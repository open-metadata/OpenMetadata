package org.openmetadata.service.resources.quicklink;

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
import org.openmetadata.schema.api.data.CreateQuickLink;
import org.openmetadata.schema.entity.data.QuickLink;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.QuickLinkRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@Path("/v1/quicklinks")
@Tag(
    name = "QuickLinks",
    description = "A `Quick Link` entity represents a Link entity that holds a URI to commonly used Data Assets.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "quicklinks")
public class QuickLinkResource extends EntityResource<QuickLink, QuickLinkRepository> {

  public static final String COLLECTION_PATH = "v1/quicklinks/";

  public QuickLinkResource(CollectionDAO dao, Authorizer authorizer) {
    super(QuickLink.class, new QuickLinkRepository(dao), authorizer);
  }

  @Override
  public QuickLink addHref(UriInfo uriInfo, QuickLink entity) {
    Entity.withHref(uriInfo, entity.getOwner());
    Entity.withHref(uriInfo, entity.getFollowers());
    return entity;
  }

  public static class QuickLinkList extends ResultList<QuickLink> {
    @SuppressWarnings("unused")
    public QuickLinkList() {
      /* Required for serde */
    }
  }

  static final String FIELDS = "owner,followers,votes,tags,url";

  @GET
  @Operation(
      operationId = "listQuickLinks",
      summary = "Get a list of Quick-Links",
      description =
          "Get a list of Quick-Links. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Get List of Quick-Links",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = QuickLinkResource.QuickLinkList.class)))
      })
  public ResultList<QuickLink> listQuickLinks(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number Quick-Links returned. " + "(1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of Quick-Links before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of Quick-Links after this cursor", schema = @Schema(type = "string"))
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
      operationId = "getQuickLinkById",
      summary = "Get a Quick-Links",
      description = "Get a Quick-Links by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "quick-Links",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = QuickLink.class))),
        @ApiResponse(responseCode = "404", description = "Quick-Links for instance {id} is not found")
      })
  public QuickLink getQuickLinkById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "quickLink Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "getQuickLinkFqn",
      summary = "Get a Quick-Links by name",
      description = "Get a Quick-Links by fully qualified table name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Quick-Links",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = QuickLink.class))),
        @ApiResponse(responseCode = "404", description = "Quick-Links for instance {id} is not found")
      })
  public QuickLink getQuickLinkByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the Quick-Links", schema = @Schema(type = "string"))
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
      operationId = "listAllQuickLinkVersion",
      summary = "Get List of all quick-link versions",
      description = "Get a list of all the versions of a quick-link identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of quick-link versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Quick-Link Id", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificQuickLinkVersion",
      summary = "Get a specific version of the quick-link",
      description = "Get a version of the quick-link by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "quickLink",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = QuickLink.class))),
        @ApiResponse(
            responseCode = "404",
            description = "quick-link for instance {id} and version {version} is " + "not found")
      })
  public QuickLink getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Quick-Link Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Quick-Link version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createQuickLink",
      summary = "Create a Quick Link",
      description = "Create a Quick Link under an existing entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Quick-Link",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = QuickLinkResource.QuickLinkList.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateQuickLink create)
      throws IOException {
    QuickLink quickLink = getQuickLink(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, quickLink);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateQuickLink",
      summary = "Create or update a quick-link",
      description = "Create a quick-link, if it does not exist. If a Quick Link already exists, update the Quick Link.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The quick-link",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = QuickLink.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateQuickLink create)
      throws IOException {
    QuickLink quickLink = getQuickLink(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, quickLink);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchQuickLink",
      summary = "Update a QuickLink",
      description = "Update an existing QuickLink using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the QuickLink", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      @Parameter(description = "Id of the QuickLink", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "UUID")) UUID userId)
      throws IOException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @PUT
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVote",
      summary = "Update Vote for a QuickLink",
      description = "Update vote for a QuickLink",
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
      @Parameter(description = "Id of the QuickLink", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      @Parameter(description = "Id of the QuickLink", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user being removed as follower", schema = @Schema(type = "UUID"))
          @PathParam("userId")
          UUID userId)
      throws IOException {
    return dao.deleteFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteQuickLink",
      summary = "Delete a QuickLink",
      description = "Delete a QuickLink by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "QuickLink for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the QuickLink", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, true);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteQuickLinkByFQN",
      summary = "Delete a QuickLink",
      description = "Delete a QuickLink by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "QuickLink for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the QuickLink", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, true);
  }

  private QuickLink getQuickLink(CreateQuickLink create, String user) throws IOException {
    return copy(new QuickLink(), create, user)
        .withTags(create.getTags())
        .withVotes(new Votes().withUpVotes(0).withDownVotes(0))
        .withUrl(create.getUrl());
  }
}
