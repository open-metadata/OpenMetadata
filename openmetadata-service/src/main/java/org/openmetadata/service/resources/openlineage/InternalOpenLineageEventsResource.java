package org.openmetadata.service.resources.openlineage;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.openmetadata.service.jdbi3.OpenLineageEventRepository;
import org.openmetadata.schema.lineage.OpenLineageWrappedEvent;
import org.openmetadata.service.Entity;

import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;

import org.openmetadata.service.util.ResultList;

import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.PathParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.QueryParam;

import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;

import java.util.UUID;

@Path("/v1/openlineage/internal")
@Tag(name = "InternalLineageEvents", description = "Internal API to manage OpenLineage events.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "openlineage")
public class InternalOpenLineageEventsResource {

    private final OpenLineageEventRepository dao;
    private final Authorizer authorizer;


    public InternalOpenLineageEventsResource(Authorizer authorizer) {
        this.dao = Entity.getOpenLineageEventRepository();
        this.authorizer = authorizer;
    }

    @PUT
    @Path("/events/{id}/processed")
    @Operation(
            operationId = "updateOpenLineageEvent",
            summary = "Update OpenLineage Event",
            description = "Update an existing OpenLineageEvent, such as marking it as processed.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Event updated"),
                    @ApiResponse(responseCode = "400", description = "Bad request")
            }
    )
    public Response updateEvent(@PathParam("id") UUID id) {
        try {
            dao.markAsProcessed(id);
            return Response.ok().build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(e.getMessage()).build();
        }
    }


    @GET
    @Path("/events")
    @Operation(
            operationId = "getOpenLineageEvents",
            summary = "Get OpenLineage Events",
            description = "Get OpenLineage Events based on query parameters such as runId, eventType, or unprocessed.",
            responses = {
                    @ApiResponse(
                            responseCode = "200",
                            description = "The OpenLineage events",
                            content = @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = OpenLineageWrappedEvent.class))),
                    @ApiResponse(responseCode = "404", description = "OpenLineage Events not found")
            })
    public ResultList<OpenLineageWrappedEvent> queryEvents(
            @Context UriInfo uriInfo,
            @QueryParam("runId") String runId,
            @QueryParam("eventType") String eventType,
            @QueryParam("unprocessed") Boolean unprocessed) {

        return dao.queryEvents(runId, eventType, unprocessed);
    }

    @DELETE
    @Path("/events/{id}")
    @Operation(
            operationId = "deleteOpenLineageEvent",
            summary = "Delete OpenLineage Event",
            description = "Delete an existing OpenLineageEvent for given ID",
            responses = {
                    @ApiResponse(responseCode = "200", description = "OK"),
                    @ApiResponse(responseCode = "404", description = "OpenLineageEvent {lineageEventId} is not found"),
                    @ApiResponse(responseCode = "400", description = "Bad request")
            })
    public Response deleteLineageEvent(
            @PathParam("id") UUID id) {
        OpenLineageWrappedEvent event = dao.queryEvents(String.valueOf(id), null, null)
                .getData()
                .stream()
                .findFirst()
                .orElse(null);

        if (event == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        dao.deleteLineageEvent(event);
        return Response.ok().build();
    }
}
