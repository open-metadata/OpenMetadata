package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.ORGANIZATION_NAME;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.timestampToString;
import static org.openmetadata.service.formatter.decorators.MessageDecorator.getDateStringEpochMilli;
import static org.openmetadata.service.jdbi3.UserRepository.AUTH_MECHANISM_FIELD;
import static org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResource.COLLECTION_PATH;
import static org.openmetadata.service.util.AsciiTable.printOpenMetadataText;
import static org.openmetadata.service.util.UserUtil.updateUserWithHashedPwd;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.validation.Validators;
import jakarta.validation.Validator;
import java.io.File;
import java.io.FileWriter;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Scanner;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.entity.applications.configuration.internal.BackfillConfiguration;
import org.openmetadata.schema.entity.applications.configuration.internal.DataInsightsAppConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.bundles.insights.DataInsightsApp;
import org.openmetadata.service.apps.bundles.searchIndex.SlackWebApiClient;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.events.AuditExcludeFilterFactory;
import org.openmetadata.service.events.AuditOnlyFilterFactory;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.TypeRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.apps.AppMapper;
import org.openmetadata.service.resources.apps.AppMarketPlaceMapper;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.IndexMappingVersionTracker;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchRepositoryFactory;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.SecretsManagerUpdateService;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.jdbi.DatabaseAuthenticationProviderFactory;
import org.openmetadata.service.util.jdbi.JdbiUtils;
import org.slf4j.LoggerFactory;
import picocli.CommandLine;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

@Slf4j
@Command(
    name = "OpenMetadataSetup",
    mixinStandardHelpOptions = true,
    version = "OpenMetadataSetup 1.3",
    description =
        "Creates or Migrates Database/Search Indexes. ReIndex the existing data into Elastic Search "
            + "or OpenSearch. Re-Deploys the service pipelines.")
public class OpenMetadataOperations implements Callable<Integer> {

  private OpenMetadataApplicationConfig config;
  private Jdbi jdbi;
  private SearchRepository searchRepository;
  private String nativeSQLScriptRootPath;
  private String extensionSQLScriptRootPath;
  private SecretsManager secretsManager;
  private CollectionDAO collectionDAO;

  @Option(
      names = {"-d", "--debug"},
      defaultValue = "false")
  private boolean debug;

  @Option(
      names = {"-c", "--config"},
      required = true)
  private String configFilePath;

  @Override
  public Integer call() {
    LOG.info(
        "Subcommand needed: 'info', 'validate', 'repair', 'check-connection', "
            + "'drop-create', 'changelog', 'migrate', 'migrate-secrets', 'reindex', 'reindex-rdf', 'reindexdi', 'deploy-pipelines', "
            + "'dbServiceCleanup', 'relationshipCleanup', 'tagUsageCleanup', 'drop-indexes', 'remove-security-config', 'create-indexes', "
            + "'setOpenMetadataUrl', 'configureEmailSettings', 'get-security-config', 'update-security-config', 'install-app', 'delete-app', 'create-user', 'reset-password', "
            + "'syncAlertOffset', 'analyze-tables', 'cleanup-flowable-history'");
    LOG.info(
        "Use 'reindex --auto-tune' for automatic performance optimization based on cluster capabilities");
    LOG.info(
        "Use 'cleanup-flowable-history --delete --runtime-batch-size=1000 --history-batch-size=1000' for Flowable cleanup with custom options");
    return 0;
  }

  @Command(
      name = "info",
      description =
          "Shows the list of migrations applied and the pending migration "
              + "waiting to be applied on the target database")
  public Integer info() {
    try {
      parseConfig();

      // Then get the native migration info from SERVER_CHANGE_LOG and SERVER_MIGRATION_SQL_LOGS
      LOG.info("Native System Data Migrations:");
      MigrationDAO migrationDAO = jdbi.onDemand(MigrationDAO.class);
      List<MigrationDAO.ServerChangeLog> serverChangeLogs =
          migrationDAO.listMetricsFromDBMigrations();

      // Create a formatted display for native migrations
      Set<String> columns = new LinkedHashSet<>(Set.of("version", "installedOn", "status"));
      List<List<String>> rows = new ArrayList<>();

      for (MigrationDAO.ServerChangeLog serverChangeLog : serverChangeLogs) {
        List<String> row = new ArrayList<>();
        row.add(serverChangeLog.getVersion());
        row.add(serverChangeLog.getInstalledOn());

        if (serverChangeLog.getMetrics() != null) {
          JsonObject metricsJson =
              new Gson().fromJson(serverChangeLog.getMetrics(), JsonObject.class);
          for (Map.Entry<String, JsonElement> entry : metricsJson.entrySet()) {
            if (!columns.contains(entry.getKey())) {
              columns.add(entry.getKey());
            }
            row.add(entry.getValue().toString());
          }
        }
        rows.add(row);
      }

      printToAsciiTable(columns.stream().toList(), rows, "No Native Migrations Found");

      return 0;
    } catch (Exception e) {
      LOG.error("Failed due to ", e);
      return 1;
    }
  }

  @Command(
      name = "validate",
      description =
          "Checks if the all the migrations haven been applied " + "on the target database.")
  public Integer validate() {
    try {
      parseConfig();
      // Validate native migrations
      ConnectionType connType = ConnectionType.from(config.getDataSourceFactory().getDriverClass());
      DatasourceConfig.initialize(connType.label);
      MigrationWorkflow workflow =
          new MigrationWorkflow(
              jdbi,
              config.getMigrationConfiguration().getNativePath(),
              connType,
              config.getMigrationConfiguration().getExtensionPath(),
              config.getMigrationConfiguration().getFlywayPath(),
              config,
              false);
      workflow.loadMigrations();
      workflow.validateMigrationsForServer();
      return 0;
    } catch (Exception e) {
      LOG.error("Database migration validation failed due to ", e);
      return 1;
    }
  }

  @Command(
      name = "repair",
      description =
          "Repairs the SERVER_MIGRATION_SQL_LOGS and SERVER_CHANGE_LOG tables which are used to track "
              + "all the migrations on the target database This involves removing entries for the failed migrations and update"
              + "the checksum of migrations already applied on the target database")
  public Integer repair() {
    try {
      parseConfig();
      // Get the migration workflow to repair native migrations
      ConnectionType connType = ConnectionType.from(config.getDataSourceFactory().getDriverClass());
      DatasourceConfig.initialize(connType.label);

      // Handle repair of SERVER_MIGRATION_SQL_LOGS and SERVER_CHANGE_LOG tables
      try {
        List<String> failedVersions =
            jdbi.withHandle(
                handle ->
                    handle
                        .createQuery(
                            "SELECT version FROM SERVER_CHANGE_LOG WHERE status = 'FAILED'")
                        .mapTo(String.class)
                        .list());

        if (!failedVersions.isEmpty()) {
          LOG.info("Found {} failed migrations in SERVER_CHANGE_LOG", failedVersions.size());

          // Remove failed migrations from SERVER_CHANGE_LOG
          jdbi.useHandle(
              handle ->
                  handle
                      .createUpdate("DELETE FROM SERVER_CHANGE_LOG WHERE status = 'FAILED'")
                      .execute());

          // Clean up related entries in SERVER_MIGRATION_SQL_LOGS
          for (String version : failedVersions) {
            jdbi.useHandle(
                handle ->
                    handle
                        .createUpdate(
                            "DELETE FROM SERVER_MIGRATION_SQL_LOGS WHERE version = :version")
                        .bind("version", version)
                        .execute());
          }
        }
      } catch (Exception e) {
        LOG.error("Error repairing SERVER_CHANGE_LOG and SERVER_MIGRATION_SQL_LOGS tables", e);
        throw e;
      }
      return 0;
    } catch (Exception e) {
      LOG.error("Repair of migration tables failed due to ", e);
      return 1;
    }
  }

  @Command(
      name = "setOpenMetadataUrl",
      description = "Set or update the OpenMetadata URL in the system repository")
  public Integer setOpenMetadataUrl(
      @Option(
              names = {"-u", "--url"},
              description = "OpenMetadata URL to store in the system repository",
              required = true)
          String openMetadataUrl) {
    try {
      URI uri = URI.create(openMetadataUrl);
      parseConfig();
      Settings updatedSettings =
          new Settings()
              .withConfigType(SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION)
              .withConfigValue(
                  new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl(uri.toString()));

      Entity.getSystemRepository().createOrUpdate(updatedSettings);
      LOG.info("Updated OpenMetadata URL to: {}", openMetadataUrl);
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to set OpenMetadata URL due to: ", e);
      return 1;
    }
  }

  @Command(
      name = "configureEmailSettings",
      description =
          "Set or update the SMTP/Email configuration in the OpenMetadata system repository")
  public Integer configureEmailSettings(
      @Option(
              names = {"--emailingEntity"},
              description = "Identifier or entity name used for sending emails (e.g. OpenMetadata)",
              required = true)
          String emailingEntity,
      @Option(
              names = {"--supportUrl"},
              description =
                  "Support URL for help or documentation (e.g. https://slack.open-metadata.org)",
              required = true)
          String supportUrl,
      @Option(
              names = {"--enableSmtpServer"},
              description = "Flag indicating whether SMTP server is enabled (true/false)",
              required = true,
              arity = "1")
          boolean enableSmtpServer,
      @Option(
              names = {"--senderMail"},
              description = "Sender email address used for outgoing messages",
              required = true)
          String senderMail,
      @Option(
              names = {"--serverEndpoint"},
              description = "SMTP server endpoint (host)",
              required = true)
          String serverEndpoint,
      @Option(
              names = {"--serverPort"},
              description = "SMTP server port",
              required = true)
          String serverPort,
      @Option(
              names = {"--username"},
              description = "SMTP server username",
              required = true)
          String username,
      @Option(
              names = {"--password"},
              description = "SMTP server password (may be masked)",
              interactive = true,
              arity = "0..1",
              required = true)
          char[] password,
      @Option(
              names = {"--transportationStrategy"},
              description = "SMTP connection strategy (one of: SMTP, SMTPS, SMTP_TLS)",
              required = true)
          String transportationStrategy,
      @Option(
              names = {"--templatePath"},
              description = "Custom path to email templates (if needed)")
          String templatePath,
      @Option(
              names = {"--templates"},
              description = "Email templates (e.g. openmetadata, collate)",
              required = true)
          String templates) {
    try {
      parseConfig();

      SmtpSettings smtpSettings = new SmtpSettings();
      smtpSettings.setEmailingEntity(emailingEntity);
      smtpSettings.setSupportUrl(supportUrl);
      smtpSettings.setEnableSmtpServer(enableSmtpServer);
      smtpSettings.setSenderMail(senderMail);
      smtpSettings.setServerEndpoint(serverEndpoint);

      smtpSettings.setServerPort(Integer.parseInt(serverPort));

      smtpSettings.setUsername(username);
      smtpSettings.setPassword(password != null ? new String(password) : "");

      try {
        smtpSettings.setTransportationStrategy(
            SmtpSettings.TransportationStrategy.valueOf(transportationStrategy.toUpperCase()));
      } catch (IllegalArgumentException e) {
        LOG.warn(
            "Invalid transportation strategy '{}'. Falling back to SMTP_TLS.",
            transportationStrategy);
        smtpSettings.setTransportationStrategy(SmtpSettings.TransportationStrategy.SMTP_TLS);
      }

      smtpSettings.setTemplatePath(templatePath);

      try {
        smtpSettings.setTemplates(SmtpSettings.Templates.valueOf(templates.toUpperCase()));
      } catch (IllegalArgumentException e) {
        LOG.warn("Invalid template value '{}'. Falling back to OPENMETADATA.", templates);
        smtpSettings.setTemplates(SmtpSettings.Templates.OPENMETADATA);
      }

      Settings emailSettings =
          new Settings()
              .withConfigType(SettingsType.EMAIL_CONFIGURATION)
              .withConfigValue(smtpSettings);

      Entity.getSystemRepository().createOrUpdate(emailSettings);

      LOG.info(
          "Email settings updated. (Email Entity: {}, SMTP Enabled: {}, SMTP Host: {})",
          emailingEntity,
          enableSmtpServer,
          serverEndpoint);
      return 0;

    } catch (Exception e) {
      LOG.error("Failed to configure email settings due to: ", e);
      return 1;
    }
  }

