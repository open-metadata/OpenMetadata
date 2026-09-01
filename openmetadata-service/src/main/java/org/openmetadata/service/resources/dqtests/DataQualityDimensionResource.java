package org.openmetadata.service.resources.dqtests;

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
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.tests.CreateDataQualityDimension;
import org.openmetadata.schema.tests.DataQualityDimension;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.DataQualityDimensionRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Slf4j
@Path("/v1/dataQuality/dimensions")
@Tag(
    name = "Data Quality Dimensions",
    description =
        "A `Data Quality Dimension` classifies what a test is checking, such as Completeness or "
            + "Accuracy. Test definitions and test cases reference a dimension by relationship. "
            + "OpenMetadata ships a set of system dimensions that cannot be edited or deleted; "
            + "users can create their own on top of them.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "DataQualityDimensions")
public class DataQualityDimensionResource
    extends EntityResource<DataQualityDimension, DataQualityDimensionRepository> {
  private final DataQualityDimensionMapper mapper = new DataQualityDimensionMapper();
  public static final String COLLECTION_PATH = "/v1/dataQuality/dimensions/";
  static final String FIELDS = "owners";

  public DataQualityDimensionResource(Authorizer authorizer, Limits limits) {
    super(Entity.DATA_QUALITY_DIMENSION, authorizer, limits);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    repository.initSeedDataFromResourcesOnStartup();
  }

  public static class DataQualityDimensionList extends ResultList<DataQualityDimension> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listDataQualityDimensions",
      summary = "List data quality dimensions",
      description = "Get a list of data quality dimensions, system and custom alike.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of data quality dimensions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataQualityDimensionList.class)))
      })
  public ResultList<DataQualityDimension> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description =
                  "Limit the number of dimensions returned. (1 to 1000000, default = 100)")
          @DefaultValue("100")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of dimensions before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of dimensions after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, new ListFilter(include), limitParam, before, after);
  }

  @GET
  @Path("/testCaseCounts")
  @Operation(
      operationId = "getDataQualityDimensionTestCaseCounts",
      summary = "Count the test cases attached to each dimension",
      description =
          "Returns a map of dimension id to the number of test cases that reference it. The Data "
              + "Quality settings page shows this next to each dimension, and the delete "
              + "confirmation uses it to tell the user how many test cases fall back to the "
              + "dimension of their test definition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Test case count per dimension id",
            content = @Content(mediaType = "application/json"))
      })
  public Map<String, Integer> getTestCaseCounts(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    ResultList<DataQualityDimension> dimensions =
        super.listInternal(
            uriInfo, securityContext, "", new ListFilter(Include.NON_DELETED), 1000000, null, null);
    Map<String, Integer> counts = new LinkedHashMap<>();
    for (DataQualityDimension dimension : dimensions.getData()) {
      counts.put(dimension.getId().toString(), repository.getTestCaseCount(dimension.getId()));
    }
    return counts;
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDataQualityDimensionByID",
      summary = "Get a data quality dimension by Id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data quality dimension",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataQualityDimension.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Data quality dimension for instance {id} is not found")
      })
  public DataQualityDimension get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the dimension", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
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
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getDataQualityDimensionByName",
      summary = "Get a data quality dimension by name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data quality dimension",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataQualityDimension.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Data quality dimension for instance {name} is not found")
      })
  public DataQualityDimension getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the dimension", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
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
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllDataQualityDimensionVersion",
      summary = "List data quality dimension versions",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of dimension versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dimension", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificDataQualityDimensionVersion",
      summary = "Get a version of a data quality dimension",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data quality dimension",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataQualityDimension.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Data quality dimension for instance {id} and version {version} is not found")
      })
  public DataQualityDimension getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dimension", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Data quality dimension version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createDataQualityDimension",
      summary = "Create a data quality dimension",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data quality dimension",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataQualityDimension.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDataQualityDimension create) {
    DataQualityDimension dimension =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, dimension);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateDataQualityDimension",
      summary = "Update a data quality dimension",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated data quality dimension",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataQualityDimension.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDataQualityDimension create) {
    DataQualityDimension dimension =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, dimension);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDataQualityDimension",
      summary = "Update a data quality dimension",
      description = "Update an existing data quality dimension using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dimension", schema = @Schema(type = "UUID"))
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

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDataQualityDimension",
      summary = "Delete a data quality dimension",
      description =
          "Delete a custom data quality dimension by `id`. Test cases that reference it are kept: "
              + "they fall back to the dimension of their test definition. System dimensions "
              + "cannot be deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Data quality dimension for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the dimension", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteDataQualityDimensionByName",
      summary = "Delete a data quality dimension by name",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Data quality dimension for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the dimension", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return deleteByName(uriInfo, securityContext, name, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restoreDataQualityDimension",
      summary = "Restore a soft deleted data quality dimension",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the data quality dimension",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataQualityDimension.class)))
      })
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
