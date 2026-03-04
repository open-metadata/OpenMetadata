package org.openmetadata.sdk.client;

import org.openmetadata.sdk.config.OpenMetadataConfig;

public class OpenMetadata {
  private static OpenMetadataClient defaultClient;

  private OpenMetadata() {
    // Private constructor to prevent instantiation
  }

  public static void initialize(OpenMetadataConfig config) {
    defaultClient = new OpenMetadataClient(config);
  }

  public static void initialize(String baseUrl, String accessToken) {
    OpenMetadataConfig config =
        OpenMetadataConfig.builder().baseUrl(baseUrl).accessToken(accessToken).build();
    initialize(config);
  }

  public static OpenMetadataClient client() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "OpenMetadata client not initialized. Call OpenMetadata.initialize() first.");
    }
    return defaultClient;
  }

  public static OpenMetadataClient client(OpenMetadataConfig config) {
    return new OpenMetadataClient(config);
  }

  public static boolean isInitialized() {
    return defaultClient != null;
  }

  public static void reset() {
    defaultClient = null;
  }
}
