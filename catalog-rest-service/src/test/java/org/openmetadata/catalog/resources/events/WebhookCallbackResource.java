package org.openmetadata.catalog.resources.events;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import javax.ws.rs.Consumes;
import javax.ws.rs.HeaderParam;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.resources.events.EventResource.ChangeEventList;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.common.utils.CommonUtil;

@Slf4j
/** REST resource used for webhook callback tests. */
@Path("v1/test/webhook")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WebhookCallbackResource {
  private final ConcurrentHashMap<String, EventDetails> eventMap = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, List<ChangeEvent>> entityCallbackMap = new ConcurrentHashMap<>();

  /**
   * Webhook endpoint that immediately responds to callback. The events received are collected in a queue per testName
   */
  @POST
  @Path("/{testName}")
  public Response receiveEventCount(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @HeaderParam(RestUtil.SIGNATURE_HEADER) String signature,
      @PathParam("testName") String testName,
      ChangeEventList events)
      throws IOException {
    String payload = JsonUtils.pojoToJson(events);
    String computedSignature = "sha256=" + CommonUtil.calculateHMAC("webhookTest", payload);
    assertEquals(computedSignature, signature);
    addEventDetails(testName, events);
    return Response.ok().build();
  }

  /** Webhook endpoint that responds to callback with 1 seconds delay. The events received are collected in a queue */
  @POST
  @Path("/simulate/slowServer")
  public Response receiveEventWithDelay(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, ChangeEventList events) {
    addEventDetails("simulate-slowServer", events);
    return Response.ok().build();
  }

  /** Webhook endpoint that responds to callback with 15 seconds delay. The events received are collected in a queue */
  @POST
  @Path("/simulate/timeout")
  public Response receiveEventWithTimeout(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, ChangeEventList events) {
    addEventDetails("simulate-timeout", events);
    try {
      Thread.sleep(15 * 1000);
    } catch (InterruptedException e) {
      e.printStackTrace();
    }
    return Response.ok().build();
  }

  /** Webhook endpoint that responds to callback with 300 Moved Permanently response */
  @POST
  @Path("/simulate/300")
  public Response receiveEvent300(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, ChangeEventList events) {
    addEventDetails("simulate-300", events);
    return Response.status(Response.Status.MOVED_PERMANENTLY).build();
  }

  /** Webhook endpoint that responds to callback with 400 Bad request response */
  @POST
  @Path("/simulate/400")
  public Response receiveEvent400(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, ChangeEventList events) {
    addEventDetails("simulate-400", events);
    return Response.status(Response.Status.BAD_REQUEST).build();
  }

  /** Webhook endpoint that responds to callback with 500 Internal server error response */
  @POST
  @Path("/simulate/500")
  public Response receiveEvent500(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, ChangeEventList events) {
    addEventDetails("simulate-500", events);
    return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
  }

  /** Webhook endpoint that receives change events for various combination of event types and entity filters */
  @POST
  @Path("/filterBased/{eventType}/{entityType}")
  public Response receiveEntityEvents(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("eventType") String eventType,
      @PathParam("entityType") String entityType,
      ChangeEventList events) {
    String key = eventType + ":" + entityType;
    List<ChangeEvent> list = entityCallbackMap.get(key);
    if (list == null) {
      list = new ArrayList<>();
      entityCallbackMap.put(key, list);
    } else {
      list.addAll(events.getData());
    }
    LOG.info("callback /{}/{} received event. Current count {}", eventType, entityType, list.size());
    return Response.ok().build();
  }

  public List<ChangeEvent> getEntityCallbackEvents(EventType eventType, String entity) {
    return Optional.ofNullable(entityCallbackMap.get(eventType + ":" + entity)).orElse(Collections.emptyList());
  }

  public EventDetails getEventDetails(String endpoint) {
    return eventMap.get(endpoint);
  }

  private void addEventDetails(String endpoint, ChangeEventList events) {
    EventDetails details = eventMap.get(endpoint); // Default endpoint
    if (details == null) {
      details = new EventDetails();
      details.setFirstEventTime(events.getData().get(0).getTimestamp());
      eventMap.put(endpoint, details);
    }
    details.getEvents().addAll(events.getData());
    details.setLatestEventTime(events.getData().get(events.getData().size() - 1).getTimestamp());
    LOG.info("Event received {}, total count {}", endpoint, details.getEvents().size());
  }

  public void clearEvents() {
    eventMap.clear();
    entityCallbackMap.clear();
  }

  /** Class to keep track of all the events received by a webhook endpoint */
  static class EventDetails {
    long firstEventTime;
    long latestEventTime;
    ConcurrentLinkedQueue<ChangeEvent> events = new ConcurrentLinkedQueue<>();

    public long getFirstEventTime() {
      return firstEventTime;
    }

    public void setFirstEventTime(long firstEventTime) {
      this.firstEventTime = firstEventTime;
    }

    public long getLatestEventTime() {
      return latestEventTime;
    }

    public void setLatestEventTime(long latestEventTime) {
      this.latestEventTime = latestEventTime;
    }

    public ConcurrentLinkedQueue<ChangeEvent> getEvents() {
      return events;
    }
  }
}