  @Command(
      name = "get-security-config",
      description =
          "Export the current security configuration (authentication and authorization) from the database to a YAML file. "
              + "This command is useful for backup purposes or when you need to review/modify the security configuration externally, "
              + "especially during SSO lockout scenarios.")
  public Integer getSecurityConfig(
      @Option(
              names = {"-o", "--output-file"},
              description =
                  "Path to the output YAML file where the security configuration will be saved",
              required = true)
          String outputFile) {
    try {
      parseConfig();

      LOG.info("Retrieving security configuration from database...");
      SystemRepository systemRepository = Entity.getSystemRepository();

      Settings authenticationSettings =
          systemRepository.getConfigWithKey(SettingsType.AUTHENTICATION_CONFIGURATION.value());
      Settings authorizerSettings =
          systemRepository.getConfigWithKey(SettingsType.AUTHORIZER_CONFIGURATION.value());

      if (authenticationSettings == null && authorizerSettings == null) {
        LOG.warn("No security configuration found in the database.");
        LOG.info("The system may not have security configured yet.");
        return 1;
      }

      SecurityConfiguration securityConfig = new SecurityConfiguration();

      if (authenticationSettings != null) {
        AuthenticationConfiguration authConfig =
            JsonUtils.convertValue(
                authenticationSettings.getConfigValue(), AuthenticationConfiguration.class);
        securityConfig.setAuthenticationConfiguration(authConfig);

        LOG.info("Authentication Configuration:");
        LOG.info("  Provider: {}", authConfig.getProvider());
        LOG.info("  Provider Name: {}", authConfig.getProviderName());

        if (authConfig.getLdapConfiguration() != null) {
          LOG.info("  Type: LDAP");
          LOG.info("  LDAP Host: {}", authConfig.getLdapConfiguration().getHost());
        } else if (authConfig.getSamlConfiguration() != null) {
          LOG.info("  Type: SAML");
        } else if (authConfig.getOidcConfiguration() != null) {
          LOG.info("  Type: OIDC");
        }
      } else {
        LOG.warn("No authentication configuration found.");
      }

      if (authorizerSettings != null) {
        AuthorizerConfiguration authzConfig =
            JsonUtils.convertValue(
                authorizerSettings.getConfigValue(), AuthorizerConfiguration.class);
        securityConfig.setAuthorizerConfiguration(authzConfig);

        LOG.info("Authorization Configuration:");
        LOG.info("  Class Name: {}", authzConfig.getClassName());
        LOG.info("  Admin Principals: {}", authzConfig.getAdminPrincipals());
      } else {
        LOG.warn("No authorization configuration found.");
      }

      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      String yamlContent =
          yamlMapper.writerWithDefaultPrettyPrinter().writeValueAsString(securityConfig);

      File file = new File(outputFile);
      try (FileWriter writer = new FileWriter(file)) {
        writer.write(yamlContent);
      }

      LOG.info("Security configuration successfully exported to: {}", outputFile);
      LOG.warn("");
      LOG.warn(
          "IMPORTANT: The exported file may contain sensitive information (passwords, secrets, certificates).");
      LOG.warn("Please ensure the file is stored securely and not committed to version control.");

      return 0;
    } catch (Exception e) {
      LOG.error("Failed to export security configuration due to: ", e);
      return 1;
    }
  }

