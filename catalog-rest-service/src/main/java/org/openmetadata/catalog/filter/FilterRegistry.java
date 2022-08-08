package org.openmetadata.catalog.filter;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.openmetadata.catalog.type.EventType;

public class FilterRegistry {
  private static final ConcurrentHashMap<String, Map<EventType, List<BasicFilter>>> FILTERS_MAP = new ConcurrentHashMap<>();
  private FilterRegistry() {}

  public static void add(List<EntityFilter> f) {
    if (f != null) {
      f.forEach(
          (entityfilter) -> {
            String entityType = entityfilter.getEntityType();
            Map<EventType, List<BasicFilter>> eventFilterMap = new HashMap<>();
            if (entityfilter.getEventFilter() != null) {
              entityfilter
                  .getEventFilter()
                  .forEach(
                      (eventFilter) -> eventFilterMap.put(eventFilter.getEventType(), eventFilter.getEvents()));
            }
            FILTERS_MAP.put(entityType, eventFilterMap);
          });
    }
  }

  public static List<Map<EventType, List<BasicFilter>>> listAllFilters() {
    List<Map<EventType, List<BasicFilter>>> filterList = new ArrayList<>();
    FILTERS_MAP.forEach(
        (key, value) -> filterList.add(value));
    return filterList;
  }

  public static List<String> listAllEntitiesHavingFilter() {
    return List.copyOf(FILTERS_MAP.keySet());
  }

  public static Map<EventType, List<BasicFilter>> getFilterForEntity(String key) {
    return FILTERS_MAP.get(key);
  }

  public static Map<String, Map<EventType, List<BasicFilter>>> getAllFilters() {
    return FILTERS_MAP;
  }
}
