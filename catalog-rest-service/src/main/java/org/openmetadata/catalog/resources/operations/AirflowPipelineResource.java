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

package org.openmetadata.catalog.resources.operations;

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
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
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
import org.openmetadata.catalog.api.operations.pipelines.CreateAirflowPipeline;
import org.openmetadata.catalog.jdbi3.AirflowPipelineRepository;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.operations.pipelines.AirflowPipeline;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

@Slf4j
@Path("/operations/v1/airflowPipeline/")
@Api(value = "Ingestion collection", tags = "Ingestion collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "airflowPipelines")
public class AirflowPipelineResource {
  public static final String COLLECTION_PATH = "operations/v1/airflowPipeline/";
  private final AirflowPipelineRepository dao;
  private final Authorizer authorizer;
  private AirflowRESTClient airflowRESTClient;
  private CatalogApplicationConfig config;

  public static void addHref(UriInfo uriInfo, EntityReference ref) {
    ref.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, ref.getId()));
  }

  public static ResultList<AirflowPipeline> addHref(UriInfo uriInfo, ResultList<AirflowPipeline> ingestions) {
    Optional.ofNullable(ingestions.getData()).orElse(Collections.emptyList()).forEach(i -> addHref(uriInfo, i));
    return ingestions;
  }

  public static AirflowPipeline addHref(UriInfo uriInfo, AirflowPipeline airflowPipeline) {
    Entity.withHref(uriInfo, airflowPipeline.getOwner());
    Entity.withHref(uriInfo, airflowPipeline.getService());
    return airflowPipeline;
  }

  public AirflowPipelineResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "AirflowPipelineRepository must not be null");
    this.dao = new AirflowPipelineRepository(dao);
    this.authorizer = authorizer;
  }

  public void initialize(CatalogApplicationConfig config) {
    this.airflowRESTClient = new AirflowRESTClient(config);
    this.config = config;
  }

  public static class AirflowPipelineList extends ResultList<AirflowPipeline> {
    @SuppressWarnings("unused")
    AirflowPipelineList() {
      // Empty constructor needed for deserialization
    }

    public AirflowPipelineList(List<AirflowPipeline> data, String beforeCursor, String afterCursor, int total)
        throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "owner,tags,status,service,pipelineConfig,scheduleInterval";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replace(" ", "").split(","));

  @GET
  @Valid
  @Operation(
      summary = "List Airflow Pipelines for Metadata Operations",
      tags = "airflowPipelines",
      description =
          "Get a list of Airflow Pipelines for Metadata Operations. Use `fields` parameter to get only necessary fields. "
              + " Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of ingestion workflows",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = AirflowPipeline.class)))
      })
  public ResultList<AirflowPipeline> list(
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
          @Min(1)
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
      throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    ResultList<AirflowPipeline> airflowPipelines;
    if (before != null) { // Reverse paging
      airflowPipelines =
          dao.listBefore(uriInfo, fields, serviceParam, limitParam, before, include); // Ask for one extra entry
    } else { // Forward paging or first page
      airflowPipelines = dao.listAfter(uriInfo, fields, serviceParam, limitParam, after, include);
    }
    if (fieldsParam != null && fieldsParam.contains("status")) {
      addStatus(airflowPipelines.getData());
    }
    return addHref(uriInfo, airflowPipelines);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      summary = "List ingestion workflow versions",
      tags = "airflowPipelines",
      description = "Get a list of all the versions of a AirflowPipeline identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of AirflowPipeline versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "AirflowPipeline Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException, ParseException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a AirflowPipeline",
      tags = "airflowPipelines",
      description = "Get a AirflowPipeline by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = AirflowPipeline.class))),
        @ApiResponse(responseCode = "404", description = "AirflowPipeline for instance {id} is not found")
      })
  public AirflowPipeline get(
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
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    AirflowPipeline airflowPipeline = dao.get(uriInfo, id, fields, include);
    if (fieldsParam != null && fieldsParam.contains("status")) {
      airflowPipeline = addStatus(airflowPipeline);
    }
    return addHref(uriInfo, airflowPipeline);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the AirflowPipeline",
      tags = "airflowPipelines",
      description = "Get a version of the AirflowPipeline by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "airflowPipelines",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = AirflowPipeline.class))),
        @ApiResponse(
            responseCode = "404",
            description = "AirflowPipeline for instance {id} and version  " + "{version} is not found")
      })
  public AirflowPipeline getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Ingestion Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "Ingestion version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException, ParseException {
    return dao.getVersion(id, version);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      summary = "Get a AirlfowPipeline by name",
      tags = "airflowPipelines",
      description = "Get a ingestion by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "AirflowPipeline",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = AirflowPipeline.class))),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {id} is not found")
      })
  public AirflowPipeline getByName(
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
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    AirflowPipeline airflowPipeline = dao.getByName(uriInfo, fqn, fields, include);
    if (fieldsParam != null && fieldsParam.contains("status")) {
      airflowPipeline = addStatus(airflowPipeline);
    }
    return addHref(uriInfo, airflowPipeline);
  }

  @POST
  @Operation(
      summary = "Create a Airflow Pipeline",
      tags = "airflowPipelines",
      description = "Create a new Airflow Pipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Airflow Pipeline",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreateAirflowPipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateAirflowPipeline create)
      throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    AirflowPipeline airflowPipeline = getAirflowPipeline(securityContext, create);
    airflowPipeline = addHref(uriInfo, dao.create(uriInfo, airflowPipeline));
    deploy(airflowPipeline);
    return Response.created(airflowPipeline.getHref()).entity(airflowPipeline).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a AirflowPipeline",
      tags = "airflowPipelines",
      description = "Update an existing AirflowPipeline using JsonPatch.",
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
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    AirflowPipeline airflowPipeline = dao.get(uriInfo, id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(
        authorizer, securityContext, dao.getEntityInterface(airflowPipeline).getEntityReference(), patch);

    PatchResponse<AirflowPipeline> response =
        dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PUT
  @Operation(
      summary = "Create or update a AirflowPipeline",
      tags = "airflowPipelines",
      description = "Create a new AirflowPipeline, if it does not exist or update an existing AirflowPipeline.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The AirflowPipeline",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = AirflowPipeline.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateAirflowPipeline create)
      throws IOException, ParseException {
    AirflowPipeline airflowPipeline = getAirflowPipeline(securityContext, create);
    PutResponse<AirflowPipeline> response = dao.createOrUpdate(uriInfo, airflowPipeline);
    deploy(airflowPipeline);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @POST
  @Path("/trigger/{id}")
  @Operation(
      summary = "Trigger a airflow pipeline run",
      tags = "airflowPipelines",
      description = "Trigger a airflow pipeline run by id.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The ingestion",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = AirflowPipeline.class))),
        @ApiResponse(responseCode = "404", description = "Ingestion for instance {name} is not found")
      })
  public AirflowPipeline triggerIngestion(
      @Context UriInfo uriInfo, @PathParam("id") String id, @Context SecurityContext securityContext)
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, "owner");
    AirflowPipeline pipeline = dao.get(uriInfo, id, fields);
    airflowRESTClient.runPipeline(pipeline.getName());
    return addHref(uriInfo, dao.get(uriInfo, id, fields));
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a Ingestion",
      tags = "airflowPipelines",
      description = "Delete a ingestion by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "ingestion for instance {id} is not found")
      })
  public Response delete(@Context UriInfo uriInfo, @PathParam("id") String id) throws IOException {
    dao.delete(UUID.fromString(id), false);
    return Response.ok().build();
  }

  private AirflowPipeline getAirflowPipeline(SecurityContext securityContext, CreateAirflowPipeline create) {
    return new AirflowPipeline()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withPipelineType(create.getPipelineType())
        .withForceDeploy(create.getForceDeploy())
        .withConcurrency(create.getConcurrency())
        .withPausePipeline(create.getPausePipeline())
        .withStartDate(create.getStartDate())
        .withEndDate(create.getEndDate())
        .withRetries(create.getRetries())
        .withRetryDelay(create.getRetryDelay())
        .withPipelineConfig(create.getPipelineConfig())
        .withPipelineCatchup(create.getPipelineCatchup())
        .withPipelineTimeout(create.getPipelineTimeout())
        .withScheduleInterval(create.getScheduleInterval())
        .withOwner(create.getOwner())
        .withService(create.getService())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }

  private void deploy(AirflowPipeline airflowPipeline) {
    if (Boolean.TRUE.equals(airflowPipeline.getForceDeploy())) {
      airflowRESTClient.deploy(airflowPipeline, config);
    }
  }

  public void addStatus(List<AirflowPipeline> airflowPipelines) {
    Optional.ofNullable(airflowPipelines).orElse(Collections.emptyList()).forEach(this::addStatus);
  }

  private AirflowPipeline addStatus(AirflowPipeline airflowPipeline) {
    try {
      airflowPipeline = airflowRESTClient.getStatus(airflowPipeline);
    } catch (Exception e) {
      LOG.error("Failed to fetch status for {}", airflowPipeline.getName());
    }
    return airflowPipeline;
  }
}
