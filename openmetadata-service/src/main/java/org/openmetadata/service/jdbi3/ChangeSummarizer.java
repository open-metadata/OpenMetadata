package org.openmetadata.service.jdbi3;

import java.lang.reflect.Field;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
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
                        .map(ChangeSummary::getChangedAt)
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
    return fields.stream().anyMatch(trackedField -> matchesTrackedField(trackedField, fieldName));
  }

  private boolean hasField(Class<T> clazz, String fieldName) {
    return hasField(clazz, FullyQualifiedName.split(fieldName), 0);
  }

  /**
   * Given a list of fields that were deleted, return the change-summary keys to remove. A key is
   * removed when either the tracked field itself was deleted (for example clearing a single
   * column's description) or when a parent list holding tracked fields was deleted (for example
   * removing a whole column). The keys mirror the ones produced by {@link #summarizeChanges}, which
   * uses the raw {@link FieldChange#getName()} as the map key.
   */
  public Set<String> processDeleted(List<FieldChange> fieldsDeleted) {
    Set<String> keysToDelete = new HashSet<>(directlyDeletedKeys(fieldsDeleted));
    keysToDelete.addAll(nestedListDeletedKeys(fieldsDeleted));
    return keysToDelete;
  }

  private Set<String> directlyDeletedKeys(List<FieldChange> fieldsDeleted) {
    return fieldsDeleted.stream()
        .map(FieldChange::getName)
        .filter(this::isFieldTracked)
        .collect(Collectors.toSet());
  }

  private Set<String> nestedListDeletedKeys(List<FieldChange> fieldsDeleted) {
    Set<String> keysToDelete = new HashSet<>();
    for (String field : fields) {
      Set<FieldChange> deletedParentLists =
          fieldsDeleted.stream()
              .filter(fieldChange -> field.startsWith(fieldChange.getName() + "."))
              .filter(fieldChange -> isListField(clazz, fieldChange.getName()))
              .collect(Collectors.toSet());
      for (FieldChange fieldChange : deletedParentLists) {
        keysToDelete.addAll(expandListItemKeys(field, fieldChange));
      }
    }
    return keysToDelete;
  }

  private Set<String> expandListItemKeys(String trackedField, FieldChange deletedList) {
    Set<String> keys = new HashSet<>();
    try {
      String nestedField = trackedField.substring(deletedList.getName().length() + 1);
      JsonUtils.readObjects((String) deletedList.getOldValue(), Map.class).stream()
          .map(map -> (Map<String, Object>) map)
          .map(map -> (String) map.get("name"))
          .forEach(
              name -> keys.add(FullyQualifiedName.build(deletedList.getName(), name, nestedField)));
    } catch (JsonParsingException e) {
      LOG.warn("Error processing deleted fields", e);
    }
    return keys;
  }

  private boolean matchesTrackedField(String trackedField, String fieldName) {
    if (trackedField.equals(fieldName)) {
      return true;
    }

    String[] trackedParts = FullyQualifiedName.split(trackedField);
    String[] fieldParts = FullyQualifiedName.split(fieldName);

    if (trackedParts.length == 1 || fieldParts.length < trackedParts.length) {
      return false;
    }

    for (int i = 0; i < trackedParts.length - 1; i++) {
      if (!trackedParts[i].equals(fieldParts[i])) {
        return false;
      }
    }

    return trackedParts[trackedParts.length - 1].equals(fieldParts[fieldParts.length - 1]);
  }

  private boolean hasField(Class<?> currentClass, String[] fieldParts, int index) {
    try {
      Field field = currentClass.getDeclaredField(fieldParts[index]);
      if (index == fieldParts.length - 1) {
        return true;
      }

      return hasField(getFieldClass(field), fieldParts, index + 1);
    } catch (NoSuchFieldException e) {
      return false;
    }
  }

  private boolean isListField(Class<?> currentClass, String fieldName) {
    try {
      String[] fieldParts = FullyQualifiedName.split(fieldName);
      Field field = null;
      Class<?> fieldClass = currentClass;

      for (String fieldPart : fieldParts) {
        field = fieldClass.getDeclaredField(fieldPart);
        fieldClass = getFieldClass(field);
      }

      return field != null && List.class.isAssignableFrom(field.getType());
    } catch (NoSuchFieldException e) {
      LOG.warn("No field {} found in class {}", fieldName, currentClass.getName());
      return false;
    }
  }

  private Class<?> getFieldClass(Field field) {
    if (List.class.isAssignableFrom(field.getType())) {
      Type genericType = field.getGenericType();
      if (genericType instanceof ParameterizedType parameterizedType) {
        Type elementType = parameterizedType.getActualTypeArguments()[0];
        if (elementType instanceof Class<?> elementClass) {
          return elementClass;
        }
        if (elementType instanceof ParameterizedType nestedParameterizedType) {
          return (Class<?>) nestedParameterizedType.getRawType();
        }
      }
    }

    return field.getType();
  }
}
