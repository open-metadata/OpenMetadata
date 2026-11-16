package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageProcessingStatus;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@Isolated
class ContextProcessingConditionalWriteSqlTest {
  private static final String DATABASE = "context_processing";
  private static final String PASSWORD = "context-processing-test";

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void fileProcessingPreservesConsolidatedEditsOnMysql() throws IOException {
    try (GenericContainer<?> database =
        new GenericContainer<>("mysql:8.3.0")
            .withEnv("MYSQL_DATABASE", DATABASE)
            .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
            .withEnv("MYSQL_ROOT_HOST", "%")
            .withExposedPorts(3306)
            .waitingFor(
                Wait.forSuccessfulCommand(
                    "mysql --protocol=TCP --host=127.0.0.1 --user=root --password="
                        + PASSWORD
                        + " --execute='SELECT 1'"))) {
      database.start();
      String url =
          "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
              .formatted(database.getHost(), database.getMappedPort(3306), DATABASE);
      runChecks(url, "root", "com.mysql.cj.jdbc.Driver", "mysql");
    }
  }

  @Test
  void fileProcessingPreservesConsolidatedEditsOnPostgres() throws IOException {
    try (GenericContainer<?> database =
        new GenericContainer<>("postgres:15")
            .withEnv("POSTGRES_DB", DATABASE)
            .withEnv("POSTGRES_PASSWORD", PASSWORD)
            .withExposedPorts(5432)
            .waitingFor(
                Wait.forLogMessage(".*database system is ready to accept connections.*\\n", 2))) {
      database.start();
      String url =
          "jdbc:postgresql://%s:%d/%s"
              .formatted(database.getHost(), database.getMappedPort(5432), DATABASE);
      runChecks(url, "postgres", "org.postgresql.Driver", "postgres");
    }
  }

  private void runChecks(String url, String username, String driver, String engine)
      throws IOException {
    Jdbi jdbi = Jdbi.create(url, username, PASSWORD).installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class).setSqlLocator(new ConnectionAwareAnnotationSqlLocator(driver));
    Entity.setCollectionDAO(jdbi.onDemand(CollectionDAO.class));
    createTable(jdbi, engine, "context_file");
    createTable(jdbi, engine, "knowledge_center");
    assertFileWrites(jdbi);
    assertPageWrites(jdbi);
  }

  private void createTable(Jdbi jdbi, String engine, String table) throws IOException {
    Path migration =
        Path.of(
            System.getProperty("basedir"),
            "..",
            "bootstrap",
            "sql",
            "migrations",
            "native",
            "2.0.0",
            engine,
            "schemaChanges.sql");
    String schema = Files.readString(migration);
    int start = schema.indexOf("CREATE TABLE IF NOT EXISTS " + table + " (");
    String statement = schema.substring(start, schema.indexOf(';', start) + 1);
    jdbi.useHandle(handle -> handle.execute(statement));
  }

  private void assertPageWrites(Jdbi jdbi) {
    KnowledgePageRepository repository = new KnowledgePageRepository(jdbi);
    Page snapshot =
        new Page()
            .withId(UUID.randomUUID())
            .withName("page")
            .withFullyQualifiedName("page")
            .withPageType(PageType.ARTICLE)
            .withPage(new Article())
            .withVersion(0.2)
            .withUpdatedAt(100L)
            .withUpdatedBy(Entity.ADMIN_USER_NAME)
            .withDescription("Original body");
    repository.storeEntity(snapshot, false);
    Page edited =
        JsonUtils.deepCopy(snapshot, Page.class)
            .withUpdatedAt(101L)
            .withDescription("Current body");
    repository.storeEntity(edited, true);
    Page result =
        JsonUtils.deepCopy(snapshot, Page.class)
            .withVersion(0.3)
            .withUpdatedAt(102L)
            .withProcessingStatus(PageProcessingStatus.Processed);

    assertThrows(
        PreconditionFailedException.class,
        () -> repository.storeEntityWithVersion(result, true, 0.2, 100L));
    assertEquals(edited.getDescription(), readPage(jdbi, snapshot.getId()).getDescription());

    Page refreshed =
        JsonUtils.deepCopy(edited, Page.class)
            .withVersion(0.3)
            .withUpdatedAt(102L)
            .withProcessingStatus(PageProcessingStatus.Processed);
    EntityReference parent = new EntityReference().withId(UUID.randomUUID()).withType(Entity.PAGE);
    refreshed.setParent(parent);
    repository.storeEntityWithVersion(refreshed, true, 0.2, 101L);
    assertEquals(parent, refreshed.getParent());
    refreshed.setParent(null);
    assertEquals(
        JsonUtils.valueToTree(refreshed), JsonUtils.valueToTree(readPage(jdbi, snapshot.getId())));

    Page legacy = JsonUtils.deepCopy(refreshed, Page.class).withVersion(0.4).withUpdatedAt(103L);
    repository.storeEntityWithVersion(legacy, true, 0.3, null);
    assertEquals(
        JsonUtils.valueToTree(legacy), JsonUtils.valueToTree(readPage(jdbi, snapshot.getId())));
  }

  private Page readPage(Jdbi jdbi, UUID id) {
    return jdbi.onDemand(KnowledgeAssetDAOs.KnowledgePageDAO.class).findEntityById(id);
  }

  private void assertFileWrites(Jdbi jdbi) {
    ContextFileRepository repository = new ContextFileRepository(jdbi);
    ContextFile snapshot =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withName("report")
            .withFullyQualifiedName("report")
            .withVersion(0.2)
            .withUpdatedAt(100L)
            .withUpdatedBy(Entity.ADMIN_USER_NAME)
            .withProcessingStatus(ProcessingStatus.Analyzing);
    repository.storeEntity(snapshot, false);
    ContextFile edited =
        JsonUtils.deepCopy(snapshot, ContextFile.class)
            .withUpdatedAt(101L)
            .withDescription("Updated description")
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));
    repository.storeEntity(edited, true);
    ContextFile result =
        JsonUtils.deepCopy(snapshot, ContextFile.class)
            .withVersion(0.3)
            .withUpdatedAt(102L)
            .withProcessingStatus(ProcessingStatus.Processed)
            .withExtractedText("Extracted text");

    assertThrows(
        PreconditionFailedException.class,
        () -> repository.storeEntityWithVersion(result, true, 0.2, 100L));
    assertEquals(edited, readFile(jdbi, snapshot.getId()));

    ContextFile refreshed = JsonUtils.deepCopy(edited, ContextFile.class);
    refreshed.setProcessingStatus(result.getProcessingStatus());
    refreshed.setExtractedText(result.getExtractedText());
    refreshed.setVersion(result.getVersion());
    refreshed.setUpdatedAt(result.getUpdatedAt());
    repository.storeEntityWithVersion(refreshed, true, 0.2, 101L);
    assertEquals(refreshed, readFile(jdbi, snapshot.getId()));

    assertThrows(
        PreconditionFailedException.class,
        () -> repository.storeEntityWithVersion(result, true, 0.2, 102L));

    ContextFile legacy =
        JsonUtils.deepCopy(refreshed, ContextFile.class).withVersion(0.4).withUpdatedAt(103L);
    repository.storeEntityWithVersion(legacy, true, 0.3, null);
    assertEquals(legacy, readFile(jdbi, snapshot.getId()));
  }

  private ContextFile readFile(Jdbi jdbi, UUID id) {
    return jdbi.onDemand(KnowledgeAssetDAOs.ContextFileDAO.class).findEntityById(id);
  }
}
