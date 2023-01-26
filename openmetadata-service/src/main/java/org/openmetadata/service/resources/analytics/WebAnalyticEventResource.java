package org.openmetadata.service.resources.analytics;

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
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.tests.CreateWebAnalyticEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WebAnalyticEventRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/analytics/webAnalyticEvent")
@Api(value = "webAnalyticEvent collection", tags = "webAnalyticEvent collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "webAnalyticEvent")
public class WebAnalyticEventResource extends EntityResource<WebAnalyticEvent, WebAnalyticEventRepository> {
  public static final String COLLECTION_PATH = WebAnalyticEventRepository.COLLECTION_PATH;
  static final String FIELDS = "owner";

  @Override
  public WebAnalyticEvent addHref(UriInfo uriInfo, WebAnalyticEvent entity) {
    entity.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, entity.getId()));
    Entity.withHref(uriInfo, entity.getOwner());
    return entity;
  }

  @Inject
  public WebAnalyticEventResource(CollectionDAO dao, Authorizer authorizer) {
    super(WebAnalyticEvent.class, new WebAnalyticEventRepository(dao), authorizer);
  }

  public static class WebAnalyticEventList extends ResultList<WebAnalyticEvent> {
    @SuppressWarnings("unused")
    public WebAnalyticEventList() {
      // Empty constructor needed for deserialization
    }
  }

  public static class WebAnalyticEventDataList extends ResultList<WebAnalyticEventData> {
    @SuppressWarnings("unused")
    public WebAnalyticEventDataList() {
      // Empty constructor needed for deserialization
    }
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // Find the existing webAnalyticEventTypes and add them from json files
    List<WebAnalyticEvent> webAnalyticEvents =
        dao.getEntitiesFromSeedData(".*json/data/analytics/webAnalyticEvents/.*\\.json$");
    for (WebAnalyticEvent webAnalyticEvent : webAnalyticEvents) {
      dao.initializeEntity(webAnalyticEvent);
    }
  }

  @GET
  @Operation(
      operationId = "listWebAnalyticEventTypes",
      summary = "List web analytic event types",
      tags = "webAnalyticEvent",
      description =
          "Get a list of web analytics event types."
              + "Use field parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of web analytic event types",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WebAnalyticEventResource.WebAnalyticEventList.class)))
      })
  public ResultList<WebAnalyticEvent> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number report Definition returned. (1 to 1000000, default = " + "10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(
              description = "Returns list of report definitions before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of report definitions after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include);
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @POST
  @Operation(
      operationId = "createWebAnalyticEventType",
      summary = "Create a web analytic event type",
      tags = "webAnalyticEvent",
      description = "Create a web analytic event type",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Create a web analytic event type",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = WebAnalyticEvent.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateWebAnalyticEvent create)
      throws IOException {
    WebAnalyticEvent webAnalyticEvent = getWebAnalyticEvent(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, webAnalyticEvent);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateWebAnalyticEventType",
      summary = "Update a web analytic event type",
      tags = "webAnalyticEvent",
      description = "Update web analytic event type.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Updated web analytic event type",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = WebAnalyticEvent.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateWebAnalyticEvent create)
      throws IOException {
    WebAnalyticEvent webAnalyticEvent = getWebAnalyticEvent(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, webAnalyticEvent);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getWebAnalyticEventTypeById",
      summary = "Get a web analytic event type by id",
      tags = "webAnalyticEvent",
      description = "Get a web analytic event type by `ID`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "A web analytic event type",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = WebAnalyticEvent.class))),
        @ApiResponse(responseCode = "404", description = "Web Analytic Event for instance {id} is not found")
      })
  public WebAnalyticEvent get(
      @Context UriInfo uriInfo,
      @PathParam("id") UUID id,
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
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchWebAnalyticEventTypeById",
      summary = "Update a web analytic event type",
      tags = "webAnalyticEvent",
      description = "Update a web analytic event type.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
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

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteWebAnalyticEventTypeById",
      summary = "delete a web analytic event type",
      tags = "webAnalyticEvent",
      description = "Delete a web analytic event type by id.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Web Analytic event for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Web Analytic event Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteWebAnalyticEventTypeByName",
      summary = "delete a web analytic event type",
      tags = "webAnalyticEvent",
      description = "Delete a web analytic event type by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Web Analytic event for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Web Analytic name", schema = @Schema(type = "string")) @PathParam("name") String name)
      throws IOException {
    return deleteByName(uriInfo, securityContext, name, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted WebAnalyticEvent.",
      tags = "webAnalyticEvent",
      description = "Restore a soft deleted WebAnalyticEvent.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the WebAnalyticEvent. ",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = WebAnalyticEvent.class)))
      })
  public Response restoreWebAnalyticEvent(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getWebAnalyticEventTypeByName",
      summary = "Get a web analytic event type by Name",
      tags = "webAnalyticEvent",
      description = "Get a web analytic event type by Name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "A web analytic event type",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = WebAnalyticEvent.class))),
        @ApiResponse(responseCode = "404", description = "Web Analytic event type for instance {id} is not found")
      })
  public WebAnalyticEvent getByName(
      @Context UriInfo uriInfo,
      @PathParam("name") String name,
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
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllWebAnalyticEventTypeVersion",
      summary = "List web analytic event type versions",
      tags = "webAnalyticEvent",
      description = "Get a list of all the version of a web analytic event type by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List all web analytic event type versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Web Analytic event type Id", schema = @Schema(type = "string")) @PathParam("id")
          UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificWebAnalyticEventTypeVersion",
      summary = "Get a version of the report definition",
      tags = "webAnalyticEvent",
      description = "Get a version of the web analytic event type by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "WebAnalyticEvent",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = WebAnalyticEvent.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Web Analytic event type for instance {id} and version {version} is " + "not found")
      })
  public WebAnalyticEvent getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Web Analytic Event type Id", schema = @Schema(type = "string")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Web Analytic Event type version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @PUT
  @Path("/collect")
  @Operation(
      operationId = "addWebAnalyticEventData",
      summary = "Add web analytic event data",
      tags = "webAnalyticEvent",
      description = "Add web analytic event data",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully added web analytic event data",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = WebAnalyticEventData.class)))
      })
  public Response addReportResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid WebAnalyticEventData webAnalyticEventData)
      throws IOException {
    return dao.addWebAnalyticEventData(webAnalyticEventData);
  }

  @DELETE
  @Path("/{name}/{timestamp}/collect")
  @Operation(
      operationId = "deleteWebAnalyticEventData",
      summary = "delete web analytic event data before a timestamp",
      tags = "webAnalyticEvent",
      description = "Delete web analytic event data before a timestamp.",
      responses = {@ApiResponse(responseCode = "200", description = "Successfully deleted Web Analytic Event Data")})
  public Response deleteWebAnalyticEventData(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Web Analytic Event type Name",
              schema = @Schema(implementation = WebAnalyticEventType.class))
          @PathParam("name")
          WebAnalyticEventType name,
      @Parameter(
              description = "Timestamp of the event. Event before the timestamp will be deleted",
              schema = @Schema(type = "long"))
          @PathParam("timestamp")
          Long timestamp)
      throws IOException {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name.value()));
    dao.deleteWebAnalyticEventData(name, timestamp);
    return Response.ok().build();
  }

  @GET
  @Path("/collect")
  @Operation(
      operationId = "getWebAnalyticEventData",
      summary = "Retrieve web analytic data",
      tags = "webAnalyticEvent",
      description = "Retrieve web analytic data.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of web analytic data",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WebAnalyticEventResource.WebAnalyticEventDataList.class)))
      })
  public ResultList<WebAnalyticEventData> listWebAnalyticEventData(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Filter web analytic events for a particular event type",
              schema = @Schema(type = "string"))
          @NonNull
          @QueryParam("eventType")
          String eventType,
      @Parameter(
              description = "Filter web analytic events after the given start timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter web analytic events before the given end timestamp",
              schema = @Schema(type = "number"))
          @NonNull
          @QueryParam("endTs")
          Long endTs)
      throws IOException {
    return dao.getWebAnalyticEventData(eventType, startTs, endTs);
  }

  private WebAnalyticEvent getWebAnalyticEvent(CreateWebAnalyticEvent create, String user) throws IOException {
    return copy(new WebAnalyticEvent(), create, user)
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withEventType(create.getEventType());
  }
}
