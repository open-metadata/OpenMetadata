/*
 *  Copyright 2026 Collate
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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
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
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.testcontainers.containers.JdbcDatabaseContainer;

/**
 * Atomicity guard for the Data Product bulk-ports write path ({@code bulkAddInputPorts} /
 * {@code bulkRemoveInputPorts} and the two output-port siblings). The whole ports write — N
 * relationship rows, the change-event insert, and the entity version store — must share one
 * transaction so a mid-flow failure (or a blocked observe) leaves no partially-committed state.
 * The previous code annotated the private {@code bulkPortsOperation} with {@code @Transaction},
 * which is inert on a plain repository class (repositories are instantiated via reflection, not as
 * JDBI SQL-object proxies), so each on-demand DAO call auto-committed on its own connection.
 *
 * <p>These tests pin the post-fix behavior by holding a row lock on the {@code data_product_entity}
 * row so the bulk operation blocks at {@code recordPortChange}'s {@code storeEntity} update —
 * <em>after</em> {@code linkPorts} has already issued its per-port {@code addRelationship} /
 * {@code deleteRelationship} statements. While the request is blocked there, a second connection
 * reads {@code entity_relationship} and {@code change_event}: with the fix, nothing is visible
 * (the per-port writes are uncommitted, held in the same {@code executeInTransaction} scope),
 * whereas the pre-fix autocommit-per-statement path would have left the earlier writes committed
 * and visible. After releasing the lock the request completes and the whole batch lands at once.
 *
 * <p>Runs in the serial global-state lane, like {@link DataProductDeleteRaceIT}, because the lock
 * probe observes every session's waits and would miscount under concurrent tests.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
@Slf4j
class DataProductPortsAtomicityIT {

  private static final Duration BLOCKED_WITHIN = Duration.ofSeconds(60);
  private static final int PORT_COUNT = 4;
  // The blocked bulk-port request waits on the data product row at storeEntity time, after
  // linkPorts has issued its per-port relationship writes.
  private static final List<String> BLOCK_TABLES = List.of("data_product_entity");
  private static final int INPUT_PORT_ORDINAL = Relationship.INPUT_PORT.ordinal();
  private static final String EDGES_OF_INPUT_PORTS =
      """
      SELECT COUNT(*) FROM entity_relationship
      WHERE fromId = :id AND fromEntity = 'dataProduct' AND relation = %d AND deleted = FALSE"""
          .formatted(INPUT_PORT_ORDINAL);

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
   * A bulk input-port add blocked at the entity store must not have exposed any of its per-port
   * relationship rows. Pre-fix those rows auto-committed one at a time and were visible; post-fix
   * they sit uncommitted inside the single {@code executeInTransaction} scope and are invisible to
   * a second connection until the whole batch commits.
   */
  @Test
  void bulkAddInputPortsBlockedMidFlowExposesNoPartialRows(TestNamespace ns) throws Exception {
    DataProduct dataProduct = createDataProduct(ns);
    List<Table> tables = createTables(ns, dataProduct, PORT_COUNT);
    UUID dataProductId = dataProduct.getId();

    CompletableFuture<BulkOperationResult> add;
    Handle holder = holdRow("data_product_entity", dataProductId.toString());
    try {
      add = async(() -> bulkAddInputPorts(dataProduct, tables));
      awaitBlocked(add, 1, BLOCK_TABLES);
      // The headline atomicity assertion: none of the per-port relationship rows committed yet.
      assertEquals(
          0L,
          countRows(EDGES_OF_INPUT_PORTS, dataProductId.toString()),
          "No input-port relationship row may be visible while the bulk add is blocked at the"
              + " entity store — the per-port writes must share the bulk operation's transaction");
      // The entity version has not advanced either: the version bump lives in storeEntity, which
      // is blocked behind the held row lock, so a fresh read still sees the pre-request version.
      DataProduct fresh = SdkClients.adminClient().dataProducts().get(dataProductId.toString());
      assertEquals(
          dataProduct.getVersion(),
          fresh.getVersion(),
          "The data product version must not advance until the bulk add commits");
    } finally {
      release(holder);
    }
    BulkOperationResult result = add.get(BLOCKED_WITHIN.toSeconds(), TimeUnit.SECONDS);
    // The whole batch lands at once once the lock is released.
    assertEquals(PORT_COUNT, result.getNumberOfRowsPassed(), "Every eligible port is added");
    assertEquals(0, result.getNumberOfRowsFailed(), "No port failed pre-flight validation");
    assertEquals(
        PORT_COUNT,
        countRows(EDGES_OF_INPUT_PORTS, dataProductId.toString()),
        "All input-port relationship rows are present once the bulk add commits");
  }

  /**
   * A bulk input-port remove blocked at the entity store must not have removed any of its per-port
   * rows yet. With the fix the per-port deletes sit uncommitted in the one transaction; pre-fix
   * each delete auto-committed so a blocked observer would have seen the rows already gone.
   */
  @Test
  void bulkRemoveInputPortsBlockedMidFlowRemovesNoPartialRows(TestNamespace ns) throws Exception {
    DataProduct dataProduct = createDataProduct(ns);
    List<Table> tables = createTables(ns, dataProduct, PORT_COUNT);
    UUID dataProductId = dataProduct.getId();
    // Pre-populate the input ports that the remove will take away.
    bulkAddInputPorts(dataProduct, tables);
    assertEquals(
        PORT_COUNT,
        countRows(EDGES_OF_INPUT_PORTS, dataProductId.toString()),
        "Pre-condition: all input ports are present before the remove");

    CompletableFuture<BulkOperationResult> remove;
    Handle holder = holdRow("data_product_entity", dataProductId.toString());
    try {
      remove = async(() -> bulkRemoveInputPorts(dataProduct, tables));
      awaitBlocked(remove, 1, BLOCK_TABLES);
      // The headline atomicity assertion: no per-port delete committed yet.
      assertEquals(
          PORT_COUNT,
          countRows(EDGES_OF_INPUT_PORTS, dataProductId.toString()),
          "No input-port relationship row may be removed while the bulk remove is blocked at the"
              + " entity store — the per-port deletes must share the bulk operation's transaction");
    } finally {
      release(holder);
    }
    BulkOperationResult result = remove.get(BLOCKED_WITHIN.toSeconds(), TimeUnit.SECONDS);
    assertEquals(PORT_COUNT, result.getNumberOfRowsPassed(), "Every eligible port is removed");
    assertEquals(
        0,
        countRows(EDGES_OF_INPUT_PORTS, dataProductId.toString()),
        "All input-port relationship rows are gone once the bulk remove commits");
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
                    .withDescription("Domain of a data product whose ports are added mid-request"));
    return client
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.prefix("dataProduct"))
                .withDescription("Data product whose ports are added mid-request")
                .withDomains(List.of(domain.getFullyQualifiedName())));
  }

  private static List<Table> createTables(TestNamespace ns, DataProduct dataProduct, int n) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());
    return java.util.stream.IntStream.range(0, n)
        .mapToObj(
            i ->
                client
                    .tables()
                    .create(
                        new CreateTable()
                            .withName(ns.prefix("table_" + i))
                            .withDatabaseSchema(schema.getFullyQualifiedName())
                            .withDomains(
                                List.of(dataProduct.getDomains().get(0).getFullyQualifiedName()))
                            .withColumns(
                                List.of(
                                    new Column()
                                        .withName("id")
                                        .withDataType(ColumnDataType.BIGINT)))))
        .toList();
  }

  private static BulkOperationResult bulkAddInputPorts(
      DataProduct dataProduct, List<Table> tables) {
    return runBulk(
        HttpMethod.PUT,
        "/v1/dataProducts/%s/inputPorts/add".formatted(dataProduct.getFullyQualifiedName()),
        new BulkAssets().withAssets(tables.stream().map(Table::getEntityReference).toList()));
  }

  private static BulkOperationResult bulkRemoveInputPorts(
      DataProduct dataProduct, List<Table> tables) {
    return runBulk(
        HttpMethod.PUT,
        "/v1/dataProducts/%s/inputPorts/remove".formatted(dataProduct.getFullyQualifiedName()),
        new BulkAssets().withAssets(tables.stream().map(Table::getEntityReference).toList()));
  }

  private static BulkOperationResult runBulk(HttpMethod method, String path, BulkAssets body) {
    try {
      return SdkClients.adminClient()
          .getHttpClient()
          .execute(method, path, body, BulkOperationResult.class);
    } catch (OpenMetadataException e) {
      throw new RuntimeException("Bulk ports request failed: " + e.getMessage(), e);
    }
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

  private static CompletableFuture<BulkOperationResult> async(
      java.util.function.Supplier<BulkOperationResult> request) {
    return CompletableFuture.supplyAsync(request::get, requests);
  }

  /** Waits until {@code request} has returned or {@code waiters} transactions wait on a row lock. */
  private static void awaitBlocked(CompletableFuture<?> request, int waiters, List<String> tables) {
    Awaitility.await("request done or %d statements waiting on a row lock".formatted(waiters))
        .pollInterval(Duration.ofMillis(50))
        .atMost(BLOCKED_WITHIN)
        .until(() -> request.isDone() || lockWaiters(tables) >= waiters);
    assertTrue(
        !request.isDone(),
        "The bulk ports request should be blocked at the data product row, not already finished");
  }

  private static long lockWaiters(List<String> tables) {
    boolean mysql = TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL;
    String waiting = mysql ? MYSQL_LOCK_WAITS : POSTGRES_LOCK_WAITS;
    List<String> statements =
        lockProbe.withHandle(
            h -> h.createQuery(waiting).map((row, ctx) -> row.getString("waiting")).list());
    return statements.stream()
        .filter(sql -> sql != null && tables.stream().anyMatch(table -> mentionsTable(sql, table)))
        .count();
  }

  private static boolean mentionsTable(String sql, String table) {
    return Pattern.compile("\\b%s\\b".formatted(table)).matcher(sql).find();
  }

  private static long countRows(String query, String id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(h -> h.createQuery(query).bind("id", id).mapTo(Long.class).one());
  }

  private static final String MYSQL_LOCK_WAITS =
      """
      SELECT DISTINCT w.REQUESTING_ENGINE_TRANSACTION_ID, l.OBJECT_NAME AS waiting
      FROM performance_schema.data_lock_waits w
      JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID""";
  private static final String POSTGRES_LOCK_WAITS =
      """
      SELECT query AS waiting FROM pg_stat_activity
      WHERE wait_event_type = 'Lock' AND datname = current_database()""";

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

  // Entity referenced for compile-safety; ensures the import resolves in the IT classpath.
  private static final Class<?> ENTITY_HOLDER = Entity.class;
}
