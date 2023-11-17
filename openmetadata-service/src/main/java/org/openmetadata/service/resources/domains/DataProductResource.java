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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.ArrayList;
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
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/dataProducts")
@Tag(
    name = "Domains",
    description =
        "A `Data Product` or `Data as a Product` is a logical unit that contains all components to process and store "
            + "domain data for analytical or data-intensive use cases made available to data consumers.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "dataProducts", order = 4) // initialize after user resource
public class DataProductResource extends EntityResource<DataProduct, DataProductRepository> {
  public static final String COLLECTION_PATH = "/v1/dataProducts/";
  static final String FIELDS = "domain,owner,experts,assets";

  public DataProductResource(Authorizer authorizer) {
    super(Entity.DATA_PRODUCT, authorizer);
  }

  @Override
  public DataProduct addHref(UriInfo uriInfo, DataProduct dataProduct) {
    super.addHref(uriInfo, dataProduct);
    Entity.withHref(uriInfo, dataProduct.getAssets());
    return dataProduct;
  }

  public static class DataProductList extends ResultList<DataProduct> {
    @SuppressWarnings("unused")
    public DataProductList() {
      /* Required for serde */
    }
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
                @Content(mediaType = "application/json", schema = @Schema(implementation = DataProductList.class)))
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
      @DefaultValue("10") @Min(0) @Max(1000000) @QueryParam("limit") int limitParam,
      @Parameter(description = "Returns list of DataProduct before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of DataProduct after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after) {
    ListFilter filter = new ListFilter(null);
    if (!nullOrEmpty(domain)) {
      EntityReference domainReference = Entity.getEntityReferenceByName(Entity.DOMAIN, domain, Include.NON_DELETED);
      filter.addQueryParam("domainId", domainReference.getId().toString());
    }
    return listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(responseCode = "404", description = "DataProduct for instance {id} is not found")
      })
  public DataProduct get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Id of the dataProduct", schema = @Schema(type = "UUID")) @PathParam("id") UUID id) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, null);
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(responseCode = "404", description = "DataProduct for instance {name} is not found")
      })
  public DataProduct getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the dataProduct", schema = @Schema(type = "string")) @PathParam("name")
          String name,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, null);
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dataProduct", schema = @Schema(type = "UUID")) @PathParam("id") UUID id) {
    return super.listVersionsInternal(securityContext, id);
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {id} and version {version} is " + "not found")
      })
  public DataProduct getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dataProduct", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "DataProduct version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
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
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDataProduct create) {
    DataProduct dataProduct = getDataProduct(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, dataProduct);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateDataProduct",
      summary = "Create or update a dataProduct",
      description =
          "Create a dataProduct. if it does not exist. If a dataProduct already exists, update the " + "dataProduct.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The dataProduct",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDataProduct create) {
    DataProduct dataProduct = getDataProduct(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, dataProduct);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDataProduct",
      summary = "Update a dataProduct",
      description = "Update an existing dataProduct using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dataProduct", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDataProduct",
      summary = "Delete a dataProduct by Id",
      description = "Delete a dataProduct by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "DataProduct for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the dataProduct", schema = @Schema(type = "UUID")) @PathParam("id") UUID id) {
    return delete(uriInfo, securityContext, id, true, true);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteDataProductByFQN",
      summary = "Delete a dataProduct by name",
      description = "Delete a dataProduct by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "DataProduct for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the dataProduct", schema = @Schema(type = "string")) @PathParam("name")
          String name) {
    return deleteByName(uriInfo, securityContext, name, true, true);
  }

  private DataProduct getDataProduct(CreateDataProduct create, String user) {
    List<String> experts = create.getExperts();
    DataProduct dataProduct =
        repository
            .copy(new DataProduct(), create, user)
            .withFullyQualifiedName(create.getName())
            .withStyle(create.getStyle())
            .withExperts(EntityUtil.populateEntityReferences(getEntityReferences(Entity.USER, experts)));
    dataProduct.withAssets(new ArrayList<>());
    for (EntityReference asset : listOrEmpty(create.getAssets())) {
      asset = Entity.getEntityReference(asset, Include.NON_DELETED);
      dataProduct.getAssets().add(asset);
      dataProduct.getAssets().sort(EntityUtil.compareEntityReference);
    }
    return dataProduct;
  }
}
