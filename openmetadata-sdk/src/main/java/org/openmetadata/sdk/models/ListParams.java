package org.openmetadata.sdk.models;

import java.util.HashMap;
import java.util.Map;

/**
 * Parameters for list operations.
 */
public class ListParams {
  private Integer limit;
  private String after;
  private String before;
  private String fields;
  private final Map<String, String> filters = new HashMap<>();
  private final Map<String, String> queryParams = new HashMap<>();

  public Integer getLimit() {
    return limit;
  }

  public ListParams setLimit(Integer limit) {
    this.limit = limit;
    return this;
  }

  public String getAfter() {
    return after;
  }

  public ListParams setAfter(String after) {
    this.after = after;
    return this;
  }

  public String getBefore() {
    return before;
  }

  public ListParams setBefore(String before) {
    this.before = before;
    return this;
  }

  public String getFields() {
    return fields;
  }

  public ListParams setFields(String fields) {
    this.fields = fields;
    return this;
  }

  public Map<String, String> getFilters() {
    return filters;
  }

  public ListParams addFilter(String key, String value) {
    filters.put(key, value);
    return this;
  }

  public Map<String, String> toQueryParams() {
    Map<String, String> params = new HashMap<>();

    // Add queryParams, filtering out null values
    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      if (entry.getValue() != null) {
        params.put(entry.getKey(), entry.getValue());
      }
    }

    // Add filters, filtering out null values
    for (Map.Entry<String, String> entry : filters.entrySet()) {
      if (entry.getValue() != null) {
        params.put(entry.getKey(), entry.getValue());
      }
    }

    if (limit != null) {
      params.put("limit", limit.toString());
    }
    if (after != null) {
      params.put("after", after);
    }
    if (before != null) {
      params.put("before", before);
    }
    if (fields != null) {
      params.put("fields", fields);
    }

    return params;
  }

  public ListParams copy() {
    ListParams copy = new ListParams();
    copy.limit = this.limit;
    copy.after = this.after;
    copy.before = this.before;
    copy.fields = this.fields;
    copy.filters.putAll(this.filters);
    copy.queryParams.putAll(this.queryParams);
    return copy;
  }
}
