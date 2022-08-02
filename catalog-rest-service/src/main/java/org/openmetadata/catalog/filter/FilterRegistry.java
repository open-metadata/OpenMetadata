package org.openmetadata.catalog.filter;

import java.util.*;

public class FilterRegistry {
  private static final FilterRegistry registry = new FilterRegistry();
  private static final Map<String, Filter> FILTER_LIST = new HashMap<>();

  private FilterRegistry() {}

  public static void add(List<Filter> filterDetails) {
    filterDetails.forEach((filter) -> FILTER_LIST.put(filter.getEntityType(), filter));
  }

  public static List<Filter> listAllFilters() {
    return List.copyOf(FILTER_LIST.values());
  }

  public static List<String> listAllEntitiesHavingFilter() {
    return List.copyOf(FILTER_LIST.keySet());
  }

  public static Filter getFilterForEntity(String key) {
    return FILTER_LIST.get(key);
  }
}
