package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * The custom-property contract for one entity type: for each of the 16 property types, define a
 * property on the type, set a value, replace it, clear it, then delete the definition — asserting
 * the server's view after each step. Callers adapt how a value is read and written ({@link
 * ValueTarget}), so the same matrix covers entities (JSON Patch on {@code /extension}) and columns
 * (PUT on the columns API).
 */
public final class CustomPropertyValueContract {

  /** How the caller reads and writes one instance's extension. */
  public interface ValueTarget {
    JsonNode extension();

    void setValue(String propertyName, Object value);

    void removeValue(String propertyName);
  }

  /** One property type with its definition config and two distinct values. */
  public record Variant(
      String key, String typeName, Object config, Object initial, Object updated) {}

  private CustomPropertyValueContract() {}

  /** The 16 property types, with two users as the entity-reference values. */
  public static List<Variant> variants(EntityReference firstUser, EntityReference secondUser) {
    EntityReference first = userRef(firstUser);
    EntityReference second = userRef(secondUser);
    return List.of(
        new Variant("integer", "integer", null, 42, 84),
        new Variant("markdown", "markdown", null, "**Initial value**", "_Updated value_"),
        new Variant("duration", "duration", null, "PT1H", "PT2H"),
        new Variant("email", "email", null, "initial@example.com", "updated@example.com"),
        new Variant("number", "number", null, 12.5, 24.75),
        new Variant("sqlQuery", "sqlQuery", null, "SELECT 1", "SELECT id FROM contract_values"),
        new Variant(
            "timeInterval",
            "timeInterval",
            null,
            Map.of("start", 1710831125922L, "end", 1710831125924L),
            Map.of("start", 1710831126922L, "end", 1710831126924L)),
        new Variant("timestamp", "timestamp", null, 1710831125922L, 1710831126922L),
        new Variant(
            "hyperlink",
            "hyperlink-cp",
            null,
            Map.of("url", "https://example.com/initial", "displayText", "Initial link"),
            Map.of("url", "https://open-metadata.org/updated", "displayText", "Updated link")),
        new Variant(
            "enum",
            "enum",
            Map.of("multiSelect", true, "values", List.of("enum1", "enum2", "enum3")),
            List.of("enum1"),
            List.of("enum2", "enum3")),
        new Variant(
            "table",
            "table-cp",
            Map.of("columns", List.of("column1", "column2")),
            tableValue("initial"),
            tableValue("updated")),
        new Variant("entityReference", "entityReference", List.of("user"), first, second),
        new Variant(
            "entityReferenceList",
            "entityReferenceList",
            List.of("user"),
            List.of(first),
            List.of(second)),
        new Variant("date", "date-cp", "yyyy-MM-dd", "2024-07-09", "2025-07-09"),
        new Variant("time", "time-cp", "HH:mm:ss", "15:35:59", "17:35:59"),
        new Variant(
            "dateTime",
            "dateTime-cp",
            "yyyy-MM-dd HH:mm:ss",
            "2024-07-09 15:07:59",
            "2025-07-09 15:07:59"));
  }

  /** Runs every variant on {@code entityType}, removing each definition even when a step fails. */
  public static void exercise(
      OpenMetadataClient client,
      String entityType,
      String namePrefix,
      List<Variant> variants,
      ValueTarget target) {
    for (Variant variant : variants) {
      String propertyName = namePrefix + variant.key();
      try {
        exerciseVariant(client, entityType, propertyName, variant, target);
      } finally {
        CustomPropertyTestSupport.removeProperty(client, entityType, propertyName);
      }
    }
  }

