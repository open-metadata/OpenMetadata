package org.openmetadata.service.monitoring;

import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.ext.Provider;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;

/**
 * Request-scoped outer latency instrumentation for resource methods annotated with
 * {@link LatencyPhase}.
 */
@Provider
@LatencyPhase
@Priority(Priorities.USER)
@Slf4j
public class LatencyPhaseFilter implements ContainerRequestFilter, ContainerResponseFilter {

  private static final String PHASE_PROPERTY = LatencyPhaseFilter.class.getName() + ".phase";
  private static final String RESOURCE_METHOD_PHASE = "resourceMethod";

  @Context private ResourceInfo resourceInfo;

  @Override
  public void filter(ContainerRequestContext requestContext) {
    requestContext.setProperty(
        PHASE_PROPERTY, RequestLatencyContext.phase(resolvePhaseName(requestContext)));
  }

  @Override
  public void filter(
      ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    Object phase = requestContext.getProperty(PHASE_PROPERTY);
    requestContext.removeProperty(PHASE_PROPERTY);
    if (phase instanceof AutoCloseable closeable) {
      try {
        closeable.close();
      } catch (Exception e) {
        LOG.debug("Error while closing latency phase scope", e);
      }
    }
  }

  private String resolvePhaseName(ContainerRequestContext requestContext) {
    LatencyPhase phaseConfig = getPhaseConfig();
    if (phaseConfig != null && !phaseConfig.value().isBlank()) {
      return phaseConfig.value();
    }

    return switch (requestContext.getMethod().toUpperCase(Locale.ROOT)) {
      case "GET" -> "resourceGet";
      case "POST" -> "resourceCreate";
      case "PUT" -> "resourceCreateOrUpdate";
      case "PATCH" -> "resourcePatch";
      case "DELETE" -> "resourceDelete";
      default -> RESOURCE_METHOD_PHASE;
    };
  }

  private LatencyPhase getPhaseConfig() {
    if (resourceInfo == null) {
      return null;
    }
    if (resourceInfo.getResourceMethod() != null) {
      LatencyPhase phase = resourceInfo.getResourceMethod().getAnnotation(LatencyPhase.class);
      if (phase != null) {
        return phase;
      }
    }
    return resourceInfo.getResourceClass() != null
        ? resourceInfo.getResourceClass().getAnnotation(LatencyPhase.class)
        : null;
  }
}
