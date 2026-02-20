package org.openmetadata.it.util;

import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.fluent.AIApplications;
import org.openmetadata.sdk.fluent.Apps;
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
import org.openmetadata.sdk.fluent.Directories;
import org.openmetadata.sdk.fluent.Domains;
import org.openmetadata.sdk.fluent.Files;
import org.openmetadata.sdk.fluent.Glossaries;
import org.openmetadata.sdk.fluent.GlossaryTerms;
import org.openmetadata.sdk.fluent.MessagingServices;
import org.openmetadata.sdk.fluent.Metrics;
import org.openmetadata.sdk.fluent.MlModelServices;
import org.openmetadata.sdk.fluent.MlModels;
import org.openmetadata.sdk.fluent.Personas;
import org.openmetadata.sdk.fluent.PipelineServices;
import org.openmetadata.sdk.fluent.Pipelines;
import org.openmetadata.sdk.fluent.Queries;
import org.openmetadata.sdk.fluent.Roles;
import org.openmetadata.sdk.fluent.SearchIndexes;
import org.openmetadata.sdk.fluent.Spreadsheets;
import org.openmetadata.sdk.fluent.StorageServices;
import org.openmetadata.sdk.fluent.StoredProcedures;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.Tags;
import org.openmetadata.sdk.fluent.Teams;
import org.openmetadata.sdk.fluent.TestCases;
import org.openmetadata.sdk.fluent.Topics;
import org.openmetadata.sdk.fluent.Usage;
import org.openmetadata.sdk.fluent.Users;
import org.openmetadata.sdk.fluent.Worksheets;

public class SdkClients {

  private static final String BASE_URL =
      System.getProperty(
          "IT_BASE_URL", System.getenv().getOrDefault("IT_BASE_URL", "http://localhost:8585"));

  // Cached clients to avoid creating new HTTP connections for each test
  private static volatile OpenMetadataClient ADMIN_CLIENT;
  private static volatile OpenMetadataClient TEST_USER_CLIENT;
  private static volatile OpenMetadataClient BOT_CLIENT;
  private static volatile OpenMetadataClient DATA_STEWARD_CLIENT;
  private static volatile OpenMetadataClient DATA_CONSUMER_CLIENT;
  private static volatile OpenMetadataClient USER1_CLIENT;
  private static volatile OpenMetadataClient USER2_CLIENT;
  private static volatile OpenMetadataClient USER3_CLIENT;

