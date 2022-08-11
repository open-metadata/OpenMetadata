package org.openmetadata.catalog.util;

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
      Filters sf;
      if (filtersOfEntity == null || filtersOfEntity.size() == 0 || (sf = filtersOfEntity.get(eventType)) == null) {
        // check if we have all entities Filter
        return handleWithWildCardFilter(filtersMap.get("all"), eventType, getUpdateField(changeEvent));
      } else {
        return sf.getFields().contains("all") || sf.getFields().contains(getUpdateField(changeEvent));
      }
    }
    return false;
  }

  public static boolean handleWithWildCardFilter(
      Map<EventType, Filters> wildCardFilter, EventType type, String updatedField) {
    if (wildCardFilter != null && !wildCardFilter.isEmpty()) {
      // check if we have all entities Filter
      Filters f = wildCardFilter.get(type);
      if (f == null || (!f.getFields().contains("all") && !f.getFields().contains(updatedField))) {
        return false;
      } else {
        return true;
      }
    }
    return false;
  }

  public static String getUpdateField(ChangeEvent changeEvent) {
    if (changeEvent.getEventType() == EventType.ENTITY_CREATED
        || changeEvent.getEventType() == EventType.ENTITY_DELETED
        || changeEvent.getEventType() == EventType.ENTITY_SOFT_DELETED) {
      return changeEvent.getEntityType();
    }
    ChangeDescription description = changeEvent.getChangeDescription();
    List<FieldChange> fieldsAdded = description.getFieldsAdded();
    List<FieldChange> fieldsUpdated = description.getFieldsUpdated();
    List<FieldChange> fieldsDeleted = description.getFieldsDeleted();

    // at a time eiter the fields are added or deleted or updated
    // there is a scenario of tags where we can have updated and added or removed together
    if (fieldsAdded.size() > 0 && fieldsUpdated.size() == 0 && fieldsDeleted.size() == 0) {
      // only added fields
      return getUpdatedField(fieldsAdded.get(0));
    } else if (fieldsAdded.size() == 0 && fieldsUpdated.size() > 0 && fieldsDeleted.size() == 0) {
      // only updated Fields
      return getUpdatedField(fieldsUpdated.get(0));
    } else if (fieldsAdded.size() == 0 && fieldsUpdated.size() == 0 && fieldsDeleted.size() > 0) {
      // only deleted Fields
      return getUpdatedField(fieldsDeleted.get(0));
    } else {
      // TODO: how do i handle this??
      return getUpdatedField(fieldsAdded.get(0));
    }
  }

  public static String getUpdatedField(FieldChange field) {
    String updatedField = field.getName();
    if (updatedField.contains(".")) {
      String[] arr = updatedField.split("\\.");
      return arr[arr.length - 1];
    } else {
      return updatedField;
    }
  }
}
