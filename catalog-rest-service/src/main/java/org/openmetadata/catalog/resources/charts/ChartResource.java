/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.charts;

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.api.data.CreateChart;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.jdbi3.ChartRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Path("/v1/charts")
@Api(value = "Chart data asset collection", tags = "Chart data asset collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "charts", repositoryClass = "org.openmetadata.catalog.jdbi3.ChartRepository")
public class ChartResource {
  private static final Logger LOG = LoggerFactory.getLogger(ChartResource.class);
  private static final String CHART_COLLECTION_PATH = "v1/charts/";
  private final ChartRepository dao;
  private final CatalogAuthorizer authorizer;

  public static void addHref(UriInfo uriInfo, EntityReference ref) {
    ref.withHref(RestUtil.getHref(uriInfo, CHART_COLLECTION_PATH, ref.getId()));
  }

  public static List<Chart> addHref(UriInfo uriInfo, List<Chart> charts) {
    Optional.ofNullable(charts).orElse(Collections.emptyList()).forEach(i -> addHref(uriInfo, i));
    return charts;
  }

  public static Chart addHref(UriInfo uriInfo, Chart chart) {
    chart.setHref(RestUtil.getHref(uriInfo, CHART_COLLECTION_PATH, chart.getId()));
    EntityUtil.addHref(uriInfo, chart.getOwner());
    EntityUtil.addHref(uriInfo, chart.getService());
    EntityUtil.addHref(uriInfo, chart.getFollowers());

    return chart;
  }

  @Inject
  public ChartResource(ChartRepository dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "ChartRepository must not be null");
    this.dao = dao;
    this.authorizer = authorizer;
  }

  public static class ChartList extends ResultList<Chart> {
    @SuppressWarnings("unused")
    ChartList() {
      // Empty constructor needed for deserialization
    }

    public ChartList(List<Chart> data, String beforeCursor, String afterCursor, int total)
            throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "owner,service,followers,tags";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "")
          .split(","));

  @GET
  @Valid
  @Operation(summary = "List charts", tags = "charts",
          description = "Get a list of charts, optionally filtered by `service` it belongs to. Use `fields` " +
                  "parameter to get only necessary fields. Use cursor-based pagination to limit the number " +
                  "entries in the list using `limit` and `before` or `after` query params.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of charts",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = ChartList.class)))
          })
  public ChartList list(@Context UriInfo uriInfo,
                        @Context SecurityContext securityContext,
                        @Parameter(description = "Fields requested in the returned resource",
                                schema = @Schema(type = "string", example = FIELDS))
                        @QueryParam("fields") String fieldsParam,
                        @Parameter(description = "Filter charts by service name",
                                schema = @Schema(type = "string", example = "superset"))
                        @QueryParam("service") String serviceParam,
                        @Parameter(description = "Limit the number charts returned. (1 to 1000000, default = 10)")
                        @DefaultValue("10")
                        @Min(1)
                        @Max(1000000)
                        @QueryParam("limit") int limitParam,
                        @Parameter(description = "Returns list of charts before this cursor",
                                schema = @Schema(type = "string"))
                        @QueryParam("before") String before,
                        @Parameter(description = "Returns list of charts after this cursor",
                                schema = @Schema(type = "string"))
                        @QueryParam("after") String after
  ) throws IOException, GeneralSecurityException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    ChartList charts;
    if (before != null) { // Reverse paging
      charts = dao.listBefore(fields, serviceParam, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      charts = dao.listAfter(fields, serviceParam, limitParam, after);
    }
    addHref(uriInfo, charts.getData());
    return charts;
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a Chart", tags = "charts",
          description = "Get a chart by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The chart",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = Chart.class))),
                  @ApiResponse(responseCode = "404", description = "Chart for instance {id} is not found")
          })
  public Chart get(@Context UriInfo uriInfo, @PathParam("id") String id,
                      @Context SecurityContext securityContext,
                      @Parameter(description = "Fields requested in the returned resource",
                              schema = @Schema(type = "string", example = FIELDS))
                      @QueryParam("fields") String fieldsParam) throws IOException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(id, fields));
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(summary = "Get a chart by name", tags = "charts",
          description = "Get a chart by fully qualified name.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The chart",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = Chart.class))),
                  @ApiResponse(responseCode = "404", description = "Chart for instance {id} is not found")
          })
  public Response getByName(@Context UriInfo uriInfo, @PathParam("fqn") String fqn,
                            @Context SecurityContext securityContext,
                            @Parameter(description = "Fields requested in the returned resource",
                                    schema = @Schema(type = "string", example = FIELDS))
                            @QueryParam("fields") String fieldsParam) throws IOException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    Chart chart = dao.getByName(fqn, fields);
    addHref(uriInfo, chart);
    return Response.ok(chart).build();
  }

  @POST
  @Operation(summary = "Create a chart", tags = "charts",
          description = "Create a chart under an existing `service`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The chart",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = CreateChart.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext,
                         @Valid CreateChart create) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Chart chart =
            new Chart().withId(UUID.randomUUID()).withName(create.getName()).withDisplayName(create.getDisplayName())
                    .withDescription(create.getDescription())
                    .withService(create.getService())
                    .withChartType(create.getChartType()).withChartUrl(create.getChartUrl())
                    .withTables(create.getTables()).withTags(create.getTags())
                    .withOwner(create.getOwner())
                    .withUpdatedBy(securityContext.getUserPrincipal().getName())
                    .withUpdatedAt(new Date());
    chart = addHref(uriInfo, dao.create(chart, create.getService(), create.getOwner()));
    return Response.created(chart.getHref()).entity(chart).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(summary = "Update a chart", tags = "charts",
          description = "Update an existing chart using JsonPatch.",
          externalDocs = @ExternalDocumentation(description = "JsonPatch RFC",
                  url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Chart updateDescription(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @PathParam("id") String id,
                                 @RequestBody(description = "JsonPatch with array of operations",
                                         content = @Content(mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                                                 examples = {@ExampleObject("[" +
                                                         "{op:remove, path:/a}," +
                                                         "{op:add, path: /b, value: val}" +
                                                         "]")}))
                                         JsonPatch patch) throws IOException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    Chart chart = dao.get(id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext,
            EntityUtil.getEntityReference(chart));
    chart = dao.patch(id, securityContext.getUserPrincipal().getName(), patch);
    return addHref(uriInfo, chart);
  }

  @PUT
  @Operation(summary = "Create or update chart", tags = "charts",
          description = "Create a chart, it it does not exist or update an existing chart.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The updated chart ",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = CreateChart.class)))
          })
  public Response createOrUpdate(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @Valid CreateChart create) throws IOException {

    Chart chart =
            new Chart().withId(UUID.randomUUID()).withName(create.getName()).withDisplayName(create.getDisplayName())
                    .withDescription(create.getDescription())
                    .withService(create.getService())
                    .withChartType(create.getChartType()).withChartUrl(create.getChartUrl())
                    .withTables(create.getTables()).withTags(create.getTags())
                    .withOwner(create.getOwner())
                    .withUpdatedBy(securityContext.getUserPrincipal().getName())
                    .withUpdatedAt(new Date());
    PutResponse<Chart> response = dao.createOrUpdate(chart, create.getService(), create.getOwner());
    chart = addHref(uriInfo, response.getEntity());
    return Response.status(response.getStatus()).entity(chart).build();
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(summary = "Add a follower", tags = "charts",
          description = "Add a user identified by `userId` as followed of this chart",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "Chart for instance {id} is not found")
          })
  public Response addFollower(@Context UriInfo uriInfo,
                              @Context SecurityContext securityContext,
                              @Parameter(description = "Id of the chart", schema = @Schema(type = "string"))
                              @PathParam("id") String id,
                              @Parameter(description = "Id of the user to be added as follower",
                                      schema = @Schema(type = "string"))
                                      String userId) throws IOException {
    Fields fields = new Fields(FIELD_LIST, "followers");
    Response.Status status = dao.addFollower(id, userId);
    Chart chart = addHref(uriInfo, dao.get(id, fields));
    return Response.status(status).entity(chart).build();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(summary = "Remove a follower", tags = "charts",
          description = "Remove the user identified `userId` as a follower of the chart.")
  public Chart deleteFollower(@Context UriInfo uriInfo,
                              @Context SecurityContext securityContext,
                              @Parameter(description = "Id of the chart",
                                      schema = @Schema(type = "string"))
                              @PathParam("id") String id,
                              @Parameter(description = "Id of the user being removed as follower",
                                      schema = @Schema(type = "string"))
                              @PathParam("userId") String userId) throws IOException {
    Fields fields = new Fields(FIELD_LIST, "followers");
    dao.deleteFollower(id, userId);
    return addHref(uriInfo, dao.get(id, fields));
  }


  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a Chart", tags = "charts",
          description = "Delete a chart by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "Chart for instance {id} is not found")
          })
  public Response delete(@Context UriInfo uriInfo, @PathParam("id") String id) {
    dao.delete(id);
    return Response.ok().build();
  }
}
