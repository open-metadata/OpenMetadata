package org.openmetadata.service.resources.openlineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.OPEN_LINEAGE_EVENT_CREATED;
import static org.openmetadata.service.util.RestUtil.CHANGE_CUSTOM_HEADER;

import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.schema.lineage.OpenLineageWrappedEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.jdbi3.OpenLineageEventRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.JsonUtils;

/**
 * Resource class for managing OpenLineage events.
 *
 * <p>This endpoint follows the official OpenLineage Standard.
 * See <a href="https://openlineage.io/">OpenLineage Documentation</a> for more details.</p>
 *
 * <p>OpenLineage is an open standard for metadata and lineage collection designed to
 * instrument data processing systems to capture and store lineage information.</p>
 */
@Path("/v1/openlineage")
@Tag(
    name = "OpenLineageEvents",
    description = "API for managing OpenLineage events as per the OpenLineage Standard.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "openlineage")
public class OpenLineageEventsResource {
  private final OpenLineageEventRepository dao;
  private final Authorizer authorizer;
  private static final String INVALID_OPENLINEAGE_CREATE_REQUEST =
      "Cannot Create OpenLineage Event";

  public OpenLineageEventsResource(Authorizer authorizer) {
    this.dao = Entity.getOpenLineageEventRepository();
    this.authorizer = authorizer;
  }

  @POST
  @Path("/lineage")
  @Operation(
      operationId = "createOpenLineageEvent",
      summary = "Create a new OpenLineage Event.",
      description = "Create a new OpenLineage Event, following the OpenLineage Standard.",
      responses = {
        @ApiResponse(
            responseCode = "201",
            description = "The OpenLineage Event created successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = String.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createEvent(
      @Context UriInfo uriInfo,
      @RequestBody(description = "OpenLineage event data", required = true) String create) {

    OpenLineageWrappedEvent event = getOpenLineageWrappedEvent(create);
    dao.create(event);
    return Response.status(Response.Status.CREATED)
        .header(CHANGE_CUSTOM_HEADER, OPEN_LINEAGE_EVENT_CREATED)
        .build();
  }

  @GET
  @Path("/events/lineage")
  @Operation(
      operationId = "listOpenLineageEvents",
      summary = "List all OpenLineage events",
      description = "Get a list of all OpenLineage events.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The OpenLineage Events",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = OpenLineageWrappedEvent.class))),
        @ApiResponse(responseCode = "404", description = "OpenLineage Events not found")
      })
  public Response listEvents() {
    return Response.ok(dao.listAllEvents()).build();
  }

  private OpenLineageWrappedEvent getOpenLineageWrappedEvent(String event) {
    validate(event);
    JsonNode jsonNode = JsonUtils.readTree(event);
    JsonNode runIdNode = jsonNode.path("run").path("runId");
    JsonNode eventTypeNode = jsonNode.path("eventType");

    return new OpenLineageWrappedEvent()
        .withId(UUID.randomUUID())
        .withRunid(runIdNode.asText())
        .withEventtype(eventTypeNode.asText())
        .withEvent(event);
  }

  private void validate(String lineageEvent) {

    JsonNode eventNode = JsonUtils.readTree(lineageEvent);
    JsonNode runIdNode = eventNode.path("run").path("runId");
    JsonNode eventTypeNode = eventNode.path("eventType");

    if (nullOrEmpty(lineageEvent)) {
      throw new CustomExceptionMessage(
          Response.Status.BAD_REQUEST,
          INVALID_OPENLINEAGE_CREATE_REQUEST,
          "OpenLineageEvent body cannot be empty.");
    }
    if (nullOrEmpty(runIdNode.asText())) {
      throw new CustomExceptionMessage(
          Response.Status.BAD_REQUEST,
          INVALID_OPENLINEAGE_CREATE_REQUEST,
          "OpenLineageEvent RunID cannot be empty.");
    }
    if (nullOrEmpty(eventTypeNode.asText())) {
      throw new CustomExceptionMessage(
          Response.Status.BAD_REQUEST,
          INVALID_OPENLINEAGE_CREATE_REQUEST,
          "OpenLineageEvent EventType cannot be empty.");
    }
  }
}
