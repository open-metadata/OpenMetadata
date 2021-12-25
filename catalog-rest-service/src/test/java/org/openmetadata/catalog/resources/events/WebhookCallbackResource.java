package org.openmetadata.catalog.resources.events;

import io.swagger.annotations.Api;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;
import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.catalog.type.ChangeEvent;

@Path("v1/test/webhook")
@Api(value = "Topic data asset collection", tags = "Topic data asset collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WebhookCallbackResource {
  private AtomicInteger counter = new AtomicInteger();
  private final ConcurrentLinkedQueue<ChangeEvent> changeEvents = new ConcurrentLinkedQueue<>();
  private final ConcurrentLinkedQueue<ChangeEvent> changeEventsSlowServer = new ConcurrentLinkedQueue<>();

  /** Webhook endpoint that immediately responds to callback. The events received are collected in a queue */
  @POST
  public Response receiveEvent(
          @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    changeEvents.addAll(events.getData());
    return Response.ok().build();
  }
  public ConcurrentLinkedQueue<ChangeEvent> getEvents() { return changeEvents; }
  public void clearEvents() { changeEvents.clear(); }

  /** Webhook endpoint that immediately responds to callback. This only counts the number of events received */
  @POST
  @Path("/counter")
  public Response receiveEventCount(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    counter.incrementAndGet();
    return Response.ok().build();
  }
  public int getCount() { return counter.get(); }

  /** Webhook endpoint that immediately responds to callback. The events received are ignored */
  @POST
  @Path("/ignore")
  public Response receiveEventIgnore(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    return Response.ok().build();
  }

  /** Webhook endpoint that responds to callback with 1 second delay. The events received are collected in a queue */
  @POST
  @Path("/slowServer")
  public Response receiveEventWithDelay(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    changeEventsSlowServer.addAll(events.getData());
    try {
      Thread.sleep(1000);
    } catch (InterruptedException e) {
      e.printStackTrace();
    }
    return Response.ok().build();
  }
  public ConcurrentLinkedQueue<ChangeEvent> getEventsSlowServer() { return changeEventsSlowServer; }
  public void clearEventsSlowServer() { changeEventsSlowServer.clear(); }

  /** Webhook endpoint that responds to callback with 15 seconds delay. The events received are collected in a queue */
  @POST
  @Path("/timeout")
  public Response receiveEventWithTimeout(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    try {
      Thread.sleep(15 * 1000);
    } catch (InterruptedException e) {
      e.printStackTrace();
    }
    return Response.ok().build();
  }

  /** Webhook endpoint that responds to callback with 300 Moved Permanently response */
  @POST
  @Path("/300")
  public Response receiveEvent300(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    return Response.status(Response.Status.MOVED_PERMANENTLY).build();
  }

  /** Webhook endpoint that responds to callback with 400 Bad request response */
  @POST
  @Path("/400")
  public Response receiveEvent400(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    return Response.status(Response.Status.BAD_REQUEST).build();
  }

  /** Webhook endpoint that responds to callback with 500 Internal server error response */
  @POST
  @Path("/500")
  public Response receiveEvent500(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
  }
}
