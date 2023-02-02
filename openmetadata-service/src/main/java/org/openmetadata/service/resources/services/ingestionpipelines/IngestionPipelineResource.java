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

package org.openmetadata.service.resources.services.ingestionpipelines;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.*;

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
import java.net.http.HttpResponse;
import java.util.Map;
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
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.PipelineServiceClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.airflow.AirflowRESTClient;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/services/ingestionPipelines/")
@Api(value = "Ingestion collection", tags = "Ingestion collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "IngestionPipelines")
public class IngestionPipelineResource extends EntityResource<IngestionPipeline, IngestionPipelineRepository> {
  public static final String COLLECTION_PATH = "v1/services/ingestionPipelines/";
  private PipelineServiceClient pipelineServiceClient;
  private OpenMetadataApplicationConfig openMetadataApplicationConfig;

  @Override
  public IngestionPipeline addHref(UriInfo uriInfo, IngestionPipeline ingestionPipeline) {
    Entity.withHref(uriInfo, ingestionPipeline.getOwner());
    Entity.withHref(uriInfo, ingestionPipeline.getService());
    return ingestionPipeline;
  }

  public IngestionPipelineResource(CollectionDAO dao, Authorizer authorizer) {
    super(IngestionPipeline.class, new IngestionPipelineRepository(dao), authorizer);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    this.openMetadataApplicationConfig = config;
    this.pipelineServiceClient = new AirflowRESTClient(openMetadataApplicationConfig.getAirflowConfiguration());
    dao.setPipelineServiceClient(pipelineServiceClient);
  }

  public static class IngestionPipelineList extends ResultList<IngestionPipeline> {
    @SuppressWarnings("unused")
    public IngestionPipelineList() {
      // Empty constructor needed for deserialization
    }
  }

  static final String FIELDS = FIELD_OWNER;

  @GET
  @Valid
  @Operation(
      operationId = "listIngestionPipelines",
      summary = "List Ingestion Pipelines for Metadata Operations",
      tags = "ingestionPipelines",
      description =
          "Get a list of Airflow Pipelines for Metadata Operations. Use `fields` parameter to get only necessary fields. "
              + " Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of ingestion workflows",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class)))
      })
  public ResultList<IngestionPipeline> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter airflow pipelines by service fully qualified name",
              schema = @Schema(type = "string", example = "snowflakeWestCoast"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(description = "Limit the number ingestion returned. (1 to 1000000, " + "default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of ingestion before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of ingestion after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include).addQueryParam("service", serviceParam);
    ResultList<IngestionPipeline> ingestionPipelines =
        super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);

    for (IngestionPipeline ingestionPipeline : listOrEmpty(ingestionPipelines.getData())) {
      if (fieldsParam != null && fieldsParam.contains(FIELD_PIPELINE_STATUS)) {
        ingestionPipeline.setPipelineStatuses(dao.getLatestPipelineStatus(ingestionPipeline));
      }
      decryptOrNullify(securityContext, ingestionPipeline);
    }
    return ingestionPipelines;
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllIngestionPipelineVersion",
      summary = "List ingestion workflow versions",
      tags = "ingestionPipelines",
      description = "Get a list of all the versions of a IngestionPipeline identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of IngestionPipeline versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getIngestionPipelineByID",
      summary = "Get a IngestionPipeline",
      tags = "ingestionPipelines",
      description = "Get a IngestionPipeline by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(responseCode = "404", description = "IngestionPipeline for instance {id} is not found")
      })
  public IngestionPipeline get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID")) @PathParam("id")
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
          Include include)
      throws IOException {
    IngestionPipeline ingestionPipeline = getInternal(uriInfo, securityContext, id, fieldsParam, include);
    if (fieldsParam != null && fieldsParam.contains(FIELD_PIPELINE_STATUS)) {
      ingestionPipeline.setPipelineStatuses(dao.getLatestPipelineStatus(ingestionPipeline));
    }
    return decryptOrNullify(securityContext, ingestionPipeline);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificIngestionPipelineVersion",
      summary = "Get a version of the IngestionPipeline",
      tags = "ingestionPipelines",
      description = "Get a version of the IngestionPipeline by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "IngestionPipelines",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(
            responseCode = "404",
            description = "IngestionPipeline for instance {id} and version  " + "{version} is not found")
      })
  public IngestionPipeline getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Ingestion version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getSpecificIngestionPipelineByFQN",
      summary = "Get a IngestionPipeline by name",
      tags = "ingestionPipelines",
      description = "Get a ingestion by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "IngestionPipeline",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {fqn} is not found")
      })
  public IngestionPipeline getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Fully qualified name of the ingestion pipeline", schema = @Schema(type = "string"))
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
          Include include)
      throws IOException {
    IngestionPipeline ingestionPipeline = getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
    if (fieldsParam != null && fieldsParam.contains(FIELD_PIPELINE_STATUS)) {
      ingestionPipeline.setPipelineStatuses(dao.getLatestPipelineStatus(ingestionPipeline));
    }
    return decryptOrNullify(securityContext, ingestionPipeline);
  }

  @POST
  @Operation(
      operationId = "createIngestionPipeline",
      summary = "Create a Ingestion Pipeline",
      tags = "ingestionPipelines",
      description = "Create a new Ingestion Pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Ingestion Pipeline",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateIngestionPipeline create)
      throws IOException {
    IngestionPipeline ingestionPipeline = getIngestionPipeline(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, ingestionPipeline);
    decryptOrNullify(securityContext, (IngestionPipeline) response.getEntity());
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchIngestionPipeline",
      summary = "Update a IngestionPipeline",
      tags = "ingestionPipelines",
      description = "Update an existing IngestionPipeline using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
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
    Response response = patchInternal(uriInfo, securityContext, id, patch);
    decryptOrNullify(securityContext, (IngestionPipeline) response.getEntity());
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateIngestionPipeline",
      summary = "Create or update a IngestionPipeline",
      tags = "ingestionPipelines",
      description = "Create a new IngestionPipeline, if it does not exist or update an existing IngestionPipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The IngestionPipeline",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateIngestionPipeline update)
      throws IOException {
    IngestionPipeline ingestionPipeline = getIngestionPipeline(update, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, ingestionPipeline);
    decryptOrNullify(securityContext, (IngestionPipeline) response.getEntity());
    return response;
  }

  @POST
  @Path("/deploy/{id}")
  @Operation(
      summary = "Deploy a ingestion pipeline run",
      tags = "ingestionPipelines",
      description = "Trigger a ingestion pipeline run by id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
      })
  public IngestionPipeline deployIngestion(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Context SecurityContext securityContext)
      throws IOException {
    Fields fields = getFields(FIELD_OWNER);
    IngestionPipeline ingestionPipeline = dao.get(uriInfo, id, fields);
    ingestionPipeline.setOpenMetadataServerConnection(
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig).build());
    decryptOrNullify(securityContext, ingestionPipeline);
    pipelineServiceClient.deployPipeline(ingestionPipeline);
    createOrUpdate(uriInfo, securityContext, ingestionPipeline);
    return addHref(uriInfo, ingestionPipeline);
  }

  @POST
  @Path("/trigger/{id}")
  @Operation(
      operationId = "triggerIngestionPipelineRun",
      summary = "Trigger a ingestion pipeline run",
      tags = "ingestionPipelines",
      description = "Trigger a ingestion pipeline run by id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
      })
  public IngestionPipeline triggerIngestion(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Context SecurityContext securityContext)
      throws IOException {
    Fields fields = getFields(FIELD_OWNER);
    IngestionPipeline ingestionPipeline = dao.get(uriInfo, id, fields);
    pipelineServiceClient.runPipeline(ingestionPipeline.getName());
    decryptOrNullify(securityContext, ingestionPipeline);
    return addHref(uriInfo, ingestionPipeline);
  }

  @POST
  @Path("/toggleIngestion/{id}")
  @Operation(
      operationId = "toggleIngestionPipelineEnabled",
      summary = "Set an Ingestion pipeline either as Enabled or Disabled",
      tags = "ingestionPipelines",
      description = "Toggle an ingestion pipeline state by id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
      })
  public Response toggleIngestion(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Context SecurityContext securityContext)
      throws IOException {
    Fields fields = getFields(FIELD_OWNER);
    IngestionPipeline pipeline = dao.get(uriInfo, id, fields);
    // This call updates the state in Airflow as well as the `enabled` field on the IngestionPipeline
    pipelineServiceClient.toggleIngestion(pipeline);
    return createOrUpdate(uriInfo, securityContext, pipeline);
  }

  @POST
  @Path("/kill/{id}")
  @Operation(
      operationId = "killIngestionPipelineRuns",
      summary = "Mark as failed and kill any not-finished workflow or task for the IngestionPipeline",
      tags = "ingestionPipelines",
      description = "Kill an ingestion pipeline by ID.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
      })
  public Response killIngestion(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Context SecurityContext securityContext)
      throws IOException {
    IngestionPipeline ingestionPipeline = getInternal(uriInfo, securityContext, id, FIELDS, Include.NON_DELETED);
    decryptOrNullify(securityContext, ingestionPipeline);
    HttpResponse<String> response = pipelineServiceClient.killIngestion(ingestionPipeline);
    return Response.status(200, response.body()).build();
  }

  @POST
  @Path("/testConnection")
  @Operation(
      operationId = "testConnection",
      summary = "Test Connection of a Service",
      tags = "ingestionPipelines",
      description = "Test Connection of a Service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content = @Content(mediaType = "application/json"))
      })
  public Response testIngestion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid TestServiceConnection testServiceConnection) {
    testServiceConnection =
        testServiceConnection.withSecretsManagerProvider(
            SecretsManagerFactory.getSecretsManager().getSecretsManagerProvider());
    HttpResponse<String> response = pipelineServiceClient.testConnection(testServiceConnection);
    return Response.status(200, response.body()).build();
  }

  @GET
  @Path("/ip")
  @Operation(
      operationId = "checkAirflowHostIp",
      summary = "Check the Airflow REST host IP",
      tags = "ingestionPipelines",
      description = "Check the Airflow REST host IP",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Pipeline Service host IP",
            content = @Content(mediaType = "application/json"))
      })
  public Response getHostIp(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    Map<String, String> hostIp = pipelineServiceClient.getHostIp();
    return Response.ok(hostIp, MediaType.APPLICATION_JSON_TYPE).build();
  }

  @GET
  @Path("/status")
  @Operation(
      operationId = "checkRestAirflowStatus",
      summary = "Check the Airflow REST status",
      tags = "ingestionPipelines",
      description = "Check that the Airflow REST endpoint is reachable and up and running",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Status message",
            content = @Content(mediaType = "application/json"))
      })
  public Response getRESTStatus(@Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    return pipelineServiceClient.getServiceStatus();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteIngestionPipeline",
      summary = "Delete a Ingestion",
      tags = "ingestionPipelines",
      description = "Delete a ingestion by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteIngestionPipelineByFQN",
      summary = "Delete a Ingestion",
      tags = "ingestionPipelines",
      description = "Delete an ingestion pipeline by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Fully qualified name of the ingestion pipeline", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn)
      throws IOException {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted IngestionPipeline.",
      tags = "ingestionPipelines",
      description = "Restore a soft deleted IngestionPipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the IngestionPipeline. ",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class)))
      })
  public Response restoreIngestionPipeline(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/logs/{id}/last")
  @Operation(
      summary = "Retrieve all logs from last ingestion pipeline run",
      tags = "IngestionPipelines",
      description = "Get all logs from last ingestion pipeline run by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "JSON object with the task instance name of the ingestion on each key and log in the value",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "404", description = "Logs for instance {id} is not found")
      })
  public Response getLastIngestionLogs(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the ingestion pipeline", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(description = "Returns log chunk after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after)
      throws IOException {
    IngestionPipeline ingestionPipeline = getInternal(uriInfo, securityContext, id, FIELDS, Include.NON_DELETED);
    Map<String, String> lastIngestionLogs = pipelineServiceClient.getLastIngestionLogs(ingestionPipeline, after);
    return Response.ok(lastIngestionLogs, MediaType.APPLICATION_JSON_TYPE).build();
  }

  @PUT
  @Path("/{fqn}/pipelineStatus")
  @Operation(
      operationId = "addPipelineStatus",
      summary = "Add pipeline status",
      tags = "IngestionPipelines",
      description = "Add pipeline status of ingestion pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the PipelineStatus. ",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class)))
      })
  public Response addPipelineStatus(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the ingestion pipeline", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Valid PipelineStatus pipelineStatus)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return dao.addPipelineStatus(uriInfo, fqn, pipelineStatus).toResponse();
  }

  @GET
  @Path("/{fqn}/pipelineStatus")
  @Operation(
      operationId = "listPipelineStatuses",
      summary = "List of pipeline status",
      tags = "IngestionPipelines",
      description =
          "Get a list of all the pipeline status for the given ingestion pipeline id, optionally filtered by  `startTs` and `endTs` of the profile. "
              + "Use cursor-based pagination to limit the number of "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of pipeline status",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class)))
      })
  public ResultList<PipelineStatus> listPipelineStatuses(
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the ingestion pipeline", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Filter pipeline status after the given start timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter pipeline status before the given end timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("endTs")
          Long endTs)
      throws IOException {
    return dao.listPipelineStatus(fqn, startTs, endTs);
  }

  @GET
  @Path("/{fqn}/pipelineStatus/{id}")
  @Operation(
      operationId = "getPipelineStatus",
      summary = "get pipeline status",
      tags = "IngestionPipelines",
      description = "Get pipeline status of ingestion pipeline",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated state of the PipelineStatus.",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class)))
      })
  public PipelineStatus getPipelineStatus(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Fully qualified name of the ingestion pipeline", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Id of pipeline status run", schema = @Schema(type = "string")) @PathParam("id")
          UUID runId)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return dao.getPipelineStatus(fqn, runId);
  }

  private IngestionPipeline getIngestionPipeline(CreateIngestionPipeline create, String user) throws IOException {
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig).build();
    return copy(new IngestionPipeline(), create, user)
        .withPipelineType(create.getPipelineType())
        .withAirflowConfig(create.getAirflowConfig())
        .withOpenMetadataServerConnection(openMetadataServerConnection)
        .withSourceConfig(create.getSourceConfig())
        .withLoggerLevel(create.getLoggerLevel())
        .withService(create.getService());
  }

  private IngestionPipeline decryptOrNullify(SecurityContext securityContext, IngestionPipeline ingestionPipeline) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, MetadataOperation.VIEW_ALL),
          getResourceContextById(ingestionPipeline.getId()));
    } catch (AuthorizationException | IOException e) {
      ingestionPipeline.getSourceConfig().setConfig(null);
      return ingestionPipeline;
    }
    secretsManager.encryptOrDecryptIngestionPipeline(ingestionPipeline, false);
    return ingestionPipeline;
  }
}
