package org.openmetadata.sdk.config;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.sdk.network.RequestListener;

public class OpenMetadataConfig {
  private final String baseUrl;
  private final String accessToken;
  private final Map<String, String> headers;
  private final int connectTimeout;
  private final int readTimeout;
  private final int writeTimeout;
  private final boolean debug;
  private final boolean testMode;
  private final List<RequestListener> requestListeners;

  private OpenMetadataConfig(Builder builder) {
    this.baseUrl = builder.baseUrl;
    this.accessToken = builder.accessToken;
    this.headers = new HashMap<>(builder.headers);
    this.connectTimeout = builder.connectTimeout;
    this.readTimeout = builder.readTimeout;
    this.writeTimeout = builder.writeTimeout;
    this.debug = builder.debug;
    this.testMode = builder.testMode;
    this.requestListeners = List.copyOf(builder.requestListeners);
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

  public List<RequestListener> getRequestListeners() {
    return requestListeners;
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
    private final List<RequestListener> requestListeners = new ArrayList<>();

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

    /** Adds a listener notified after every HTTP call; see {@link RequestListener}. */
    public Builder requestListener(RequestListener listener) {
      if (listener == null) {
        throw new IllegalArgumentException("Request listener must not be null");
      }
      this.requestListeners.add(listener);
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
