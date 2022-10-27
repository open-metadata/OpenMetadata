package org.openmetadata.service.resources.metadata;

import com.google.inject.Inject;
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
import org.openmetadata.schema.api.metadata.CreateMetadata;
import org.openmetadata.schema.entity.metadata.Metadata;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MetadataRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/metadata")
@Api(value = "Metadata collection", tags = "Metadata collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "metadata")
public class MetadataResource extends EntityResource<Metadata, MetadataRepository> {
  public static final String COLLECTION_PATH = MetadataRepository.COLLECTION_PATH;
  public static final String FIELDS = "owner";

  @Override
  public Metadata addHref(UriInfo uriInfo, Metadata entity) {
    entity.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, entity.getId()));
    Entity.withHref(uriInfo, entity.getOwner());
    return entity;
  }

  @Inject
  public MetadataResource(CollectionDAO dao, Authorizer authorizer) {
    super(Metadata.class, new MetadataRepository(dao), authorizer);
  }

  public static class MetadataList extends ResultList<Metadata> {
    @SuppressWarnings("unused")
    public MetadataList() {
      // Empty constructor needed for deserialization
    }

    public MetadataList(List<Metadata> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  @SuppressWarnings("unused") // Method used for reflection of webAnalyticEventTypes
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // Find the existing webAnalyticEventTypes and add them from json files
    List<Metadata> metadataEntities = dao.getEntitiesFromSeedData(".*json/data/metadata/.*\\.json$");
    for (Metadata metadata : metadataEntities) {
      dao.initializeEntity(metadata);
    }
  }

  @GET
  @Operation(
      operationId = "ListMetadataEntities",
      summary = "List metadata entities",
      tags = "Metadata",
      description = "Get a list of all metadata entities",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of metadata entities",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetadataResource.MetadataList.class)))
      })
  public ResultList<Metadata> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number metadata entities returned. (1 to 1000000, default = " + "10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(
              description = "Returns list of metadata entities before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of metadata entities after this cursor", schema = @Schema(type = "string"))
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
  @Path("/{id}/versions")
  @Operation(
      operationId = "ListMetadataEntitiesVersion",
      summary = "List metadata entity versions",
      tags = "Metadata",
      description = "Get a list of all the versions of a metadata entity identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of metadata versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Metadata entity Id", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "ListMetadataEntityById",
      summary = "Get a Metadata entity by ID",
      tags = "Metadata",
      description = "Get a metadata entity by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Metadata entity",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Metadata.class))),
        @ApiResponse(responseCode = "404", description = "Metadata for instance {id} is not found")
      })
  public Metadata get(
      @Context UriInfo uriInfo,
      @PathParam("id") UUID id,
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
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getMetadataByName",
      summary = "Get a metadata by name",
      tags = "Metadata",
      description = "Get a metadata by  name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The metadata entity",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Metadata.class))),
        @ApiResponse(responseCode = "404", description = "Metadata for instance {name} is not found")
      })
  public Metadata getByName(
      @Context UriInfo uriInfo,
      @PathParam("name") String name,
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
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificMetadataVersion",
      summary = "Get a version of the Metadata",
      tags = "Metadata",
      description = "Get a version of the metadata by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Metadata",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Metadata.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Metadata for instance {id} and version {version} is " + "not found")
      })
  public Metadata getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Metadata Id", schema = @Schema(type = "string")) @PathParam("id") UUID id,
      @Parameter(
              description = "Metadata version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createMetadata",
      summary = "Create a Metadata entity",
      tags = "Metadata",
      description = "Create a metadata entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The metadata entity",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Metadata.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateMetadata create)
      throws IOException {
    Metadata metadata = getMetadata(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, metadata);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchMetadata",
      summary = "Update a metadata entity",
      tags = "Metadata",
      description = "Update an existing metadata using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
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

  @PUT
  @Operation(
      operationId = "createOrUpdateMetadata",
      summary = "Update metadat ",
      tags = "Metadata",
      description = "Create a metadata entity, if it does not exist or update an existing metadata entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated Metadata",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Metadata.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateMetadata create)
      throws IOException {
    Metadata metadata = getMetadata(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, metadata);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteMetadata",
      summary = "Delete a metadata entity",
      tags = "Metadata",
      description = "Delete a metadata by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Metadata for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Metadata Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  private Metadata getMetadata(CreateMetadata create, String user) throws IOException {
    return copy(new Metadata(), create, user)
        .withName(create.getName())
        .withDescription(create.getDescription())
        .withDisplayName(create.getDisplayName());
  }
}
