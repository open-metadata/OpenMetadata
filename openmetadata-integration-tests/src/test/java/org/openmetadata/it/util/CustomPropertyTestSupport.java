package org.openmetadata.it.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
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

  public static void removeProperty(
      OpenMetadataClient client, String entityType, String propertyName) {
    try {
      Type owningType = getTypeByName(client, entityType);
      client
          .getHttpClient()
          .execute(
              HttpMethod.DELETE,
              "/v1/metadata/types/" + owningType.getId() + "/" + propertyName,
              null,
              Void.class);
    } catch (OpenMetadataException | JsonProcessingException cleanupFailure) {
      log.warn(
          "Failed to remove custom property '{}' from type '{}'",
          propertyName,
          entityType,
          cleanupFailure);
    }
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
