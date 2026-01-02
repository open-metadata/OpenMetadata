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

package org.openmetadata.service.resources.domains;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.services.domains.DataProductService.FIELDS;

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
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.services.domains.DataProductService;

@Slf4j
@Path("/v1/dataProducts")
@Tag(
    name = "Domains",
    description =
        "A `Data Product` or `Data as a Product` is a logical unit that contains all components to process and store "
            + "domain data for analytical or data-intensive use cases made available to data consumers.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "dataProducts", order = 4)
public class DataProductResource {
  public static final String COLLECTION_PATH = "/v1/dataProducts/";
  private final DataProductService service;

  public DataProductResource(DataProductService service) {
    this.service = service;
  }

  @GET
  @Operation(
      operationId = "listDataProducts",
      summary = "List dataProducts",
      description = "Get a list of DataProducts.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of DataProducts",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataProductService.DataProductList.class)))
      })
  public ResultList<DataProduct> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter data products by domain name",
              schema = @Schema(type = "string", example = "marketing"))
          @QueryParam("domain")
          String domain,
      @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of DataProduct before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of DataProduct after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after) {
    ListFilter filter = new ListFilter(null);
    if (!nullOrEmpty(domain)) {
      EntityReference domainReference =
          Entity.getEntityReferenceByName(Entity.DOMAIN, domain, Include.NON_DELETED);
      filter.addQueryParam("domainId", String.format("'%s'", domainReference.getId()));
    }
    return service.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDataProductByID",
      summary = "Get a dataProduct by Id",
      description = "Get a dataProduct by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dataProduct",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {id} is not found")
      })
  public DataProduct get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Id of the dataProduct", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return service.getInternal(uriInfo, securityContext, id, fieldsParam, null);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getDataProductByFQN",
      summary = "Get a dataProduct by name",
      description = "Get a dataProduct by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "dataProduct",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {name} is not found")
      })
  public DataProduct getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the dataProduct", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    return service.getByNameInternal(uriInfo, securityContext, name, fieldsParam, null);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllDataProductVersion",
      summary = "List dataProduct versions",
      description = "Get a list of all the versions of a dataProduct identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of dataProduct versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dataProduct", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return service.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "listSpecificDataProductVersion",
      summary = "Get a version of the dataProduct",
      description = "Get a version of the dataProduct by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "dataProduct",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {id} and version {version} is not found")
      })
  public DataProduct getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dataProduct", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "DataProduct version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return service.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createDataProduct",
      summary = "Create a dataProduct",
      description = "Create a new dataProduct.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dataProduct ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @RequestBody(
              description = "CreateDataProduct request",
              content =
                  @Content(
                      mediaType = "application/json",
                      schema = @Schema(implementation = CreateDataProduct.class)))
          @Valid
          CreateDataProduct create) {
    DataProduct dataProduct =
        service.getMapper().createToEntity(create, securityContext.getUserPrincipal().getName());
    return service.create(uriInfo, securityContext, dataProduct);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateDataProduct",
      summary = "Create or update a dataProduct",
      description =
          "Create a dataProduct. if it does not exist. If a dataProduct already exists, update the dataProduct.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dataProduct",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @RequestBody(
              description = "CreateDataProduct request",
              content =
                  @Content(
                      mediaType = "application/json",
                      schema = @Schema(implementation = CreateDataProduct.class)))
          @Valid
          CreateDataProduct create) {
    DataProduct dataProduct =
        service.getMapper().createToEntity(create, securityContext.getUserPrincipal().getName());
    return service.createOrUpdate(uriInfo, securityContext, dataProduct);
  }

  @PUT
  @Path("/{name}/assets/add")
  @Operation(
      operationId = "bulkAddAssets",
      summary = "Bulk Add Assets",
      description = "Bulk Add Assets",
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
  public Response bulkAddAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Data product", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    return Response.ok().entity(service.bulkAddAssets(securityContext, name, request)).build();
  }

  @PUT
  @Path("/{name}/assets/remove")
  @Operation(
      operationId = "bulkRemoveAssets",
      summary = "Bulk Remove Assets",
      description = "Bulk Remove Assets",
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
  public Response bulkRemoveAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Data Product", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    return Response.ok().entity(service.bulkRemoveAssets(securityContext, name, request)).build();
  }

  @PUT
  @Path("/{name}/inputPorts/add")
  @Operation(
      operationId = "bulkAddInputPorts",
      summary = "Bulk Add Input Ports",
      description = "Bulk Add Input Ports to a Data Product",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {name} is not found")
      })
  public Response bulkAddInputPorts(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Data Product", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    return Response.ok().entity(service.bulkAddInputPorts(securityContext, name, request)).build();
  }

  @PUT
  @Path("/{name}/inputPorts/remove")
  @Operation(
      operationId = "bulkRemoveInputPorts",
      summary = "Bulk Remove Input Ports",
      description = "Bulk Remove Input Ports from a Data Product",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {name} is not found")
      })
  public Response bulkRemoveInputPorts(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Data Product", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    return Response.ok()
        .entity(service.bulkRemoveInputPorts(securityContext, name, request))
        .build();
  }

  @PUT
  @Path("/{name}/outputPorts/add")
  @Operation(
      operationId = "bulkAddOutputPorts",
      summary = "Bulk Add Output Ports",
      description = "Bulk Add Output Ports to a Data Product",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {name} is not found")
      })
  public Response bulkAddOutputPorts(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Data Product", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    return Response.ok().entity(service.bulkAddOutputPorts(securityContext, name, request)).build();
  }

  @PUT
  @Path("/{name}/outputPorts/remove")
  @Operation(
      operationId = "bulkRemoveOutputPorts",
      summary = "Bulk Remove Output Ports",
      description = "Bulk Remove Output Ports from a Data Product",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {name} is not found")
      })
  public Response bulkRemoveOutputPorts(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Data Product", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    return Response.ok()
        .entity(service.bulkRemoveOutputPorts(securityContext, name, request))
        .build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDataProduct",
      summary = "Update a dataProduct",
      description = "Update an existing dataProduct using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dataProduct", schema = @Schema(type = "UUID"))
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
    return service.patchInternal(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchDataProduct",
      summary = "Update a dataProduct by name.",
      description = "Update an existing dataProduct using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the dataProduct", schema = @Schema(type = "string"))
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
    return service.patchInternal(uriInfo, securityContext, fqn, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDataProduct",
      summary = "Delete a dataProduct by Id",
      description = "Delete a dataProduct by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dataProduct", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return service.delete(uriInfo, securityContext, id, true, true);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteDataProductAsync",
      summary = "Asynchronously delete a dataProduct by Id",
      description = "Asynchronously delete a dataProduct by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dataProduct", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return service.deleteByIdAsync(uriInfo, securityContext, id, true, true);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteDataProductByFQN",
      summary = "Delete a dataProduct by name",
      description = "Delete a dataProduct by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the dataProduct", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return service.deleteByName(uriInfo, securityContext, name, true, true);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToDataProduct",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as followed of this DataProduct",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the DataProduct", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "UUID"))
          UUID userId) {
    return service.addDataProductFollower(securityContext, id, userId).toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollowerFromDataProduct",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the dataProduct.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class)))
      })
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "UUID"))
          @PathParam("userId")
          UUID userId) {
    return service.deleteDataProductFollower(securityContext, id, userId).toResponse();
  }

  @GET
  @Path("/{id}/assets")
  @Operation(
      operationId = "getDataProductAssets",
      summary = "Get assets for a data product",
      description = "Get paginated list of assets belonging to a data product.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of assets",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResultList.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {id} is not found")
      })
  public Response getAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data product", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description =
                  "Limit the number of results returned. Maximum of 1000 records will be returned in a single request.",
              schema = @Schema(type = "integer", defaultValue = "10"))
          @QueryParam("limit")
          @DefaultValue("10")
          @Min(1)
          @Max(1000)
          int limit,
      @Parameter(
              description = "Offset from which to start returning results",
              schema = @Schema(type = "integer", defaultValue = "0"))
          @QueryParam("offset")
          @DefaultValue("0")
          @Min(0)
          int offset) {
    return Response.ok(service.getDataProductAssets(id, limit, offset)).build();
  }

  @GET
  @Path("/name/{fqn}/assets")
  @Operation(
      operationId = "getDataProductAssetsByName",
      summary = "Get assets for a data product by name",
      description =
          "Get paginated list of assets belonging to a data product by data product name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of assets",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResultList.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {name} is not found")
      })
  public Response getAssetsByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the data product", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description =
                  "Limit the number of results returned. Maximum of 1000 records will be returned in a single request.",
              schema = @Schema(type = "integer", defaultValue = "10"))
          @QueryParam("limit")
          @DefaultValue("10")
          @Min(1)
          @Max(1000)
          int limit,
      @Parameter(
              description = "Offset from which to start returning results",
              schema = @Schema(type = "integer", defaultValue = "0"))
          @QueryParam("offset")
          @DefaultValue("0")
          @Min(0)
          int offset) {
    return Response.ok(service.getDataProductAssetsByName(fqn, limit, offset)).build();
  }

  @GET
  @Path("/assets/counts")
  @Operation(
      operationId = "getAllDataProductsWithAssetsCount",
      summary = "Get all data products with their asset counts",
      description =
          "Get a map of data product fully qualified names to their asset counts using search aggregation.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Map of data product FQN to asset count",
            content = @Content(mediaType = "application/json"))
      })
  public Response getAllDataProductsWithAssetsCount(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    java.util.Map<String, Integer> result = service.getAllDataProductsWithAssetsCount();
    return Response.ok(result).build();
  }
}
