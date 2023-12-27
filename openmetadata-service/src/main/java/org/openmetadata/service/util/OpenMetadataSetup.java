package org.openmetadata.service.util;

import static org.flywaydb.core.internal.info.MigrationInfoDumper.dumpToAsciiTable;
import static org.openmetadata.service.Entity.FIELD_OWNER;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.validation.Validators;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Scanner;
import java.util.Set;
import java.util.concurrent.Callable;
import javax.validation.Validator;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.flywaydb.core.internal.util.AsciiTable;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.search.SearchIndexFactory;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.jdbi.DatabaseAuthenticationProviderFactory;
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
public class OpenMetadataSetup implements Callable<Integer> {

  private OpenMetadataApplicationConfig config;
  private Flyway flyway;
  private Jdbi jdbi;
  private SearchRepository searchRepository;
  private String nativeSQLScriptRootPath;
  private String extensionSQLScriptRootPath;
  private String flywayRootPath;
  private SecretsManager secretsManager;
  private CollectionDAO collectionDAO;

  @CommandLine.ArgGroup(exclusive = false, multiplicity = "1", order = 1, heading = "Config%n")
  DefaultConfig defaultConfig;

  @CommandLine.ArgGroup(multiplicity = "1", order = 2, heading = "OpenMetadata Operations %n")
  OpenMetadataOperations operations;

  static class DefaultConfig {
    @Option(
        names = {"-c", "--config"},
        description = "OpenMetadata config file",
        required = true)
    String configFilePath;

    @Option(
        names = {"-debug", "--debug"},
        description = "Prints Debug logs",
        required = false)
    boolean debug;

    @Option(
        names = {"-force", "--force"},
        description =
            "Forces migrate to re-run the previously ran SQL statements. "
                + "Only use this option, if the migrate option didn't worked.",
        required = false)
    boolean force;
  }

  static class OpenMetadataOperations {

    @Option(
        names = {"-dc", "--drop-create"},
        description =
            "Deletes any tables in configured database and creates a new tables "
                + "based on current version of OpenMetadata. This command also re-creates the search indexes.",
        required = true)
    boolean dropCreate;

    @Option(
        names = {"-m", "--migrate"},
        description = "Migrates the OpenMetadata database schema and search index mappings.",
        required = true)
    boolean migrate;

    @Option(
        names = {"-ri", "--re-index"},
        description = "Re Indexes data into search engine from command line.",
        required = true)
    boolean reIndex;

    @Option(
        names = {"-dp", "--deploy-pipelines"},
        description = "Deploy all the service pipelines.",
        required = true)
    boolean deployPipelines;

    @Option(
        names = {"-validate", "--validate"},
        description =
            "Checks if the all the migrations haven been applied on " + "the target database.",
        required = false)
    boolean validate;

    @Option(
        names = {"-info", "--info"},
        description =
            "Shows the list of migrations applied and the pending migration "
                + "waiting to be applied on the target database",
        required = false)
    boolean info;

    @Option(
        names = {"-repair", "--repair"},
        description =
            "Repairs the DATABASE_CHANGE_LOG table which is used to track"
                + "all the migrations on the target database This involves removing entries for the failed migrations and update"
                + "the checksum of migrations already applied on the target database",
        required = false)
    boolean repair;

    @Option(
        names = {"-check-connection", "--check-connection"},
        description =
            "Checks if a connection can be " + "successfully obtained for the target database",
        required = false)
    boolean checkConnection;

    @Option(
        names = {"-rotate-fernet-key", "--rotate-fernet-key"},
        description = "Rotate the Fernet Key defined in " + "$FERNET_KEY",
        required = false)
    boolean rotate;
  }

  @Override
  public Integer call() throws Exception {
    try {
      if (defaultConfig.debug) {
        Logger root = (Logger) LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        root.setLevel(Level.DEBUG);
      }
      parseConfig();
      if (operations.dropCreate) {
        dropCreate();
      } else if (operations.migrate) {
        migrate();
      } else if (operations.reIndex) {

      } else if (operations.deployPipelines) {
        deployPipelines();
      } else if (operations.info) {
        info();
      } else if (operations.validate) {
        validate();
      } else if (operations.repair) {
        repair();
      } else if (operations.checkConnection) {
        checkConnection();
      }
      return 0;
    } catch (Exception e) {
      LOG.error("Failed due to", e);
      return 1;
    }
  }

  private void info() {
    LOG.info(dumpToAsciiTable(flyway.info().all()));
  }

  private void validate() {
    flyway.validate();
  }

  private void repair() {
    flyway.repair();
  }

  private void checkConnection() throws SQLException {
    flyway.getConfiguration().getDataSource().getConnection();
  }

  private void dropCreate() {
    promptUserForDelete();
    LOG.info("Deleting all the OpenMetadata tables.");
    flyway.clean();
    LOG.info("Creating the OpenMetadata Schema.");
    flyway.migrate();
    validateAndRunSystemDataMigrations();
    LOG.info("OpenMetadata Database Schema is Updated.");
    LOG.info("Deleting Search Indexes.");
    searchRepository.dropIndexes();
    LOG.info("Creating Search Indexes.");
    searchRepository.createIndexes();
    LOG.info("OpenMetadata DropCreate operation is completed.");
  }

