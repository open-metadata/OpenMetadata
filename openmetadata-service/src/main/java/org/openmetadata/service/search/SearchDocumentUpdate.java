package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchClient.FIELDS_TO_REMOVE;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;

/** A search update with explicit field-removal and relationship-upsert semantics. */
public record SearchDocumentUpdate(
    String script, Map<String, Object> parameters, boolean scriptedUpsert) {
  public SearchDocumentUpdate(String script, Map<String, Object> parameters) {
    this(script, parameters, false);
  }

  /**
   * Converts null document fields into explicit removals for the relationship-preserving
   * scripted-upsert contract. Omitting a null parameter leaves the old value untouched in the
   * existing search document.
   */
  public Map<String, Object> parametersForIndexing() {
    if (!scriptedUpsert || parameters.values().stream().noneMatch(Objects::isNull)) {
      return parameters;
    }

    Map<String, Object> normalizedParameters = new LinkedHashMap<>();
    Set<String> fieldsToRemove = new TreeSet<>();
    Object configuredRemovals = parameters.get(FIELDS_TO_REMOVE);
    if (configuredRemovals instanceof Iterable<?> removals) {
      for (Object field : removals) {
        if (field != null) {
          fieldsToRemove.add(field.toString());
        }
      }
    }
    parameters.forEach(
        (field, value) -> {
          if (FIELDS_TO_REMOVE.equals(field)) {
            return;
          }
          if (value == null) {
            fieldsToRemove.add(field);
          } else {
            normalizedParameters.put(field, value);
          }
        });
    if (!fieldsToRemove.isEmpty()) {
      normalizedParameters.put(FIELDS_TO_REMOVE, List.copyOf(fieldsToRemove));
    }
    return normalizedParameters;
  }
}
