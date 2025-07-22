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

package org.openmetadata.service.resources.data;

import static org.openmetadata.service.jdbi3.DataContractRepository.RESULT_EXTENSION;
import static org.openmetadata.service.jdbi3.DataContractRepository.RESULT_EXTENSION_KEY;

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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.data.CreateDataContractResult;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/dataContracts")
@Tag(
    name = "Data Contracts",
    description = "`DataContract` defines the schema and quality guarantees for a data asset.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes({MediaType.APPLICATION_JSON, "application/yaml", "text/yaml"})
@Collection(name = "dataContracts")
public class DataContractResource extends EntityResource<DataContract, DataContractRepository> {
  public static final String COLLECTION_PATH = "v1/dataContracts/";
  static final String FIELDS = "owners,reviewers";

  @Override
  public DataContract addHref(UriInfo uriInfo, DataContract dataContract) {
    super.addHref(uriInfo, dataContract);
    Entity.withHref(uriInfo, dataContract.getOwners());
    Entity.withHref(uriInfo, dataContract.getReviewers());
    Entity.withHref(uriInfo, dataContract.getEntity());
    return dataContract;
  }

  public DataContractResource(Authorizer authorizer, Limits limits) {
    super(Entity.DATA_CONTRACT, authorizer, limits);
  }

  // Set the PipelineServiceClient so the repository can manage the Ingestion Pipelines for Test
  // Suites
  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    PipelineServiceClientInterface pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(
            config.getPipelineServiceClientConfiguration());
    repository.setPipelineServiceClient(pipelineServiceClient);
  }

  @GET
  @Valid
  @Operation(
      operationId = "listDataContracts",
      summary = "List data contracts",
      description = "Get a list of data contracts, optionally filtered by query parameters.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of data contracts",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContractList.class)))
      })
  public ResultList<DataContract> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Limit the number of records returned in the response",
              schema = @Schema(type = "integer", minimum = "0", example = "100"))
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          @DefaultValue("10")
          int limitParam,
      @Parameter(
              description = "Sort the records based on a field",
              schema = @Schema(type = "string", example = "name"))
          @QueryParam("sort")
          @DefaultValue("updatedAt")
          String sortParam,
      @Parameter(
              description = "Starting record number for pagination",
              schema = @Schema(type = "integer", minimum = "0", example = "0"))
          @Min(0)
          @QueryParam("before")
          Integer beforeParam,
      @Parameter(
              description = "Starting record number for pagination",
              schema = @Schema(type = "integer", minimum = "0", example = "0"))
          @Min(0)
          @QueryParam("after")
          Integer afterParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include,
      @Parameter(
              description = "Filter contracts by status",
              schema = @Schema(type = "string", example = "Active"))
          @QueryParam("status")
          String status,
      @Parameter(
              description = "Filter contracts by entity id",
              schema = @Schema(type = "string", format = "uuid"))
          @QueryParam("entity")
          UUID entityId) {
    ListFilter filter = new ListFilter(include).addQueryParam("status", status);
    if (entityId != null) {
      filter.addQueryParam("entity", entityId.toString());
    }
    String before = beforeParam != null ? beforeParam.toString() : null;
    String after = afterParam != null ? afterParam.toString() : null;
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDataContractByID",
      summary = "Get a data contract by id",
      description = "Get a data contract by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContract.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Data contract for instance {id} is not found")
      })
  public DataContract get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Data contract Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getDataContractByFQN",
      summary = "Get a data contract by fully qualified name",
      description = "Get a data contract by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContract.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Data contract for instance {fqn} is not found")
      })
  public DataContract getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the data contract",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/entity")
  @Operation(
      operationId = "getDataContractByEntityId",
      summary = "Get a data contract by its related Entity ID",
      description = "Get a data contract by its related Entity ID.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContract.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Data contract for instance {id} is not found")
      })
  public DataContract getByEntityId(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "ID of the related Entity", schema = @Schema(type = "string"))
          @QueryParam("entityId")
          UUID entityId,
      @Parameter(
              description = "Entity Type to get the data contract for",
              schema = @Schema(type = "string", example = Entity.TABLE))
          @QueryParam("entityType")
          String entityType) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        getResourceContextById(entityId));
    return repository.loadEntityDataContract(
        new EntityReference().withId(entityId).withType(entityType));
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listDataContractVersions",
      summary = "List all versions of a data contract",
      description = "Get a list of all the versions of a data contract identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of data contract versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Data contract Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getDataContractVersion",
      summary = "Get a version of a data contract",
      description = "Get a version of a data contract by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContract.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Data contract for instance {id} and version {version} is not found")
      })
  public DataContract getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Data contract Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Data contract version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "createDataContract",
      summary = "Create a data contract",
      description = "Create a new data contract.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContract.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDataContract create) {
    DataContract dataContract =
        getDataContract(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, dataContract);
  }

  @POST
  @Consumes({"application/yaml", "text/yaml"})
  @Operation(
      operationId = "createDataContractFromYaml",
      summary = "Create a data contract from YAML",
      description = "Create a new data contract from YAML content.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContract.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createFromYaml(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, String yamlContent) {
    try {
      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      CreateDataContract create = yamlMapper.readValue(yamlContent, CreateDataContract.class);
      DataContract dataContract =
          getDataContract(create, securityContext.getUserPrincipal().getName());
      return create(uriInfo, securityContext, dataContract);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid YAML content: " + e.getMessage(), e);
    }
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDataContract",
      summary = "Update a data contract",
      description = "Update an existing data contract using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Data contract Id", schema = @Schema(type = "UUID")) @PathParam("id")
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

  @PUT
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "createOrUpdateDataContract",
      summary = "Create or update a data contract",
      description =
          "Create a new data contract, if it does not exist or update an existing data contract.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContract.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateDataContract create) {
    DataContract dataContract =
        getDataContract(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, dataContract);
  }

  @PUT
  @Consumes({"application/yaml", "text/yaml"})
  @Operation(
      operationId = "createOrUpdateDataContractFromYaml",
      summary = "Create or update a data contract from YAML",
      description =
          "Create a new data contract from YAML, if it does not exist or update an existing data contract.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContract.class)))
      })
  public Response createOrUpdateFromYaml(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, String yamlContent) {
    try {
      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      CreateDataContract create = yamlMapper.readValue(yamlContent, CreateDataContract.class);
      DataContract dataContract =
          getDataContract(create, securityContext.getUserPrincipal().getName());
      return createOrUpdate(uriInfo, securityContext, dataContract);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid YAML content: " + e.getMessage(), e);
    }
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDataContract",
      summary = "Delete a data contract by id",
      description = "Delete a data contract by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Data contract for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity", schema = @Schema(type = "boolean"))
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Data contract Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteDataContractByName",
      summary = "Delete a data contract by fully qualified name",
      description = "Delete a data contract by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Data contract for instance {fqn} is not found")
      })
  public Response deleteByFqn(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity", schema = @Schema(type = "boolean"))
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Fully qualified name of the data contract",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return super.deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteDataContractAsync",
      summary = "Delete a data contract by id asynchronously",
      description = "Delete a data contract by `id` asynchronously.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Data contract for instance {id} is not found")
      })
  public Response deleteAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity", schema = @Schema(type = "boolean"))
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Data contract Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return super.deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted data contract",
      description = "Restore a soft deleted data contract.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the DataContract ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContract.class)))
      })
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private DataContract getDataContract(CreateDataContract create, String user) {
    return DataContractMapper.createEntity(create, user);
  }

  // Data Contract Results APIs

  @GET
  @Path("/{id}/results")
  @Operation(
      operationId = "listDataContractResults",
      summary = "List data contract results",
      description = "Get a list of all data contract execution results for a given contract.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of data contract results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResultList.class)))
      })
  public ResultList<DataContractResult> listResults(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data contract", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Limit the number of results (1 to 10000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(10000)
          int limitParam,
      @Parameter(
              description = "Returns results after this timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Returns results before this timestamp",
              schema = @Schema(type = "number"))
          @QueryParam("endTs")
          Long endTs) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    OperationContext operationContext =
        new OperationContext(Entity.DATA_CONTRACT, MetadataOperation.VIEW_BASIC);
    ResourceContext<DataContract> resourceContext =
        new ResourceContext<>(Entity.DATA_CONTRACT, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    EntityTimeSeriesDAO timeSeriesDAO = Entity.getCollectionDAO().entityExtensionTimeSeriesDao();
    List<String> jsonResults =
        timeSeriesDAO.listBetweenTimestampsByOrder(
            dataContract.getFullyQualifiedName(),
            "dataContract.dataContractResult",
            startTs != null ? startTs : 0L,
            endTs != null ? endTs : System.currentTimeMillis(),
            EntityTimeSeriesDAO.OrderBy.DESC);

    List<DataContractResult> results = JsonUtils.readObjects(jsonResults, DataContractResult.class);

    // Apply limit
    if (limitParam > 0 && results.size() > limitParam) {
      results = results.subList(0, limitParam);
    }

    return new ResultList<>(
        results, String.valueOf(startTs), String.valueOf(endTs), results.size());
  }

  @GET
  @Path("/{id}/results/latest")
  @Operation(
      operationId = "getLatestDataContractResult",
      summary = "Get latest data contract result",
      description = "Get the latest execution result for a data contract.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Latest data contract result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContractResult.class))),
        @ApiResponse(responseCode = "404", description = "Data contract or result not found")
      })
  public DataContractResult getLatestResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data contract", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    OperationContext operationContext =
        new OperationContext(Entity.DATA_CONTRACT, MetadataOperation.VIEW_BASIC);
    ResourceContext<DataContract> resourceContext =
        new ResourceContext<>(Entity.DATA_CONTRACT, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    EntityTimeSeriesDAO timeSeriesDAO = Entity.getCollectionDAO().entityExtensionTimeSeriesDao();
    String jsonRecord =
        timeSeriesDAO.getLatestExtension(
            dataContract.getFullyQualifiedName(), "dataContract.dataContractResult");

    return jsonRecord != null ? JsonUtils.readValue(jsonRecord, DataContractResult.class) : null;
  }

  @GET
  @Path("/{id}/results/{resultId}")
  @Operation(
      operationId = "getDataContractResult",
      summary = "Get a data contract result by ID",
      description = "Get a specific data contract execution result by its ID.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Data contract result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContractResult.class))),
        @ApiResponse(responseCode = "404", description = "Data contract result not found")
      })
  public DataContractResult getResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data contract", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Id of the data contract result", schema = @Schema(type = "UUID"))
          @PathParam("resultId")
          UUID resultId) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    OperationContext operationContext =
        new OperationContext(Entity.DATA_CONTRACT, MetadataOperation.VIEW_BASIC);
    ResourceContext<DataContract> resourceContext =
        new ResourceContext<>(Entity.DATA_CONTRACT, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    EntityTimeSeriesDAO timeSeriesDAO = Entity.getCollectionDAO().entityExtensionTimeSeriesDao();
    String jsonRecord =
        timeSeriesDAO.getLatestExtensionByKey(
            RESULT_EXTENSION_KEY,
            resultId.toString(),
            dataContract.getFullyQualifiedName(),
            RESULT_EXTENSION);
    return JsonUtils.readValue(jsonRecord, DataContractResult.class);
  }

  @PUT
  @Path("/{id}/results")
  @Operation(
      operationId = "createOrUpdateDataContractResult",
      summary = "Create or update data contract result",
      description = "Create a new data contract execution result.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully created or updated the result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContractResult.class)))
      })
  public Response createResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data contract", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Valid CreateDataContractResult create) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    OperationContext operationContext =
        new OperationContext(Entity.DATA_CONTRACT, MetadataOperation.EDIT_ALL);
    ResourceContext<DataContract> resourceContext =
        new ResourceContext<>(Entity.DATA_CONTRACT, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    DataContractResult result = getContractResult(dataContract, create);
    result = repository.addContractResult(dataContract, result);
    return Response.ok(result).build();
  }

  @DELETE
  @Path("/{id}/results/{timestamp}")
  @Operation(
      operationId = "deleteDataContractResult",
      summary = "Delete data contract result",
      description = "Delete a data contract result at a specific timestamp.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Successfully deleted the result")
      })
  public Response deleteResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data contract", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Timestamp of the result to delete",
              schema = @Schema(type = "number"))
          @PathParam("timestamp")
          Long timestamp) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    OperationContext operationContext =
        new OperationContext(Entity.DATA_CONTRACT, MetadataOperation.DELETE);
    ResourceContext<DataContract> resourceContext =
        new ResourceContext<>(Entity.DATA_CONTRACT, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    EntityTimeSeriesDAO timeSeriesDAO = Entity.getCollectionDAO().entityExtensionTimeSeriesDao();
    timeSeriesDAO.deleteAtTimestamp(
        dataContract.getFullyQualifiedName(), "dataContract.dataContractResult", timestamp);
    return Response.ok().build();
  }

  @DELETE
  @Path("/{id}/results/before/{timestamp}")
  @Operation(
      operationId = "deleteDataContractResultsBefore",
      summary = "Delete data contract results before timestamp",
      description = "Delete all data contract results before a specific timestamp.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Successfully deleted the results")
      })
  public Response deleteResultsBefore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data contract", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Delete results before this timestamp",
              schema = @Schema(type = "number"))
          @PathParam("timestamp")
          Long timestamp) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    OperationContext operationContext =
        new OperationContext(Entity.DATA_CONTRACT, MetadataOperation.DELETE);
    ResourceContext<DataContract> resourceContext =
        new ResourceContext<>(Entity.DATA_CONTRACT, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    EntityTimeSeriesDAO timeSeriesDAO = Entity.getCollectionDAO().entityExtensionTimeSeriesDao();
    timeSeriesDAO.deleteBeforeTimestamp(
        dataContract.getFullyQualifiedName(), "dataContract.dataContractResult", timestamp);
    return Response.ok().build();
  }

  @POST
  @Path("/{id}/validate")
  @Operation(
      operationId = "validateDataContract",
      summary = "Validate a data contract",
      description =
          "Execute on-demand validation of a data contract including semantic rules and quality tests.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Validation result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContractResult.class))),
        @ApiResponse(responseCode = "404", description = "Data contract not found")
      })
  public Response validateContract(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data contract", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    OperationContext operationContext =
        new OperationContext(Entity.DATA_CONTRACT, MetadataOperation.EDIT_ALL);
    ResourceContext<DataContract> resourceContext =
        new ResourceContext<>(Entity.DATA_CONTRACT, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    DataContractResult result = repository.validateContract(dataContract);
    return Response.ok(result).build();
  }

  private DataContractResult getContractResult(
      DataContract dataContract, CreateDataContractResult create) {
    DataContractResult result =
        new DataContractResult()
            .withId(dataContract.getId() == null ? UUID.randomUUID() : dataContract.getId())
            .withDataContractFQN(dataContract.getFullyQualifiedName())
            .withTimestamp(create.getTimestamp())
            .withContractExecutionStatus(create.getContractExecutionStatus())
            .withResult(create.getResult())
            .withExecutionTime(create.getExecutionTime());

    if (create.getSchemaValidation() != null) {
      result.withSchemaValidation(create.getSchemaValidation());
    }

    if (create.getSemanticsValidation() != null) {
      result.withSemanticsValidation(create.getSemanticsValidation());
    }

    if (create.getQualityValidation() != null) {
      result.withQualityValidation(create.getQualityValidation());
    }

    if (create.getSlaValidation() != null) {
      result.withSlaValidation(create.getSlaValidation());
    }

    if (create.getIncidentId() != null) {
      result.withIncidentId(create.getIncidentId());
    }

    return result;
  }

  public static class DataContractList extends ResultList<DataContract> {
    @SuppressWarnings("unused")
    public DataContractList() {
      /* Required for serde */
    }
  }
}
