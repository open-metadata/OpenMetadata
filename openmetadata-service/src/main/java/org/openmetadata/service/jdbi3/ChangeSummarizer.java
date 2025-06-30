package org.openmetadata.service.jdbi3;

import java.lang.reflect.Field;
import java.lang.reflect.ParameterizedType;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.change.ChangeSummary;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class ChangeSummarizer<T extends EntityInterface> {
  private final Set<String> fields;
  Class<T> clazz;

  public ChangeSummarizer(Class<T> clazz, Set<String> fields) {
    this.fields = fields;
    this.clazz = clazz;
    for (String field : fields) {
      if (!hasField(clazz, field)) {
        throw new IllegalArgumentException(
            String.format("Trying to register non-existent field %s for class %s", field, clazz));
      }
    }
  }

  public Map<String, ChangeSummary> summarizeChanges(
      Map<String, ChangeSummary> currentSummary,
      List<FieldChange> changes,
      ChangeSource changeSource,
      String changedBy,
      long changedAt) {
    return changes.stream()
        .filter(change -> isFieldTracked(change.getName()))
        .filter(
            change ->
                Optional.ofNullable(currentSummary)
                        .map(summary -> summary.get(change.getName()))
                        .map(c -> c.getChangedAt())
                        .orElse(0L)
                        .compareTo(changedAt)
                    < 0)
        .collect(
            java.util.stream.Collectors.toMap(
                FieldChange::getName,
                change ->
                    new ChangeSummary()
                        .withChangeSource(changeSource)
                        .withChangedAt(changedAt)
                        .withChangedBy(changedBy),
                // If its a consolidation, we might have multiple changes for the same field.
                // Since we are only interested in the field name, we can just take whichever.
                (existing, replacement) -> existing));
  }

  private boolean isFieldTracked(String fieldName) {
    // Check if the field is explicitly tracked or if it is a nested field
    if (fields.contains(fieldName)) {
      return true;
    }
    // Check for nested fields
    String[] parts = FullyQualifiedName.split(fieldName);
    return fields.contains(parts[0] + "." + parts[parts.length - 1]);
  }

  private boolean hasField(Class<T> clazz, String fieldName) {
    // Check if the class has the specified field
    try {
      clazz.getDeclaredField(fieldName);
      return true;
    } catch (NoSuchFieldException e) {
      // Ignore
    }
    // Handle nested fields (e.g. columns.column1.description)
    try {
      String[] parts = FullyQualifiedName.split(fieldName);
      String field = parts[0];
      String nestedField = parts[parts.length - 1];
      Field fieldObj = clazz.getDeclaredField(field);
      // Handles list types. We might want to expand this to cover other types in the future
      ((Class<?>) ((ParameterizedType) fieldObj.getGenericType()).getActualTypeArguments()[0])
          .getDeclaredField(nestedField);
      return true;
    } catch (NoSuchFieldException e) {
      // Ignore
    }
    return false;
  }

  /**
   * Given a list of fields that were deleted, process the fields and return the set of keys to delete
   * @param fieldsDeleted list of fields that were deleted
   * @return set of keys to delete
   */
  public Set<String> processDeleted(List<FieldChange> fieldsDeleted) {
    Set<String> keysToDelete = new HashSet<>();
    for (String field : fields) {
      // process top level fields
      List<String> topLevel =
          fieldsDeleted.stream()
              .filter(fieldChange -> fieldChange.getName().equals(field))
              .map(
                  fieldChange ->
                      FullyQualifiedName.build(
                          fieldChange.getName(), (String) fieldChange.getOldValue()))
              .toList();
      if (!topLevel.isEmpty()) {
        keysToDelete.addAll(topLevel);
        continue;
      }

      // process nested fields
      Set<FieldChange> nestedFields =
          fieldsDeleted.stream()
              .filter(fieldChange -> field.startsWith(fieldChange.getName() + "."))
              .collect(Collectors.toSet());

      for (FieldChange fieldChange : nestedFields) {
        String fieldName = field.split("\\.")[0];
        String nestedField = field.split("\\.")[1];
        try {
          if (!clazz.getDeclaredField(fieldName).getType().isAssignableFrom(List.class)) {
            // skip non List types
            continue;
          }
        } catch (NoSuchFieldException e) {
          LOG.warn(
              "No field {} found in class {}",
              fieldChange.getName().split("\\.")[0],
              clazz.getName());
        }

        try {
          JsonUtils.readObjects((String) fieldChange.getOldValue(), Map.class).stream()
              .map(map -> (Map<String, Object>) map)
              .map(map -> (String) map.get("name"))
              .forEach(
                  name -> {
                    keysToDelete.add(
                        FullyQualifiedName.build(fieldChange.getName(), name, nestedField));
                  });
        } catch (JsonParsingException e) {
          LOG.warn("Error processing deleted fields", e);
        }
      }
    }
    return keysToDelete;
  }
}
