package org.openmetadata.it.util;

import java.util.function.Consumer;
import java.util.function.Supplier;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.fluent.AIApplications;
import org.openmetadata.sdk.fluent.Announcements;
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
import org.openmetadata.sdk.fluent.TaskFormSchemas;
import org.openmetadata.sdk.fluent.Tasks;
import org.openmetadata.sdk.fluent.Teams;
import org.openmetadata.sdk.fluent.TestCases;
import org.openmetadata.sdk.fluent.Topics;
import org.openmetadata.sdk.fluent.Usage;
import org.openmetadata.sdk.fluent.Users;
import org.openmetadata.sdk.fluent.Worksheets;

public class SdkClients {
  private static final long INTEGRATION_TEST_TOKEN_TTL_SECONDS = 86400;
  private static final long CACHED_CLIENT_MAX_AGE_MILLIS = 15 * 60 * 1000;

  private static final String BASE_URL =
      System.getProperty(
          "IT_BASE_URL", System.getenv().getOrDefault("IT_BASE_URL", "http://localhost:8585"));

  // Cached clients to avoid creating new HTTP connections for each test
  private static volatile CachedClient ADMIN_CLIENT;
  private static volatile CachedClient TEST_USER_CLIENT;
  private static volatile CachedClient BOT_CLIENT;
  private static volatile CachedClient DATA_STEWARD_CLIENT;
  private static volatile CachedClient DATA_CONSUMER_CLIENT;
  private static volatile CachedClient USER1_CLIENT;
  private static volatile CachedClient USER2_CLIENT;
  private static volatile CachedClient USER3_CLIENT;

  private static final class CachedClient {
    private final OpenMetadataClient client;
    private final long createdAtMillis;

    private CachedClient(OpenMetadataClient client, long createdAtMillis) {
      this.client = client;
      this.createdAtMillis = createdAtMillis;
    }

    private boolean isExpired(long nowMillis) {
      return nowMillis - createdAtMillis >= CACHED_CLIENT_MAX_AGE_MILLIS;
    }
  }

  public static OpenMetadataClient adminClient() {
    CachedClient cached = ADMIN_CLIENT;
    long nowMillis = System.currentTimeMillis();
    if (cached == null || cached.isExpired(nowMillis)) {
      synchronized (SdkClients.class) {
        cached = ADMIN_CLIENT;
        if (cached == null || cached.isExpired(nowMillis)) {
          ADMIN_CLIENT =
              new CachedClient(
                  createClient(
                      "admin@open-metadata.org", "admin@open-metadata.org", new String[] {"admin"}),
                  nowMillis);
        }
      }
    }
    return ADMIN_CLIENT.client;
  }

  public static OpenMetadataClient testUserClient() {
    TEST_USER_CLIENT =
        getOrRefreshClient(
            () -> TEST_USER_CLIENT,
            cachedClient -> TEST_USER_CLIENT = cachedClient,
            () ->
                createClient("test@open-metadata.org", "test@open-metadata.org", new String[] {}));

    return TEST_USER_CLIENT.client;
  }

  public static OpenMetadataClient botClient() {
    BOT_CLIENT =
        getOrRefreshClient(
            () -> BOT_CLIENT,
            cachedClient -> BOT_CLIENT = cachedClient,
            () ->
                createClient(
                    "ingestion-bot@open-metadata.org",
                    "ingestion-bot@open-metadata.org",
                    new String[] {"bot"}));

    return BOT_CLIENT.client;
  }

  public static OpenMetadataClient ingestionBotClient() {
    return botClient();
  }

  public static OpenMetadataClient dataStewardClient() {
    DATA_STEWARD_CLIENT =
        getOrRefreshClient(
            () -> DATA_STEWARD_CLIENT,
            cachedClient -> DATA_STEWARD_CLIENT = cachedClient,
            () ->
                createClient(
                    "data-steward@open-metadata.org",
                    "data-steward@open-metadata.org",
                    new String[] {"DataSteward"}));

    return DATA_STEWARD_CLIENT.client;
  }

  public static OpenMetadataClient dataConsumerClient() {
    DATA_CONSUMER_CLIENT =
        getOrRefreshClient(
            () -> DATA_CONSUMER_CLIENT,
            cachedClient -> DATA_CONSUMER_CLIENT = cachedClient,
            () ->
                createClient(
                    "data-consumer@open-metadata.org",
                    "data-consumer@open-metadata.org",
                    new String[] {"DataConsumer"}));

    return DATA_CONSUMER_CLIENT.client;
  }

  public static OpenMetadataClient user1Client() {
    USER1_CLIENT =
        getOrRefreshClient(
            () -> USER1_CLIENT,
            cachedClient -> USER1_CLIENT = cachedClient,
            () ->
                createClient(
                    "shared_user1@test.openmetadata.org",
                    "shared_user1@test.openmetadata.org",
                    new String[] {}));

    return USER1_CLIENT.client;
  }

  public static OpenMetadataClient user2Client() {
    USER2_CLIENT =
        getOrRefreshClient(
            () -> USER2_CLIENT,
            cachedClient -> USER2_CLIENT = cachedClient,
            () ->
                createClient(
                    "shared_user2@test.openmetadata.org",
                    "shared_user2@test.openmetadata.org",
                    new String[] {}));

    return USER2_CLIENT.client;
  }

  public static OpenMetadataClient user3Client() {
    USER3_CLIENT =
        getOrRefreshClient(
            () -> USER3_CLIENT,
            cachedClient -> USER3_CLIENT = cachedClient,
            () ->
                createClient(
                    "shared_user3@test.openmetadata.org",
                    "shared_user3@test.openmetadata.org",
                    new String[] {}));

    return USER3_CLIENT.client;
  }

  private static CachedClient getOrRefreshClient(
      Supplier<CachedClient> fieldReader,
      Consumer<CachedClient> fieldWriter,
      Supplier<OpenMetadataClient> clientSupplier) {
    long nowMillis = System.currentTimeMillis();
    CachedClient cachedClient = fieldReader.get();
    if (cachedClient == null || cachedClient.isExpired(nowMillis)) {
      synchronized (SdkClients.class) {
        cachedClient = fieldReader.get();
        if (cachedClient == null || cachedClient.isExpired(nowMillis)) {
          cachedClient = new CachedClient(clientSupplier.get(), nowMillis);
          fieldWriter.accept(cachedClient);
        }
      }
    }

    return cachedClient;
  }

  /**
   * Create a new client for a specific user. Note: For standard users (admin, test, bot, etc.),
   * prefer using the cached methods like adminClient(), testUserClient(), etc. to avoid
   * creating too many HTTP connections during parallel test execution.
   */
  public static OpenMetadataClient createClient(String subject, String email, String[] roles) {
    String token =
        JwtAuthProvider.tokenFor(subject, email, roles, INTEGRATION_TEST_TOKEN_TTL_SECONDS);
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
    Tasks.setDefaultClient(client);
    TaskFormSchemas.setDefaultClient(client);
    TestCases.setDefaultClient(client);

    // Feed
    Announcements.setDefaultClient(client);
  }

  /** Get the base server URL for direct HTTP calls */
  public static String getServerUrl() {
    return BASE_URL;
  }

  /** Get an admin JWT token for direct HTTP calls */
  public static String getAdminToken() {
    return JwtAuthProvider.tokenFor(
        "admin@open-metadata.org",
        "admin@open-metadata.org",
        new String[] {"admin"},
        INTEGRATION_TEST_TOKEN_TTL_SECONDS);
  }
}
