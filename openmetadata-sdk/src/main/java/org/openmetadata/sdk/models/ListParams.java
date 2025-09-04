package org.openmetadata.sdk.models;

import java.util.HashMap;
import java.util.Map;

public class ListParams {
  private String fields;
  private Integer limit;
  private String before;
  private String after;
  private String include;

  public ListParams() {}

  public String getFields() {
    return fields;
  }

  public ListParams setFields(String fields) {
    this.fields = fields;
    return this;
  }

  public Integer getLimit() {
    return limit;
  }

  public ListParams setLimit(Integer limit) {
    this.limit = limit;
    return this;
  }

  public String getBefore() {
    return before;
  }

  public ListParams setBefore(String before) {
    this.before = before;
    return this;
  }

  public String getAfter() {
    return after;
  }

  public ListParams setAfter(String after) {
    this.after = after;
    return this;
  }

  public String getInclude() {
    return include;
  }

  public ListParams setInclude(String include) {
    this.include = include;
    return this;
  }

  public Map<String, String> toQueryParams() {
    Map<String, String> params = new HashMap<>();
    if (fields != null) params.put("fields", fields);
    if (limit != null) params.put("limit", limit.toString());
    if (before != null) params.put("before", before);
    if (after != null) params.put("after", after);
    if (include != null) params.put("include", include);
    return params;
  }
}
