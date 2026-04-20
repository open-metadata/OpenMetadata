package org.openmetadata.service.governance.workflows.util;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;

public class FieldChangeValueExtractor {

  public static String extractFieldValueForMatching(FieldChange fieldChange) {
    Object valueToCheck = fieldChange.getNewValue();
    if (valueToCheck == null && fieldChange.getOldValue() != null) {
      valueToCheck = fieldChange.getOldValue();
    }
    if (valueToCheck == null) {
      return null;
    }
    try {
      return extractFqnFromValue(valueToCheck);
    } catch (Exception e) {
      return null;
    }
  }

  public static String extractFqnFromValue(Object value) {
    switch (value) {
      case null -> {
        return null;
      }

        // FieldChange values are often stored as JSON strings, try to parse first
      case String strValue -> {
        String trimmed = strValue.trim();
        if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
          try {
            Object parsed = JsonUtils.readValue(trimmed, Object.class);
            return extractFqnFromValue(parsed);
          } catch (Exception e) {
            // Not valid JSON, return as-is
            return strValue;
          }
        }
        return strValue;
      }
      case List valueList -> {
        if (!valueList.isEmpty()) {
          // Collect all FQNs from the list items
          StringBuilder fqns = new StringBuilder();
          for (Object item : valueList) {
            String fqn = extractFqnFromSingleItem(item);
            if (fqn != null) {
              if (!fqns.isEmpty()) fqns.append(",");
              fqns.append(fqn);
            }
          }
          return !fqns.isEmpty() ? fqns.toString() : null;
        }
        return null;
      }
      case Map map -> {
        return extractFqnFromSingleItem(value);
      }
      default -> {}
    }

    return value.toString();
  }

  @SuppressWarnings("unchecked")
  private static String extractFqnFromSingleItem(Object item) {
    if (item instanceof Map) {
      Map<String, Object> map = (Map<String, Object>) item;
      // Check "fullyQualifiedName" first (for domains, entities, etc.)
      Object fqn = map.get("fullyQualifiedName");
      if (fqn != null) return fqn.toString();
      // Check "tagFQN" for tag labels
      Object tagFqn = map.get("tagFQN");
      if (tagFqn != null) return tagFqn.toString();
      return null;
    }
    return item != null ? item.toString() : null;
  }
}
