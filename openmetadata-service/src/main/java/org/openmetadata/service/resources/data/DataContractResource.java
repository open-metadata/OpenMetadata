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

import com.fasterxml.jackson.core.JsonProcessingException;
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
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.ContractValidation;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.EntityNotFoundException;
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
import org.openmetadata.service.util.ODCSConverter;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Path("/v1/dataContracts")
@Tag(
    name = "Data Contracts",
    description = "`DataContract` defines the schema and quality guarantees for a data asset.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes({MediaType.APPLICATION_JSON, "application/yaml", "text/yaml"})
@Collection(name = "dataContracts")
public class DataContractResource extends EntityResource<DataContract, DataContractRepository> {
  public static final String COLLECTION_PATH = "/v1/dataContracts/";
  static final String FIELDS = "owners,reviewers,extension";
  static final String EXPORT_FIELDS = "owners,reviewers,extension,schema,sla,security";

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
              description = "Returns list of contracts before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of contracts after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
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
    ListFilter filter = new ListFilter(include).addQueryParam("entityStatus", status);
    if (entityId != null) {
      filter.addQueryParam("entity", entityId.toString());
    }
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
  @Path("/entity")
  @Operation(
      operationId = "getDataContractByEntityId",
      summary = "Get the effective data contract for an entity",
      description =
          "Get the effective data contract for an entity, including inherited contract properties from its data product if applicable.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The effective data contract (may include inherited properties)",
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
          String entityType,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        getResourceContextById(entityId));

    EntityInterface entity = Entity.getEntity(entityType, entityId, "*", Include.NON_DELETED);
    DataContract dataContract = repository.getEffectiveDataContract(entity);

    if (dataContract == null) {
      throw EntityNotFoundException.byMessage(
          String.format("Data contract for entity %s is not found", entityId));
    }
    return addHref(uriInfo, repository.setFieldsInternal(dataContract, getFields(fieldsParam)));
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
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Data contract Id", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
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
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(
              description = "Fully qualified name of the data contract",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return super.deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
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
        timeSeriesDAO.getLatestExtension(dataContract.getFullyQualifiedName(), RESULT_EXTENSION);

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

    return repository.getLatestResult(dataContract);
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
      @Valid DataContractResult newResult) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    OperationContext operationContext =
        new OperationContext(Entity.DATA_CONTRACT, MetadataOperation.EDIT_ALL);
    ResourceContext<DataContract> resourceContext =
        new ResourceContext<>(Entity.DATA_CONTRACT, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    DataContractResult result = getContractResult(dataContract, newResult);
    return repository.addContractResult(dataContract, result).toResponse();
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
          "Execute on-demand validation of a data contract including semantic rules, quality tests, and inherited contract properties from data products.",
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

    // Get the effective contract (with inherited properties from data products) for validation
    EntityInterface entity =
        Entity.getEntity(
            dataContract.getEntity().getType(),
            dataContract.getEntity().getId(),
            "*",
            Include.NON_DELETED);
    DataContract effectiveContract = repository.getEffectiveDataContract(entity);

    // Use the effective contract for validation to include inherited semantics
    RestUtil.PutResponse<DataContractResult> result =
        repository.validateContract(effectiveContract != null ? effectiveContract : dataContract);
    return result.toResponse();
  }

  @POST
  @Path("/entity/validate")
  @Operation(
      operationId = "validateDataContractByEntityId",
      summary = "Validate a data contract for an entity",
      description =
          "Execute on-demand validation of a data contract for an entity. If the entity only has "
              + "an inherited contract from a Data Product, an empty contract will be materialized "
              + "for the entity to store validation results.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Validation result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContractResult.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Entity not found or no contract available")
      })
  public Response validateContractByEntityId(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "ID of the entity", schema = @Schema(type = "UUID"))
          @QueryParam("entityId")
          UUID entityId,
      @Parameter(description = "Type of the entity", schema = @Schema(type = "string"))
          @QueryParam("entityType")
          String entityType) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.EDIT_ALL),
        getResourceContextById(entityId));

    EntityInterface entity = Entity.getEntity(entityType, entityId, "*", Include.NON_DELETED);

    // Get the entity's direct contract (if exists)
    DataContract directContract = repository.getEntityDataContractSafely(entity);

    // Get the effective contract (with inherited properties)
    DataContract effectiveContract = repository.getEffectiveDataContract(entity);

    if (effectiveContract == null) {
      throw EntityNotFoundException.byMessage(
          String.format("No data contract found for entity %s", entityId));
    }

    // If entity has no direct contract but has an inherited one, materialize an empty contract
    DataContract contractForValidation;
    if (directContract == null && Boolean.TRUE.equals(effectiveContract.getInherited())) {
      // Materialize an empty contract for this entity to store validation results
      // Use the Data Product contract name as prefix for the new contract name
      contractForValidation =
          repository.materializeInheritedContract(
              entity, effectiveContract.getName(), securityContext.getUserPrincipal().getName());
    } else {
      contractForValidation = directContract != null ? directContract : effectiveContract;
    }

    // Validate using the effective contract (to include inherited rules)
    // but store results against the entity's own contract
    RestUtil.PutResponse<DataContractResult> result =
        repository.validateContractWithEffective(contractForValidation, effectiveContract);
    return result.toResponse();
  }

  // Add runId and dataContractFQN to the result if not incoming
  private DataContractResult getContractResult(
      DataContract dataContract, DataContractResult newResult) {
    return newResult
        .withId(newResult.getId() == null ? UUID.randomUUID() : newResult.getId())
        .withDataContractFQN(dataContract.getFullyQualifiedName());
  }

  // ODCS (Open Data Contract Standard) Import/Export APIs

  @GET
  @Path("/{id}/odcs")
  @Operation(
      operationId = "exportDataContractToODCS",
      summary = "Export data contract to ODCS format",
      description = "Export a data contract to Open Data Contract Standard (ODCS) v3.1.0 format.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "ODCS data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ODCSDataContract.class))),
        @ApiResponse(responseCode = "404", description = "Data contract not found")
      })
  public ODCSDataContract exportToODCS(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data contract", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    String fields = (fieldsParam == null || fieldsParam.isEmpty()) ? EXPORT_FIELDS : fieldsParam;
    DataContract dataContract =
        getInternal(uriInfo, securityContext, id, fields, Include.NON_DELETED);
    return ODCSConverter.toODCS(dataContract);
  }

  @GET
  @Path("/{id}/odcs/yaml")
  @Produces({"application/yaml", "text/yaml"})
  @Operation(
      operationId = "exportDataContractToODCSYaml",
      summary = "Export data contract to ODCS YAML format",
      description =
          "Export a data contract to Open Data Contract Standard (ODCS) v3.1.0 YAML format.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "ODCS data contract in YAML format",
            content = @Content(mediaType = "application/yaml")),
        @ApiResponse(responseCode = "404", description = "Data contract not found")
      })
  public Response exportToODCSYaml(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the data contract", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    String fields = (fieldsParam == null || fieldsParam.isEmpty()) ? EXPORT_FIELDS : fieldsParam;
    DataContract dataContract =
        getInternal(uriInfo, securityContext, id, fields, Include.NON_DELETED);
    ODCSDataContract odcs = ODCSConverter.toODCS(dataContract);
    try {
      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      yamlMapper.setSerializationInclusion(
          com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL);
      String yamlContent = yamlMapper.writeValueAsString(odcs);
      return Response.ok(yamlContent, "application/yaml").build();
    } catch (Exception e) {
      throw new IllegalArgumentException("Failed to convert to YAML: " + e.getMessage(), e);
    }
  }

  @GET
  @Path("/name/{fqn}/odcs")
  @Operation(
      operationId = "exportDataContractToODCSByFQN",
      summary = "Export data contract to ODCS format by FQN",
      description =
          "Export a data contract to Open Data Contract Standard (ODCS) v3.1.0 format by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "ODCS data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ODCSDataContract.class))),
        @ApiResponse(responseCode = "404", description = "Data contract not found")
      })
  public ODCSDataContract exportToODCSByFqn(
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
          String fieldsParam) {
    String fields = (fieldsParam == null || fieldsParam.isEmpty()) ? EXPORT_FIELDS : fieldsParam;
    DataContract dataContract =
        getByNameInternal(uriInfo, securityContext, fqn, fields, Include.NON_DELETED);
    return ODCSConverter.toODCS(dataContract);
  }

  @GET
  @Path("/name/{fqn}/odcs/yaml")
  @Produces("application/yaml")
  @Operation(
      operationId = "exportDataContractToODCSYamlByFQN",
      summary = "Export data contract to ODCS YAML format by FQN",
      description =
          "Export a data contract to Open Data Contract Standard (ODCS) v3.1.0 YAML format by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "ODCS data contract in YAML format",
            content = @Content(mediaType = "application/yaml", schema = @Schema(type = "string"))),
        @ApiResponse(responseCode = "404", description = "Data contract not found")
      })
  public Response exportToODCSYamlByFqn(
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
          String fieldsParam) {
    String fields = (fieldsParam == null || fieldsParam.isEmpty()) ? EXPORT_FIELDS : fieldsParam;
    DataContract dataContract =
        getByNameInternal(uriInfo, securityContext, fqn, fields, Include.NON_DELETED);
    ODCSDataContract odcs = ODCSConverter.toODCS(dataContract);
    try {
      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      yamlMapper.setSerializationInclusion(
          com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL);
      String yamlContent = yamlMapper.writeValueAsString(odcs);
      return Response.ok(yamlContent, "application/yaml").build();
    } catch (Exception e) {
      throw new IllegalArgumentException("Failed to convert to YAML: " + e.getMessage(), e);
    }
  }

  @POST
  @Path("/odcs")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "importDataContractFromODCS",
      summary = "Import data contract from ODCS format",
      description =
          "Import a data contract from Open Data Contract Standard (ODCS) v3.1.0 JSON format.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The imported data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContract.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response importFromODCS(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity ID to associate with the contract",
              schema = @Schema(type = "string", format = "uuid"))
          @QueryParam("entityId")
          UUID entityId,
      @Parameter(
              description = "Entity Type (table, topic, etc.)",
              schema = @Schema(type = "string", example = Entity.TABLE))
          @QueryParam("entityType")
          String entityType,
      @Parameter(
              description =
                  "Schema object name to import (for multi-object ODCS contracts). "
                      + "If not specified, auto-selects based on entity name or uses first object.",
              schema = @Schema(type = "string"))
          @QueryParam("objectName")
          String objectName,
      @Valid ODCSDataContract odcs) {
    EntityReference entityRef = new EntityReference().withId(entityId).withType(entityType);
    DataContract dataContract = ODCSConverter.fromODCS(odcs, entityRef, objectName);
    dataContract.setUpdatedBy(securityContext.getUserPrincipal().getName());
    dataContract.setUpdatedAt(System.currentTimeMillis());
    return create(uriInfo, securityContext, dataContract);
  }

  @POST
  @Path("/odcs/yaml")
  @Consumes({"application/yaml", "text/yaml"})
  @Operation(
      operationId = "importDataContractFromODCSYaml",
      summary = "Import data contract from ODCS YAML format",
      description =
          "Import a data contract from Open Data Contract Standard (ODCS) v3.1.0 YAML format.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The imported data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContract.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response importFromODCSYaml(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity ID to associate with the contract",
              schema = @Schema(type = "string", format = "uuid"))
          @QueryParam("entityId")
          UUID entityId,
      @Parameter(
              description = "Entity Type (table, topic, etc.)",
              schema = @Schema(type = "string", example = Entity.TABLE))
          @QueryParam("entityType")
          String entityType,
      @Parameter(
              description =
                  "Schema object name to import (for multi-object ODCS contracts). "
                      + "If not specified, auto-selects based on entity name or uses first object.",
              schema = @Schema(type = "string"))
          @QueryParam("objectName")
          String objectName,
      String yamlContent) {
    try {
      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      ODCSDataContract odcs = yamlMapper.readValue(yamlContent, ODCSDataContract.class);
      EntityReference entityRef = new EntityReference().withId(entityId).withType(entityType);
      DataContract dataContract = ODCSConverter.fromODCS(odcs, entityRef, objectName);
      dataContract.setUpdatedBy(securityContext.getUserPrincipal().getName());
      dataContract.setUpdatedAt(System.currentTimeMillis());
      return create(uriInfo, securityContext, dataContract);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid ODCS YAML content: " + e.getMessage(), e);
    }
  }

  @POST
  @Path("/odcs/parse/yaml")
  @Consumes({"application/yaml", "text/yaml"})
  @Operation(
      operationId = "parseODCSYaml",
      summary = "Parse ODCS YAML and return metadata",
      description =
          "Parse an ODCS YAML contract and return metadata including the list of schema objects. "
              + "Use this to determine available objects for multi-object contracts before importing.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Parsed ODCS metadata",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ODCSParseResult.class))),
        @ApiResponse(responseCode = "400", description = "Invalid YAML content")
      })
  public Response parseODCSYaml(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, String yamlContent) {
    try {
      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      ODCSDataContract odcs = yamlMapper.readValue(yamlContent, ODCSDataContract.class);

      ODCSParseResult result = new ODCSParseResult();
      result.setName(odcs.getName());
      result.setVersion(odcs.getVersion());
      result.setStatus(odcs.getStatus() != null ? odcs.getStatus().value() : null);
      result.setSchemaObjects(ODCSConverter.getSchemaObjectNames(odcs));
      result.setHasMultipleObjects(ODCSConverter.hasMultipleSchemaObjects(odcs));

      return Response.ok(result).build();
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid ODCS YAML content: " + e.getMessage(), e);
    }
  }

  @POST
  @Path("/validate")
  @Operation(
      operationId = "validateDataContractRequest",
      summary = "Validate data contract request without creating",
      description =
          "Validate a CreateDataContract request against the target entity without creating the contract. "
              + "Returns comprehensive validation results including constraint errors and schema field mismatches.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Validation results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContractValidation.class))),
        @ApiResponse(responseCode = "400", description = "Invalid request")
      })
  public Response validateDataContractRequest(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      CreateDataContract createRequest) {
    DataContract dataContract = DataContractMapper.createEntity(createRequest, "validation");
    ContractValidation validation = repository.validateContractWithoutThrowing(dataContract);
    return Response.ok(validation).build();
  }

  @POST
  @Path("/validate/yaml")
  @Consumes({"application/yaml", "text/yaml"})
  @Operation(
      operationId = "validateDataContractRequestYaml",
      summary = "Validate data contract request from YAML without creating",
      description =
          "Validate a CreateDataContract YAML request against the target entity without creating the contract. "
              + "Returns comprehensive validation results including entity errors, constraint errors, "
              + "and schema field mismatches.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Validation results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContractValidation.class))),
        @ApiResponse(responseCode = "400", description = "Invalid YAML content")
      })
  public Response validateDataContractRequestYaml(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, String yamlContent) {
    try {
      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      CreateDataContract createRequest =
          yamlMapper.readValue(yamlContent, CreateDataContract.class);
      DataContract dataContract = DataContractMapper.createEntity(createRequest, "validation");
      ContractValidation validation = repository.validateContractWithoutThrowing(dataContract);
      return Response.ok(validation).build();
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid YAML content: " + e.getMessage(), e);
    }
  }

  @POST
  @Path("/odcs/validate/yaml")
  @Consumes({"application/yaml", "text/yaml"})
  @Operation(
      operationId = "validateODCSYaml",
      summary = "Validate ODCS YAML without importing",
      description =
          "Validate an ODCS YAML contract against the target entity without creating the contract. "
              + "Returns comprehensive validation results including entity errors, constraint errors, "
              + "and schema field mismatches.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Validation results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContractValidation.class))),
        @ApiResponse(responseCode = "400", description = "Invalid YAML content")
      })
  public Response validateODCSYaml(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity ID to validate against",
              schema = @Schema(type = "string", format = "uuid"))
          @QueryParam("entityId")
          UUID entityId,
      @Parameter(
              description = "Entity Type (table, topic, etc.)",
              schema = @Schema(type = "string", example = Entity.TABLE))
          @QueryParam("entityType")
          String entityType,
      @Parameter(
              description =
                  "Schema object name to validate (for multi-object ODCS contracts). "
                      + "If not specified, auto-selects based on entity name or uses first object.",
              schema = @Schema(type = "string"))
          @QueryParam("objectName")
          String objectName,
      String yamlContent) {
    try {
      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      ODCSDataContract odcs = yamlMapper.readValue(yamlContent, ODCSDataContract.class);
      EntityReference entityRef = new EntityReference().withId(entityId).withType(entityType);
      DataContract dataContract = ODCSConverter.fromODCS(odcs, entityRef, objectName);

      ContractValidation validation = repository.validateContractWithoutThrowing(dataContract);
      return Response.ok(validation).build();
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid ODCS YAML content: " + e.getMessage(), e);
    }
  }

  @PUT
  @Path("/odcs")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "createOrUpdateDataContractFromODCS",
      summary = "Create or update data contract from ODCS format",
      description =
          "Create or update a data contract from Open Data Contract Standard (ODCS) v3.1.0 JSON format. "
              + "Use mode=merge (default) to preserve existing fields not in the import. "
              + "Use mode=replace to fully overwrite the contract while preserving ID and execution history.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The created or updated data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContract.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdateFromODCS(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity ID to associate with the contract",
              schema = @Schema(type = "string", format = "uuid"))
          @QueryParam("entityId")
          UUID entityId,
      @Parameter(
              description = "Entity Type (table, topic, etc.)",
              schema = @Schema(type = "string", example = Entity.TABLE))
          @QueryParam("entityType")
          String entityType,
      @Parameter(
              description =
                  "Import mode: 'merge' preserves existing fields, 'replace' overwrites all fields",
              schema =
                  @Schema(
                      type = "string",
                      allowableValues = {"merge", "replace"}))
          @QueryParam("mode")
          @DefaultValue("merge")
          String mode,
      @Parameter(
              description =
                  "Schema object name to import (for multi-object ODCS contracts). "
                      + "If not specified, auto-selects based on entity name or uses first object.",
              schema = @Schema(type = "string"))
          @QueryParam("objectName")
          String objectName,
      @Valid ODCSDataContract odcs) {
    EntityReference entityRef = new EntityReference().withId(entityId).withType(entityType);
    DataContract imported = ODCSConverter.fromODCS(odcs, entityRef, objectName);
    DataContract dataContract =
        "replace".equalsIgnoreCase(mode)
            ? applyFullReplace(entityRef, imported)
            : applySmartMerge(entityRef, imported);
    dataContract.setUpdatedBy(securityContext.getUserPrincipal().getName());
    dataContract.setUpdatedAt(System.currentTimeMillis());
    return createOrUpdate(uriInfo, securityContext, dataContract);
  }

  @PUT
  @Path("/odcs/yaml")
  @Consumes({"application/yaml", "text/yaml"})
  @Operation(
      operationId = "createOrUpdateDataContractFromODCSYaml",
      summary = "Create or update data contract from ODCS YAML format",
      description =
          "Create or update a data contract from Open Data Contract Standard (ODCS) v3.1.0 YAML format. "
              + "Use mode=merge (default) to preserve existing fields not in the import. "
              + "Use mode=replace to fully overwrite the contract while preserving ID and execution history.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The created or updated data contract",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DataContract.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdateFromODCSYaml(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity ID to associate with the contract",
              schema = @Schema(type = "string", format = "uuid"))
          @QueryParam("entityId")
          UUID entityId,
      @Parameter(
              description = "Entity Type (table, topic, etc.)",
              schema = @Schema(type = "string", example = Entity.TABLE))
          @QueryParam("entityType")
          String entityType,
      @Parameter(
              description =
                  "Import mode: 'merge' preserves existing fields, 'replace' overwrites all fields",
              schema =
                  @Schema(
                      type = "string",
                      allowableValues = {"merge", "replace"}))
          @QueryParam("mode")
          @DefaultValue("merge")
          String mode,
      @Parameter(
              description =
                  "Schema object name to import (for multi-object ODCS contracts). "
                      + "If not specified, auto-selects based on entity name or uses first object.",
              schema = @Schema(type = "string"))
          @QueryParam("objectName")
          String objectName,
      String yamlContent) {
    try {
      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      ODCSDataContract odcs = yamlMapper.readValue(yamlContent, ODCSDataContract.class);
      EntityReference entityRef = new EntityReference().withId(entityId).withType(entityType);
      DataContract imported = ODCSConverter.fromODCS(odcs, entityRef, objectName);
      DataContract dataContract =
          "replace".equalsIgnoreCase(mode)
              ? applyFullReplace(entityRef, imported)
              : applySmartMerge(entityRef, imported);
      dataContract.setUpdatedBy(securityContext.getUserPrincipal().getName());
      dataContract.setUpdatedAt(System.currentTimeMillis());
      return createOrUpdate(uriInfo, securityContext, dataContract);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid ODCS YAML content: " + e.getMessage(), e);
    }
  }

  private DataContract applySmartMerge(EntityReference entityRef, DataContract imported) {
    DataContract existing = null;

    // Try to find existing contract by entity reference
    try {
      existing = repository.loadEntityDataContract(entityRef);
    } catch (Exception e) {
      LOG.debug(
          "Could not load contract by entity ref for {}: {}", entityRef.getId(), e.getMessage());
    }

    if (existing != null) {
      LOG.debug("Found existing contract {} for entity {}", existing.getId(), entityRef.getId());
      return ODCSConverter.smartMerge(existing, imported);
    }

    // No existing contract found - return imported for new creation
    LOG.debug("No existing contract found for entity {}, will create new", entityRef.getId());
    return imported;
  }

  private DataContract applyFullReplace(EntityReference entityRef, DataContract imported) {
    DataContract existing = null;

    // Try to find existing contract by entity reference
    try {
      existing = repository.loadEntityDataContract(entityRef);
    } catch (Exception e) {
      LOG.debug(
          "Could not load contract by entity ref for {}: {}", entityRef.getId(), e.getMessage());
    }

    if (existing != null) {
      LOG.debug(
          "Found existing contract {} for entity {}, will replace",
          existing.getId(),
          entityRef.getId());
      return ODCSConverter.fullReplace(existing, imported);
    }

    // No existing contract found - return imported for new creation
    LOG.debug("No existing contract found for entity {}, will create new", entityRef.getId());
    return imported;
  }

  public static class DataContractList extends ResultList<DataContract> {
    @SuppressWarnings("unused")
    public DataContractList() {
      /* Required for serde */
    }
  }

  /** Response object for ODCS parse endpoint containing metadata about the parsed contract. */
  public static class ODCSParseResult {
    private String name;
    private String version;
    private String status;
    private List<String> schemaObjects;
    private boolean hasMultipleObjects;

    public String getName() {
      return name;
    }

    public void setName(String name) {
      this.name = name;
    }

    public String getVersion() {
      return version;
    }

    public void setVersion(String version) {
      this.version = version;
    }

    public String getStatus() {
      return status;
    }

    public void setStatus(String status) {
      this.status = status;
    }

    public List<String> getSchemaObjects() {
      return schemaObjects;
    }

    public void setSchemaObjects(List<String> schemaObjects) {
      this.schemaObjects = schemaObjects;
    }

    public boolean isHasMultipleObjects() {
      return hasMultipleObjects;
    }

    public void setHasMultipleObjects(boolean hasMultipleObjects) {
      this.hasMultipleObjects = hasMultipleObjects;
    }
  }
}
