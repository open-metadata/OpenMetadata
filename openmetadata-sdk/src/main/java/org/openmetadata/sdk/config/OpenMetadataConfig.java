package org.openmetadata.sdk.config;

import java.util.HashMap;
import java.util.Map;

public class OpenMetadataConfig {
  private final String baseUrl;
  private final String accessToken;
  private final Map<String, String> headers;
  private final int connectTimeout;
  private final int readTimeout;
  private final int writeTimeout;
  private final boolean debug;
  private final boolean testMode;

  private OpenMetadataConfig(Builder builder) {
    this.baseUrl = builder.baseUrl;
    this.accessToken = builder.accessToken;
    this.headers = new HashMap<>(builder.headers);
    this.connectTimeout = builder.connectTimeout;
    this.readTimeout = builder.readTimeout;
    this.writeTimeout = builder.writeTimeout;
    this.debug = builder.debug;
    this.testMode = builder.testMode;
  }

  public String getBaseUrl() {
    return baseUrl;
  }

  public String getAccessToken() {
    return accessToken;
  }

  public Map<String, String> getHeaders() {
    return new HashMap<>(headers);
  }

  public int getConnectTimeout() {
    return connectTimeout;
  }

  public int getReadTimeout() {
    return readTimeout;
  }

  public int getWriteTimeout() {
    return writeTimeout;
  }

  public boolean isDebug() {
    return debug;
  }

  public boolean isTestMode() {
    return testMode;
  }

  public String getServerUrl() {
    return baseUrl;
  }

  public static Builder builder() {
    return new Builder();
  }

  public static class Builder {
    private String baseUrl;
    private String accessToken;
    private Map<String, String> headers = new HashMap<>();
    private int connectTimeout = 30000; // 30 seconds
    private int readTimeout = 60000; // 60 seconds
    private int writeTimeout = 60000; // 60 seconds
    private boolean debug = false;
    private boolean testMode = false;

    private Builder() {}

    public Builder baseUrl(String baseUrl) {
      this.baseUrl = baseUrl;
      return this;
    }

    public Builder serverUrl(String serverUrl) {
      this.baseUrl = serverUrl;
      return this;
    }

    public Builder accessToken(String accessToken) {
      this.accessToken = accessToken;
      return this;
    }

    public Builder apiKey(String apiKey) {
      this.accessToken = apiKey;
      return this;
    }

    public Builder header(String name, String value) {
      this.headers.put(name, value);
      return this;
    }

    public Builder headers(Map<String, String> headers) {
      this.headers.putAll(headers);
      return this;
    }

    public Builder connectTimeout(int connectTimeout) {
      this.connectTimeout = connectTimeout;
      return this;
    }

    public Builder readTimeout(int readTimeout) {
      this.readTimeout = readTimeout;
      return this;
    }

    public Builder writeTimeout(int writeTimeout) {
      this.writeTimeout = writeTimeout;
      return this;
    }

    public Builder debug(boolean debug) {
      this.debug = debug;
      return this;
    }

    public Builder testMode(boolean testMode) {
      this.testMode = testMode;
      return this;
    }

    public OpenMetadataConfig build() {
      if (baseUrl == null || baseUrl.trim().isEmpty()) {
        throw new IllegalArgumentException("Base URL is required");
      }
      return new OpenMetadataConfig(this);
    }
  }
}
