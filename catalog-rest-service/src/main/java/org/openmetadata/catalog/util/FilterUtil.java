/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.util;

import static org.openmetadata.catalog.util.EntityUtil.compareEventFilters;
import static org.openmetadata.catalog.util.EntityUtil.compareFilters;

import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.filter.EventFilter;
import org.openmetadata.catalog.filter.Filters;
import org.openmetadata.catalog.settings.Settings;
import org.openmetadata.catalog.tests.type.TestCaseResult;
import org.openmetadata.catalog.tests.type.TestCaseStatus;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;

@Slf4j
public class FilterUtil {

  private static final String TEST_CASE_RESULT = "testCaseResult";

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
          if (sf.getFields().contains("all")) {
            return true;
          } else {
            if (entityType.equals("testCase")) {
              return handleTestCaseFilter(changeEvent, sf);
            } else {
              return checkIfFilterContainField(sf, getUpdateField(changeEvent));
            }
          }
        }
      }
    }
    return false;
  }

  private static boolean handleTestCaseFilter(ChangeEvent changeEvent, Filters sf) {
    List<FieldChange> fieldChanges = getAllFieldChange(changeEvent);
    for (FieldChange fieldChange : fieldChanges) {
      if (fieldChange.getName().equals(TEST_CASE_RESULT)) {
        TestCaseResult testCaseResult = (TestCaseResult) fieldChange.getNewValue();
        TestCaseStatus status = testCaseResult.getTestCaseStatus();
        if (sf.getFields().contains(TEST_CASE_RESULT + status.toString())) {
          return true;
        }
      }
    }
    return checkIfFilterContainField(sf, getUpdateField(changeEvent));
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
    return getChangedFields(getAllFieldChange(changeEvent));
  }

  public static List<FieldChange> getAllFieldChange(ChangeEvent changeEvent) {
    ChangeDescription description = changeEvent.getChangeDescription();
    List<FieldChange> allFieldChange = new ArrayList<>();
    allFieldChange.addAll(description.getFieldsAdded());
    allFieldChange.addAll(description.getFieldsUpdated());
    allFieldChange.addAll(description.getFieldsDeleted());

    return allFieldChange;
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

  public static Settings updateEntityFilter(Settings oldValue, String entityType, List<Filters> filters) {
    // all existing filters
    List<EventFilter> existingEntityFilter = (List<EventFilter>) oldValue.getConfigValue();
    EventFilter entititySpecificFilter = null;
    int position = 0;
    for (EventFilter e : existingEntityFilter) {
      if (e.getEntityType().equals(entityType)) {
        // filters for entity to Update
        entititySpecificFilter = e;
        break;
      }
      position++;
    }
    // sort based on eventType
    filters.sort(compareFilters);
    if (entititySpecificFilter != null) {
      // entity has some existing filter
      entititySpecificFilter.setFilters(filters);
      existingEntityFilter.set(position, entititySpecificFilter);
    } else {
      entititySpecificFilter = new EventFilter();
      entititySpecificFilter.setEntityType(entityType);
      entititySpecificFilter.setFilters(filters);
      existingEntityFilter.add(entititySpecificFilter);
    }
    // sort based on eventType
    existingEntityFilter.sort(compareEventFilters);
    // Put in DB
    oldValue.setConfigValue(existingEntityFilter);
    return oldValue;
  }

  public static List<EventFilter> getEventFilterFromSettings(Settings setting) throws IOException {
    String json = JsonUtils.pojoToJson(setting.getConfigValue());
    List<EventFilter> eventFilterList = JsonUtils.readValue(json, new TypeReference<ArrayList<EventFilter>>() {});
    return eventFilterList;
  }
}
