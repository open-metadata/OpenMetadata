package org.openmetadata.catalog.filter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.openmetadata.catalog.type.EventType;

public class FilterRegistry {
  private static final ConcurrentHashMap<String, Map<EventType, Filters>> FILTERS_MAP = new ConcurrentHashMap<>();

  private FilterRegistry() {}

  public static void add(List<EventFilter> f) {
    if (f != null) {
      f.forEach(
          (entityfilter) -> {
            String entityType = entityfilter.getEntityType();
            Map<EventType, Filters> eventFilterMap = new HashMap<>();
            if (entityfilter.getFilters() != null) {
              entityfilter
                  .getFilters()
                  .forEach((eventFilter) -> eventFilterMap.put(eventFilter.getEventType(), eventFilter));
            }
            FILTERS_MAP.put(entityType, eventFilterMap);
          });
    }
  }

  public static List<Map<EventType, Filters>> listAllFilters() {
    List<Map<EventType, Filters>> filterList = new ArrayList<>();
    FILTERS_MAP.forEach((key, value) -> filterList.add(value));
    return filterList;
  }

  public static List<String> listAllEntitiesHavingFilter() {
    return List.copyOf(FILTERS_MAP.keySet());
  }

  public static Map<EventType, Filters> getFilterForEntity(String key) {
    return FILTERS_MAP.get(key);
  }

  public static Map<String, Map<EventType, Filters>> getAllFilters() {
    return FILTERS_MAP;
  }
}
