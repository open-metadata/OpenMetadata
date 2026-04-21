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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
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
import jakarta.ws.rs.BadRequestException;
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
import org.openmetadata.schema.api.domains.DataProductPortsView;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.odps.ODPSDataProduct;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.ODPSConverter;

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
  private final DataProductMapper mapper = new DataProductMapper();
  static final String FIELDS =
      "domains,owners,reviewers,experts,extension,tags,followers,votes,certification";
  static final String PORT_FIELDS =
      "owners,tags,followers,domains,votes,extension"; // Common fields across all entity types
  static final String EXPORT_FIELDS =
      "domains,owners,reviewers,experts,extension,tags,followers,votes,certification,sla";

  private static final ObjectMapper JSON_MAPPER = new ObjectMapper();
  private static final ObjectMapper YAML_MAPPER =
      new ObjectMapper(new YAMLFactory())
          .setSerializationInclusion(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL);

  public DataProductResource(Authorizer authorizer, Limits limits) {
    super(Entity.DATA_PRODUCT, authorizer, limits);
  }

  @Override
  public DataProduct addHref(UriInfo uriInfo, DataProduct dataProduct) {
    super.addHref(uriInfo, dataProduct);
    return dataProduct;
  }

  private static final java.util.Set<String> ALLOWED_PORT_FIELDS =
      java.util.Set.of(PORT_FIELDS.split(","));

  private Response buildBulkOperationResponse(BulkOperationResult result) {
    if (result.getStatus() == ApiStatus.FAILURE) {
      return Response.status(Response.Status.BAD_REQUEST).entity(result).build();
    }
    return Response.ok().entity(result).build();
  }

  private void validatePortFields(String fieldsParam) {
    if (nullOrEmpty(fieldsParam)) {
      return;
    }
    for (String field : fieldsParam.split(",")) {
      String trimmedField = field.trim();
      if (!trimmedField.isEmpty() && !ALLOWED_PORT_FIELDS.contains(trimmedField)) {
        throw new BadRequestException(
            String.format("Invalid field '%s'. Allowed fields are: %s", trimmedField, PORT_FIELDS));
      }
    }
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
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataProductList.class)))
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
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, dataProduct);
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
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, dataProduct);
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
        @ApiResponse(
            responseCode = "400",
            description = "All operations failed",
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
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return buildBulkOperationResponse(
        repository.bulkAddAssets(name, request, securityContext.getUserPrincipal().getName()));
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
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "400",
            description = "All operations failed",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response bulkRemoveAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Data Product", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return buildBulkOperationResponse(
        repository.bulkRemoveAssets(name, request, securityContext.getUserPrincipal().getName()));
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
            responseCode = "400",
            description = "All operations failed",
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
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return buildBulkOperationResponse(repository.bulkAddInputPorts(name, request));
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
            responseCode = "400",
            description = "All operations failed",
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
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return buildBulkOperationResponse(repository.bulkRemoveInputPorts(name, request));
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
            responseCode = "400",
            description = "All operations failed",
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
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return buildBulkOperationResponse(repository.bulkAddOutputPorts(name, request));
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
            responseCode = "400",
            description = "All operations failed",
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
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return buildBulkOperationResponse(repository.bulkRemoveOutputPorts(name, request));
  }

  @PUT
  @Path("/name/{fqn}/inputPorts/add")
  @Operation(
      operationId = "bulkAddInputPortsByName",
      summary = "Bulk Add Input Ports by Name",
      description = "Bulk Add Input Ports to a Data Product by fully qualified name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "400",
            description = "All operations failed",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {fqn} is not found")
      })
  public Response bulkAddInputPortsByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the Data Product",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Valid BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return buildBulkOperationResponse(repository.bulkAddInputPorts(fqn, request));
  }

  @PUT
  @Path("/name/{fqn}/inputPorts/remove")
  @Operation(
      operationId = "bulkRemoveInputPortsByName",
      summary = "Bulk Remove Input Ports by Name",
      description = "Bulk Remove Input Ports from a Data Product by fully qualified name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "400",
            description = "All operations failed",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {fqn} is not found")
      })
  public Response bulkRemoveInputPortsByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the Data Product",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Valid BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return buildBulkOperationResponse(repository.bulkRemoveInputPorts(fqn, request));
  }

  @PUT
  @Path("/name/{fqn}/outputPorts/add")
  @Operation(
      operationId = "bulkAddOutputPortsByName",
      summary = "Bulk Add Output Ports by Name",
      description = "Bulk Add Output Ports to a Data Product by fully qualified name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "400",
            description = "All operations failed",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {fqn} is not found")
      })
  public Response bulkAddOutputPortsByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the Data Product",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Valid BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return buildBulkOperationResponse(repository.bulkAddOutputPorts(fqn, request));
  }

  @PUT
  @Path("/name/{fqn}/outputPorts/remove")
  @Operation(
      operationId = "bulkRemoveOutputPortsByName",
      summary = "Bulk Remove Output Ports by Name",
      description = "Bulk Remove Output Ports from a Data Product by fully qualified name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "400",
            description = "All operations failed",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {fqn} is not found")
      })
  public Response bulkRemoveOutputPortsByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the Data Product",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Valid BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return buildBulkOperationResponse(repository.bulkRemoveOutputPorts(fqn, request));
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
    return patchInternal(uriInfo, securityContext, id, patch);
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
    return patchInternal(uriInfo, securityContext, fqn, patch);
  }

  @GET
  @Path("/{id}/dataContract")
  @Operation(
      operationId = "getDataProductContract",
      summary = "Get data contract for a data product",
      description = "Get the data contract associated with a data product.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(
                            implementation =
                                org.openmetadata.schema.entity.data.DataContract.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Data contract not found for the data product")
      })
  public Response getDataContract(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data product", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string"))
          @QueryParam("fields")
          String fieldsParam) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));

    org.openmetadata.schema.entity.data.DataContract dataContract =
        repository.getDataProductContract(id);

    if (dataContract == null) {
      throw EntityNotFoundException.byMessage(
          String.format("Data contract for data product %s not found", id));
    }

    return Response.ok(dataContract).build();
  }

  @PUT
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVoteForEntity",
      summary = "Update Vote for an Entity",
      description = "Update vote for an Entity",
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
      @Valid org.openmetadata.schema.api.VoteRequest request) {
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
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
    return delete(uriInfo, securityContext, id, true, true);
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
    return deleteByIdAsync(uriInfo, securityContext, id, true, true);
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
    return deleteByName(uriInfo, securityContext, name, true, true);
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
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the DataProduct", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "string"))
          UUID userId) {
    return repository
        .addFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
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
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId) {
    return repository
        .deleteFollower(securityContext.getUserPrincipal().getName(), id, UUID.fromString(userId))
        .toResponse();
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
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return Response.ok(repository.getDataProductAssets(id, limit, offset)).build();
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
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return Response.ok(repository.getDataProductAssetsByName(fqn, limit, offset)).build();
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
    java.util.Map<String, Integer> result = repository.getAllDataProductsWithAssetsCount();
    return Response.ok(result).build();
  }

  @GET
  @Path("/{id}/inputPorts")
  @Operation(
      operationId = "getInputPorts",
      summary = "Get input ports for a data product",
      description = "Get paginated list of input ports (data assets consumed) for a data product.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of input ports",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResultList.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {id} is not found")
      })
  public Response getInputPorts(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data product", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = PORT_FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Limit the number of results returned",
              schema = @Schema(type = "integer", defaultValue = "50"))
          @QueryParam("limit")
          @DefaultValue("50")
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
    validatePortFields(fieldsParam);
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return Response.ok(repository.getPaginatedInputPorts(id, fieldsParam, limit, offset)).build();
  }

  @GET
  @Path("/name/{fqn}/inputPorts")
  @Operation(
      operationId = "getInputPortsByName",
      summary = "Get input ports for a data product by name",
      description =
          "Get paginated list of input ports (data assets consumed) for a data product by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of input ports",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResultList.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {fqn} is not found")
      })
  public Response getInputPortsByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the data product", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = PORT_FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Limit the number of results returned",
              schema = @Schema(type = "integer", defaultValue = "50"))
          @QueryParam("limit")
          @DefaultValue("50")
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
    validatePortFields(fieldsParam);
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return Response.ok(repository.getPaginatedInputPortsByName(fqn, fieldsParam, limit, offset))
        .build();
  }

  @GET
  @Path("/{id}/outputPorts")
  @Operation(
      operationId = "getOutputPorts",
      summary = "Get output ports for a data product",
      description =
          "Get paginated list of output ports (data assets produced/exposed) for a data product.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of output ports",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResultList.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {id} is not found")
      })
  public Response getOutputPorts(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data product", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = PORT_FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Limit the number of results returned",
              schema = @Schema(type = "integer", defaultValue = "50"))
          @QueryParam("limit")
          @DefaultValue("50")
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
    validatePortFields(fieldsParam);
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return Response.ok(repository.getPaginatedOutputPorts(id, fieldsParam, limit, offset)).build();
  }

  @GET
  @Path("/name/{fqn}/outputPorts")
  @Operation(
      operationId = "getOutputPortsByName",
      summary = "Get output ports for a data product by name",
      description =
          "Get paginated list of output ports (data assets produced/exposed) for a data product by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of output ports",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResultList.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {fqn} is not found")
      })
  public Response getOutputPortsByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the data product", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = PORT_FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Limit the number of results returned",
              schema = @Schema(type = "integer", defaultValue = "50"))
          @QueryParam("limit")
          @DefaultValue("50")
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
    validatePortFields(fieldsParam);
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return Response.ok(repository.getPaginatedOutputPortsByName(fqn, fieldsParam, limit, offset))
        .build();
  }

  @GET
  @Path("/{id}/portsView")
  @Operation(
      operationId = "getPortsView",
      summary = "Get combined input/output ports view for a data product",
      description =
          "Get a combined view of input and output ports with independent pagination, "
              + "optimized for lineage-like visualization.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Combined ports view",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataProductPortsView.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {id} is not found")
      })
  public Response getPortsView(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data product", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = PORT_FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Limit the number of input ports returned",
              schema = @Schema(type = "integer", defaultValue = "50"))
          @QueryParam("inputLimit")
          @DefaultValue("50")
          @Min(1)
          @Max(1000)
          int inputLimit,
      @Parameter(
              description = "Offset for input ports pagination",
              schema = @Schema(type = "integer", defaultValue = "0"))
          @QueryParam("inputOffset")
          @DefaultValue("0")
          @Min(0)
          int inputOffset,
      @Parameter(
              description = "Limit the number of output ports returned",
              schema = @Schema(type = "integer", defaultValue = "50"))
          @QueryParam("outputLimit")
          @DefaultValue("50")
          @Min(1)
          @Max(1000)
          int outputLimit,
      @Parameter(
              description = "Offset for output ports pagination",
              schema = @Schema(type = "integer", defaultValue = "0"))
          @QueryParam("outputOffset")
          @DefaultValue("0")
          @Min(0)
          int outputOffset) {
    validatePortFields(fieldsParam);
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return Response.ok(
            repository.getPortsView(
                id, fieldsParam, inputLimit, inputOffset, outputLimit, outputOffset))
        .build();
  }

  @GET
  @Path("/name/{fqn}/portsView")
  @Operation(
      operationId = "getPortsViewByName",
      summary = "Get combined input/output ports view for a data product by name",
      description =
          "Get a combined view of input and output ports with independent pagination by name, "
              + "optimized for lineage-like visualization.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Combined ports view",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataProductPortsView.class))),
        @ApiResponse(
            responseCode = "404",
            description = "DataProduct for instance {fqn} is not found")
      })
  public Response getPortsViewByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the data product", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = PORT_FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Limit the number of input ports returned",
              schema = @Schema(type = "integer", defaultValue = "50"))
          @QueryParam("inputLimit")
          @DefaultValue("50")
          @Min(1)
          @Max(1000)
          int inputLimit,
      @Parameter(
              description = "Offset for input ports pagination",
              schema = @Schema(type = "integer", defaultValue = "0"))
          @QueryParam("inputOffset")
          @DefaultValue("0")
          @Min(0)
          int inputOffset,
      @Parameter(
              description = "Limit the number of output ports returned",
              schema = @Schema(type = "integer", defaultValue = "50"))
          @QueryParam("outputLimit")
          @DefaultValue("50")
          @Min(1)
          @Max(1000)
          int outputLimit,
      @Parameter(
              description = "Offset for output ports pagination",
              schema = @Schema(type = "integer", defaultValue = "0"))
          @QueryParam("outputOffset")
          @DefaultValue("0")
          @Min(0)
          int outputOffset) {
    validatePortFields(fieldsParam);
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return Response.ok(
            repository.getPortsViewByName(
                fqn, fieldsParam, inputLimit, inputOffset, outputLimit, outputOffset))
        .build();
  }

  // ---------------------------------------------------------------------------
  // ODPS (Open Data Product Standard) v4.1 Import/Export APIs
  // ---------------------------------------------------------------------------

  @GET
  @Path("/{id}/odps")
  @Operation(
      operationId = "exportDataProductToODPS",
      summary = "Export data product to ODPS v4.1 format",
      description = "Export a data product to Open Data Product Standard (ODPS) v4.1 JSON format.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "ODPS data product",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ODPSDataProduct.class))),
        @ApiResponse(responseCode = "404", description = "Data product not found")
      })
  public ODPSDataProduct exportToODPS(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data product", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    DataProduct dataProduct =
        getInternal(uriInfo, securityContext, id, EXPORT_FIELDS, Include.NON_DELETED);
    return ODPSConverter.toODPS(dataProduct);
  }

  @GET
  @Path("/{id}/odps/yaml")
  @Produces({"application/yaml", "text/yaml"})
  @Operation(
      operationId = "exportDataProductToODPSYaml",
      summary = "Export data product to ODPS v4.1 YAML format",
      description = "Export a data product to Open Data Product Standard (ODPS) v4.1 YAML format.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "ODPS data product in YAML format",
            content = @Content(mediaType = "application/yaml")),
        @ApiResponse(responseCode = "404", description = "Data product not found")
      })
  public Response exportToODPSYaml(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data product", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    DataProduct dataProduct =
        getInternal(uriInfo, securityContext, id, EXPORT_FIELDS, Include.NON_DELETED);
    ODPSDataProduct odps = ODPSConverter.toODPS(dataProduct);
    try {
      return Response.ok(YAML_MAPPER.writeValueAsString(odps), "application/yaml").build();
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Failed to convert to YAML: " + e.getMessage(), e);
    }
  }

  @GET
  @Path("/name/{fqn}/odps")
  @Operation(
      operationId = "exportDataProductToODPSByFQN",
      summary = "Export data product to ODPS v4.1 format by FQN",
      description =
          "Export a data product to Open Data Product Standard (ODPS) v4.1 JSON format by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "ODPS data product",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ODPSDataProduct.class))),
        @ApiResponse(responseCode = "404", description = "Data product not found")
      })
  public ODPSDataProduct exportToODPSByFqn(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the data product",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    DataProduct dataProduct =
        getByNameInternal(uriInfo, securityContext, fqn, EXPORT_FIELDS, Include.NON_DELETED);
    return ODPSConverter.toODPS(dataProduct);
  }

  @GET
  @Path("/name/{fqn}/odps/yaml")
  @Produces("application/yaml")
  @Operation(
      operationId = "exportDataProductToODPSYamlByFQN",
      summary = "Export data product to ODPS v4.1 YAML format by FQN",
      description =
          "Export a data product to Open Data Product Standard (ODPS) v4.1 YAML format by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "ODPS data product in YAML format",
            content = @Content(mediaType = "application/yaml", schema = @Schema(type = "string"))),
        @ApiResponse(responseCode = "404", description = "Data product not found")
      })
  public Response exportToODPSYamlByFqn(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the data product",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    DataProduct dataProduct =
        getByNameInternal(uriInfo, securityContext, fqn, EXPORT_FIELDS, Include.NON_DELETED);
    ODPSDataProduct odps = ODPSConverter.toODPS(dataProduct);
    try {
      return Response.ok(YAML_MAPPER.writeValueAsString(odps), "application/yaml").build();
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Failed to convert to YAML: " + e.getMessage(), e);
    }
  }

  @POST
  @Path("/odps")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "importDataProductFromODPS",
      summary = "Import data product from ODPS v4.1 JSON",
      description =
          "Import a data product from Open Data Product Standard (ODPS) v4.1 JSON format. Creates a new data product.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The imported data product",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response importFromODPS(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "FQN of a Domain this product belongs to",
              schema = @Schema(type = "string"))
          @QueryParam("domain")
          String domainFqn,
      @Parameter(
              description = "ISO 639-1 language code to import (default 'en')",
              schema = @Schema(type = "string", defaultValue = "en"))
          @QueryParam("languageCode")
          String languageCode,
      String jsonContent) {
    try {
      ODPSDataProduct odps = JSON_MAPPER.readValue(jsonContent, ODPSDataProduct.class);
      DataProduct dataProduct = buildDataProductFromODPS(odps, languageCode, domainFqn);
      dataProduct.setUpdatedBy(securityContext.getUserPrincipal().getName());
      dataProduct.setUpdatedAt(System.currentTimeMillis());
      return create(uriInfo, securityContext, dataProduct);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid ODPS JSON content: " + e.getMessage(), e);
    }
  }

  @POST
  @Path("/odps/yaml")
  @Consumes({"application/yaml", "text/yaml"})
  @Operation(
      operationId = "importDataProductFromODPSYaml",
      summary = "Import data product from ODPS v4.1 YAML",
      description =
          "Import a data product from Open Data Product Standard (ODPS) v4.1 YAML format. Creates a new data product.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The imported data product",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response importFromODPSYaml(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "FQN of a Domain this product belongs to",
              schema = @Schema(type = "string"))
          @QueryParam("domain")
          String domainFqn,
      @Parameter(
              description = "ISO 639-1 language code to import (default 'en')",
              schema = @Schema(type = "string", defaultValue = "en"))
          @QueryParam("languageCode")
          String languageCode,
      String yamlContent) {
    try {
      ODPSDataProduct odps = YAML_MAPPER.readValue(yamlContent, ODPSDataProduct.class);
      DataProduct dataProduct = buildDataProductFromODPS(odps, languageCode, domainFqn);
      dataProduct.setUpdatedBy(securityContext.getUserPrincipal().getName());
      dataProduct.setUpdatedAt(System.currentTimeMillis());
      return create(uriInfo, securityContext, dataProduct);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid ODPS YAML content: " + e.getMessage(), e);
    }
  }

  @PUT
  @Path("/odps")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "createOrUpdateDataProductFromODPS",
      summary = "Create or smart-merge a data product from ODPS v4.1 JSON",
      description =
          "Create a data product if it doesn't exist, or smart-merge an ODPS v4.1 document into an existing data product. Governance-workflow-driven fields (lifecycleStage, entityStatus) are preserved from the existing product.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The created or merged data product",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdateFromODPS(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "FQN of a Domain this product belongs to",
              schema = @Schema(type = "string"))
          @QueryParam("domain")
          String domainFqn,
      @Parameter(
              description = "Merge strategy (merge|replace)",
              schema = @Schema(type = "string", defaultValue = "merge"))
          @QueryParam("strategy")
          @DefaultValue("merge")
          String strategy,
      @Parameter(
              description = "ISO 639-1 language code to import (default 'en')",
              schema = @Schema(type = "string", defaultValue = "en"))
          @QueryParam("languageCode")
          String languageCode,
      String jsonContent) {
    try {
      ODPSDataProduct odps = JSON_MAPPER.readValue(jsonContent, ODPSDataProduct.class);
      return mergeOrCreateDataProductFromODPS(
          uriInfo, securityContext, odps, languageCode, domainFqn, strategy);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid ODPS JSON content: " + e.getMessage(), e);
    }
  }

  @PUT
  @Path("/odps/yaml")
  @Consumes({"application/yaml", "text/yaml"})
  @Operation(
      operationId = "createOrUpdateDataProductFromODPSYaml",
      summary = "Create or smart-merge a data product from ODPS v4.1 YAML",
      description =
          "Create a data product if it doesn't exist, or smart-merge an ODPS v4.1 YAML document into an existing data product.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The created or merged data product",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataProduct.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdateFromODPSYaml(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "FQN of a Domain this product belongs to",
              schema = @Schema(type = "string"))
          @QueryParam("domain")
          String domainFqn,
      @Parameter(
              description = "Merge strategy (merge|replace)",
              schema = @Schema(type = "string", defaultValue = "merge"))
          @QueryParam("strategy")
          @DefaultValue("merge")
          String strategy,
      @Parameter(
              description = "ISO 639-1 language code to import (default 'en')",
              schema = @Schema(type = "string", defaultValue = "en"))
          @QueryParam("languageCode")
          String languageCode,
      String yamlContent) {
    try {
      ODPSDataProduct odps = YAML_MAPPER.readValue(yamlContent, ODPSDataProduct.class);
      return mergeOrCreateDataProductFromODPS(
          uriInfo, securityContext, odps, languageCode, domainFqn, strategy);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid ODPS YAML content: " + e.getMessage(), e);
    }
  }

  @POST
  @Path("/odps/validate/yaml")
  @Consumes({"application/yaml", "text/yaml"})
  @Operation(
      operationId = "validateDataProductODPSYaml",
      summary = "Validate an ODPS v4.1 YAML document without importing",
      description =
          "Parse an ODPS v4.1 YAML document and validate its required fields without creating or modifying any data product.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Validation result",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "400", description = "Validation failed")
      })
  public Response validateODPSYaml(String yamlContent) {
    try {
      ODPSDataProduct odps = YAML_MAPPER.readValue(yamlContent, ODPSDataProduct.class);
      ODPSConverter.validateRequiredODPSFields(odps);
      JsonNode summary = summarizeODPS(odps);
      return Response.ok(summary).build();
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid ODPS YAML content: " + e.getMessage(), e);
    }
  }

  // ---------------------------------------------------------------------------
  // ODPS helper methods
  // ---------------------------------------------------------------------------

  private DataProduct buildDataProductFromODPS(
      ODPSDataProduct odps, String languageCode, String domainFqn) {
    DataProduct dp = ODPSConverter.fromODPS(odps, languageCode);
    if (domainFqn != null && !domainFqn.isBlank()) {
      dp.setDomains(
          java.util.List.of(
              new EntityReference().withFullyQualifiedName(domainFqn).withType(Entity.DOMAIN)));
    }
    return dp;
  }

  private Response mergeOrCreateDataProductFromODPS(
      UriInfo uriInfo,
      SecurityContext securityContext,
      ODPSDataProduct odps,
      String languageCode,
      String domainFqn,
      String strategy) {
    DataProduct imported = buildDataProductFromODPS(odps, languageCode, domainFqn);
    DataProduct existing = findExistingByName(imported.getName());
    DataProduct finalProduct;
    if (existing == null) {
      finalProduct = imported;
    } else if ("replace".equalsIgnoreCase(strategy)) {
      finalProduct = ODPSConverter.fullReplace(existing, imported);
    } else {
      finalProduct = ODPSConverter.smartMerge(existing, imported);
    }
    finalProduct.setUpdatedBy(securityContext.getUserPrincipal().getName());
    finalProduct.setUpdatedAt(System.currentTimeMillis());
    if (existing == null) {
      return create(uriInfo, securityContext, finalProduct);
    }
    return createOrUpdate(uriInfo, securityContext, finalProduct);
  }

  private DataProduct findExistingByName(String name) {
    if (nullOrEmpty(name)) return null;
    try {
      return repository.getByName(null, name, repository.getFields("id,name,version"));
    } catch (EntityNotFoundException ignored) {
      return null;
    }
  }

  private JsonNode summarizeODPS(ODPSDataProduct odps) {
    com.fasterxml.jackson.databind.node.ObjectNode summary = JSON_MAPPER.createObjectNode();
    summary.put("valid", true);
    summary.put("version", odps.getVersion() != null ? odps.getVersion().value() : null);
    if (odps.getProduct() != null
        && odps.getProduct().getDetails() != null
        && odps.getProduct().getDetails().getAdditionalProperties() != null) {
      summary.put(
          "languages",
          odps.getProduct().getDetails().getAdditionalProperties().keySet().toString());
    }
    return summary;
  }
}
