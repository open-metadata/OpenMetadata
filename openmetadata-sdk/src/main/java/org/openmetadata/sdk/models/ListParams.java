package org.openmetadata.sdk.models;

import java.util.HashMap;
import java.util.Map;

/**
 * Parameters for list operations.
 */
public class ListParams {
  private Integer limit;
  private Integer offset;
  private Boolean latest;
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

  public ListParams setService(String service) {
    filters.put("service", service);
    return this;
  }

  public ListParams setDatabase(String database) {
    filters.put("database", database);
    return this;
  }

  public ListParams setDatabaseSchema(String databaseSchema) {
    filters.put("databaseSchema", databaseSchema);
    return this;
  }

  public ListParams setParent(String parent) {
    filters.put("parent", parent);
    return this;
  }

  public ListParams setDomain(String domain) {
    filters.put("domain", domain);
    return this;
  }

  public ListParams withDomain(String domain) {
    return setDomain(domain);
  }

  public ListParams setDomains(String domains) {
    filters.put("domains", domains);
    return this;
  }

  public ListParams withService(String service) {
    return setService(service);
  }

  public ListParams setDirectory(String directory) {
    filters.put("directory", directory);
    return this;
  }

  public ListParams withDirectory(String directory) {
    return setDirectory(directory);
  }

  public ListParams setRoot(String root) {
    filters.put("root", root);
    return this;
  }

  public ListParams withRoot(String root) {
    return setRoot(root);
  }

  public ListParams setProvider(String provider) {
    filters.put("provider", provider);
    return this;
  }

  public ListParams withProvider(String provider) {
    return setProvider(provider);
  }

  public ListParams setServiceType(String serviceType) {
    filters.put("serviceType", serviceType);
    return this;
  }

  public ListParams withServiceType(String serviceType) {
    return setServiceType(serviceType);
  }

  public ListParams setPipelineType(String pipelineType) {
    filters.put("pipelineType", pipelineType);
    return this;
  }

  public ListParams withPipelineType(String pipelineType) {
    return setPipelineType(pipelineType);
  }

  public Integer getOffset() {
    return offset;
  }

  public ListParams setOffset(Integer offset) {
    this.offset = offset;
    return this;
  }

  public ListParams withOffset(Integer offset) {
    return setOffset(offset);
  }

  public Boolean getLatest() {
    return latest;
  }

  public ListParams setLatest(Boolean latest) {
    this.latest = latest;
    return this;
  }

  public ListParams withLatest(boolean latest) {
    return setLatest(latest);
  }

  public ListParams withLimit(Integer limit) {
    return setLimit(limit);
  }

  public ListParams withAfter(String after) {
    return setAfter(after);
  }

  public ListParams addQueryParam(String key, String value) {
    queryParams.put(key, value);
    return this;
  }

  public ListParams setQueryParams(Map<String, String> params) {
    if (params != null) {
      queryParams.putAll(params);
    }
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
    if (offset != null) {
      params.put("offset", offset.toString());
    }
    if (latest != null) {
      params.put("latest", latest.toString());
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
    copy.offset = this.offset;
    copy.latest = this.latest;
    copy.after = this.after;
    copy.before = this.before;
    copy.fields = this.fields;
    copy.filters.putAll(this.filters);
    copy.queryParams.putAll(this.queryParams);
    return copy;
  }
}
