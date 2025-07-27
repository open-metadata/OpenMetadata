package org.openmetadata.service.resources.analytics;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Hidden;
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
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.analytics.CustomEvent;
import org.openmetadata.schema.analytics.PageViewData;
import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.tests.CreateWebAnalyticEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WebAnalyticEventRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/analytics/web/events")
@Tag(name = "Data Insights", description = "APIs related to Data Insights data and charts.")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "analytics")
public class WebAnalyticEventResource
    extends EntityResource<WebAnalyticEvent, WebAnalyticEventRepository> {
  public static final String COLLECTION_PATH = WebAnalyticEventRepository.COLLECTION_PATH;
  static final String FIELDS = "owners";
  private static final Pattern HTML_PATTERN = Pattern.compile(".*\\<[^>]+>.*", Pattern.DOTALL);
  private final WebAnalyticEventMapper mapper = new WebAnalyticEventMapper();

  public WebAnalyticEventResource(Authorizer authorizer, Limits limits) {
    super(Entity.WEB_ANALYTIC_EVENT, authorizer, limits);
  }

  public static class WebAnalyticEventList extends ResultList<WebAnalyticEvent> {
    /* Required for serde */
  }

  public static class WebAnalyticEventDataList extends ResultList<WebAnalyticEventData> {
    /* Required for serde */
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // Find the existing webAnalyticEventTypes and add them from json files
    List<WebAnalyticEvent> webAnalyticEvents =
        repository.getEntitiesFromSeedData(".*json/data/analytics/webAnalyticEvents/.*\\.json$");
    for (WebAnalyticEvent webAnalyticEvent : webAnalyticEvents) {
      repository.initializeEntity(webAnalyticEvent);
    }
  }

  @GET
  @Operation(
      operationId = "listWebAnalyticEventTypes",
      summary = "List web analytic event types",
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
                    schema =
                        @Schema(
                            implementation = WebAnalyticEventResource.WebAnalyticEventList.class)))
      })
  public ResultList<WebAnalyticEvent> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description =
                  "Limit the number report Definition returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
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
          Include include) {
    ListFilter filter = new ListFilter(include);
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @POST
  @Operation(
      operationId = "createWebAnalyticEventType",
      summary = "Create a web analytic event type",
      description = "Create a web analytic event type",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Create a web analytic event type",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WebAnalyticEvent.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateWebAnalyticEvent create) {
    WebAnalyticEvent webAnalyticEvent =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, webAnalyticEvent);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateWebAnalyticEventType",
      summary = "Update a web analytic event type",
      description = "Update web analytic event type.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Updated web analytic event type",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WebAnalyticEvent.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateWebAnalyticEvent create) {
    WebAnalyticEvent webAnalyticEvent =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, webAnalyticEvent);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getWebAnalyticEventTypeById",
      summary = "Get a web analytic event type by Id",
      description = "Get a web analytic event type by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "A web analytic event type",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WebAnalyticEvent.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Web Analytic Event for instance {id} is not found")
      })
  public WebAnalyticEvent get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the web analytic event", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
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
          Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchWebAnalyticEventTypeById",
      summary = "Update a web analytic event type by Id",
      description = "Update a web analytic event type.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the web analytic event", schema = @Schema(type = "UUID"))
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
      operationId = "patchWebAnalyticEventTypeByName",
      summary = "Update a web analytic event type by fully qualified name",
      description = "Update a web analytic event type by `fullyQualifiedName`.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the web analytic event", schema = @Schema(type = "string"))
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

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteWebAnalyticEventTypeById",
      summary = "Delete a web analytic event type by Id",
      description = "Delete a web analytic event type by Id.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Web Analytic event for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the web analytic event", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteWebAnalyticEventTypeByIdAsync",
      summary = "Asynchronously delete a web analytic event type by Id",
      description = "Asynchronously delete a web analytic event type by Id.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Web Analytic event for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the web analytic event", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteWebAnalyticEventTypeByName",
      summary = "Delete a web analytic event type by fully qualified name",
      description = "Delete a web analytic event type by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Web Analytic event for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Fully qualified name of the web analytic event",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted web analytic event",
      description = "Restore a soft deleted web analytic event.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the WebAnalyticEvent. ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WebAnalyticEvent.class)))
      })
  public Response restoreWebAnalyticEvent(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getWebAnalyticEventTypeByName",
      summary = "Get a web analytic event type by fully qualified name",
      description = "Get a web analytic event type by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "A web analytic event type",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WebAnalyticEvent.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Web Analytic event type for instance {fqn} is not found")
      })
  public WebAnalyticEvent getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the web analytic event",
              schema = @Schema(type = "string"))
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
          Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllWebAnalyticEventTypeVersion",
      summary = "List web analytic event type versions",
      description = "Get a list of all the version of a web analytic event type by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List all web analytic event type versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the web analytic event", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificWebAnalyticEventTypeVersion",
      summary = "Get a version of the report definition",
      description = "Get a version of the web analytic event type by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "WebAnalyticEvent",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WebAnalyticEvent.class))),
        @ApiResponse(
            responseCode = "404",
            description =
                "Web Analytic event type for instance {id} and version {version} is not found")
      })
  public WebAnalyticEvent getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the web analytic event", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Web Analytic Event type version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @PUT
  @Path("/collect")
  @Operation(
      operationId = "addWebAnalyticEventData",
      summary = "Add web analytic event data",
      description = "Add web analytic event data",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully added web analytic event data",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WebAnalyticEventData.class)))
      })
  public Response addReportResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid WebAnalyticEventData webAnalyticEventData) {

    return repository.addWebAnalyticEventData(sanitizeWebAnalyticEventData(webAnalyticEventData));
  }

  @DELETE
  @Path("/{name}/{timestamp}/collect")
  @Operation(
      operationId = "deleteWebAnalyticEventData",
      summary = "Delete web analytic event data before a timestamp",
      description = "Delete web analytic event data before a timestamp.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully deleted Web Analytic Event Data")
      })
  public Response deleteWebAnalyticEventData(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Name of the Web Analytic event",
              schema = @Schema(implementation = WebAnalyticEventType.class))
          @PathParam("name")
          WebAnalyticEventType name,
      @Parameter(
              description = "Timestamp of the event. Event before the timestamp will be deleted",
              schema = @Schema(type = "long"))
          @PathParam("timestamp")
          Long timestamp) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name.value()));
    repository.deleteWebAnalyticEventData(name, timestamp);
    return Response.ok().build();
  }

  @GET
  @Path("/collect")
  @Operation(
      operationId = "getWebAnalyticEventData",
      summary = "Retrieve web analytic data",
      description = "Retrieve web analytic data.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of web analytic data",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WebAnalyticEventDataList.class)))
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
          Long endTs) {
    return repository.getWebAnalyticEventData(eventType, startTs, endTs);
  }

  public static WebAnalyticEventData sanitizeWebAnalyticEventData(
      WebAnalyticEventData webAnalyticEventDataInput) {
    Object inputData = webAnalyticEventDataInput.getEventData();
    if (webAnalyticEventDataInput.getEventType().equals(WebAnalyticEventType.PAGE_VIEW)) {
      // Validate Json as Page View Data
      PageViewData pageViewData = JsonUtils.convertValue(inputData, PageViewData.class);
      webAnalyticEventDataInput.setEventData(pageViewData);
    } else if (webAnalyticEventDataInput.getEventType().equals(WebAnalyticEventType.CUSTOM_EVENT)) {
      // Validate Json as type Custom Event
      CustomEvent customEventData = JsonUtils.convertValue(inputData, CustomEvent.class);
      if (customEventData.getEventType().equals(CustomEvent.CustomEventTypes.CLICK)) {
        if (containsHtml(customEventData.getEventValue())) {
          throw new IllegalArgumentException("Invalid event value for custom event.");
        }
        webAnalyticEventDataInput.setEventData(customEventData);
      } else {
        throw new IllegalArgumentException("Invalid event type for custom event");
      }
    } else {
      throw new IllegalArgumentException("Invalid event type for Web Analytic Event Data");
    }

    return webAnalyticEventDataInput;
  }

  public static boolean containsHtml(String input) {
    if (input == null || input.isEmpty()) {
      return false;
    }
    return HTML_PATTERN.matcher(input).matches();
  }
}