  @Command(
      name = "update-security-config",
      description =
          "Update the security configuration (authentication and authorization) in the database from a YAML file. "
              + "This is a critical operation that should be used carefully, especially when users are locked out due to SSO misconfiguration. "
              + "WARNING: Incorrect configuration may lock all users out of the system!")
  public Integer updateSecurityConfig(
      @Option(
              names = {"-f", "--config-file"},
              description = "Path to the YAML file containing the security configuration",
              required = true)
          String configFile,
      @Option(
              names = {"--force"},
              description = "Skip confirmation prompt and apply changes immediately",
              defaultValue = "false")
          boolean force) {
    try {
      File file = new File(configFile);
      if (!file.exists()) {
        LOG.error("Configuration file not found: {}", configFile);
        return 1;
      }

      LOG.info("Reading security configuration from file: {}", configFile);
      String yamlContent = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);

      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      SecurityConfiguration securityConfig =
          yamlMapper.readValue(yamlContent, SecurityConfiguration.class);

      LOG.info("Parsed security configuration:");

      if (securityConfig.getAuthenticationConfiguration() != null) {
        AuthenticationConfiguration authConfig = securityConfig.getAuthenticationConfiguration();
        LOG.info("Authentication Configuration:");
        LOG.info("  Provider: {}", authConfig.getProvider());
        LOG.info("  Provider Name: {}", authConfig.getProviderName());
        LOG.info("  Authority: {}", authConfig.getAuthority());
        LOG.info("  Client ID: {}", authConfig.getClientId());
        LOG.info("  Callback URL: {}", authConfig.getCallbackUrl());

        if (authConfig.getLdapConfiguration() != null) {
          LOG.info("  LDAP Host: {}", authConfig.getLdapConfiguration().getHost());
          LOG.info("  LDAP Port: {}", authConfig.getLdapConfiguration().getPort());
        } else if (authConfig.getSamlConfiguration() != null) {
          LOG.info(
              "  SAML IDP Entity ID: {}",
              authConfig.getSamlConfiguration().getIdp() != null
                  ? authConfig.getSamlConfiguration().getIdp().getEntityId()
                  : "N/A");
        } else if (authConfig.getOidcConfiguration() != null) {
          LOG.info("  OIDC Discovery URI: {}", authConfig.getOidcConfiguration().getDiscoveryUri());
        }
      } else {
        LOG.warn("No authentication configuration in the file.");
      }

      if (securityConfig.getAuthorizerConfiguration() != null) {
        AuthorizerConfiguration authzConfig = securityConfig.getAuthorizerConfiguration();
        LOG.info("Authorization Configuration:");
        LOG.info("  Class Name: {}", authzConfig.getClassName());
        LOG.info("  Admin Principals: {}", authzConfig.getAdminPrincipals());
      } else {
        LOG.warn("No authorization configuration in the file.");
      }

      if (!force) {
        LOG.warn("");
        LOG.warn("========================================================================");
        LOG.warn("WARNING: You are about to update the security configuration!");
        LOG.warn("========================================================================");
        LOG.warn("This will replace the current authentication and authorization config.");
        LOG.warn("Incorrect configuration may lock all users out of the system.");
        LOG.warn("");
        LOG.warn("After applying this change, you MUST restart the OpenMetadata service");
        LOG.warn("for the new configuration to take effect.");
        LOG.warn("========================================================================");
        LOG.warn("");

        // Scanner on System.in should not be closed as it would close System.in entirely
        @SuppressWarnings("resource")
        Scanner scanner = new Scanner(System.in);
        LOG.info("Type 'CONFIRM' to proceed with updating the security configuration: ");
        String input = scanner.next();
        if (!input.equals("CONFIRM")) {
          LOG.info("Operation cancelled by user.");
          return 0;
        }
      }

      parseConfig();

      LOG.info("Updating security configuration in database...");

      if (securityConfig.getAuthenticationConfiguration() != null) {
        Settings authenticationSettings =
            new Settings()
                .withConfigType(SettingsType.AUTHENTICATION_CONFIGURATION)
                .withConfigValue(securityConfig.getAuthenticationConfiguration());
        Entity.getSystemRepository().createOrUpdate(authenticationSettings);
        LOG.info("Authentication configuration updated.");
      }

      if (securityConfig.getAuthorizerConfiguration() != null) {
        Settings authorizerSettings =
            new Settings()
                .withConfigType(SettingsType.AUTHORIZER_CONFIGURATION)
                .withConfigValue(securityConfig.getAuthorizerConfiguration());
        Entity.getSystemRepository().createOrUpdate(authorizerSettings);
        LOG.info("Authorization configuration updated.");
      }

      LOG.info("Security configuration successfully updated in the database.");
      LOG.warn("");
      LOG.warn("========================================================================");
      LOG.warn("IMPORTANT: You MUST restart the OpenMetadata service now!");
      LOG.warn("========================================================================");
      LOG.warn(
          "The new security configuration will NOT take effect until the service is restarted.");
      LOG.warn("Run: 'systemctl restart openmetadata' (or equivalent for your deployment)");
      LOG.warn("========================================================================");

      return 0;
    } catch (Exception e) {
      LOG.error("Failed to update security configuration due to: ", e);
      LOG.error("Please verify that the YAML file is valid and contains all required fields.");
      return 1;
    }
  }

  @Command(name = "install-app", description = "Install the application from App MarketPlace.")
  public Integer installApp(
      @Option(
              names = {"-n", "--name"},
              description = "The name of the application to install.",
              required = true)
          String appName,
      @Option(
              names = {"--force"},
              description = "Forces migrations to be run again, even if they have ran previously",
              defaultValue = "false")
          boolean force) {
    try {
      parseConfig();
      initializeCollectionRegistry();
      WorkflowHandler.initialize(config);
      SettingsCache.initialize(config);
      initializeSecurityConfig();
      AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);

      if (!force && isAppInstalled(appRepository, appName)) {
        LOG.info("App already installed.");
        return 0;
      }

      if (force && deleteApplication(appRepository, appName)) {
        LOG.info("App deleted.");
      }

      LOG.info("App not installed. Installing...");
      installApplication(appName, appRepository);
      LOG.info("App Installed.");
      return 0;
    } catch (Exception e) {
      LOG.error("Install Application Failed", e);
      return 1;
    }
  }

  @Command(name = "delete-app", description = "Delete the installed application.")
  public Integer deleteApp(
      @Option(
              names = {"-n", "--name"},
              description = "The name of the application to install.",
              required = true)
          String appName) {
    try {
      parseConfig();
      initializeCollectionRegistry();
      SettingsCache.initialize(config);
      initializeSecurityConfig();
      AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
      if (deleteApplication(appRepository, appName)) {
        LOG.info("App deleted.");
      }
      return 0;
    } catch (Exception e) {
      LOG.error("Delete Application Failed", e);
      return 1;
    }
  }

  @Command(
      name = "create-user",
      description = "Creates a new user when basic authentication is enabled.")
  public Integer createUser(
      @Option(
              names = {"-u", "--user"},
              description = "User email address",
              required = true)
          String email,
      @Option(
              names = {"-p", "--password"},
              description = "User password",
              interactive = true,
              arity = "0..1",
              required = true)
          char[] password,
      @Option(
              names = {"--admin"},
              description = "Promote the user as an admin",
              defaultValue = "false")
          boolean admin) {
    try {
      LOG.info("Creating user: {}", email);
      if (nullOrEmpty(password)) {
        throw new IllegalArgumentException("Password cannot be empty.");
      }
      if (nullOrEmpty(email)
          || !email.matches("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) {
        throw new IllegalArgumentException("Invalid email address: " + email);
      }
      parseConfig();
      initializeCollectionRegistry();
      SettingsCache.initialize(config);
      initializeSecurityConfig();
      AuthProvider authProvider = SecurityConfigurationManager.getCurrentAuthConfig().getProvider();
      if (!authProvider.equals(AuthProvider.BASIC)) {
        LOG.error("Authentication is not set to basic. User creation is not supported.");
        return 1;
      }
      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      try {
        userRepository.getByEmail(null, email, EntityUtil.Fields.EMPTY_FIELDS);
        LOG.info("User {} already exists.", email);
        return 0;
      } catch (EntityNotFoundException ex) {
        // Expected – continue to create the user.
      }
      initOrganization();
      String domain = email.substring(email.indexOf("@") + 1);
      String username = email.substring(0, email.indexOf("@"));
      UserUtil.createOrUpdateUser(authProvider, username, new String(password), domain, admin);
      LOG.info("User {} created successfully. Admin: {}", email, admin);
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to create user: {}", email, e);
      return 1;
    }
  }

  private void initializeCollectionRegistry() {
    LoggerContext loggerContext = (LoggerContext) LoggerFactory.getILoggerFactory();
    ch.qos.logback.classic.Logger rootLogger =
        loggerContext.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
    Level originalLevel = rootLogger.getLevel();

    try {
      rootLogger.setLevel(Level.ERROR);
      CollectionRegistry.initialize();
    } finally {
      // Restore the original logging level.
      rootLogger.setLevel(originalLevel);
    }
  }

  private void initializeSecurityConfig() {
    try {
      var authConfig =
          Entity.getSystemRepository()
              .getConfigWithKey(SettingsType.AUTHENTICATION_CONFIGURATION.value());
      if (authConfig != null) {
        SecurityConfigurationManager.getInstance()
            .setCurrentAuthConfig(
                JsonUtils.convertValue(
                    authConfig.getConfigValue(),
                    org.openmetadata.schema.api.security.AuthenticationConfiguration.class));
      } else if (config.getAuthenticationConfiguration() != null) {
        SecurityConfigurationManager.getInstance()
            .setCurrentAuthConfig(config.getAuthenticationConfiguration());
      }
    } catch (Exception e) {
      if (config.getAuthenticationConfiguration() != null) {
        SecurityConfigurationManager.getInstance()
            .setCurrentAuthConfig(config.getAuthenticationConfiguration());
      }
    }
  }

  private boolean isAppInstalled(AppRepository appRepository, String appName) {
    try {
      appRepository.findByName(appName, Include.NON_DELETED);
      return true;
    } catch (EntityNotFoundException e) {
      return false;
    }
  }

  private boolean deleteApplication(AppRepository appRepository, String appName) {
    try {
      appRepository.deleteByName(ADMIN_USER_NAME, appName, true, true);
      return true;
    } catch (EntityNotFoundException e) {
      return false;
    }
  }

  private void installApplication(String appName, AppRepository appRepository) throws Exception {
    PipelineServiceClientInterface pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(
            config.getPipelineServiceClientConfiguration());

    JWTTokenGenerator.getInstance()
        .init(
            SecurityConfigurationManager.getInstance()
                .getCurrentAuthConfig()
                .getTokenValidationAlgorithm(),
            config.getJwtTokenConfiguration());

    AppMarketPlaceMapper mapper = new AppMarketPlaceMapper(pipelineServiceClient);
    AppMarketPlaceRepository appMarketRepository =
        (AppMarketPlaceRepository) Entity.getEntityRepository(Entity.APP_MARKET_PLACE_DEF);

    AppMarketPlaceUtil.createAppMarketPlaceDefinitions(appMarketRepository, mapper);

    AppMarketPlaceDefinition definition =
        appMarketRepository.getByName(null, appName, appMarketRepository.getFields("id"));

    CreateApp createApp =
        new CreateApp()
            .withName(definition.getName())
            .withDescription(definition.getDescription())
            .withDisplayName(definition.getDisplayName())
            .withAppSchedule(new AppSchedule().withScheduleTimeline(ScheduleTimeline.NONE))
            .withAppConfiguration(Map.of());

    AppMapper appMapper = new AppMapper();
    App entity = appMapper.createToEntity(createApp, ADMIN_USER_NAME);
    appRepository.prepareInternal(entity, true);
    appRepository.createOrUpdate(null, entity, ADMIN_USER_NAME);
  }

  @Command(
      name = "check-connection",
      description =
          "Checks if a connection can be successfully " + "obtained for the target database")
  public Integer checkConnection() {
    try {
      parseConfig();
      // Check native tables
      try {
        jdbi.withHandle(
            handle -> {
              try {
                handle
                    .createQuery("SELECT COUNT(*) FROM SERVER_CHANGE_LOG")
                    .mapTo(Integer.class)
                    .findOne();
                return true;
              } catch (Exception e) {
                LOG.warn("Could not access SERVER_CHANGE_LOG table: {}", e.getMessage());
                return false;
              }
            });

        // querying SERVER_MIGRATION_SQL_LOGS table
        jdbi.withHandle(
            handle -> {
              try {
                handle
                    .createQuery("SELECT COUNT(*) FROM SERVER_MIGRATION_SQL_LOGS")
                    .mapTo(Integer.class)
                    .findOne();
                return true;
              } catch (Exception e) {
                LOG.warn("Could not access SERVER_MIGRATION_SQL_LOGS table: {}", e.getMessage());
                return false;
              }
            });

      } catch (Exception e) {
        LOG.warn("Error checking migration tables: {}", e.getMessage());
      }
      jdbi.open().getConnection();
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to check connection due to ", e);
      return 1;
    }
  }

  @Command(
      name = "drop-create",
      description =
          "Deletes any tables in configured database and creates a new tables "
              + "based on current version of OpenMetadata. This command also re-creates the search indexes.")
  public Integer dropCreate() {
    try {
      promptUserForDelete();
      parseConfig();
      LOG.info("Deleting all the OpenMetadata tables.");
      dropAllTables();
      LOG.info("Running the Native Migrations.");
      validateAndRunSystemDataMigrations(true);
      LOG.info("OpenMetadata Database Schema is Updated.");
      LOG.info("create indexes.");
      searchRepository.createIndexes();
      Entity.cleanup();
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to drop create due to ", e);
      return 1;
    }
  }

  @Command(name = "reset-password", description = "Reset the password for a user.")
  public Integer resetUserPassword(
      @Option(
              names = {"-e", "--email"},
              description = "Email for which to reset the password.",
              required = true)
          String email,
      @Option(
              names = {"-p", "--password"},
              description = "Enter user password",
              arity = "0..1",
              interactive = true,
              required = true)
          char[] password) {
    try {
      LOG.info("Resetting password for user : {}", email);
      if (nullOrEmpty(password)) {
        throw new IllegalArgumentException("Password cannot be empty.");
      }
      parseConfig();
      CollectionRegistry.initialize();
      SettingsCache.initialize(config);
      initializeSecurityConfig();

      AuthProvider authProvider = SecurityConfigurationManager.getCurrentAuthConfig().getProvider();

      // Only Basic Auth provider is supported for password reset
      if (!authProvider.equals(AuthProvider.BASIC)) {
        LOG.error("Auth Provider is Not Basic. Cannot apply Password");
        return 1;
      }

      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      Set<String> fieldList = new HashSet<>(userRepository.getPatchFields().getFieldList());
      fieldList.add(AUTH_MECHANISM_FIELD);
      User originalUser = userRepository.getByEmail(null, email, new EntityUtil.Fields(fieldList));

      // Check if the user is a bot user
      if (Boolean.TRUE.equals(originalUser.getIsBot())) {
        LOG.error("Bot user : {} cannot have password.", originalUser.getName());
        return 1;
      }

      User updatedUser = JsonUtils.deepCopy(originalUser, User.class);
      String inputPwd = new String(password);
      updateUserWithHashedPwd(updatedUser, inputPwd);
      UserUtil.addOrUpdateUser(updatedUser);
      LOG.info("Password updated successfully.");
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to reset user password.", e);
      return 1;
    }
  }

  @Command(
      name = "migrate",
      description = "Migrates the OpenMetadata database schema and search index mappings.")
  public Integer migrate(
      @Option(
              names = {"--force"},
              description = "Forces migrations to be run again, even if they have ran previously",
              defaultValue = "false")
          boolean force) {
    try {
      LOG.info("Migrating the OpenMetadata Schema.");
      parseConfig();
      validateAndRunSystemDataMigrations(force);
      LOG.info("Update Search Indexes.");
      searchRepository.updateIndexes();
      printChangeLog();
      // update entities secrets if required
      new SecretsManagerUpdateService(secretsManager, config.getClusterName()).updateEntities();
      Entity.cleanup();
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to db migration due to ", e);
      return 1;
    }
  }

  @Command(
      name = "recover",
      description =
          "Recover data lost due to Flyway migration issue (roles, policies, bot relationships). "
              + "Use this if you ran migrations with --force after upgrading from pre-1.11.0 and lost data.")
  public Integer recover() {
    try {
      LOG.info("Running data recovery for Flyway migration issue...");
      parseConfig();
      runDataRecovery();
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to recover data due to ", e);
      return 1;
    }
  }

  private void runDataRecovery() {
    try (Handle handle = jdbi.open()) {
      ConnectionType connType = ConnectionType.from(config.getDataSourceFactory().getDriverClass());

      org.openmetadata.service.migration.utils.v1114.MigrationUtil.checkAndLogDataLossSymptoms(
          handle);
      org.openmetadata.service.migration.utils.v1114.MigrationUtil.reseedRolesAndPoliciesIfMissing(
          handle, connType);
      org.openmetadata.service.migration.utils.v1114.MigrationUtil
          .restoreRolePolicyRelationshipsIfMissing(handle, connType);
      org.openmetadata.service.migration.utils.v1114.MigrationUtil.restoreBotRelationshipsIfMissing(
          handle, connType);
      org.openmetadata.service.migration.utils.v1114.MigrationUtil.restoreBotUserRolesIfMissing(
          handle, connType);

      LOG.info("Data recovery completed.");
    } catch (Exception e) {
      LOG.error("Error during data recovery: {}", e.getMessage(), e);
    }
  }

  @Command(name = "changelog", description = "Prints the change log of database migration.")
  public Integer changelog() {
    try {
      parseConfig();
      printChangeLog();
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to fetch db change log due to ", e);
      return 1;
    }
  }

  @Command(
      name = "dbServiceCleanup",
      description = "Cleans Up broken relationship hierarchy for database service.")
  public Integer cleanupOrphanedEntities() {
    try {
      LOG.info("Running a Database Service Hierarchy Cleanup");
      parseConfig();

      // Check Broken Tables
      List<String> brokenTables = Entity.getCollectionDAO().tableDAO().getBrokenTables();
      LOG.info("Following Tables seems to be Broken.");
      List<String> tableColumns = List.of(String.format("Tables(%d)", brokenTables.size()));
      List<List<String>> allRowsForTables = new ArrayList<>();
      for (String name : brokenTables) {
        List<String> row = new ArrayList<>();
        row.add(name);
        allRowsForTables.add(row);
      }
      printToAsciiTable(tableColumns.stream().toList(), allRowsForTables, "No Broken Tables.");
      LOG.info("Cleaning up the broken tables.");
      if (!brokenTables.isEmpty()) {
        Entity.getCollectionDAO().tableDAO().removeBrokenTables();
      }

      List<String> brokenSchemas =
          Entity.getCollectionDAO().databaseSchemaDAO().getBrokenDatabaseSchemas();
      LOG.info("Following DatabaseSchemas seems to be Broken.");
      List<String> dbSchemaColumns =
          List.of(String.format("DatabaseSchemas(%d)", brokenSchemas.size()));
      List<List<String>> allRowsForSchemas = new ArrayList<>();
      for (String name : brokenSchemas) {
        List<String> row = new ArrayList<>();
        row.add(name);
        allRowsForSchemas.add(row);
      }
      printToAsciiTable(dbSchemaColumns.stream().toList(), allRowsForSchemas, "No Broken Schemas.");
      if (!brokenSchemas.isEmpty()) {
        Entity.getCollectionDAO().databaseSchemaDAO().removeBrokenDatabaseSchemas();
      }

      List<String> brokenDatabases = Entity.getCollectionDAO().databaseDAO().getBrokenDatabase();
      LOG.info("Following Database seems to be Broken.");
      List<String> databaseColumns = List.of(String.format("Database(%d)", brokenSchemas.size()));
      List<List<String>> allRowsForDatabases = new ArrayList<>();
      for (String name : brokenDatabases) {
        List<String> row = new ArrayList<>();
        row.add(name);
        allRowsForDatabases.add(row);
      }
      printToAsciiTable(
          databaseColumns.stream().toList(), allRowsForDatabases, "No Broken Databases.");
      if (!brokenDatabases.isEmpty()) {
        Entity.getCollectionDAO().databaseDAO().removeDatabase();
      }

      return 0;
    } catch (Exception e) {
      LOG.error("Failed to Entity Cleanup due to ", e);
      return 1;
    }
  }

  @Command(
      name = "relationshipCleanup",
      description =
          "Cleans up orphaned entity relationships where referenced entities no longer exist, "
              + "and broken service hierarchy entities. By default, runs in dry-run mode to only identify orphaned relationships.")
  public Integer cleanupOrphanedRelationships(
      @Option(
              names = {"--delete"},
              description =
                  "Actually delete the orphaned relationships and broken entities. Without this flag, the command only identifies orphaned relationships (dry-run mode).",
              defaultValue = "false")
          boolean delete,
      @Option(
              names = {"-b", "--batch-size"},
              defaultValue = "1000",
              description = "Number of relationships to process in each batch.")
          int batchSize,
      @Option(
              names = {"--skip-hierarchy-cleanup"},
              description =
                  "Skip the service hierarchy cleanup and only perform generic relationship cleanup.",
              defaultValue = "false")
          boolean skipHierarchyCleanup) {
    try {
      boolean dryRun = !delete;
      LOG.info(
          "Running Entity Relationship Cleanup. Dry run: {}, Batch size: {}, Skip hierarchy cleanup: {}",
          dryRun,
          batchSize,
          skipHierarchyCleanup);
      parseConfig();

      if (skipHierarchyCleanup) {
        // Only perform relationship cleanup
        LOG.info("=== Entity Relationship Cleanup Only ===");
        EntityRelationshipCleanup cleanup = new EntityRelationshipCleanup(collectionDAO, dryRun);
        EntityRelationshipCleanup.EntityCleanupResult result = cleanup.performCleanup(batchSize);

        LOG.info("Total relationships scanned: {}", result.getTotalRelationshipsScanned());
        LOG.info("Orphaned relationships found: {}", result.getOrphanedRelationshipsFound());
        LOG.info("Relationships deleted: {}", result.getRelationshipsDeleted());

        if (dryRun && result.getOrphanedRelationshipsFound() > 0) {
          LOG.info("To actually delete these orphaned relationships, run with --delete");
          return 1;
        }
      } else {
        // Perform comprehensive cleanup (relationships + hierarchies)
        EntityRelationshipCleanupUtil comprehensiveCleanup =
            dryRun
                ? EntityRelationshipCleanupUtil.forDryRun(collectionDAO, batchSize)
                : EntityRelationshipCleanupUtil.forActualCleanup(collectionDAO, batchSize);

        EntityRelationshipCleanupUtil.CleanupResult result =
            comprehensiveCleanup.performComprehensiveCleanup();
        comprehensiveCleanup.printComprehensiveResults(result);

        if (dryRun && result.getTotalEntitiesDeleted() > 0) {
          LOG.info(
              "To actually delete these orphaned relationships and broken entities, run with --delete");
          return 1;
        }
      }

      return 0;
    } catch (Exception e) {
      LOG.error("Failed to cleanup orphaned relationships due to ", e);
      return 1;
    }
  }

  @Command(
      name = "tagUsageCleanup",
      description =
          "Cleans up orphaned tag usages where referenced tags or glossary terms no longer exist. "
              + "By default, runs in dry-run mode to only identify orphaned tag usages.")
  public Integer cleanupOrphanedTagUsages(
      @Option(
              names = {"--delete"},
              description =
                  "Actually delete the orphaned tag usages. Without this flag, the command only identifies orphaned tag usages (dry-run mode).",
              defaultValue = "false")
          boolean delete,
      @Option(
              names = {"-b", "--batch-size"},
              defaultValue = "1000",
              description = "Number of tag usages to process in each batch.")
          int batchSize) {
    try {
      boolean dryRun = !delete;
      LOG.info("Running Tag Usage Cleanup. Dry run: {}, Batch size: {}", dryRun, batchSize);
      parseConfig();

      TagUsageCleanup cleanup = new TagUsageCleanup(collectionDAO, dryRun);
      TagUsageCleanup.TagCleanupResult result = cleanup.performCleanup(batchSize);

      LOG.info("Total tag usages scanned: {}", result.getTotalTagUsagesScanned());
      LOG.info("Orphaned tag usages found: {}", result.getOrphanedTagUsagesFound());
      LOG.info("Tag usages deleted: {}", result.getTagUsagesDeleted());

      if (dryRun && result.getOrphanedTagUsagesFound() > 0) {
        LOG.info("To actually delete these orphaned tag usages, run with --delete");
        return 1;
      }

      return 0;
    } catch (Exception e) {
      LOG.error("Failed to cleanup orphaned tag usages due to ", e);
      return 1;
    }
  }

  @Command(name = "reindex", description = "Re Indexes data into search engine from command line.")
  public Integer reIndex(
      @Option(
              names = {"-b", "--batch-size"},
              defaultValue = "300",
              description = "Number of records to process in each batch.")
          int batchSize,
      @Option(
              names = {"-p", "--payload-size"},
              defaultValue = "104857600",
              description = "Maximum size of the payload in bytes.")
          long payloadSize,
      @Option(
              names = {"--recreate-indexes"},
              defaultValue = "true",
              description = "Flag to determine if indexes should be recreated.")
          boolean recreateIndexes,
      @Option(
              names = {"--producer-threads"},
              defaultValue = "10",
              description = "Number of threads to use for processing.")
          int producerThreads,
      @Option(
              names = {"--consumer-threads"},
              defaultValue = "5",
              description = "Number of threads to use for processing.")
          int consumerThreads,
      @Option(
              names = {"--queue-size"},
              defaultValue = "300",
              description = "Queue Size to use internally for reindexing.")
          int queueSize,
      @Option(
              names = {"--back-off"},
              defaultValue = "1000",
              description = "Back-off time in milliseconds for retries.")
          int backOff,
      @Option(
              names = {"--max-back-off"},
              defaultValue = "10000",
              description = "Max Back-off time in milliseconds for retries.")
          int maxBackOff,
      @Option(
              names = {"--max-requests"},
              defaultValue = "1000",
              description = "Maximum number of concurrent search requests.")
          int maxRequests,
      @Option(
              names = {"--retries"},
              defaultValue = "3",
              description = "Maximum number of retries for failed search requests.")
          int retries,
      @Option(
              names = {"--auto-tune"},
              defaultValue = "false",
              description =
                  "Enable automatic performance tuning based on cluster capabilities and database entity count. When enabled, overrides manual parameter settings.")
          boolean autoTune,
      @Option(
              names = {"--force"},
              defaultValue = "false",
              description = "Force reindexing even if no index mapping changes are detected.")
          boolean force,
      @Option(
              names = {"--entities"},
              defaultValue = "'all'",
              description =
                  "Entities to reindex. Passing --entities='table,dashboard' will reindex table and dashboard entities. Passing nothing will reindex everything.")
          String entityStr,
      @Option(
              names = {"--slack-bot-token"},
              description = "Optional Slack bot token for real-time progress updates in Slack.")
          String slackBotToken,
      @Option(
              names = {"--slack-channel"},
              description =
                  "Slack channel ID or name (required when using bot token, e.g., 'C1234567890' or '#general').")
          String slackChannel) {
    try {
      LOG.info(
          "Running Reindexing with Entities:{} , Batch Size: {}, Payload Size: {}, Recreate-Index: {}, Producer threads: {}, Consumer threads: {}, Queue Size: {}, Back-off: {}, Max Back-off: {}, Max Requests: {}, Retries: {}, Auto-tune: {}",
          entityStr,
          batchSize,
          payloadSize,
          recreateIndexes,
          producerThreads,
          consumerThreads,
          queueSize,
          backOff,
          maxBackOff,
          maxRequests,
          retries,
          autoTune);
      parseConfig();
      CollectionRegistry.initialize();
      ApplicationHandler.initialize(config);
      CollectionRegistry.getInstance().loadSeedData(jdbi, config, null, null, null, true);
      ApplicationHandler.initialize(config);
      TypeRepository typeRepository = (TypeRepository) Entity.getEntityRepository(Entity.TYPE);
      TypeRegistry.instance().initialize(typeRepository);
      AppScheduler.initialize(config, collectionDAO, searchRepository);

      // Prepare search repository for reindexing (e.g., initialize vector services)
      searchRepository.prepareForReindex();

      String appName = "SearchIndexingApplication";
      // Handle entityStr with or without quotes
      String cleanEntityStr = entityStr;
      if (entityStr.startsWith("'") && entityStr.endsWith("'")) {
        cleanEntityStr = entityStr.substring(1, entityStr.length() - 1);
      }
      Set<String> entities = new HashSet<>(Arrays.asList(cleanEntityStr.split(",")));
      return executeSearchReindexApp(
          appName,
          entities,
          batchSize,
          payloadSize,
          recreateIndexes,
          producerThreads,
          consumerThreads,
          queueSize,
          backOff,
          maxBackOff,
          maxRequests,
          retries,
          autoTune,
          force,
          slackBotToken,
          slackChannel);
    } catch (Exception e) {
      LOG.error("Failed to reindex due to ", e);
      return 1;
    }
  }

  @Command(name = "syncAlertOffset", description = "Sync the Alert Offset.")
  public Integer reIndex(
      @Option(
              names = {"-n", "--name"},
              description = "Name of the alerts.",
              required = true)
          String alertName) {
    try {
      parseConfig();
      CollectionRegistry.initialize();
      EventSubscriptionRepository repository =
          (EventSubscriptionRepository) Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);
      repository.syncEventSubscriptionOffset(alertName);
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to sync alert offset due to ", e);
      return 1;
    }
  }

  private int executeSearchReindexApp(
      String appName,
      Set<String> entities,
      int batchSize,
      long payloadSize,
      boolean recreateIndexes,
      int producerThreads,
      int consumerThreads,
      int queueSize,
      int backOff,
      int maxBackOff,
      int maxRequests,
      int retries,
      boolean autoTune,
      boolean force,
      String slackBotToken,
      String slackChannel) {
    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    App app = appRepository.getByName(null, appName, appRepository.getFields("id"));

    // Check for index mapping changes only when running from CLI
    IndexMappingVersionTracker versionTracker = null;
    boolean shouldUpdateVersions = false;
    ReindexingProgressMonitor progressMonitor = null;

    if (!force && recreateIndexes) {
      try {
        String version = System.getProperty("project.version", "1.8.0-SNAPSHOT");
        versionTracker = new IndexMappingVersionTracker(collectionDAO, version, "system");

        List<String> changedMappings = versionTracker.getChangedMappings();

        if (changedMappings.isEmpty()) {
          LOG.info("✅ Smart reindexing: No index mapping changes detected, skipping reindex");
          recreateIndexes = false;

          // Send Slack notification if configured
          if (slackBotToken != null
              && !slackBotToken.isEmpty()
              && slackChannel != null
              && !slackChannel.isEmpty()) {
            try {
              String instanceUrl = getInstanceUrlFromSettings();
              SlackWebApiClient slackClient =
                  new SlackWebApiClient(slackBotToken, slackChannel, instanceUrl);
              slackClient.sendNoChangesNotification();
            } catch (Exception e) {
              LOG.warn("Failed to send Slack notification for no changes", e);
            }
          }
        } else {
          shouldUpdateVersions = true;

          // If 'all' entities were requested, only reindex changed ones
          if (entities.contains("all")) {
            entities = new HashSet<>(changedMappings);
          } else {
            // If specific entities were requested, check if any have changed mappings
            Set<String> requestedAndChanged = new HashSet<>(entities);
            requestedAndChanged.retainAll(changedMappings);
            if (requestedAndChanged.isEmpty()) {
              LOG.info(
                  "✅ Smart reindexing: None of the requested entities have mapping changes, skipping reindex");
              recreateIndexes = false;
              shouldUpdateVersions = false;

              // Send Slack notification if configured
              if (slackBotToken != null
                  && !slackBotToken.isEmpty()
                  && slackChannel != null
                  && !slackChannel.isEmpty()) {
                try {
                  String instanceUrl = getInstanceUrlFromSettings();
                  SlackWebApiClient slackClient =
                      new SlackWebApiClient(slackBotToken, slackChannel, instanceUrl);
                  slackClient.sendNoChangesNotification();
                } catch (Exception e) {
                  LOG.warn("Failed to send Slack notification for no changes", e);
                }
              }
            } else {
              entities = requestedAndChanged;
            }
          }

          // Initialize progress monitor for entities that will be reindexed
          if (recreateIndexes) {
            progressMonitor = new ReindexingProgressMonitor(entities.stream().sorted().toList());
            progressMonitor.printInitialSummary();
          }
        }
      } catch (Exception e) {
        LOG.warn("⚠️  Smart reindexing unavailable: {}", e.getMessage());
        LOG.info("🔄 Falling back to standard reindexing for all requested entities");
      }
    }

    // Initialize progress monitor for force mode as well to get clean output
    if (progressMonitor == null && recreateIndexes && force) {
      progressMonitor = new ReindexingProgressMonitor(entities.stream().sorted().toList());
      LOG.info("");
      LOG.info("🔄 Force Reindexing");
      LOG.info("═".repeat(80));
      LOG.info("🎯 Entities to reindex: {}", String.join(", ", entities));
      LOG.info("⏳ Reindexing in progress...");
      LOG.info("");
    }

    // If recreateIndexes is false, we should not proceed with reindexing
    if (!recreateIndexes) {
      LOG.info("Reindexing skipped - no changes detected");
      return 0; // Success - no reindexing needed
    }

    EventPublisherJob config =
        (JsonUtils.convertValue(app.getAppConfiguration(), EventPublisherJob.class))
            .withEntities(entities)
            .withBatchSize(batchSize)
            .withPayLoadSize(payloadSize)
            .withRecreateIndex(recreateIndexes)
            .withProducerThreads(producerThreads)
            .withConsumerThreads(consumerThreads)
            .withQueueSize(queueSize)
            .withInitialBackoff(backOff)
            .withMaxBackoff(maxBackOff)
            .withMaxConcurrentRequests(maxRequests)
            .withMaxRetries(retries)
            .withAutoTune(autoTune)
            .withForce(force)
            .withSlackBotToken(slackBotToken)
            .withSlackChannel(slackChannel);

    // Log auto-tune behavior
    if (autoTune) {
      LOG.info(
          "Auto-tune enabled: SearchIndexApp will analyze cluster capabilities and optimize parameters automatically");
      LOG.info("Manual parameter settings will be overridden by auto-tuned values based on:");
      LOG.info("  - OpenSearch/ElasticSearch cluster stats and settings");
      LOG.info("  - Database entity counts");
      LOG.info("  - Available cluster resources and capacity");
      LOG.info("  - Request compression benefits (JSON payloads will be gzip compressed)");
    }

    // Trigger Application
    long currentTime = System.currentTimeMillis();
    AppScheduler.getInstance().triggerOnDemandApplication(app, JsonUtils.getMap(config));

    int result = waitAndReturnReindexingAppStatus(app, currentTime, progressMonitor);

    // Update mapping versions after successful reindexing
    if (result == 0 && shouldUpdateVersions && versionTracker != null) {
      try {
        versionTracker.updateMappingVersions();
        LOG.info(
            "✅ Smart reindexing: Updated mapping versions in database for future change detection");
      } catch (Exception e) {
        LOG.warn("⚠️  Failed to update index mapping versions in database", e);
        // Don't fail the operation if version update fails
      }
    }

    return result;
  }

  @Command(
      name = "reindexdi",
      description = "Re Indexes data insights into search engine from command line.")
  public Integer reIndexDI(
      @Option(
              names = {"-b", "--batch-size"},
              defaultValue = "100",
              description = "Number of records to process in each batch.")
          int batchSize,
      @Option(
              names = {"--recreate-indexes"},
              defaultValue = "true",
              description = "Flag to determine if indexes should be recreated.")
          boolean recreateIndexes,
      @Option(
              names = {"--start-date"},
              description = "Start Date to backfill from.")
          String startDate,
      @Option(
              names = {"--end-date"},
              description = "End Date to backfill to.")
          String endDate) {
    try {
      LOG.info(
          "Running Reindexing with Batch Size: {}, Recreate-Index: {}, Start Date: {}, End Date: {}.",
          batchSize,
          recreateIndexes,
          startDate,
          endDate);
      parseConfig();
      CollectionRegistry.initialize();
      ApplicationHandler.initialize(config);
      CollectionRegistry.getInstance().loadSeedData(jdbi, config, null, null, null, true);
      ApplicationHandler.initialize(config);
      AppScheduler.initialize(config, collectionDAO, searchRepository);
      return executeDataInsightsReindexApp(
          batchSize, recreateIndexes, getBackfillConfiguration(startDate, endDate));
    } catch (Exception e) {
      LOG.error("Failed to reindex due to ", e);
      return 1;
    }
  }

  private BackfillConfiguration getBackfillConfiguration(String startDate, String endDate) {
    BackfillConfiguration backfillConfiguration = new BackfillConfiguration();
    backfillConfiguration.withEnabled(false);

    if (startDate != null) {
      backfillConfiguration.withEnabled(true);
      backfillConfiguration.withStartDate(startDate);
      backfillConfiguration.withEndDate(
          Objects.requireNonNullElseGet(
              endDate, () -> timestampToString(System.currentTimeMillis(), "yyyy-MM-dd")));
    }
    return backfillConfiguration;
  }

  private int executeDataInsightsReindexApp(
      int batchSize, boolean recreateIndexes, BackfillConfiguration backfillConfiguration) {
    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    App app =
        appRepository.getByName(null, "DataInsightsApplication", appRepository.getFields("id"));

    DataInsightsAppConfig config =
        JsonUtils.convertValue(app.getAppConfiguration(), DataInsightsAppConfig.class)
            .withBatchSize(batchSize)
            .withRecreateDataAssetsIndex(recreateIndexes)
            .withBackfillConfiguration(backfillConfiguration);

    // Trigger Application
    long currentTime = System.currentTimeMillis();
    AppScheduler.getInstance().triggerOnDemandApplication(app, JsonUtils.getMap(config));

    int result = waitAndReturnReindexingAppStatus(app, currentTime);

    return result;
  }

  @SneakyThrows
  private int waitAndReturnReindexingAppStatus(App searchIndexApp, long startTime) {
    return waitAndReturnReindexingAppStatus(searchIndexApp, startTime, null);
  }

  @SneakyThrows
  private int waitAndReturnReindexingAppStatus(
      App searchIndexApp, long startTime, ReindexingProgressMonitor progressMonitor) {
    AppRunRecord appRunRecord = null;
    do {
      try {
        AppRepository appRepository =
            (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
        appRunRecord = appRepository.getLatestAppRunsAfterStartTime(searchIndexApp, startTime);
        if (isRunCompleted(appRunRecord)) {
          // Only show the ugly table if we don't have a progress monitor
          LOG.debug(
              "Job completed. Progress monitor is: {}",
              progressMonitor != null ? "present" : "null");
          if (progressMonitor == null) {
            List<String> columns =
                new ArrayList<>(
                    List.of(
                        "jobStatus",
                        "startTime",
                        "endTime",
                        "executionTime",
                        "successContext",
                        "failureContext"));
            List<List<String>> rows = new ArrayList<>();

            String startTimeofJob =
                nullOrEmpty(appRunRecord.getStartTime())
                    ? "Unavailable"
                    : getDateStringEpochMilli(appRunRecord.getStartTime());
            String endTimeOfJob =
                nullOrEmpty(appRunRecord.getEndTime())
                    ? "Unavailable"
                    : getDateStringEpochMilli(appRunRecord.getEndTime());
            String executionTime =
                nullOrEmpty(appRunRecord.getExecutionTime())
                    ? "Unavailable"
                    : String.format("%d seconds", appRunRecord.getExecutionTime() / 1000);
            rows.add(
                Arrays.asList(
                    getValueOrUnavailable(appRunRecord.getStatus().value()),
                    getValueOrUnavailable(startTimeofJob),
                    getValueOrUnavailable(endTimeOfJob),
                    getValueOrUnavailable(executionTime),
                    getValueOrUnavailable(appRunRecord.getSuccessContext()),
                    getValueOrUnavailable(appRunRecord.getFailureContext())));
            printToAsciiTable(columns, rows, "Failed to run Search Reindexing");
          }
        }
      } catch (Exception ignored) {
      }

      if (!isRunCompleted(appRunRecord)) {
        // Show clean progress updates instead of verbose JSON
        if (progressMonitor != null) {
          // Progress monitor will handle the display
          LOG.debug("Waiting for reindexing completion...");
        } else {
          // Show simple status message for non-smart reindexing
          LOG.info("⏳ Reindexing in progress... waiting for completion");
        }
        Thread.sleep(10000);
      }
    } while (!isRunCompleted(appRunRecord));

    if (appRunRecord.getStatus().equals(AppRunRecord.Status.SUCCESS)
        || appRunRecord.getStatus().equals(AppRunRecord.Status.COMPLETED)) {
      if (progressMonitor == null) {
        LOG.info("✅ Reindexing completed successfully");
      }
      return 0;
    }
    LOG.error("❌ Reindexing failed");
    return 1;
  }

  public String getValueOrUnavailable(Object obj) {
    return nullOrEmpty(obj) ? "Unavailable" : JsonUtils.pojoToJson(obj);
  }

  boolean isRunCompleted(AppRunRecord appRunRecord) {
    if (appRunRecord == null) {
      return false;
    }

    return !nullOrEmpty(appRunRecord.getExecutionTime());
  }

  @Command(name = "reindex-rdf", description = "Re-index all entities into RDF triple store.")
  public Integer reIndexRdf(
      @Option(
              names = {"-r", "--recreate"},
              defaultValue = "true",
              description = "Clear and recreate all RDF data.")
          boolean recreate,
      @Option(
              names = {"-e", "--entity-type"},
              description =
                  "Specific entity type to process (optional). Use 'all' for all entities.")
          String entityType,
      @Option(
              names = {"-b", "--batch-size"},
              defaultValue = "100",
              description = "Number of records to process in each batch.")
          int batchSize) {
    try {
      LOG.info("Starting RDF reindexing...");
      parseConfig();

      // Check if RDF is enabled
      if (config.getRdfConfiguration() == null
          || !Boolean.TRUE.equals(config.getRdfConfiguration().getEnabled())) {
        LOG.error("RDF is not enabled in configuration. Please set rdf.enabled=true");
        return 1;
      }

      // Get entities to process
      Set<String> entities = new HashSet<>();
      if (entityType == null || "all".equalsIgnoreCase(entityType)) {
        entities.add("all");
      } else {
        entities.add(entityType);
      }

      return executeRdfReindexApp(entities, batchSize, recreate);
    } catch (Exception e) {
      LOG.error("Failed to reindex RDF due to", e);
      return 1;
    }
  }

  private int executeRdfReindexApp(Set<String> entities, int batchSize, boolean recreateIndexes) {
    try {
      AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
      App app = appRepository.getByName(null, "RdfIndexApp", appRepository.getFields("id"));

      EventPublisherJob config =
          new EventPublisherJob()
              .withEntities(entities)
              .withBatchSize(batchSize)
              .withRecreateIndex(recreateIndexes);

      LOG.info("Triggering RDF reindex application");
      LOG.info("  Entities: {}", entities);
      LOG.info("  Batch size: {}", batchSize);
      LOG.info("  Recreate indexes: {}", recreateIndexes);

      // Trigger Application
      long currentTime = System.currentTimeMillis();
      AppScheduler.getInstance().triggerOnDemandApplication(app, JsonUtils.getMap(config));

      // Wait for completion and return status
      return waitAndReturnReindexingAppStatus(app, currentTime, null);
    } catch (EntityNotFoundException e) {
      LOG.error("RdfIndexApp not found. Please ensure the RDF indexing application is registered.");
      return 1;
    } catch (Exception e) {
      LOG.error("Failed to execute RDF reindex app", e);
      return 1;
    }
  }

  @Command(name = "deploy-pipelines", description = "Deploy all the service pipelines.")
  public Integer deployPipelines() {
    try {
      LOG.info("Deploying Pipelines via API");
      parseConfig();
      IngestionPipelineRepository pipelineRepository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
      List<IngestionPipeline> pipelines =
          pipelineRepository.listAll(
              new EntityUtil.Fields(Set.of(FIELD_OWNERS, "service")),
              new ListFilter(Include.NON_DELETED));
      LOG.debug(String.format("Pipelines %d", pipelines.size()));
      List<String> columns = Arrays.asList("Name", "Type", "Service Name", "Status");
      List<List<String>> pipelineStatuses = new ArrayList<>();

      if (!pipelines.isEmpty()) {
        deployPipelinesViaAPI(pipelines, pipelineStatuses);
      }

      printToAsciiTable(columns, pipelineStatuses, "No Pipelines Found");

      // Check if any pipeline deployments failed by examining the status column
      boolean hasFailures =
          pipelineStatuses.stream().anyMatch(status -> status.get(3).startsWith("FAILED"));

      if (hasFailures) {
        LOG.error("Some pipeline deployments failed. Check the table above for details.");
        return 1;
      }

      return 0;
    } catch (Exception e) {
      LOG.error("Failed to deploy pipelines due to ", e);
      return 1;
    }
  }

  @Command(
      name = "migrate-secrets",
      description =
          "Migrate secrets from DB to the configured Secrets Manager. "
              + "Note that this does not support migrating between external Secrets Managers")
  public Integer migrateSecrets() {
    try {
      LOG.info("Migrating Secrets from DB...");
      parseConfig();
      // update entities secrets if required
      new SecretsManagerUpdateService(secretsManager, config.getClusterName()).updateEntities();
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to migrate secrets due to ", e);
      return 1;
    }
  }

  @Command(name = "drop-indexes", description = "Drop all indexes from Elasticsearch/OpenSearch.")
  public Integer dropIndexes() {
    try {
      LOG.info("Dropping all indexes from search engine...");
      parseConfig();

      // Drop regular search repository indexes
      for (String entityType : searchRepository.getEntityIndexMap().keySet()) {
        LOG.info("Dropping index for entity type: {}", entityType);
        IndexMapping entityIndexMapping = searchRepository.getIndexMapping(entityType);
        Set<String> allEntityIndices =
            searchRepository
                .getSearchClient()
                .listIndicesByPrefix(
                    entityIndexMapping.getIndexName(searchRepository.getClusterAlias()));
        for (String oldIndex : allEntityIndices) {
          try {
            if (searchRepository.getSearchClient().indexExists(oldIndex)) {
              searchRepository.getSearchClient().deleteIndex(oldIndex);
              LOG.info("Cleaned up old index '{}' for entity '{}'.", oldIndex, entityType);
            }
          } catch (Exception deleteEx) {
            LOG.warn(
                "Failed to delete old index '{}' for entity '{}'.", oldIndex, entityType, deleteEx);
          }
        }
      }

      // Drop data streams and data quality indexes created by DataInsightsApp
      dropDataInsightsIndexes();

      LOG.info("All indexes dropped successfully.");
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to drop indexes due to ", e);
      return 1;
    }
  }

  @Command(name = "create-indexes", description = "Creates Indexes for Elastic/OpenSearch")
  public Integer createIndexes() {
    try {
      LOG.info("Creating indexes for search engine...");
      parseConfig();
      searchRepository.createIndexes();
      createDataInsightsIndexes();
      Entity.cleanup();
      LOG.info("All indexes created successfully.");
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to drop create due to ", e);
      return 1;
    }
  }

  private void dropDataInsightsIndexes() {
    try {
      LOG.info("Dropping Data Insights data streams and indexes...");

      // Create a DataInsightsApp instance to access its cleanup methods
      DataInsightsApp dataInsightsApp = new DataInsightsApp(collectionDAO, searchRepository);

      // Drop data assets data streams
      LOG.info("Dropping data assets data streams...");
      dataInsightsApp.deleteDataAssetsDataStream();

      // Drop data quality indexes
      LOG.info("Dropping data quality indexes...");
      dataInsightsApp.deleteDataQualityDataIndex();

      LOG.info("Data Insights indexes and data streams dropped successfully.");
    } catch (Exception e) {
      LOG.warn("Failed to drop some Data Insights indexes: {}", e.getMessage());
      LOG.debug("Data Insights index cleanup error details: ", e);
    }
  }

  private void createDataInsightsIndexes() {
    try {
      LOG.info("Create Data Insights data streams and indexes...");

      // Create a DataInsightsApp instance to access its cleanup methods
      DataInsightsApp dataInsightsApp = new DataInsightsApp(collectionDAO, searchRepository);

      // Drop data assets data streams
      LOG.info("Create/Update data assets data streams...");
      dataInsightsApp.createOrUpdateDataAssetsDataStream();

      // Drop data quality indexes
      LOG.info("Create/Updated data quality indexes...");
      dataInsightsApp.createDataQualityDataIndex();

      LOG.info("Data Insights indexes and data streams created successfully.");
    } catch (Exception e) {
      LOG.warn("Failed to create some Data Insights indexes: {}", e.getMessage());
      LOG.debug("Data Insights index creation error details: ", e);
    }
  }

  private Set<String> getAllIndices() {
    Set<String> indices = new HashSet<>();
    try {
      SearchClient searchClient = searchRepository.getSearchClient();

      if (searchClient instanceof ElasticSearchClient) {
        var request =
            new es.co.elastic.clients.transport.rest5_client.low_level.Request(
                "GET", "/_cat/indices?format=json");
        es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client lowLevelClient =
            (es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client)
                searchClient.getLowLevelClient();
        var response = lowLevelClient.performRequest(request);
        String responseBody;
        try (var is = response.getEntity().getContent()) {
          responseBody = new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }

        com.fasterxml.jackson.databind.JsonNode root = JsonUtils.readTree(responseBody);
        for (com.fasterxml.jackson.databind.JsonNode node : root) {
          String indexName = node.get("index").asText();
          indices.add(indexName);
        }
      } else if (searchClient instanceof OpenSearchClient openSearchClient) {
        os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient genericClient =
            openSearchClient.getNewClient().generic();
        var response =
            genericClient.execute(
                os.org.opensearch.client.opensearch.generic.Requests.builder()
                    .method("GET")
                    .endpoint("/_cat/indices?format=json")
                    .build());
        String responseBody =
            response
                .getBody()
                .map(
                    b -> {
                      try {
                        return new String(b.bodyAsBytes(), StandardCharsets.UTF_8);
                      } catch (Exception e) {
                        LOG.warn("Failed to read response body for indices", e);
                        return "[]";
                      }
                    })
                .orElse("[]");

        com.fasterxml.jackson.databind.JsonNode root = JsonUtils.readTree(responseBody);
        for (com.fasterxml.jackson.databind.JsonNode node : root) {
          String indexName = node.get("index").asText();
          indices.add(indexName);
        }
      }
    } catch (Exception e) {
      LOG.error("Failed to retrieve all indices", e);
    }
    return indices;
  }

  @Command(
      name = "remove-security-config",
      description =
          "Remove security configuration (authentication and authorization) from the database. "
              + "WARNING: This will delete all authentication and authorization settings!")
  public Integer removeSecurityConfig(
      @Option(
              names = {"--force"},
              description = "Force removal without confirmation prompt.",
              defaultValue = "false")
          boolean force) {
    try {
      if (!force) {
        LOG.warn(
            "WARNING: This will remove all authentication and authorization configuration from the database!");
        LOG.warn("This includes authenticationConfiguration and authorizerConfiguration settings.");
        LOG.info("Use --force to skip this confirmation.");

        // Scanner on System.in should not be closed as it would close System.in entirely
        @SuppressWarnings("resource")
        Scanner scanner = new Scanner(System.in);
        LOG.info("Enter 'DELETE' to confirm removal of security configuration: ");
        String input = scanner.next();
        if (!input.equals("DELETE")) {
          LOG.info("Operation cancelled.");
          return 0;
        }
      }

      LOG.info("Removing security configuration from database...");
      parseConfig();

      SystemRepository systemRepository = Entity.getSystemRepository();

      // Remove authentication configuration
      try {
        Settings authenticationSettings =
            systemRepository.getConfigWithKey(SettingsType.AUTHENTICATION_CONFIGURATION.value());
        if (authenticationSettings != null) {
          systemRepository.deleteSettings(SettingsType.AUTHENTICATION_CONFIGURATION);
          LOG.info("Removed authenticationConfiguration from database.");
        } else {
          LOG.info("No authenticationConfiguration found in database.");
        }
      } catch (Exception e) {
        LOG.debug("Failed to remove authenticationConfiguration: {}", e.getMessage());
      }

      // Remove authorizer configuration
      try {
        Settings authorizerSettings =
            systemRepository.getConfigWithKey(SettingsType.AUTHORIZER_CONFIGURATION.value());
        if (authorizerSettings != null) {
          systemRepository.deleteSettings(SettingsType.AUTHORIZER_CONFIGURATION);
          LOG.info("Removed authorizerConfiguration from database.");
        } else {
          LOG.info("No authorizerConfiguration found in database.");
        }
      } catch (Exception e) {
        LOG.debug("Failed to remove authorizerConfiguration: {}", e.getMessage());
      }

      LOG.info("Security configuration removal completed.");
      LOG.info(
          "Note: You will need to restart the OpenMetadata service for changes to take effect.");
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to remove security configuration due to ", e);
      return 1;
    }
  }

  @Command(
      name = "analyze-tables",
      description =
          "Migrate secrets from DB to the configured Secrets Manager. "
              + "Note that this does not support migrating between external Secrets Managers")
  public Integer analyzeTables() {
    try {
      LOG.info("Analyzing Tables...");
      parseConfig();
      Entity.getEntityList().forEach(this::analyzeEntityTable);
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to analyze tables due to ", e);
      return 1;
    }
  }

  @Command(
      name = "cleanup-flowable-history",
      description =
          "Cleans up old workflow deployments and history. "
              + "For Periodic Batch workflows: cleans up both deployments and history. "
              + "For Event Based workflows: cleans up only history. "
              + "By default, runs in dry-run mode to only analyze what would be cleaned.")
  public Integer cleanupFlowableHistory(
      @Option(
              names = {"--delete"},
              defaultValue = "false",
              description =
                  "Actually perform the cleanup. Without this flag, the command only analyzes what would be cleaned (dry-run mode).")
          boolean delete,
      @Option(
              names = {"--runtime-batch-size"},
              defaultValue = "1000",
              description = "Batch size for runtime instance cleanup.")
          int runtimeBatchSize,
      @Option(
              names = {"--history-batch-size"},
              defaultValue = "1000",
              description = "Batch size for history instance cleanup.")
          int historyBatchSize) {
    try {
      boolean dryRun = !delete;
      LOG.info("Running Flowable workflow cleanup. Dry run: {}", dryRun);

      parseConfig();
      initializeCollectionRegistry();
      SettingsCache.initialize(config);
      initializeSecurityConfig();
      WorkflowHandler.initialize(config);

      WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
      FlowableCleanup cleanup = new FlowableCleanup(workflowHandler, dryRun);
      FlowableCleanup.FlowableCleanupResult result =
          cleanup.performCleanup(historyBatchSize, runtimeBatchSize);

      if (dryRun && !result.getCleanedWorkflows().isEmpty()) {
        LOG.info("Dry run completed. To actually perform the cleanup, run with --delete");
        return 1;
      }

      LOG.info("Flowable cleanup completed successfully.");
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to cleanup Flowable history due to ", e);
      return 1;
    }
  }

  private void analyzeEntityTable(String entity) {
    try {
      EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entity);
      LOG.info("Analyzing table for [{}] Entity", entity);
      repository.getDao().analyzeTable();
    } catch (EntityNotFoundException e) {
      LOG.debug("No repository for [{}] Entity", entity);
    }
  }

  private void deployPipelinesViaAPI(
      List<IngestionPipeline> pipelines, List<List<String>> pipelineStatuses) {
    try {
      // Get ingestion-bot JWT token
      String jwtToken = getIngestionBotToken();
      if (jwtToken == null) {
        throw new RuntimeException("Failed to retrieve ingestion-bot JWT token");
      }

      // Get server API URL from config
      String serverUrl = getServerApiUrl();
      if (serverUrl == null) {
        throw new RuntimeException("SERVER_HOST_API_URL not configured");
      }
      LOG.info("Deploying pipelines to server URL: {}", serverUrl);

      // Create HTTP client
      HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

      // Process pipelines in chunks of 20
      int chunkSize = 20;
      int totalPipelines = pipelines.size();
      LOG.info(
          "Deploying {} pipelines via bulk API calls in chunks of {}", totalPipelines, chunkSize);

      List<List<IngestionPipeline>> pipelineChunks = chunkList(pipelines, chunkSize);

      for (int chunkIndex = 0; chunkIndex < pipelineChunks.size(); chunkIndex++) {
        List<IngestionPipeline> chunk = pipelineChunks.get(chunkIndex);
        LOG.info(
            "Processing chunk {} of {} (pipelines {}-{})",
            chunkIndex + 1,
            pipelineChunks.size(),
            chunkIndex * chunkSize + 1,
            Math.min((chunkIndex + 1) * chunkSize, totalPipelines));

        deployPipelineChunk(client, jwtToken, serverUrl, chunk, pipelineStatuses);
      }

      LOG.info("Completed bulk deployment of {} pipelines", totalPipelines);
    } catch (Exception e) {
      LOG.error("Failed to deploy pipelines via API", e);
      // Mark all pipelines as failed
      for (IngestionPipeline pipeline : pipelines) {
        pipelineStatuses.add(
            Arrays.asList(
                pipeline.getName(),
                pipeline.getPipelineType().value(),
                pipeline.getService().getName(),
                "FAILED - " + e.getMessage()));
      }
    }
  }

  private void deployPipelineChunk(
      HttpClient client,
      String jwtToken,
      String serverUrl,
      List<IngestionPipeline> pipelineChunk,
      List<List<String>> pipelineStatuses) {
    try {
      // Collect pipeline IDs for this chunk
      List<UUID> pipelineIds =
          pipelineChunk.stream().map(IngestionPipeline::getId).collect(Collectors.toList());

      // Make bulk deploy API call for this chunk
      String jsonBody = JsonUtils.pojoToJson(pipelineIds);

      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(serverUrl + COLLECTION_PATH + "bulk/deploy"))
              .header("Authorization", "Bearer " + jwtToken)
              .header("Content-Type", "application/json")
              .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
              .timeout(Duration.ofMinutes(2))
              .build();

      HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() == 200) {
        LOG.debug("Chunk deployment completed successfully");
        // Parse response and update status table for this chunk
        updatePipelineStatuses(pipelineChunk, response.body(), pipelineStatuses);
      } else {
        LOG.error(
            "Chunk deployment failed with status: {} - {}", response.statusCode(), response.body());
        // Mark chunk pipelines as failed
        for (IngestionPipeline pipeline : pipelineChunk) {
          pipelineStatuses.add(
              Arrays.asList(
                  pipeline.getName(),
                  pipeline.getPipelineType().value(),
                  pipeline.getService().getName(),
                  "FAILED - HTTP " + response.statusCode()));
        }
      }
    } catch (Exception e) {
      LOG.error("Failed to deploy pipeline chunk", e);
      // Mark chunk pipelines as failed
      for (IngestionPipeline pipeline : pipelineChunk) {
        pipelineStatuses.add(
            Arrays.asList(
                pipeline.getName(),
                pipeline.getPipelineType().value(),
                pipeline.getService().getName(),
                "FAILED - " + e));
      }
    }
  }

  private <T> List<List<T>> chunkList(List<T> list, int chunkSize) {
    List<List<T>> chunks = new ArrayList<>();
    for (int i = 0; i < list.size(); i += chunkSize) {
      int end = Math.min(list.size(), i + chunkSize);
      chunks.add(list.subList(i, end));
    }
    return chunks;
  }

  private String getIngestionBotToken() {
    try {
      // Use the same pattern as OpenMetadataConnectionBuilder
      BotRepository botRepository = (BotRepository) Entity.getEntityRepository(Entity.BOT);
      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);

      // First get the bot entity
      Bot bot =
          botRepository.getByName(null, Entity.INGESTION_BOT_NAME, new EntityUtil.Fields(Set.of()));
      if (bot == null || bot.getBotUser() == null) {
        LOG.error("Ingestion bot not found or bot has no associated user");
        return null;
      }

      // Get the bot user with authentication mechanism
      User botUser =
          userRepository.getByName(
              null,
              bot.getBotUser().getFullyQualifiedName(),
              new EntityUtil.Fields(Set.of("authenticationMechanism")));

      if (botUser == null || botUser.getAuthenticationMechanism() == null) {
        LOG.error("Bot user not found or missing authentication mechanism");
        return null;
      }

      // Extract and decrypt the JWT token
      AuthenticationMechanism authMechanism = botUser.getAuthenticationMechanism();
      if (authMechanism.getAuthType() != AuthenticationMechanism.AuthType.JWT) {
        LOG.error("Bot user does not have JWT authentication mechanism");
        return null;
      }

      JWTAuthMechanism jwtAuthMechanism =
          JsonUtils.convertValue(authMechanism.getConfig(), JWTAuthMechanism.class);

      // Decrypt the JWT token - this is the crucial step that was missing
      secretsManager.decryptJWTAuthMechanism(jwtAuthMechanism);
      String token = jwtAuthMechanism.getJWTToken();
      if (secretsManager.isSecret(token)) {
        return secretsManager.getSecretValue(token);
      }
      return jwtAuthMechanism.getJWTToken();
    } catch (Exception e) {
      LOG.error("Failed to retrieve ingestion-bot token", e);
      return null;
    }
  }

  private String getServerApiUrl() {
    if (config.getPipelineServiceClientConfiguration() != null
        && config.getPipelineServiceClientConfiguration().getMetadataApiEndpoint() != null) {
      String serverUrl = config.getPipelineServiceClientConfiguration().getMetadataApiEndpoint();
      return serverUrl.endsWith("/") ? serverUrl : serverUrl + "/";
    }
    return null;
  }

  private void updatePipelineStatuses(
      List<IngestionPipeline> pipelines, String responseBody, List<List<String>> pipelineStatuses) {
    try {
      // Parse the bulk deploy response to typed PipelineServiceClientResponse objects
      List<PipelineServiceClientResponse> responses =
          JsonUtils.readValue(
              responseBody, new TypeReference<List<PipelineServiceClientResponse>>() {});

      // Log the parsed responses for debugging
      LOG.info("Received {} deployment responses", responses.size());
      for (int i = 0; i < responses.size(); i++) {
        PipelineServiceClientResponse response = responses.get(i);
        String pipelineName = i < pipelines.size() ? pipelines.get(i).getName() : "unknown";
        LOG.info(
            "Pipeline {}: code={}, platform={}, reason={}",
            pipelineName,
            response.getCode(),
            response.getPlatform(),
            response.getReason() != null ? response.getReason() : "N/A");
      }

      // Correlate responses with pipelines by position (assuming same order)
      for (int i = 0; i < pipelines.size(); i++) {
        IngestionPipeline pipeline = pipelines.get(i);
        String status;

        if (i < responses.size()) {
          PipelineServiceClientResponse response = responses.get(i);
          Integer code = response.getCode();
          String reason = response.getReason();

          if (code != null && (code == 200 || code == 201)) {
            status = "DEPLOYED";
          } else if (code != null) {
            status = "FAILED - " + code + (reason != null ? ": " + reason : "");
          } else {
            status = "UNKNOWN";
          }
        } else {
          status = "NO_RESPONSE";
        }

        pipelineStatuses.add(
            Arrays.asList(
                pipeline.getName(),
                pipeline.getPipelineType().value(),
                pipeline.getService().getName(),
                status));
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse bulk deploy response, using default status", e);
      // Fallback to showing all as failed in display
      for (IngestionPipeline pipeline : pipelines) {
        pipelineStatuses.add(
            Arrays.asList(
                pipeline.getName(),
                pipeline.getPipelineType().value(),
                pipeline.getService().getName(),
                "FAILED"));
      }
    }
  }

  public void parseConfig() throws Exception {
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    objectMapper.registerSubtypes(AuditExcludeFilterFactory.class, AuditOnlyFilterFactory.class);
    Validator validator = Validators.newValidator();
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class, validator, objectMapper, "dw");
    config =
        factory.build(
            new SubstitutingSourceProvider(
                new FileConfigurationSourceProvider(), new EnvironmentVariableSubstitutor(false)),
            configFilePath);
    IndexMappingLoader.init(config.getElasticSearchConfiguration());
    Fernet.getInstance().setFernetKey(config);
    DataSourceFactory dataSourceFactory = config.getDataSourceFactory();
    if (dataSourceFactory == null) {
      throw new IllegalArgumentException("No database in config file");
    }
    // Check for db auth providers.
    DatabaseAuthenticationProviderFactory.get(dataSourceFactory.getUrl())
        .ifPresent(
            databaseAuthenticationProvider -> {
              String token =
                  databaseAuthenticationProvider.authenticate(
                      dataSourceFactory.getUrl(),
                      dataSourceFactory.getUser(),
                      dataSourceFactory.getPassword());
              dataSourceFactory.setPassword(token);
            });

    nativeSQLScriptRootPath = config.getMigrationConfiguration().getNativePath();
    extensionSQLScriptRootPath = config.getMigrationConfiguration().getExtensionPath();

    jdbi = JdbiUtils.createAndSetupJDBI(dataSourceFactory);

    // Initialize the MigrationValidationClient, used in the Settings Repository
    MigrationValidationClient.initialize(jdbi.onDemand(MigrationDAO.class), config);
    // Init repos
    collectionDAO = jdbi.onDemand(CollectionDAO.class);
    Entity.setJdbi(jdbi);
    Entity.setCollectionDAO(collectionDAO);
    Entity.setEntityRelationshipRepository(new EntityRelationshipRepository(collectionDAO));
    Entity.setSystemRepository(new SystemRepository());

    searchRepository =
        SearchRepositoryFactory.createSearchRepository(
            config.getElasticSearchConfiguration(), config.getDataSourceFactory().getMaxSize());

    // Initialize secrets manager
    secretsManager =
        SecretsManagerFactory.createSecretsManager(
            config.getSecretsManagerConfiguration(), config.getClusterName());

    Entity.setSearchRepository(searchRepository);
    Entity.initializeRepositories(config, jdbi);
    ConnectionType connType = ConnectionType.from(config.getDataSourceFactory().getDriverClass());
    DatasourceConfig.initialize(connType.label);
    OpenMetadataApplicationConfigHolder.initialize(config);
  }

  // This was before handled via flyway's clean command.
  private void dropAllTables() {
    try (Handle handle = jdbi.open()) {
      ConnectionType connType = ConnectionType.from(config.getDataSourceFactory().getDriverClass());
      if (connType == ConnectionType.MYSQL) {
        handle.execute("SET FOREIGN_KEY_CHECKS = 0");
        handle
            .createQuery("SHOW TABLES")
            .mapTo(String.class)
            .list()
            .forEach(
                tableName -> {
                  try {
                    handle.execute("DROP TABLE IF EXISTS " + tableName);
                  } catch (Exception e) {
                    LOG.warn("Failed to drop table: " + tableName, e);
                  }
                });
        handle.execute("SET FOREIGN_KEY_CHECKS = 1");
      } else if (connType == ConnectionType.POSTGRES) {
        handle
            .createQuery(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
            .mapTo(String.class)
            .list()
            .forEach(
                tableName -> {
                  try {
                    handle.execute("DROP TABLE IF EXISTS \"" + tableName + "\" CASCADE");
                  } catch (Exception e) {
                    LOG.warn("Failed to drop table: " + tableName, e);
                  }
                });
      }
    }
  }

  private void promptUserForDelete() {
    LOG.info(
        """
                    You are about drop all the data in the database. ALL METADATA WILL BE DELETED.\s
                    This is not recommended for a Production setup or any deployment where you have collected\s
                    a lot of information from the users, such as descriptions, tags, etc.
                    """);
    String input = "";
    // Scanner on System.in should not be closed as it would close System.in entirely
    @SuppressWarnings("resource")
    Scanner scanner = new Scanner(System.in);
    while (!input.equals("DELETE")) {
      LOG.info("Enter QUIT to quit. If you still want to continue, please enter DELETE: ");
      input = scanner.next();
      if (input.equals("QUIT")) {
        LOG.info("Exiting without deleting data");
        System.exit(1);
      }
    }
  }

  private void validateAndRunSystemDataMigrations(boolean force) {
    ConnectionType connType = ConnectionType.from(config.getDataSourceFactory().getDriverClass());
    DatasourceConfig.initialize(connType.label);
    MigrationWorkflow workflow =
        new MigrationWorkflow(
            jdbi,
            nativeSQLScriptRootPath,
            connType,
            extensionSQLScriptRootPath,
            config.getMigrationConfiguration().getFlywayPath(),
            config,
            force);
    workflow.loadMigrations();
    workflow.printMigrationInfo();
    workflow.runMigrationWorkflows(true);
  }

  private void initOrganization() {
    LoggerContext loggerContext = (LoggerContext) LoggerFactory.getILoggerFactory();
    ch.qos.logback.classic.Logger rootLogger =
        loggerContext.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
    Level originalLevel = rootLogger.getLevel();
    TeamRepository teamRepository = (TeamRepository) Entity.getEntityRepository(Entity.TEAM);
    try {
      teamRepository.getByName(null, ORGANIZATION_NAME, EntityUtil.Fields.EMPTY_FIELDS);
    } catch (EntityNotFoundException e) {
      try {
        PolicyRepository policyRepository =
            (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
        policyRepository.initSeedDataFromResources();
        RoleRepository roleRepository = (RoleRepository) Entity.getEntityRepository(Entity.ROLE);
        List<Role> roles = roleRepository.getEntitiesFromSeedData();
        for (Role role : roles) {
          role.setFullyQualifiedName(role.getName());
          List<EntityReference> policies = role.getPolicies();
          for (EntityReference policy : policies) {
            EntityReference ref =
                Entity.getEntityReferenceByName(
                    Entity.POLICY, policy.getName(), Include.NON_DELETED);
            policy.setId(ref.getId());
          }
          roleRepository.initializeEntity(role);
        }
        teamRepository.initOrganization();
      } catch (Exception ex) {
        LOG.error("Failed to initialize organization due to ", ex);
        throw new RuntimeException(ex);
      } finally {
        rootLogger.setLevel(originalLevel);
      }
    }
  }

  public static void printToAsciiTable(
      List<String> columns, List<List<String>> rows, String emptyText) {
    LOG.info(new AsciiTable(columns, rows, true, "", emptyText).render());
  }

  private void performServiceHierarchyCleanup(boolean dryRun) {
    ServiceHierarchyCleanup hierarchyCleanup = new ServiceHierarchyCleanup(collectionDAO, dryRun);
    ServiceHierarchyCleanup.HierarchyCleanupResult result =
        hierarchyCleanup.performHierarchyCleanup();
    hierarchyCleanup.printCleanupResults(result);
  }

  private void printChangeLog() {
    MigrationDAO migrationDAO = jdbi.onDemand(MigrationDAO.class);
    List<MigrationDAO.ServerChangeLog> serverChangeLogs =
        migrationDAO.listMetricsFromDBMigrations();
    Set<String> columns = new LinkedHashSet<>(Set.of("version", "installedOn"));
    List<List<String>> rows = new ArrayList<>();
    try {
      for (MigrationDAO.ServerChangeLog serverChangeLog : serverChangeLogs) {
        List<String> row = new ArrayList<>();
        if (serverChangeLog.getMetrics() != null) {
          JsonObject metricsJson =
              new Gson().fromJson(serverChangeLog.getMetrics(), JsonObject.class);
          Set<String> keys = metricsJson.keySet();
          columns.addAll(keys);
          row.add(serverChangeLog.getVersion());
          row.add(serverChangeLog.getInstalledOn());
          row.addAll(
              metricsJson.entrySet().stream()
                  .map(Map.Entry::getValue)
                  .map(JsonElement::toString)
                  .toList());
          rows.add(row);
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to generate migration metrics due to", e);
    }
    printToAsciiTable(columns.stream().toList(), rows, "No Server Change log found");
  }

  private String getInstanceUrlFromSettings() {
    try {
      SystemRepository systemRepository = Entity.getSystemRepository();
      if (systemRepository != null) {
        Settings settings = systemRepository.getOMBaseUrlConfigInternal();
        if (settings != null && settings.getConfigValue() != null) {
          OpenMetadataBaseUrlConfiguration urlConfig =
              (OpenMetadataBaseUrlConfiguration) settings.getConfigValue();
          if (urlConfig != null && urlConfig.getOpenMetadataUrl() != null) {
            return urlConfig.getOpenMetadataUrl();
          }
        }
      }
    } catch (Exception e) {
      LOG.debug("Could not get instance URL from SystemSettings", e);
    }
    return "http://localhost:8585";
  }

  public static void main(String... args) {
    LOG.info(printOpenMetadataText());
    int exitCode =
        new CommandLine(new org.openmetadata.service.util.OpenMetadataOperations()).execute(args);
    System.exit(exitCode);
  }
}
