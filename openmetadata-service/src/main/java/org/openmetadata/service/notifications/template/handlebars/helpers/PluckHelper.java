package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.fasterxml.jackson.core.type.TypeReference;
import com.github.jknack.handlebars.Handlebars;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Helper to deserialize and extract data from objects or lists of objects.
 * Usage:
 *   {{pluck list "propertyName"}}  - Extracts propertyName from each object in list
 *   {{pluck list}}                  - Deserializes list and returns whole objects as Maps
 *   {{pluck object "propertyName"}} - Extracts propertyName from a single object
 *   {{pluck object}}                - Deserializes single object and returns it as a Map
 *
 * <p>Returns:
 * - For arrays: a list of extracted values or deserialized objects that can be iterated
 * - For single objects: the extracted property value or deserialized object
 *
 * <p>Handles various input types:
 * - Collections (already parsed)
 * - JSON string representations of arrays or single objects
 * - POJOs
 *
 * <p>Examples:
 * {{#each (pluck tags 'tagFQN') as |tagFQN|}}{{tagFQN}}{{#unless @last}}, {{/unless}}{{/each}}
 * {{#with (pluck certification) as |cert|}}{{cert.tagLabel.name}}{{/with}}
 * {{#with (pluck certification "tagLabel") as |label|}}{{label.name}}{{/with}}
 */
public class PluckHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "pluck";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null) {
            return null;
          }

          // Try to convert to object first (handles both single objects and arrays)
          Object converted = convertToObjectOrList(context);

          if (converted == null) {
            return null;
          }

          // No property name provided - return the deserialized object/list as-is
          if (options.params.length == 0 || options.params[0] == null) {
            return converted;
          }

          // Get property name parameter
          String propertyName = options.params[0].toString();

          // If converted is a list, extract property from each item
          if (converted instanceof List<?> items) {
            List<Object> result = new ArrayList<>();
            for (Object item : items) {
              Object value = extractValue(item, propertyName);
              if (value != null && !value.toString().isEmpty()) {
                result.add(value);
              }
            }
            return result;
          }

          // Otherwise it's a single object - extract property directly
          return extractValue(converted, propertyName);
        });
  }

  /**
   * Converts the context to either a single object (Map) or a list of objects, handling various
   * input types.
   */
  private Object convertToObjectOrList(Object context) {
    if (context instanceof Collection<?> collection) {
      return List.copyOf(collection);
    }

    // If already a Map, return as-is
    if (context instanceof Map) {
      return context;
    }

    // If it's a JSON string, try to deserialize it
    if (context instanceof String jsonString) {
      // First, try to parse as an array
      try {
        return JsonUtils.readValue(jsonString, new TypeReference<List<Map<String, Object>>>() {});
      } catch (Exception arrayException) {
        // If that fails, try to parse as a single object
        try {
          return JsonUtils.readValue(jsonString, new TypeReference<Map<String, Object>>() {});
        } catch (Exception objectException) {
          // If both fail, return the original string
          return context;
        }
      }
    }

    // For other object types (POJOs), try to convert via JSON serialization
    try {
      String json = JsonUtils.pojoToJson(context);
      // Try array first
      try {
        return JsonUtils.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
      } catch (Exception arrayException) {
        // Then try single object
        return JsonUtils.readValue(json, new TypeReference<Map<String, Object>>() {});
      }
    } catch (Exception e) {
      // If all parsing fails, return the original object
      return context;
    }
  }

  /**
   * Extracts the specified property value from an item.
   */
  private Object extractValue(Object item, String propertyName) {
    if (item == null) {
      return null;
    }

    // Extract property from map
    if (item instanceof Map<?, ?> map) {
      return map.get(propertyName);
    }

    // For other objects, return null (property not accessible)
    return null;
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("pluck")
        .withDescription("Extract property from objects in array")
        .withCursorOffset(8)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{pluck }}")
                    .withExample("{{pluck tags \"tagFQN\"}}"),
                new HandlebarsHelperUsage()
                    .withSyntax("{{pluck }}")
                    .withExample("{{#with (pluck certification \"tagLabel\")}}{{name}}{{/with}}")));
  }
}
