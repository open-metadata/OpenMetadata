package org.openmetadata.it.util;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Registers custom properties on the shared built-in entity types. TestNamespaceExtension only
 * reaps tracked entity roots, not properties on built-in types, so callers remove what they
 * register (try/finally) — otherwise every run adds another field to the type's settings page.
 */
@Slf4j
public final class CustomPropertyTestSupport {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final int MAX_DELETE_ATTEMPTS = 5;

  private CustomPropertyTestSupport() {}

  public static void registerStringProperty(
      OpenMetadataClient client, String entityType, String propertyName)
      throws JsonProcessingException {
    Type stringType = getTypeByName(client, "string");
    Type owningType = getTypeByName(client, entityType);
    CustomProperty property =
        new CustomProperty()
            .withName(propertyName)
            .withDescription("Registered by an integration test")
            .withPropertyType(
                new EntityReference()
                    .withId(stringType.getId())
                    .withType("type")
                    .withName("string"));
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/metadata/types/" + owningType.getId(), property, Type.class);
  }

  /** Best-effort {@link #deleteProperty} for cleanup: logs instead of failing. */
  public static void removeProperty(
      final OpenMetadataClient client, final String entityType, final String propertyName) {
    try {
      deleteProperty(client, entityType, propertyName);
    } catch (OpenMetadataException | JsonProcessingException cleanupFailure) {
      log.warn(
          "Failed to remove custom property '{}' from type '{}'",
          propertyName,
          entityType,
          cleanupFailure);
    }
  }

  /**
   * Removes the property definition by JSON Patch on the type's {@code customProperties}, as the
   * UI does. Concurrent tests add and remove properties on the same type, so the index is guarded
   * by a {@code test} op and re-read on a miss. No-op when the property is already gone.
   */
  public static void deleteProperty(
      final OpenMetadataClient client, final String entityType, final String propertyName)
      throws JsonProcessingException {
    boolean isGone = false;
    for (int attempt = 1; !isGone; attempt++) {
      isGone = tryDeleteProperty(client, entityType, propertyName, attempt == MAX_DELETE_ATTEMPTS);
    }
  }

  /** One guarded removal: true once the property is gone, false if its index moved under us. */
  private static boolean tryDeleteProperty(
      final OpenMetadataClient client,
      final String entityType,
      final String propertyName,
      final boolean isLastAttempt)
      throws JsonProcessingException {
    final Type owningType = getTypeByName(client, entityType + "?fields=customProperties");
    final int index = indexOf(owningType, propertyName);
    return index < 0 || patchedOut(client, owningType, propertyName, index, isLastAttempt);
  }

  private static int indexOf(final Type owningType, final String propertyName) {
    final List<CustomProperty> properties = listOrEmpty(owningType.getCustomProperties());
    return IntStream.range(0, properties.size())
        .filter(position -> properties.get(position).getName().equals(propertyName))
        .findFirst()
        .orElse(-1);
  }

  /** Removes the property at {@code index}; the {@code test} op fails if another took its place. */
  private static boolean patchedOut(
      final OpenMetadataClient client,
      final Type owningType,
      final String propertyName,
      final int index,
      final boolean isLastAttempt) {
    try {
      removeAt(client, owningType, propertyName, index);
      return true;
    } catch (OpenMetadataException indexMoved) {
      if (isLastAttempt) {
        throw indexMoved;
      }
      log.debug(
          "Custom property index moved under the patch, retrying: {}", indexMoved.getMessage());
      return false;
    }
  }

  private static void removeAt(
      final OpenMetadataClient client,
      final Type owningType,
      final String propertyName,
      final int index) {
    final String path = "/customProperties/" + index;
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/metadata/types/" + owningType.getId(),
            OBJECT_MAPPER.valueToTree(
                List.of(
                    Map.of("op", "test", "path", path + "/name", "value", propertyName),
                    Map.of("op", "remove", "path", path))));
  }

  public static Object extensionValue(Object extension, String propertyName) {
    return OBJECT_MAPPER.convertValue(extension, Map.class).get(propertyName);
  }

  private static Type getTypeByName(OpenMetadataClient client, String name)
      throws JsonProcessingException {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/metadata/types/name/" + name, null);
    return OBJECT_MAPPER.readValue(response, Type.class);
  }
}
