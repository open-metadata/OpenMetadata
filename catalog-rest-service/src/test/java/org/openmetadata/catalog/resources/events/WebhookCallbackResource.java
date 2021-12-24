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

  @POST
  @Path("/counter")
  public Response receiveEventCount(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    counter.incrementAndGet();
    return Response.ok().build();
  }

  @POST
  @Path("/ignore")
  public Response receiveEventIgnore(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    return Response.ok().build();
  }

  @POST
  public Response receiveEvent(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    changeEvents.addAll(events.getData());
    return Response.ok().build();
  }

  @POST
  @Path("/slowServer")
  public Response receiveEventWithDelay(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    try {
      Thread.sleep(1000);
    } catch (InterruptedException e) {
      e.printStackTrace();
    }
    changeEventsSlowServer.addAll(events.getData());
    return Response.ok().build();
  }

  @POST
  @Path("/timeout")
  public Response receiveEventWithTimeout(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    try {
      Thread.sleep(11 * 1000);
    } catch (InterruptedException e) {
      e.printStackTrace();
    }
    return Response.ok().build();
  }

  @POST
  @Path("/300")
  public Response receiveEvent300(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    return Response.status(Response.Status.MOVED_PERMANENTLY).build();
  }

  @POST
  @Path("/400")
  public Response receiveEvent400(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    return Response.status(Response.Status.BAD_REQUEST).build();
  }

  @POST
  @Path("/500")
  public Response receiveEvent500(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, EventResource.ChangeEventList events) {
    return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
  }

  public ConcurrentLinkedQueue<ChangeEvent> getEvents() {
    return changeEvents;
  }

  public ConcurrentLinkedQueue<ChangeEvent> getEventsSlowServer() {
    return changeEventsSlowServer;
  }

  public void clearAllEvents() {
    changeEvents.clear();
    changeEventsSlowServer.clear();
  }

  public int getCount() {
    return counter.get();
  }

  public void resetCount() {
    counter.set(0);
  }
}
