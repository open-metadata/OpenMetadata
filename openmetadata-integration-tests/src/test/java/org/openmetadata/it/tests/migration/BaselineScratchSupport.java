/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.it.tests.migration;

import java.lang.reflect.Field;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.flowable.engine.ProcessEngines;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.HikariCPDataSourceFactory;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchRepositoryFactory;
import org.testcontainers.containers.JdbcDatabaseContainer;

/**
 * Shared plumbing for baseline generation and equivalence checks: scratch databases inside the
 * session's shared database container, a faithful replica of the TestSuiteBootstrap migration
 * sequence pointed at a scratch database, and capture/restore of the {@code Entity} globals that
 * sequence re-points (same pattern as OneTransactionFlushAtomicityIT — callers must be
 * {@code @Isolated}).
 */
final class BaselineScratchSupport {

  private static final Pattern JDBC_URL_PATTERN =
      Pattern.compile("(jdbc:[a-z]+://[^/]+/)([^?]*)(.*)");
  private static final String SERVER_CHANGE_LOG = "SERVER_CHANGE_LOG";
  private static final String SERVER_MIGRATION_SQL_LOGS = "SERVER_MIGRATION_SQL_LOGS";

  record ScratchDatabase(
      String name, String jdbcUrl, String username, String password, Jdbi jdbi) {}

  record GlobalState(
      CollectionDAO collectionDAO,
      JobDAO jobDAO,
      SearchRepository searchRepository,
      Jdbi jdbi,
      EntityRelationshipRepository entityRelationshipRepository) {}

  private BaselineScratchSupport() {}

  /**
   * Tables owned by other machinery and therefore excluded from the baseline artifact and from
   * equivalence comparison: the runner-managed history tables and Flowable's self-managed schema.
   */
  static boolean isExcludedFromBaseline(String tableName) {
    String upper = tableName.toUpperCase(java.util.Locale.ROOT);
    return upper.equals(SERVER_CHANGE_LOG)
        || upper.equals(SERVER_MIGRATION_SQL_LOGS)
        || upper.startsWith("ACT_")
        || upper.startsWith("FLW_");
  }

  static ConnectionType currentConnectionType() {
    return ConnectionType.from(databaseContainer().getDriverClassName());
  }

  static GlobalState captureGlobals() {
    return new GlobalState(
        Entity.getCollectionDAO(),
        Entity.getJobDAO(),
        Entity.getSearchRepository(),
        Entity.getJdbi(),
        Entity.getEntityRelationshipRepository());
  }

  /** Re-point the Entity globals back at the session database the live application uses. */
  static void restoreGlobals(GlobalState state) {
    Entity.cleanup();
    Entity.setCollectionDAO(state.collectionDAO());
    Entity.setJobDAO(state.jobDAO());
    Entity.setSearchRepository(state.searchRepository());
    Entity.setJdbi(state.jdbi());
    Entity.setEntityRelationshipRepository(state.entityRelationshipRepository());
    Entity.initializeRepositories(
        TestSuiteBootstrap.createApplicationConfigCopy(), TestSuiteBootstrap.getJdbi());
    SettingsCache.cleanUp();
    // If a scratch chain run left the handler in migration mode, this hits the public
    // migration-to-runtime transition, which destroys the scratch engine and rebinds to the
    // session database; otherwise it is a no-op.
    WorkflowHandler.initialize(TestSuiteBootstrap.createApplicationConfigCopy());
  }

  /**
   * The live WorkflowHandler is bound to the session database; Java migrations initialize it
   * lazily via {@code WorkflowHandler.initialize(config, true)}, which no-ops when already
   * initialized — leaving Flowable pointed at the wrong database for a scratch chain run (and
   * breaking 1.6.0's FLW_EV_DATABASECHANGELOG insert). Reset it so the chain binds to scratch;
   * {@link #restoreGlobals} rebinds it to the session database afterwards.
   */
  private static void resetWorkflowHandlerForScratchRun() {
    if (WorkflowHandler.isInitialized()) {
      ProcessEngines.destroy();
      setStaticField(WorkflowHandler.class, "instance", null);
      setStaticField(WorkflowHandler.class, "initialized", false);
    }
  }

  /**
   * The entity caches are static and keyed by (entityType, name) with no notion of which database
   * they came from, so entries loaded during one scratch run are served to the next one. That is
   * not academic: it made v200's {@code ensureDefaultTaskWorkflows} see the previous run's workflow
   * definitions as "already existing", take the update path, and write nothing to the new database.
   */
  private static void resetStaticEntityCaches() {
    EntityRepository.CACHE_WITH_NAME.invalidateAll();
    EntityRepository.CACHE_WITH_ID.invalidateAll();
    SettingsCache.cleanUp();
  }

  private static void setStaticField(Class<?> clazz, String fieldName, Object value) {
    try {
      Field field = clazz.getDeclaredField(fieldName);
      field.setAccessible(true);
      field.set(null, value);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException("Failed to reset " + clazz + "." + fieldName, e);
    }
  }

