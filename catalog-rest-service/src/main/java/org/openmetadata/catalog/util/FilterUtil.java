package org.openmetadata.catalog.util;

import static org.openmetadata.catalog.Entity.*;
import static org.openmetadata.catalog.filter.FiltersType.*;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.filter.BasicFilter;
import org.openmetadata.catalog.filter.FiltersType;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;

@Slf4j
public class FilterUtil {

  public static boolean shouldProcessRequest(
      ChangeEvent changeEvent, Map<String, Map<EventType, List<BasicFilter>>> filtersMap) {
    if (filtersMap != null && !filtersMap.isEmpty()) {
      EventType changeType = changeEvent.getEventType();
      String entityType = changeEvent.getEntityType();
      Map<EventType, List<BasicFilter>> filtersOfEntity = filtersMap.get(entityType);
      if (filtersOfEntity == null || filtersOfEntity.size() == 0) {
        // check if we have all entities Filter
        return handleWithWildCardFilter(filtersMap.get("*"), changeType);
      } else {
        List<BasicFilter> filter = filtersOfEntity.get(changeType);
        if (filter == null || filter.isEmpty()) {
          return handleWithWildCardFilter(filtersMap.get("*"), changeType);
        } else {
          try {
            switch (changeType) {
              case ENTITY_CREATED:
              case ENTITY_DELETED:
              case ENTITY_SOFT_DELETED:
                // TODO: Here assumption of having one filter for above changeTypes?!
                return filter.get(0).getEnabled();
              case ENTITY_UPDATED:
                if (filter.size() == 1 && filter.get(0).getFilterType() == ALL) {
                  return filter.get(0).getEnabled();
                } else {
                  return getUpdateFilter(changeEvent, filter);
                }
            }
          } catch (Exception ex) {
            LOG.debug("Filter of type is not present in the map");
          }
        }
      }
    }
    return false;
  }

  public static boolean handleWithWildCardFilter(Map<EventType, List<BasicFilter>> wildCardFilter, EventType type) {
    if (wildCardFilter != null && !wildCardFilter.isEmpty()) {
      // check if we have all entities Filter
      List<BasicFilter> filter = wildCardFilter.get(type);
      if (filter != null && !filter.isEmpty()) {
        return filter.get(0).getEnabled();
      } else {
        return false;
      }
    }
    return false;
  }

  public static boolean getUpdateFilter(ChangeEvent changeEvent, List<BasicFilter> filter) {
    ChangeDescription description = changeEvent.getChangeDescription();
    List<FieldChange> fieldsAdded = description.getFieldsAdded();
    List<FieldChange> fieldsUpdated = description.getFieldsUpdated();
    List<FieldChange> fieldsDeleted = description.getFieldsDeleted();

    // at a time eiter the fields are added or deleted or updated
    // there is a scenario of tags where we can have updated and added or removed together
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
      ChangeEventParser.CHANGE_TYPE changeType, List<BasicFilter> filter, String updatedField) {
    FiltersType updateFilterType = ALL;
    boolean containsFilter = true;
    switch (updatedField) {
      case FIELD_FOLLOWERS:
        if (changeType == ChangeEventParser.CHANGE_TYPE.ADD) {
          updateFilterType = FOLLOW_ENTITY;
        } else if (changeType == ChangeEventParser.CHANGE_TYPE.DELETE) {
          updateFilterType = UNFOLLOW_ENTITY;
        }
        break;
      case FIELD_TAGS:
        if (changeType == ChangeEventParser.CHANGE_TYPE.ADD) {
          updateFilterType = ADDTAGS;
        } else if (changeType == ChangeEventParser.CHANGE_TYPE.UPDATE) {
          updateFilterType = UPDATETAGS;
        } else if (changeType == ChangeEventParser.CHANGE_TYPE.DELETE) {
          updateFilterType = REMOVETAGS;
        }
        break;
      case FIELD_DESCRIPTION:
        updateFilterType = UPDATEDESCRIPTION;
        break;
      case FIELD_OWNER:
        updateFilterType = UPDATEOWNER;
        break;
      case FIELD_USAGE_SUMMARY:
        updateFilterType = USAGESUMMARY;
        break;
      case FIELD_EVENT_FILTERS:
        updateFilterType = UPDATE_EVENT_FILTERS;
        break;
    }
    for (BasicFilter f : filter) {
      if (f.getFilterType() == updateFilterType) {
        containsFilter = f.getEnabled();
      }
    }
    return containsFilter;
  }
}
