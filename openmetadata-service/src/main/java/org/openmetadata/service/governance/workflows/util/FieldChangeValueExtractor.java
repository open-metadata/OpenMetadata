package org.openmetadata.service.governance.workflows.util;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class FieldChangeValueExtractor {

  /**
   * Extracts a value from the {@link FieldChange} that the governance rule patterns can match
   * against.
   *
   * <p>The new value is tried first because rules are meant to match what the field is being
   * changed <em>to</em>. The new value, however, may be a schema-valid but "sparse" {@code
   * EntityReference} (carrying only {@code id} + {@code type}, the {@code EntityReference} schema's
   * only required fields) or a list of such references, recorded verbatim from a PATCH/PUT body.
   * Such a value carries no {@code fullyQualifiedName}/{@code tagFQN}, so {@link
   * #extractFqnFromValue} returns {@code null} for it. When that happens we fall back to the old
   * value, which is normally a fully-populated reference loaded from the store, rather than
   * returning {@code null} and silently skipping the rule. Skipping would bypass change-request /
   * approval gates for the very changes the rule is meant to gate, so we prefer over-triggering an
   * approval gate over silently ignoring the change.
   */
  public static String extractFieldValueForMatching(FieldChange fieldChange) {
    Object newValue = fieldChange.getNewValue();
    Object oldValue = fieldChange.getOldValue();

    if (newValue != null) {
      String extracted = extractSafely(newValue);
      if (extracted != null) {
        return extracted;
      }
    }

    if (oldValue != null) {
      if (newValue != null) {
        LOG.debug(
            "New value for field change yielded no matchable value; falling back to old value");
      }
      return extractSafely(oldValue);
    }
    return null;
  }

  private static String extractSafely(Object value) {
    try {
      return extractFqnFromValue(value);
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
