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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.testcontainers.containers.JdbcDatabaseContainer;

/**
 * An {@code assets/add} that overlaps the hard delete of the same data product must not leave an
 * {@code entity_relationship} row whose data product is gone (#33741). Each test holds a row lock
 * on a connection of its own to stop one side part-way through its transaction, so the two
 * requests interleave the same way on every run instead of racing.
 */
// The two tests run one after the other so neither counts the other's lock waits as its own.
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
@Slf4j
class DataProductDeleteRaceIT {

  private static final Duration BLOCKED_WITHIN = Duration.ofSeconds(60);
  private static final String MYSQL_LOCK_WAITS =
      """
      SELECT trx_query FROM information_schema.innodb_trx WHERE trx_state = 'LOCK WAIT'""";
  private static final String POSTGRES_LOCK_WAITS =
      """
      SELECT query FROM pg_stat_activity
      WHERE wait_event_type = 'Lock' AND datname = current_database()""";
  private static final String DATA_PRODUCT_ROWS =
      """
      SELECT COUNT(*) FROM data_product_entity WHERE id = :id""";
  private static final String EDGES_OF =
      """
      SELECT COUNT(*) FROM entity_relationship WHERE fromId = :id OR toId = :id""";
  private static ExecutorService requests;
  private static Jdbi lockProbe;

  @BeforeAll
  static void setUp() {
    requests = Executors.newCachedThreadPool();
    lockProbe = lockProbe();
  }

  @AfterAll
  static void tearDown() {
    requests.shutdownNow();
  }

  /**
   * The delete has already swept the data product's edges and is held before it removes the row.
   * An add arriving now must not write an edge the finished delete never sees.
   */
  @Test
  void addDuringDeleteWritesNoEdgeForTheDeletedDataProduct(TestNamespace ns) throws Exception {
    DataProduct dataProduct = createDataProduct(ns);
    Table table = createTable(ns, dataProduct);
    String dataProductId = dataProduct.getId().toString();

    CompletableFuture<?> delete;
    CompletableFuture<?> add;
    Handle holder = holdRow("data_product_entity", dataProductId);
    try {
      delete = async(() -> hardDelete(dataProduct));
      awaitBlocked(delete, 1, List.of(dataProductId), List.of("data_product_entity"));
      add = async(() -> addAsset(dataProduct, table));
      awaitBlocked(
          add, 2, List.of(dataProductId), List.of("data_product_entity", "entity_relationship"));
    } finally {
      release(holder);
    }
    awaitBoth(delete, add);

    assertNoEdgesFrom(dataProductId);
  }

  /**
   * The add has written its edge and is held before it saves the asset. A delete arriving now
   * must remove that edge rather than sweep before it commits.
   */
  @Test
  void deleteDuringAddRemovesTheEdgeTheAddWrote(TestNamespace ns) throws Exception {
    DataProduct dataProduct = createDataProduct(ns);
    Table table = createTable(ns, dataProduct);
    String dataProductId = dataProduct.getId().toString();
    String tableId = table.getId().toString();

    CompletableFuture<?> add;
    CompletableFuture<?> delete;
    Handle holder = holdRow("table_entity", tableId);
    try {
      add = async(() -> addAsset(dataProduct, table));
      awaitBlocked(add, 1, List.of(tableId), List.of("table_entity"));
      delete = async(() -> hardDelete(dataProduct));
      awaitBlocked(
          delete,
          2,
          List.of(tableId, dataProductId),
          List.of("table_entity", "data_product_entity", "entity_relationship"));
    } finally {
      release(holder);
    }
    awaitBoth(add, delete);

    assertNoEdgesFrom(dataProductId);
  }

