package org.openmetadata.it.util;

import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.fluent.DatabaseServices;

public class SdkClients {
  public static OpenMetadataClient adminClient() {
    String baseUrl =
        System.getProperty("IT_BASE_URL", System.getenv().getOrDefault("IT_BASE_URL", "http://localhost:8585"));
    String token =
        JwtAuthProvider.tokenFor(
            "admin@open-metadata.org", "admin@open-metadata.org", new String[] {"admin"}, 3600);
    OpenMetadataConfig cfg =
        OpenMetadataConfig.builder()
            .serverUrl(baseUrl)
            .accessToken(token)
            .header("X-Auth-Params-Email", "admin@open-metadata.org")
            .build();
    OpenMetadataClient client = new OpenMetadataClient(cfg);
    // Set default client for fluent APIs used in factories
    DatabaseServices.setDefaultClient(client);
    return client;
  }
}
