package org.openmetadata.mcp.tools;

import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriBuilder;
import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.glassfish.jersey.internal.MapPropertiesDelegate;
import org.glassfish.jersey.server.ContainerRequest;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.RestUtil;

final class OntologyToolSupport {
  private OntologyToolSupport() {}

  static void requireOnly(final Map<String, Object> values, final Set<String> fields) {
    final Set<String> unknown =
        values.keySet().stream()
            .filter(field -> !fields.contains(field))
            .collect(Collectors.toSet());
    if (!unknown.isEmpty()) {
      throw new IllegalArgumentException("Unsupported parameters: " + unknown);
    }
  }

  static UUID id(final Map<String, Object> values, final String name) {
    return UUID.fromString(McpToolParameters.from(values).requiredString(name));
  }

  static <T> T request(final Object input, final Class<T> type) {
    return validated(JsonUtils.convertValue(input, type));
  }

  static <T> T validated(final T request) {
    try (final ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
      final var violations = factory.getValidator().validate(request);
      if (!violations.isEmpty()) {
        throw new IllegalArgumentException(
            "Invalid " + request.getClass().getSimpleName() + ": " + violations);
      }
    }
    return request;
  }

  static UriInfo uriInfo(final CatalogSecurityContext context) {
    final String base =
        SettingsCache.getSetting(
                SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION,
                OpenMetadataBaseUrlConfiguration.class)
            .getOpenMetadataUrl();
    if (base == null || base.isBlank()) {
      throw new IllegalStateException("OpenMetadata public base URL is not configured");
    }
    return uriInfo(
        base, OpenMetadataApplicationConfigHolder.getInstance().getApiRootPath(), context);
  }

  static UriInfo uriInfo(
      final String base, final String apiRoot, final CatalogSecurityContext context) {
    final URI uri = UriBuilder.fromUri(base).path(apiRoot).path("/").build();
    return new ContainerRequest(uri, uri, "POST", context, new MapPropertiesDelegate())
        .getUriInfo();
  }

  static Map<String, Object> writeResult(
      final Response response, final String entityType, final CatalogSecurityContext context) {
    requireSuccess(response);
    final EntityInterface<?> entity = (EntityInterface<?>) response.getEntity();
    final String pendingHeader = response.getHeaderString(RestUtil.PENDING_CHANGE_HEADER);
    final UUID pending = pendingHeader == null ? null : UUID.fromString(pendingHeader);
    final EventType event = eventType(response);
    if (pending == null) {
      McpChangeEventUtil.publishChangeEvent(entity, event, context.getUserPrincipal().getName());
    }
    final Map<String, Object> result =
        McpResponseUtils.compactPatch(
            entity, entityType, pending == null ? event : EventType.ENTITY_NO_CHANGE);
    if (event == EventType.ENTITY_CREATED) {
      result.put("_operation", "created");
    } else if (event == EventType.ENTITY_NO_CHANGE) {
      result.put("_operation", "unchanged");
    }
    return McpResponseUtils.markHeld(result, pending);
  }

  static void requireSuccess(final Response response) {
    if (response.getStatusInfo().getFamily() != Response.Status.Family.SUCCESSFUL) {
      throw new WebApplicationException(response);
    }
  }

  private static EventType eventType(final Response response) {
    final String header = response.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER);
    if (header == null && response.getStatus() != Response.Status.CREATED.getStatusCode()) {
      throw new IllegalStateException("Ontology write response is missing its change type");
    }
    return header == null ? EventType.ENTITY_CREATED : EventType.fromValue(header);
  }
}