  /** Drop-and-recreate a scratch database inside the shared container. */
  static ScratchDatabase createScratchDatabase(String name) {
    ConnectionType connectionType = currentConnectionType();
    String containerUrl = databaseContainer().getJdbcUrl();
    ScratchDatabase result;
    if (connectionType == ConnectionType.MYSQL) {
      recreateDatabase(swapDatabase(containerUrl, "mysql"), "root", "test", name, connectionType);
      result = buildScratch(name, swapDatabase(containerUrl, name), "root", "test");
    } else {
      recreateDatabase(
          swapDatabase(containerUrl, "postgres"), "test", "test", name, connectionType);
      result = buildScratch(name, swapDatabase(containerUrl, name), "test", "test");
    }
    return result;
  }

  /**
   * The exact TestSuiteBootstrap.validateAndRunSystemDataMigrations sequence, pointed at a scratch
   * database. Re-points the Entity globals — capture them first and restore after.
   */
  static void runMigrations(ScratchDatabase database, String nativeRoot, boolean force) {
    runMigrations(database, nativeRoot, "", force);
  }

  static void runMigrations(
      ScratchDatabase database, String nativeRoot, String flywayPath, boolean force) {
    ConnectionType connectionType = currentConnectionType();
    OpenMetadataApplicationConfig config = scratchConfig(database);
    DatasourceConfig.initialize(connectionType.label);
    MigrationWorkflow workflow =
        new MigrationWorkflow(
            database.jdbi(), nativeRoot, connectionType, "", flywayPath, config, force);
    resetWorkflowHandlerForScratchRun();
    resetStaticEntityCaches();
    Entity.cleanup();
    SearchRepository searchRepository =
        SearchRepositoryFactory.createSearchRepository(config.getElasticSearchConfiguration(), 50);
    Entity.setSearchRepository(searchRepository);
    CollectionDAO scratchCollectionDAO = database.jdbi().onDemand(CollectionDAO.class);
    Entity.setCollectionDAO(scratchCollectionDAO);
    Entity.setJobDAO(database.jdbi().onDemand(JobDAO.class));
    // The production migrate path (OpenMetadataOperations.parseConfig) sets these before running
    // migrations. Without the explicit jdbi, entity writes inside Java migrations (e.g. v200
    // seeding task workflow definitions via flushInOneTransaction) NPE on Entity.getJdbi();
    // without the relationship repository, deletes (e.g. v150) NPE resolving owners.
    Entity.setJdbi(database.jdbi());
    Entity.setEntityRelationshipRepository(new EntityRelationshipRepository(scratchCollectionDAO));
    Entity.initializeRepositories(config, database.jdbi());
    workflow.loadMigrations();
    workflow.runMigrationWorkflows(false);
  }

  static OpenMetadataApplicationConfig scratchConfig(ScratchDatabase database) {
    OpenMetadataApplicationConfig config = TestSuiteBootstrap.createApplicationConfigCopy();
    HikariCPDataSourceFactory dataSourceFactory =
        (HikariCPDataSourceFactory) config.getDataSourceFactory();
    dataSourceFactory.setUrl(database.jdbcUrl());
    dataSourceFactory.setUser(database.username());
    dataSourceFactory.setPassword(database.password());
    return config;
  }

  static Path repoRoot() {
    Path workingDir = Path.of(System.getProperty("user.dir"));
    return workingDir.endsWith("openmetadata-integration-tests")
        ? workingDir.getParent()
        : workingDir;
  }

  static Path committedBaselineRoot() {
    return repoRoot().resolve("bootstrap/sql/migrations/baseline");
  }

  static String realNativePath() {
    return TestSuiteBootstrap.createApplicationConfigCopy()
        .getMigrationConfiguration()
        .getNativePath();
  }

  static String realFlywayPath() {
    return TestSuiteBootstrap.createApplicationConfigCopy()
        .getMigrationConfiguration()
        .getFlywayPath();
  }

  private static void recreateDatabase(
      String adminUrl,
      String username,
      String password,
      String name,
      ConnectionType connectionType) {
    Jdbi adminJdbi = Jdbi.create(adminUrl, username, password);
    adminJdbi.useHandle(
        handle -> {
          if (connectionType == ConnectionType.MYSQL) {
            handle.execute("DROP DATABASE IF EXISTS " + name);
            handle.execute("CREATE DATABASE " + name);
          } else {
            handle.execute("DROP DATABASE IF EXISTS " + name + " WITH (FORCE)");
            handle.execute("CREATE DATABASE " + name);
          }
        });
  }

  private static ScratchDatabase buildScratch(
      String name, String jdbcUrl, String username, String password) {
    Jdbi scratchJdbi = Jdbi.create(jdbcUrl, username, password);
    scratchJdbi.installPlugin(new SqlObjectPlugin());
    scratchJdbi
        .getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(databaseContainer().getDriverClassName()));
    return new ScratchDatabase(name, jdbcUrl, username, password, scratchJdbi);
  }

  static JdbcDatabaseContainer<?> databaseContainer() {
    try {
      Field field = TestSuiteBootstrap.class.getDeclaredField("DATABASE_CONTAINER");
      field.setAccessible(true);
      return (JdbcDatabaseContainer<?>) field.get(null);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException(
          "Failed to access the integration-test database container", e);
    }
  }

  private static String swapDatabase(String jdbcUrl, String databaseName) {
    Matcher matcher = JDBC_URL_PATTERN.matcher(jdbcUrl);
    if (!matcher.matches()) {
      throw new IllegalArgumentException("Unrecognized JDBC url: " + jdbcUrl);
    }
    return matcher.group(1) + databaseName + matcher.group(3);
  }
}
