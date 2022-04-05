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

package org.openmetadata.catalog.resources.services.ingestionpipelines;

import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.security.SecurityUtil.ADMIN;
import static org.openmetadata.catalog.security.SecurityUtil.BOT;
import static org.openmetadata.catalog.security.SecurityUtil.OWNER;

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
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.airflow.AirflowRESTClient;
import org.openmetadata.catalog.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.catalog.entity.services.ingestionPipelines.OpenMetadataServerConfig;
import org.openmetadata.catalog.entity.services.ingestionPipelines.Source;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.IngestionPipelineRepository;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.ResultList;

@Slf4j
@Path("/v1/services/ingestionPipelines/")
@Api(value = "Ingestion collection", tags = "Ingestion collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "IngestionPipelines")
public class IngestionPipelineResource extends EntityResource<IngestionPipeline, IngestionPipelineRepository> {
  public static final String COLLECTION_PATH = "v1/services/ingestionPipelines/";
  private AirflowRESTClient airflowRESTClient;
  private OpenMetadataServerConfig serverConfig;

  @Override
  public IngestionPipeline addHref(UriInfo uriInfo, IngestionPipeline ingestionPipeline) {
    Entity.withHref(uriInfo, ingestionPipeline.getOwner());
    Entity.withHref(uriInfo, ingestionPipeline.getService());
    return ingestionPipeline;
  }

  public IngestionPipelineResource(CollectionDAO dao, Authorizer authorizer) {
    super(IngestionPipeline.class, new IngestionPipelineRepository(dao), authorizer);
  }

  public void initialize(CatalogApplicationConfig config) {
    this.airflowRESTClient = new AirflowRESTClient(config);
    this.serverConfig =
        new OpenMetadataServerConfig()
            .withHostPort(config.getAirflowConfiguration().getApiEndpoint())
            .withAuthProvider(
                OpenMetadataServerConfig.AuthProvider.valueOf(config.getAirflowConfiguration().getAuthProvider()));
  }

  public static class IngestionPipelineList extends ResultList<IngestionPipeline> {
    @SuppressWarnings("unused")
    public IngestionPipelineList() {
      // Empty constructor needed for deserialization
    }

    public IngestionPipelineList(List<IngestionPipeline> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = FIELD_OWNER;

  @GET
  @Valid
  @Operation(
      summary = "List Airflow Pipelines for Metadata Operations",
      tags = "IngestionPipelines",
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
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List ingestion workflow versions",
      tags = "IngestionPipelines",
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
      @Parameter(description = "IngestionPipeline Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a IngestionPipeline",
      tags = "IngestionPipelines",
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
      @PathParam("id") String id,
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
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the IngestionPipeline",
      tags = "IngestionPipelines",
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
      @Parameter(description = "Ingestion Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "Ingestion version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return dao.getVersion(id, version);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      summary = "Get a IngestionPipeline by name",
      tags = "IngestionPipelines",
      description = "Get a ingestion by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "IngestionPipeline",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
      })
  public IngestionPipeline getByName(
      @Context UriInfo uriInfo,
      @PathParam("fqn") String fqn,
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
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @POST
  @Operation(
      summary = "Create a Ingestion Pipeline",
      tags = "IngestionPipelines",
      description = "Create a new Ingestion Pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Airflow Pipeline",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreateIngestionPipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateIngestionPipeline create)
      throws IOException {
    IngestionPipeline ingestionPipeline = getIngestionPipeline(securityContext, create);
    Response response = create(uriInfo, securityContext, ingestionPipeline, ADMIN | BOT);
    deploy(ingestionPipeline);
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a IngestionPipeline",
      tags = "IngestionPipelines",
      description = "Update an existing IngestionPipeline using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
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
      summary = "Create or update a IngestionPipeline",
      tags = "IngestionPipelines",
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
    IngestionPipeline ingestionPipeline = getIngestionPipeline(securityContext, update);
    Response response = createOrUpdate(uriInfo, securityContext, ingestionPipeline, ADMIN | BOT | OWNER);
    deploy(ingestionPipeline);
    return response;
  }

  @POST
  @Path("/trigger/{id}")
  @Operation(
      summary = "Trigger a airflow pipeline run",
      tags = "IngestionPipelines",
      description = "Trigger a airflow pipeline run by id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = IngestionPipeline.class))),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {name} is not found")
      })
  public IngestionPipeline triggerIngestion(
      @Context UriInfo uriInfo, @PathParam("id") String id, @Context SecurityContext securityContext)
      throws IOException {
    Fields fields = getFields(FIELD_OWNER);
    IngestionPipeline pipeline = dao.get(uriInfo, id, fields);
    airflowRESTClient.runPipeline(pipeline.getName());
    return addHref(uriInfo, dao.get(uriInfo, id, fields));
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a Ingestion",
      tags = "IngestionPipelines",
      description = "Delete a ingestion by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "ingestion for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Pipeline Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    Response response = delete(uriInfo, securityContext, id, false, hardDelete, ADMIN | BOT);
    IngestionPipeline pipeline = (IngestionPipeline) response.getEntity();
    airflowRESTClient.deletePipeline(pipeline.getName());
    return response;
  }

  private IngestionPipeline getIngestionPipeline(SecurityContext securityContext, CreateIngestionPipeline create)
      throws IOException {
    Source source = buildIngestionSource(create);

    return new IngestionPipeline()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withPipelineType(create.getPipelineType())
        .withAirflowConfig(create.getAirflowConfig())
        .withOpenMetadataServerConnection(serverConfig)
        .withSource(source)
        .withOwner(create.getOwner())
        .withService(create.getService())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }

  private void deploy(IngestionPipeline ingestionPipeline) {
    if (Boolean.TRUE.equals(ingestionPipeline.getAirflowConfig().getForceDeploy())) {
      airflowRESTClient.deploy(ingestionPipeline);
    }
  }

  private Source buildIngestionSource(CreateIngestionPipeline create) throws IOException {
    Source source;
    String serviceType = create.getService().getType();
    Fields serviceFields = new Fields(List.of("connection"));
    switch (serviceType) {
      case Entity.DATABASE_SERVICE:
        DatabaseService databaseService = Entity.getEntity(create.getService(), serviceFields, Include.ALL);
        source =
            new Source()
                .withServiceConnection(databaseService.getConnection())
                .withServiceName(databaseService.getName())
                .withType(databaseService.getServiceType().value());
        break;
      case Entity.DASHBOARD_SERVICE:
        DashboardService dashboardService = Entity.getEntity(create.getService(), serviceFields, Include.ALL);
        source =
            new Source()
                .withServiceName(dashboardService.getName())
                .withServiceConnection(dashboardService.getConnection())
                .withType(dashboardService.getServiceType().value());
        break;
      case Entity.MESSAGING_SERVICE:
        MessagingService messagingService = Entity.getEntity(create.getService(), serviceFields, Include.ALL);
        source =
            new Source()
                .withServiceName(messagingService.getName())
                .withServiceConnection(messagingService.getConnection())
                .withType(messagingService.getServiceType().value());
        break;
      default:
        throw new IllegalArgumentException(
            String.format("Ingestion Pipeline is not supported for service %s", serviceType));
    }
    source.setSourceConfig(create.getSourceConfig());
    return source;
  }
}
