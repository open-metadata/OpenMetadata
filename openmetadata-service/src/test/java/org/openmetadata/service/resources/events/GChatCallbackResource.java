package org.openmetadata.service.resources.events;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.awaitility.Awaitility;

/** REST resource used for Google Chat callback tests. */
@Slf4j
@Path("v1/test/gchat")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class GChatCallbackResource {
  private static final ConcurrentHashMap<String, EventDetails> eventMap = new ConcurrentHashMap<>();
  private static final ConcurrentHashMap<String, ConcurrentLinkedQueue<String>> entityCallbackMap =
      new ConcurrentHashMap<>();

  @POST
  @Path("/addEvent/{id}")
  public Response addEventDetails(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
      String message) {
    addEventDetails(id, message);
    return Response.ok().build();
  }

  @POST
  @Path("/addEntityCallback/{id}")
  public Response addEntityCallback(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
      String message) {
    addEntityCallback(id, message);
    return Response.ok().build();
  }

  @POST
  @Path("/waitForFirstEvent/{id}")
  public Response waitForFirstEvent(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id) {
    waitForFirstEvent(id);
    return Response.ok().build();
  }

  @POST
  @Path("/waitForEvents/{id}/{count}")
  public Response waitForEvents(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
      @PathParam("count") int count) {
    waitForEvents(id, count);
    return Response.ok().build();
  }

  @POST
  @Path("/clearEvents/{id}")
  public Response clearEvents(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id) {
    clearEvents(id);
    return Response.ok().build();
  }

  @POST
  @Path("/getEntityCallbackCount/{id}")
  public Response getEntityCallbackCount(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id) {
    return Response.ok(getEntityCallbackCount(id)).build();
  }

  @POST
  @Path("/getEntityCallbackMessages/{id}")
  public Response getEntityCallbackMessages(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id) {
    return Response.ok(getEntityCallbackMessages(id)).build();
  }

  @POST
  @Path("/getEventDetails/{id}")
  public Response getEventDetails(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id) {
    return Response.ok(getEventDetails(id)).build();
  }

  @POST
  @Path("/getEventCount/{id}")
  public Response getEventCount(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id) {
    return Response.ok(getEventCount(id)).build();
  }

  @POST
  @Path("/slow/{id}")
  public Response slow(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
      String message) {
    try {
      Thread.sleep(2000);
    } catch (InterruptedException e) {
      throw new RuntimeException(e);
    }
    addEventDetails(id, message);
    return Response.ok().build();
  }

  @POST
  @Path("/timeout/{id}")
  public Response timeout(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
      String message) {
    try {
      Thread.sleep(10000);
    } catch (InterruptedException e) {
      throw new RuntimeException(e);
    }
    addEventDetails(id, message);
    return Response.ok().build();
  }

  @POST
  @Path("/300/{id}")
  public Response status300(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
      String message) {
    addEventDetails(id, message);
    return Response.status(300).build();
  }

  @POST
  @Path("/400/{id}")
  public Response status400(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
      String message) {
    addEventDetails(id, message);
    return Response.status(400).build();
  }

  @POST
  @Path("/500/{id}")
  public Response status500(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
      String message) {
    addEventDetails(id, message);
    return Response.status(500).build();
  }

  private void addEventDetails(String id, String message) {
    EventDetails details = eventMap.computeIfAbsent(id, k -> new EventDetails());
    details.addEvent(message);
  }

  private void addEntityCallback(String id, String message) {
    ConcurrentLinkedQueue<String> messages =
        entityCallbackMap.computeIfAbsent(id, k -> new ConcurrentLinkedQueue<>());
    messages.add(message);
  }

  private void waitForFirstEvent(String id) {
    EventDetails details = eventMap.computeIfAbsent(id, k -> new EventDetails());
    Awaitility.await().untilTrue(details.hasEvent);
  }

  private void waitForEvents(String id, int count) {
    EventDetails details = eventMap.computeIfAbsent(id, k -> new EventDetails());
    Awaitility.await().until(() -> details.getEventCount() >= count);
  }

  private void clearEvents(String id) {
    eventMap.remove(id);
    entityCallbackMap.remove(id);
  }

  private int getEntityCallbackCount(String id) {
    ConcurrentLinkedQueue<String> messages = entityCallbackMap.get(id);
    return messages != null ? messages.size() : 0;
  }

  private List<String> getEntityCallbackMessages(String id) {
    ConcurrentLinkedQueue<String> messages = entityCallbackMap.get(id);
    return messages != null ? new ArrayList<>(messages) : new ArrayList<>();
  }

  private EventDetails getEventDetails(String id) {
    return eventMap.get(id);
  }

  private int getEventCount(String id) {
    EventDetails details = eventMap.get(id);
    return details != null ? details.getEventCount() : 0;
  }

  @Getter
  static class EventDetails {
    private final List<String> events = new ArrayList<>();
    private final AtomicBoolean hasEvent = new AtomicBoolean(false);

    public void addEvent(String message) {
      events.add(message);
      hasEvent.set(true);
    }

    public int getEventCount() {
      return events.size();
    }
  }
}
