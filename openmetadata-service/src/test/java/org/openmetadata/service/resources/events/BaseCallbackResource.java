package org.openmetadata.service.resources.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
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
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.awaitility.Awaitility;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public abstract class BaseCallbackResource<T> {
  protected final ConcurrentHashMap<String, EventDetails<T>> eventMap = new ConcurrentHashMap<>();
  protected final ConcurrentHashMap<String, List<T>> entityCallbackMap = new ConcurrentHashMap<>();

  @POST
  @Path("/{name}")
  public Response receiveEventCount(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @HeaderParam(RestUtil.SIGNATURE_HEADER) String signature,
      @Parameter(description = "Name of the Webhook callback", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      T event) {
    String payload = JsonUtils.pojoToJson(event);
    String computedSignature = "sha256=" + CommonUtil.calculateHMAC(getTestName(), payload);
    assertEquals(computedSignature, signature);
    addEventDetails(name, event);
    return Response.ok().build();
  }

  @POST
  @Path("/simulate/slowServer")
  public Response receiveEventWithDelay(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, T event) {
    addEventDetails("simulate-slowServer", event);
    return Response.ok().build();
  }

  @POST
  @Path("/simulate/timeout")
  public Response receiveEventWithTimeout(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, T event) {
    addEventDetails("simulate-timeout", event);
    Awaitility.await()
        .pollDelay(java.time.Duration.ofSeconds(100L))
        .untilTrue(new AtomicBoolean(true));
    return Response.ok().build();
  }

  @POST
  @Path("/simulate/300")
  public Response receiveEvent300(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, T event) {
    addEventDetails("simulate-300", event);
    return Response.status(Response.Status.MOVED_PERMANENTLY).build();
  }

  @POST
  @Path("/simulate/400")
  public Response receiveEvent400(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, T event) {
    addEventDetails("simulate-400", event);
    return Response.status(Response.Status.BAD_REQUEST).build();
  }

  @POST
  @Path("/simulate/500")
  public Response receiveEvent500(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, T event) {
    addEventDetails("simulate-500", event);
    return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
  }

  @POST
  @Path("/filterBased/{eventType}/{entityType}")
  public Response receiveEntityEvents(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Webhook callback", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(description = "Type of event", schema = @Schema(type = "string"))
          @PathParam("eventType")
          String eventType,
      @Parameter(description = "Type of entity", schema = @Schema(type = "string"))
          @PathParam("entityType")
          String entityType,
      T event) {
    String key = eventType + ":" + entityType;
    List<T> list = entityCallbackMap.computeIfAbsent(key, k -> new ArrayList<>());
    list.add(event);
    LOG.debug(
        "callback /{}/{} received event. Current count {}", eventType, entityType, list.size());
    return Response.ok().build();
  }

  public List<T> getEntityCallbackEvents(EventType eventType, String entity) {
    return listOrEmpty(entityCallbackMap.get(eventType + ":" + entity));
  }

  public EventDetails<T> getEventDetails(String endpoint) {
    return eventMap.get(endpoint);
  }

  protected abstract String getTestName();

  protected void addEventDetails(String endpoint, T event) {
    EventDetails<T> details = eventMap.computeIfAbsent(endpoint, k -> new EventDetails<>());
    details.getEvents().add(event);
    LOG.info("Event received {}, total count {}", endpoint, details.getEvents().size());
  }

  public void clearEvents() {
    eventMap.clear();
    entityCallbackMap.clear();
  }

  public static class EventDetails<T> {
    @Getter @Setter long firstEventTime;
    @Getter @Setter long latestEventTime;
    @Getter final ConcurrentLinkedQueue<T> events = new ConcurrentLinkedQueue<>();
  }
}
