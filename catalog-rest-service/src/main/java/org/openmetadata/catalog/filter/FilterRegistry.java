package org.openmetadata.catalog.filter;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class FilterRegistry {
  private static final FilterRegistry registry = new FilterRegistry();
  private static final ConcurrentHashMap<String, Map<FiltersType, BasicFilter>> FILTERS_MAP = new ConcurrentHashMap<>();

  private FilterRegistry() {}

  public static void add(List<Filter> filterDetails) {
    filterDetails.forEach(
        (filter) -> {
          String entityType = filter.getEntityType();
          Map<FiltersType, BasicFilter> eventFilterMap = new HashMap<>();
          if (filter.getEventFilter() != null) {
            filter
                .getEventFilter()
                .forEach(
                    (eventFilter) -> {
                      eventFilterMap.put(eventFilter.getFilterType(), eventFilter);
                    });
          }
          FILTERS_MAP.put(filter.getEntityType(), eventFilterMap);
        });
  }

  public static List<Map<FiltersType, BasicFilter>> listAllFilters() {
    List<Map<FiltersType, BasicFilter>> filterList = new ArrayList<>();
    FILTERS_MAP.forEach(
        (key, value) -> {
          filterList.add(value);
        });
    return filterList;
  }

  public static List<String> listAllEntitiesHavingFilter() {
    return List.copyOf(FILTERS_MAP.keySet());
  }

  public static Map<FiltersType, BasicFilter> getFilterForEntity(String key) {
    return FILTERS_MAP.get(key);
  }
}