  private static DataProduct createDataProduct(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("domain"))
                    .withDomainType(DomainType.AGGREGATE)
                    .withDescription("Domain of a data product deleted mid-request"));
    return client
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.prefix("dataProduct"))
                .withDescription("Data product deleted mid-request")
                .withDomains(List.of(domain.getFullyQualifiedName())));
  }

  private static Table createTable(TestNamespace ns, DataProduct dataProduct) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix("table"))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withDomains(List.of(dataProduct.getDomains().get(0).getFullyQualifiedName()))
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private static void addAsset(DataProduct dataProduct, Table table) {
    try {
      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.PUT,
              "/v1/dataProducts/%s/assets/add".formatted(dataProduct.getFullyQualifiedName()),
              new BulkAssets().withAssets(List.of(table.getEntityReference())),
              BulkOperationResult.class);
    } catch (OpenMetadataException e) {
      // Which request wins is the database's choice; only the rows left behind are asserted.
      log.info("assets/add lost the race to the delete: {}", e.getMessage());
    }
  }

  private static void hardDelete(DataProduct dataProduct) {
    SdkClients.adminClient()
        .dataProducts()
        .delete(dataProduct.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
  }

  /** Opens a transaction that holds {@code id}'s row in {@code table} until it is released. */
  private static Handle holdRow(String table, String id) {
    Handle handle = TestSuiteBootstrap.getJdbi().open();
    handle.begin();
    handle
        .createQuery("SELECT id FROM %s WHERE id = :id FOR UPDATE".formatted(table))
        .bind("id", id)
        .mapTo(String.class)
        .one();
    return handle;
  }

  private static void release(Handle holder) {
    holder.rollback();
    holder.close();
  }

  private static CompletableFuture<?> async(Runnable request) {
    return CompletableFuture.runAsync(request, requests);
  }

  /**
   * Waits until {@code request} has returned or {@code waiters} statements are waiting on a row
   * lock. MySQL shows the bound values, so its statements are matched on the ids; Postgres shows
   * placeholders, so its statements are matched on the tables.
   */
  private static void awaitBlocked(
      CompletableFuture<?> request, int waiters, List<String> ids, List<String> tables) {
    boolean mysql = TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL;
    List<String> needles = mysql ? ids : tables;
    Awaitility.await("request done or %d statements waiting on a row lock".formatted(waiters))
        .pollInterval(Duration.ofMillis(50))
        .atMost(BLOCKED_WITHIN)
        .until(() -> request.isDone() || lockWaiters(mysql, needles) >= waiters);
  }

  private static long lockWaiters(boolean mysql, List<String> needles) {
    String waiting = mysql ? MYSQL_LOCK_WAITS : POSTGRES_LOCK_WAITS;
    List<String> statements =
        lockProbe.withHandle(h -> h.createQuery(waiting).mapTo(String.class).list());
    return statements.stream()
        .filter(sql -> sql != null && needles.stream().anyMatch(sql::contains))
        .count();
  }

  private static void awaitBoth(CompletableFuture<?> first, CompletableFuture<?> second)
      throws Exception {
    CompletableFuture.allOf(first, second)
        .exceptionally(e -> null)
        .get(BLOCKED_WITHIN.toSeconds(), TimeUnit.SECONDS);
  }

  private static void assertNoEdgesFrom(String dataProductId) {
    assertEquals(0, countRows(DATA_PRODUCT_ROWS, dataProductId), "The data product is deleted");
    assertEquals(
        0,
        countRows(EDGES_OF, dataProductId),
        "No relationship row may outlive the deleted data product");
  }

  private static long countRows(String query, String id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(h -> h.createQuery(query).bind("id", id).mapTo(Long.class).one());
  }

  /** innodb_trx needs the PROCESS privilege, which the suite's own test user does not have. */
  private static Jdbi lockProbe() {
    Jdbi probe = TestSuiteBootstrap.getJdbi();
    if (TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL) {
      JdbcDatabaseContainer<?> mysql =
          (JdbcDatabaseContainer<?>) TestSuiteBootstrap.getDatabaseContainer();
      probe = Jdbi.create(mysql.getJdbcUrl(), "root", mysql.getPassword());
    }
    return probe;
  }
}