  public static OpenMetadataClient adminClient() {
    if (ADMIN_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (ADMIN_CLIENT == null) {
          ADMIN_CLIENT =
              createClient(
                  "admin@open-metadata.org", "admin@open-metadata.org", new String[] {"admin"});
        }
      }
    }
    return ADMIN_CLIENT;
  }

  public static OpenMetadataClient testUserClient() {
    if (TEST_USER_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (TEST_USER_CLIENT == null) {
          TEST_USER_CLIENT =
              createClient("test@open-metadata.org", "test@open-metadata.org", new String[] {});
        }
      }
    }
    return TEST_USER_CLIENT;
  }

  public static OpenMetadataClient botClient() {
    if (BOT_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (BOT_CLIENT == null) {
          BOT_CLIENT =
              createClient(
                  "ingestion-bot@open-metadata.org",
                  "ingestion-bot@open-metadata.org",
                  new String[] {"bot"});
        }
      }
    }
    return BOT_CLIENT;
  }

  public static OpenMetadataClient ingestionBotClient() {
    return botClient();
  }

  public static OpenMetadataClient dataStewardClient() {
    if (DATA_STEWARD_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (DATA_STEWARD_CLIENT == null) {
          DATA_STEWARD_CLIENT =
              createClient(
                  "data-steward@open-metadata.org",
                  "data-steward@open-metadata.org",
                  new String[] {"DataSteward"});
        }
      }
    }
    return DATA_STEWARD_CLIENT;
  }

  public static OpenMetadataClient dataConsumerClient() {
    if (DATA_CONSUMER_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (DATA_CONSUMER_CLIENT == null) {
          DATA_CONSUMER_CLIENT =
              createClient(
                  "data-consumer@open-metadata.org",
                  "data-consumer@open-metadata.org",
                  new String[] {"DataConsumer"});
        }
      }
    }
    return DATA_CONSUMER_CLIENT;
  }

  public static OpenMetadataClient user1Client() {
    if (USER1_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (USER1_CLIENT == null) {
          // USER1 has AllowAll role assigned in SharedEntities for permission tests
          USER1_CLIENT =
              createClient(
                  "shared_user1@test.openmetadata.org",
                  "shared_user1@test.openmetadata.org",
                  new String[] {});
        }
      }
    }
    return USER1_CLIENT;
  }

  public static OpenMetadataClient user2Client() {
    if (USER2_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (USER2_CLIENT == null) {
          USER2_CLIENT =
              createClient(
                  "shared_user2@test.openmetadata.org",
                  "shared_user2@test.openmetadata.org",
                  new String[] {});
        }
      }
    }
    return USER2_CLIENT;
  }

  public static OpenMetadataClient user3Client() {
    if (USER3_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (USER3_CLIENT == null) {
          USER3_CLIENT =
              createClient(
                  "shared_user3@test.openmetadata.org",
                  "shared_user3@test.openmetadata.org",
                  new String[] {});
        }
      }
    }
    return USER3_CLIENT;
  }

  /**
   * Create a new client for a specific user. Note: For standard users (admin, test, bot, etc.),
   * prefer using the cached methods like adminClient(), testUserClient(), etc. to avoid
   * creating too many HTTP connections during parallel test execution.
   */
  public static OpenMetadataClient createClient(String subject, String email, String[] roles) {
    String token = JwtAuthProvider.tokenFor(subject, email, roles, 3600);
    OpenMetadataConfig cfg =
        OpenMetadataConfig.builder()
            .serverUrl(BASE_URL)
            .accessToken(token)
            .header("X-Auth-Params-Email", email)
            .readTimeout(300000)
            .writeTimeout(300000)
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
    // AI
    AIApplications.setDefaultClient(client);

    // Apps
    Apps.setDefaultClient(client);

    // Data Assets
    Charts.setDefaultClient(client);
    Containers.setDefaultClient(client);
    DashboardDataModels.setDefaultClient(client);
    Dashboards.setDefaultClient(client);
    Databases.setDefaultClient(client);
    DatabaseSchemas.setDefaultClient(client);
    Directories.setDefaultClient(client);
    Files.setDefaultClient(client);
    MlModels.setDefaultClient(client);
    Pipelines.setDefaultClient(client);
    Queries.setDefaultClient(client);
    SearchIndexes.setDefaultClient(client);
    Spreadsheets.setDefaultClient(client);
    StoredProcedures.setDefaultClient(client);
    Tables.setDefaultClient(client);
    Topics.setDefaultClient(client);
    Usage.setDefaultClient(client);
    Worksheets.setDefaultClient(client);

    // Services
    DashboardServices.setDefaultClient(client);
    DatabaseServices.setDefaultClient(client);
    MessagingServices.setDefaultClient(client);
    MlModelServices.setDefaultClient(client);
    PipelineServices.setDefaultClient(client);
    StorageServices.setDefaultClient(client);

    // Teams & Users
    Personas.setDefaultClient(client);
    Roles.setDefaultClient(client);
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

  /** Get the base server URL for direct HTTP calls */
  public static String getServerUrl() {
    return BASE_URL;
  }

  /** Get an admin JWT token for direct HTTP calls */
  public static String getAdminToken() {
    return JwtAuthProvider.tokenFor(
        "admin@open-metadata.org", "admin@open-metadata.org", new String[] {"admin"}, 3600);
  }
}
