package org.openmetadata.sdk.entities;

import org.openmetadata.sdk.client.OpenMetadataClient;

public abstract class EntityBase {
  protected static OpenMetadataClient defaultClient;

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  protected static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Default client not set. Call setDefaultClient() or use instance methods.");
    }
    return defaultClient;
  }
}
