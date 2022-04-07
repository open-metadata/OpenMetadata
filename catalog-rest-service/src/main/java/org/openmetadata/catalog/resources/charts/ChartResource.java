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

package org.openmetadata.catalog.resources.charts;

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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateChart;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.jdbi3.ChartRepository;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/charts")
@Api(value = "Chart data asset collection", tags = "Chart data asset collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "charts")
public class ChartResource extends EntityResource<Chart, ChartRepository> {
  public static final String COLLECTION_PATH = "v1/charts/";

  @Override
  public Chart addHref(UriInfo uriInfo, Chart chart) {
    chart.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, chart.getId()));
    Entity.withHref(uriInfo, chart.getOwner());
    Entity.withHref(uriInfo, chart.getService());
    Entity.withHref(uriInfo, chart.getFollowers());
    return chart;
  }

  public ChartResource(CollectionDAO dao, Authorizer authorizer) {
    super(Chart.class, new ChartRepository(dao), authorizer);
  }

  public static class ChartList extends ResultList<Chart> {
    @SuppressWarnings("unused")
    ChartList() {
      // Empty constructor needed for deserialization
    }

    public ChartList(List<Chart> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "owner,followers,tags";

  @GET
  @Operation(
      summary = "List charts",
      tags = "charts",
      description =
          "Get a list of charts, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of charts",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChartList.class)))
      })
  public ResultList<Chart> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Filter charts by service name", schema = @Schema(type = "string", example = "superset"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(description = "Limit the number charts returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(description = "Returns list of charts before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of charts after this cursor", schema = @Schema(type = "string"))
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
      summary = "List chart versions",
      tags = "charts",
      description = "Get a list of all the versions of a chart identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of chart versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Chart Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      summary = "Get a Chart",
      tags = "charts",
      description = "Get a chart by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The chart",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Chart.class))),
        @ApiResponse(responseCode = "404", description = "Chart for instance {id} is not found")
      })
  public Chart get(
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
  @Path("/name/{fqn}")
  @Operation(
      summary = "Get a chart by name",
      tags = "charts",
      description = "Get a chart by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The chart",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Chart.class))),
        @ApiResponse(responseCode = "404", description = "Chart for instance {id} is not found")
      })
  public Chart getByName(
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

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      summary = "Get a version of the chart",
      tags = "charts",
      description = "Get a version of the chart by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "chart",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Chart.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Chart for instance {id} and version {version} is " + "not found")
      })
  public Chart getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Chart Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "Chart version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      summary = "Create a chart",
      tags = "charts",
      description = "Create a chart under an existing `service`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The chart",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateChart.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateChart create)
      throws IOException {
    Chart chart = getChart(securityContext, create);
    return create(uriInfo, securityContext, chart, ADMIN | BOT);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a chart",
      tags = "charts",
      description = "Update an existing chart using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
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
      summary = "Create or update chart",
      tags = "charts",
      description = "Create a chart, it it does not exist or update an existing chart.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated chart ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateChart.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateChart create)
      throws IOException {
    Chart chart = getChart(securityContext, create);
    return createOrUpdate(uriInfo, securityContext, chart, ADMIN | BOT | OWNER);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      summary = "Add a follower",
      tags = "charts",
      description = "Add a user identified by `userId` as followed of this chart",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Chart for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the chart", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "string"))
          String userId)
      throws IOException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(), UUID.fromString(id), UUID.fromString(userId))
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      summary = "Remove a follower",
      tags = "charts",
      description = "Remove the user identified `userId` as a follower of the chart.")
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the chart", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Id of the user being removed as follower", schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId)
      throws IOException {
    return dao.deleteFollower(
            securityContext.getUserPrincipal().getName(), UUID.fromString(id), UUID.fromString(userId))
        .toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a Chart",
      tags = "charts",
      description = "Delete a chart by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Chart for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Chart Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete, ADMIN | BOT);
  }

  private Chart getChart(SecurityContext securityContext, CreateChart create) {
    return new Chart()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withService(create.getService())
        .withChartType(create.getChartType())
        .withChartUrl(create.getChartUrl())
        .withTables(create.getTables())
        .withTags(create.getTags())
        .withOwner(create.getOwner())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withUpdatedAt(System.currentTimeMillis());
  }
}
