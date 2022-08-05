package org.openmetadata.catalog.util;

import static org.openmetadata.catalog.Entity.*;
import static org.openmetadata.catalog.filter.FiltersType.ENTITY_CREATED;
import static org.openmetadata.catalog.filter.FiltersType.ENTITY_DELETED;

import java.util.List;
import java.util.Map;
import org.openmetadata.catalog.filter.BasicFilter;
import org.openmetadata.catalog.filter.FiltersType;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;

public class FilterUtil {

  public static boolean shouldProcessRequest(ChangeEvent changeEvent, Map<FiltersType, BasicFilter> filter) {
    if (filter != null) {
      EventType changeType = changeEvent.getEventType();
      switch (changeType) {
        case ENTITY_CREATED:
          return filter.get(ENTITY_CREATED).getEnabled();
        case ENTITY_UPDATED:
          return getUpdateFilter(changeEvent, filter);
        case ENTITY_DELETED:
          return filter.get(ENTITY_DELETED).getEnabled();
      }
    }
    // continue to post events updates
    return true;
  }

  public static boolean getUpdateFilter(ChangeEvent changeEvent, Map<FiltersType, BasicFilter> filter) {
    ChangeDescription description = changeEvent.getChangeDescription();
    List<FieldChange> fieldsAdded = description.getFieldsAdded();
    List<FieldChange> fieldsUpdated = description.getFieldsUpdated();
    List<FieldChange> fieldsDeleted = description.getFieldsDeleted();

    // at a time eiter the fields are added or deleted or updated
    // there is a scenarion of tags where we can have updated and added or removed together
    if (fieldsAdded.size() > 0 && fieldsUpdated.size() == 0 && fieldsDeleted.size() == 0) {
      // only added fields
      return isFilterEnabled(ChangeEventParser.CHANGE_TYPE.ADD, filter, getUpdatedField(fieldsAdded.get(0)));
    } else if (fieldsAdded.size() == 0 && fieldsUpdated.size() > 0 && fieldsDeleted.size() == 0) {
      // only updated Fields
      return isFilterEnabled(ChangeEventParser.CHANGE_TYPE.UPDATE, filter, getUpdatedField(fieldsUpdated.get(0)));
    } else if (fieldsAdded.size() == 0 && fieldsUpdated.size() == 0 && fieldsDeleted.size() > 0) {
      // only deleted Fields
      return isFilterEnabled(ChangeEventParser.CHANGE_TYPE.DELETE, filter, getUpdatedField(fieldsDeleted.get(0)));
    } else {
      // TODO: how do i handle this??
      return isFilterEnabled(ChangeEventParser.CHANGE_TYPE.UPDATE, filter, getUpdatedField(fieldsAdded.get(0)));
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

  public static boolean isFilterEnabled(
      ChangeEventParser.CHANGE_TYPE changeType, Map<FiltersType, BasicFilter> filter, String updatedField) {
    boolean response = true;
    switch (updatedField) {
      case FIELD_FOLLOWERS:
        if (changeType == ChangeEventParser.CHANGE_TYPE.ADD) {
          return filter.get(FiltersType.FOLLOW_ENTITY).getEnabled();
        } else if (changeType == ChangeEventParser.CHANGE_TYPE.DELETE) {
          return filter.get(FiltersType.UNFOLLOW_ENTITY).getEnabled();
        }
      case FIELD_TAGS:
        if (changeType == ChangeEventParser.CHANGE_TYPE.ADD) {
          return filter.get(FiltersType.ADDTAGS).getEnabled();
        } else if (changeType == ChangeEventParser.CHANGE_TYPE.UPDATE) {
          return filter.get(FiltersType.UPDATETAGS).getEnabled();
        } else if (changeType == ChangeEventParser.CHANGE_TYPE.DELETE) {
          return filter.get(FiltersType.REMOVETAGS).getEnabled();
        }
      case FIELD_DESCRIPTION:
        return filter.get(FiltersType.UPDATEDESCRIPTION).getEnabled();
      case FIELD_OWNER:
        return filter.get(FiltersType.UPDATEOWNER).getEnabled();
      case FIELD_USAGE_SUMMARY:
        return filter.get(FiltersType.USAGESUMMARY).getEnabled();
    }
    return response;
  }
}
