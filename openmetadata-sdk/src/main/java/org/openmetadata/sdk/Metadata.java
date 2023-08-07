package org.openmetadata.sdk;

import java.net.PasswordAuthentication;
import java.net.Proxy;
import java.util.HashMap;
import java.util.Map;

public class Metadata {
  public static final int DEFAULT_CONNECT_TIMEOUT = 30 * 1000;
  public static final int DEFAULT_READ_TIMEOUT = 80 * 1000;

  public static final String API_VERSION = ApiVersion.CURRENT;
  public static final String CONNECT_API_BASE = "http://localhost:8585/api";
  public static volatile String apiKey;

  private static volatile int maxNetworkRetries = 0;

  private static volatile String connectApiBase = CONNECT_API_BASE;
  private static volatile int connectTimeout = -1;
  private static volatile int readTimeout = -1;

  public static void overrideApiBase(final String overriddenApiBase) {
    connectApiBase = overriddenApiBase;
  }

  public static String getApiBase() {
    return connectApiBase;
  }

  public static int getConnectTimeout() {
    if (connectTimeout == -1) {
      return DEFAULT_CONNECT_TIMEOUT;
    }
    return connectTimeout;
  }

  public static void setReadTimeout(final int timeout) {
    readTimeout = timeout;
  }

  public static int getMaxNetworkRetries() {
    return maxNetworkRetries;
  }

  public static void setMaxNetworkRetries(final int numRetries) {
    maxNetworkRetries = numRetries;
  }

}