  private void migrate() {
    LOG.info("Migrating the OpenMetadata Schema.");
    flyway.migrate();
    validateAndRunSystemDataMigrations();
    LOG.info("Migrating the Search Indexes.");
    searchRepository.updateIndexes();
    LOG.info("OpenMetadata Migrate operation is completed.");
  }

  private void parseConfig() throws Exception {
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    Validator validator = Validators.newValidator();
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class, validator, objectMapper, "dw");
    config =
        factory.build(
            new SubstitutingSourceProvider(
                new FileConfigurationSourceProvider(), new EnvironmentVariableSubstitutor(false)),
            defaultConfig.configFilePath);
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

    String jdbcUrl = dataSourceFactory.getUrl();
    String user = dataSourceFactory.getUser();
    String password = dataSourceFactory.getPassword();

    flywayRootPath = config.getMigrationConfiguration().getFlywayPath();
    String location =
        "filesystem:"
            + flywayRootPath
            + File.separator
            + config.getDataSourceFactory().getDriverClass();
    flyway =
        Flyway.configure()
            .encoding(StandardCharsets.UTF_8)
            .table("DATABASE_CHANGE_LOG")
            .sqlMigrationPrefix("v")
            .validateOnMigrate(false)
            .outOfOrder(false)
            .baselineOnMigrate(true)
            .baselineVersion(MigrationVersion.fromVersion("000"))
            .cleanOnValidationError(false)
            .locations(location)
            .dataSource(jdbcUrl, user, password)
            .cleanDisabled(false)
            .load();
    nativeSQLScriptRootPath = config.getMigrationConfiguration().getNativePath();
    extensionSQLScriptRootPath = config.getMigrationConfiguration().getExtensionPath();
    jdbi = Jdbi.create(jdbcUrl, user, password);
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(
                config.getDataSourceFactory().getDriverClass()));

    searchRepository =
        new SearchRepository(config.getElasticSearchConfiguration(), new SearchIndexFactory());

    // Initialize secrets manager
    secretsManager =
        SecretsManagerFactory.createSecretsManager(
            config.getSecretsManagerConfiguration(), config.getClusterName());

    collectionDAO = jdbi.onDemand(CollectionDAO.class);
    Entity.setCollectionDAO(collectionDAO);
    Entity.initializeRepositories(config, jdbi);
  }

  private void deployPipelines() {
    PipelineServiceClient pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(
            config.getPipelineServiceClientConfiguration());
    IngestionPipelineRepository pipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    List<IngestionPipeline> pipelines =
        pipelineRepository.listAll(
            new EntityUtil.Fields(Set.of(FIELD_OWNER, "service")),
            new ListFilter(Include.NON_DELETED));
    LOG.debug(String.format("Pipelines %d", pipelines.size()));
    List<String> columns = Arrays.asList("Name", "Type", "Service Name", "Status");
    List<List<String>> pipelineStatuses = new ArrayList<>();
    for (IngestionPipeline pipeline : pipelines) {
      try {
        LOG.debug(String.format("deploying pipeline %s", pipeline.getName()));
        pipeline.setOpenMetadataServerConnection(new OpenMetadataConnectionBuilder(config).build());
        secretsManager.decryptIngestionPipeline(pipeline);
        OpenMetadataConnection openMetadataServerConnection =
            new OpenMetadataConnectionBuilder(config).build();
        pipeline.setOpenMetadataServerConnection(
            secretsManager.encryptOpenMetadataConnection(openMetadataServerConnection, false));
        ServiceEntityInterface service =
            Entity.getEntity(pipeline.getService(), "", Include.NON_DELETED);
        pipelineServiceClient.deployPipeline(pipeline, service);
      } catch (Exception e) {
        LOG.error(
            String.format(
                "Failed to deploy pipeline %s of type %s for service %s",
                pipeline.getName(),
                pipeline.getPipelineType().value(),
                pipeline.getService().getName()),
            e);
        pipeline.setDeployed(false);
      } finally {
        LOG.debug("update the pipeline");
        collectionDAO.ingestionPipelineDAO().update(pipeline);
        pipelineStatuses.add(
            Arrays.asList(
                pipeline.getName(),
                pipeline.getPipelineType().value(),
                pipeline.getService().getName(),
                pipeline.getDeployed().toString()));
      }
    }
    printToAsciiTable(columns, pipelineStatuses, "No Pipelines Found");
  }

  private void promptUserForDelete() {
    LOG.info(
        """
                    You are about drop all the data in the database. ALL METADATA WILL BE DELETED.\s
                    This is not recommended for a Production setup or any deployment where you have collected\s
                    a lot of information from the users, such as descriptions, tags, etc.
                    """);
    String input = "";
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

  private void validateAndRunSystemDataMigrations() {
    ConnectionType connType = ConnectionType.from(config.getDataSourceFactory().getDriverClass());
    DatasourceConfig.initialize(connType.label);
    MigrationWorkflow workflow =
        new MigrationWorkflow(
            jdbi,
            nativeSQLScriptRootPath,
            connType,
            extensionSQLScriptRootPath,
            defaultConfig.force);
    workflow.loadMigrations();
    workflow.runMigrationWorkflows();
    Entity.cleanup();
  }

  private void printToAsciiTable(List<String> columns, List<List<String>> rows, String emptyText) {
    LOG.info(new AsciiTable(columns, rows, true, "", emptyText).render());
  }

  public static void main(String... args) {
    int exitCode = new CommandLine(new OpenMetadataSetup()).execute(args);
    System.exit(exitCode);
  }
}
