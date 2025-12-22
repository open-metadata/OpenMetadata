package org.openmetadata.it.util;

import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.fluent.Charts;
import org.openmetadata.sdk.fluent.Classifications;
import org.openmetadata.sdk.fluent.Containers;
import org.openmetadata.sdk.fluent.DashboardDataModels;
import org.openmetadata.sdk.fluent.DashboardServices;
import org.openmetadata.sdk.fluent.Dashboards;
import org.openmetadata.sdk.fluent.DataProducts;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.Domains;
import org.openmetadata.sdk.fluent.Glossaries;
import org.openmetadata.sdk.fluent.GlossaryTerms;
import org.openmetadata.sdk.fluent.MessagingServices;
import org.openmetadata.sdk.fluent.Metrics;
import org.openmetadata.sdk.fluent.MlModelServices;
import org.openmetadata.sdk.fluent.MlModels;
import org.openmetadata.sdk.fluent.PipelineServices;
import org.openmetadata.sdk.fluent.Pipelines;
import org.openmetadata.sdk.fluent.Queries;
import org.openmetadata.sdk.fluent.SearchIndexes;
import org.openmetadata.sdk.fluent.StorageServices;
import org.openmetadata.sdk.fluent.StoredProcedures;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.Tags;
import org.openmetadata.sdk.fluent.Teams;
import org.openmetadata.sdk.fluent.TestCases;
import org.openmetadata.sdk.fluent.Topics;
import org.openmetadata.sdk.fluent.Users;

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
      initializeFluentAPIs(client);
    }
    return client;
  }

  /**
   * Initialize all fluent API classes with the default client.
   * This allows using static methods like Tables.find(id).fetch()
   */
  private static void initializeFluentAPIs(OpenMetadataClient client) {
    // Data Assets
    Charts.setDefaultClient(client);
    Containers.setDefaultClient(client);
    DashboardDataModels.setDefaultClient(client);
    Dashboards.setDefaultClient(client);
    Databases.setDefaultClient(client);
    DatabaseSchemas.setDefaultClient(client);
    MlModels.setDefaultClient(client);
    Pipelines.setDefaultClient(client);
    Queries.setDefaultClient(client);
    SearchIndexes.setDefaultClient(client);
    StoredProcedures.setDefaultClient(client);
    Tables.setDefaultClient(client);
    Topics.setDefaultClient(client);

    // Services
    DashboardServices.setDefaultClient(client);
    DatabaseServices.setDefaultClient(client);
    MessagingServices.setDefaultClient(client);
    MlModelServices.setDefaultClient(client);
    PipelineServices.setDefaultClient(client);
    StorageServices.setDefaultClient(client);

    // Teams & Users
    Teams.setDefaultClient(client);
    Users.setDefaultClient(client);

    // Governance
    Classifications.setDefaultClient(client);
    DataProducts.setDefaultClient(client);
    Domains.setDefaultClient(client);
    Glossaries.setDefaultClient(client);
    GlossaryTerms.setDefaultClient(client);
    Metrics.setDefaultClient(client);
    Tags.setDefaultClient(client);
    TestCases.setDefaultClient(client);
  }
}
