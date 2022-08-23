package org.openmetadata.catalog.util;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.filter.Filters;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;

@Slf4j
public class FilterUtil {

  public static boolean shouldProcessRequest(ChangeEvent changeEvent, Map<String, Map<EventType, Filters>> filtersMap) {
    if (filtersMap != null && !filtersMap.isEmpty()) {
      String entityType = changeEvent.getEntityType();
      EventType eventType = changeEvent.getEventType();
      Map<EventType, Filters> filtersOfEntity = filtersMap.get(entityType);
      if (filtersOfEntity == null || filtersOfEntity.size() == 0) {
        // check if we have all entities Filter
        return handleWithWildCardFilter(filtersMap.get("all"), eventType, getUpdateField(changeEvent));
      } else {
        Filters sf;
        if ((sf = filtersOfEntity.get(eventType)) == null) {
          return false;
        } else {
          return sf.getFields().contains("all") || checkIfFilterContainField(sf, getUpdateField(changeEvent));
        }
      }
    }
    return false;
  }

  public static boolean handleWithWildCardFilter(
      Map<EventType, Filters> wildCardFilter, EventType type, List<String> updatedField) {
    if (wildCardFilter != null && !wildCardFilter.isEmpty()) {
      // check if we have all entities Filter
      Filters f = wildCardFilter.get(type);
      boolean allFieldCheck = checkIfFilterContainField(f, updatedField);
      return f != null && (f.getFields().contains("all") || allFieldCheck);
    }
    return false;
  }

  public static boolean checkIfFilterContainField(Filters f, List<String> updatedField) {
    if (f != null) {
      for (String changed : updatedField) {
        if (f.getFields().contains(changed)) {
          return true;
        }
      }
    }
    return false;
  }

  public static List<String> getUpdateField(ChangeEvent changeEvent) {
    if (changeEvent.getEventType() == EventType.ENTITY_CREATED
        || changeEvent.getEventType() == EventType.ENTITY_DELETED
        || changeEvent.getEventType() == EventType.ENTITY_SOFT_DELETED) {
      return List.of(changeEvent.getEntityType());
    }
    ChangeDescription description = changeEvent.getChangeDescription();
    List<FieldChange> allFieldChange = new ArrayList<>();
    allFieldChange.addAll(description.getFieldsAdded());
    allFieldChange.addAll(description.getFieldsUpdated());
    allFieldChange.addAll(description.getFieldsDeleted());

    return getChangedFields(allFieldChange);
  }

  public static List<String> getChangedFields(List<FieldChange> field) {
    List<String> updatedFields = new ArrayList<>();
    field.forEach(
        (f) -> {
          String updatedField = f.getName();
          if (updatedField.contains(".")) {
            String[] arr = updatedField.split("\\.");
            updatedFields.add(arr[arr.length - 1]);
          } else {
            updatedFields.add(updatedField);
          }
        });
    return updatedFields;
  }
}
