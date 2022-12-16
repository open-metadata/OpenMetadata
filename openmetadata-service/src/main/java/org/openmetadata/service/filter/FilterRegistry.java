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

package org.openmetadata.service.filter;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.openmetadata.schema.entity.alerts.Alert;
import org.openmetadata.schema.filter.EventFilter;
import org.openmetadata.schema.filter.Filters;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.alerts.ActivityFeedAlertCache;

public class FilterRegistry {
  private static final ConcurrentHashMap<String, Map<EventType, Filters>> FILTERS_MAP = new ConcurrentHashMap<>();

  private FilterRegistry() {}

  public static void add(List<EventFilter> f) {
    if (f != null) {
      f.forEach(
          (entityFilter) -> {
            String entityType = entityFilter.getEntityType();
            Map<EventType, Filters> eventFilterMap = new HashMap<>();
            if (entityFilter.getFilters() != null) {
              entityFilter
                  .getFilters()
                  .forEach((eventFilter) -> eventFilterMap.put(eventFilter.getEventType(), eventFilter));
            }
            FILTERS_MAP.put(entityType, eventFilterMap);
          });
    }
  }

  public static Map<String, Map<EventType, Filters>> getAllFilters() {
    Alert alert = ActivityFeedAlertCache.getInstance().getActivityFeedAlert();
    add(alert.getTriggerConfig().getEventFilters());
    return FILTERS_MAP;
  }
}
