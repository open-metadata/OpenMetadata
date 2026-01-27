package org.openmetadata.sdk.network;

import java.util.HashMap;
import java.util.Map;

public class RequestOptions {
  private final Map<String, String> headers;
  private final Map<String, String> queryParams;
  private final Integer timeout;

  private RequestOptions(Builder builder) {
    this.headers = new HashMap<>(builder.headers);
    this.queryParams = new HashMap<>(builder.queryParams);
    this.timeout = builder.timeout;
  }

  public Map<String, String> getHeaders() {
    return new HashMap<>(headers);
  }

  public Map<String, String> getQueryParams() {
    return new HashMap<>(queryParams);
  }

  public Integer getTimeout() {
    return timeout;
  }

  public static Builder builder() {
    return new Builder();
  }

  public static class Builder {
    private Map<String, String> headers = new HashMap<>();
    private Map<String, String> queryParams = new HashMap<>();
    private Integer timeout;

    public Builder header(String name, String value) {
      this.headers.put(name, value);
      return this;
    }

    public Builder headers(Map<String, String> headers) {
      this.headers.putAll(headers);
      return this;
    }

    public Builder queryParam(String name, String value) {
      this.queryParams.put(name, value);
      return this;
    }

    public Builder queryParams(Map<String, String> queryParams) {
      this.queryParams.putAll(queryParams);
      return this;
    }

    public Builder timeout(Integer timeout) {
      this.timeout = timeout;
      return this;
    }

    public RequestOptions build() {
      return new RequestOptions(this);
    }
  }
}
