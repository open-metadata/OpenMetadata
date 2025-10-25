package org.openmetadata.it.util;

import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.fluent.DatabaseServices;

public class SdkClients {

  private static final String BASE_URL =
      System.getProperty(
          "IT_BASE_URL", System.getenv().getOrDefault("IT_BASE_URL", "http://localhost:8585"));

  public static OpenMetadataClient adminClient() {
    return createClient(
        "admin@open-metadata.org", "admin@open-metadata.org", new String[] {"admin"});
  }

  public static OpenMetadataClient testUserClient() {
    return createClient("test@open-metadata.org", "test@open-metadata.org", new String[] {});
  }

  public static OpenMetadataClient botClient() {
    return createClient(
        "ingestion-bot@open-metadata.org", "ingestion-bot@open-metadata.org", new String[] {"bot"});
  }

  public static OpenMetadataClient dataStewardClient() {
    return createClient(
        "data-steward@open-metadata.org",
        "data-steward@open-metadata.org",
        new String[] {"DataSteward"});
  }

  public static OpenMetadataClient dataConsumerClient() {
    return createClient(
        "data-consumer@open-metadata.org",
        "data-consumer@open-metadata.org",
        new String[] {"DataConsumer"});
  }

  public static OpenMetadataClient user1Client() {
    return createClient("user1@open-metadata.org", "user1@open-metadata.org", new String[] {});
  }

  public static OpenMetadataClient user2Client() {
    return createClient("user2@open-metadata.org", "user2@open-metadata.org", new String[] {});
  }

  public static OpenMetadataClient user3Client() {
    return createClient("user3@open-metadata.org", "user3@open-metadata.org", new String[] {});
  }

  public static OpenMetadataClient createClient(String subject, String email, String[] roles) {
    String token = JwtAuthProvider.tokenFor(subject, email, roles, 3600);
    OpenMetadataConfig cfg =
        OpenMetadataConfig.builder()
            .serverUrl(BASE_URL)
            .accessToken(token)
            .header("X-Auth-Params-Email", email)
            .build();
    OpenMetadataClient client = new OpenMetadataClient(cfg);
    // Set default client for fluent APIs used in factories (only for admin)
    if (email.equals("admin@open-metadata.org")) {
      DatabaseServices.setDefaultClient(client);
    }
    return client;
  }
}