  private static void exerciseVariant(
      OpenMetadataClient client,
      String entityType,
      String propertyName,
      Variant variant,
      ValueTarget target) {
    String context = entityType + "." + propertyName + " (" + variant.typeName() + ")";
    Type propertyType = typeByName(client, variant.typeName());
    Type defined = defineProperty(client, entityType, propertyName, variant, propertyType);
    assertEquals(
        propertyType.getId(),
        propertyOf(defined, propertyName).getPropertyType().getId(),
        context + " is defined with its property type");

    target.setValue(propertyName, variant.initial());
    assertValue(variant.initial(), target.extension().path(propertyName), context + " initial");
    target.setValue(propertyName, variant.updated());
    assertValue(variant.updated(), target.extension().path(propertyName), context + " updated");
    target.removeValue(propertyName);
    assertTrue(target.extension().path(propertyName).isMissingNode(), context + " value cleared");

    deletePropertyDefinition(client, entityType, propertyName);
    assertTrue(
        typeByName(client, entityType + "?fields=customProperties").getCustomProperties().stream()
            .noneMatch(property -> property.getName().equals(propertyName)),
        context + " definition removed");
  }

  /**
   * Every field the test wrote reads back with the same value; the server may add fields (an
   * entity reference comes back with its name and href).
   */
  private static void assertValue(Object written, JsonNode actual, String context) {
    assertContains(JsonUtils.valueToTree(written), actual, context);
  }

  private static void assertContains(JsonNode expected, JsonNode actual, String context) {
    if (expected.isObject()) {
      expected
          .fields()
          .forEachRemaining(
              field ->
                  assertContains(
                      field.getValue(),
                      actual.path(field.getKey()),
                      context + "." + field.getKey()));
    } else if (expected.isArray()) {
      assertEquals(expected.size(), actual.size(), context + " size");
      for (int index = 0; index < expected.size(); index++) {
        assertContains(expected.get(index), actual.path(index), context + "[" + index + "]");
      }
    } else if (expected.isNumber()) {
      assertEquals(expected.decimalValue(), actual.decimalValue(), context);
    } else {
      assertEquals(expected, actual, context);
    }
  }

  private static Type defineProperty(
      OpenMetadataClient client,
      String entityType,
      String propertyName,
      Variant variant,
      Type propertyType) {
    CustomProperty property =
        new CustomProperty()
            .withName(propertyName)
            .withDescription(entityType + " " + variant.typeName() + " value contract")
            .withPropertyType(propertyType.getEntityReference());
    if (variant.config() != null) {
      property.withCustomPropertyConfig(new CustomPropertyConfig().withConfig(variant.config()));
    }
    String typeId = typeByName(client, entityType).getId().toString();
    return client
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/metadata/types/" + typeId, property, Type.class);
  }

  private static void deletePropertyDefinition(
      OpenMetadataClient client, String entityType, String propertyName) {
    try {
      CustomPropertyTestSupport.deleteProperty(client, entityType, propertyName);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Unreadable type " + entityType, e);
    }
  }

  private static CustomProperty propertyOf(Type type, String propertyName) {
    return type.getCustomProperties().stream()
        .filter(property -> property.getName().equals(propertyName))
        .findFirst()
        .orElseThrow(() -> new AssertionError(propertyName + " missing from " + type.getName()));
  }

  private static Type typeByName(OpenMetadataClient client, String nameAndQuery) {
    return client
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/metadata/types/name/" + nameAndQuery, null, Type.class);
  }

  private static EntityReference userRef(EntityReference user) {
    return new EntityReference().withId(user.getId()).withType(user.getType());
  }

  private static Map<String, Object> tableValue(String label) {
    return Map.of(
        "columns",
        List.of("column1", "column2"),
        "rows",
        List.of(Map.of("column1", label + "-1", "column2", label + "-2")));
  }

  /** Applies {@code change} to a copy of the current extension; for targets that write it whole. */
  public static Map<String, Object> withChange(
      JsonNode extension, Consumer<Map<String, Object>> change) {
    Map<String, Object> copy = new HashMap<>();
    extension.fields().forEachRemaining(field -> copy.put(field.getKey(), field.getValue()));
    change.accept(copy);
    return copy;
  }
}
