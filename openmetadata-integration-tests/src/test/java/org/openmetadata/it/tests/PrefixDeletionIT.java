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
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;

/**
 * Integration tests for the FQN prefix-based hard deletion endpoints at each hierarchy level:
 *
 * <ul>
 *   <li>{@code DELETE /v1/services/databaseServices/prefix/{id}} — deletes service + all descendants
 *   <li>{@code DELETE /v1/databases/prefix/{id}} — deletes database + schemas + tables, leaving
 *       sibling databases intact
 *   <li>{@code DELETE /v1/databaseSchemas/prefix/{id}} — deletes schema + tables, leaving sibling
 *       schemas intact
 * </ul>
 *
 * <p>The endpoint is async (returns 202 with a jobId). All assertions use Awaitility to poll until
 * the background deletion actually completes.
 */
@ExtendWith(TestNamespaceExtension.class)
public class PrefixDeletionIT {

  private static final Duration DELETE_TIMEOUT = Duration.ofSeconds(30);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(1);

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  // ── Service-level ────────────────────────────────────────────────────────────

  @Test
  void prefixDelete_service_removesServiceAndAllDescendants(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());

    List<UUID> tableIds = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      Table table = TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "t" + i);
      tableIds.add(table.getId());
    }

    prefixDelete("/v1/services/databaseServices/prefix/", service.getId());

    awaitGone("service", () -> SdkClients.adminClient().databaseServices().get(service.getId().toString()));
    awaitGone("database", () -> SdkClients.adminClient().databases().get(database.getId().toString()));
    awaitGone("schema", () -> SdkClients.adminClient().databaseSchemas().get(schema.getId().toString()));
    for (UUID tableId : tableIds) {
      awaitGone("table", () -> SdkClients.adminClient().tables().get(tableId.toString()));
    }
  }

  @Test
  void prefixDelete_service_withMultipleDatabasesAndSchemas(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    List<UUID> dbIds = new ArrayList<>();
    List<UUID> schemaIds = new ArrayList<>();
    List<UUID> tableIds = new ArrayList<>();

    for (int d = 0; d < 2; d++) {
      Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
      dbIds.add(database.getId());
      for (int s = 0; s < 2; s++) {
        DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());
        schemaIds.add(schema.getId());
        for (int t = 0; t < 3; t++) {
          Table table = TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "t" + d + s + t);
          tableIds.add(table.getId());
        }
      }
    }

    prefixDelete("/v1/services/databaseServices/prefix/", service.getId());

    awaitGone("service", () -> SdkClients.adminClient().databaseServices().get(service.getId().toString()));
    for (UUID id : dbIds) {
      awaitGone("database", () -> SdkClients.adminClient().databases().get(id.toString()));
    }
    for (UUID id : schemaIds) {
      awaitGone("schema", () -> SdkClients.adminClient().databaseSchemas().get(id.toString()));
    }
    for (UUID id : tableIds) {
      awaitGone("table", () -> SdkClients.adminClient().tables().get(id.toString()));
    }
  }

  // ── Database-level ────────────────────────────────────────────────────────────

  @Test
  void prefixDelete_database_removesDatabaseAndDescendantsLeavingSiblingDatabaseIntact(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    Database targetDb = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    DatabaseSchema targetSchema = DatabaseSchemaTestFactory.create(ns, targetDb.getFullyQualifiedName());
    Table targetTable = TableTestFactory.createWithName(ns, targetSchema.getFullyQualifiedName(), "tgt");

    Database siblingDb = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    DatabaseSchema siblingSchema = DatabaseSchemaTestFactory.create(ns, siblingDb.getFullyQualifiedName());
    Table siblingTable = TableTestFactory.createWithName(ns, siblingSchema.getFullyQualifiedName(), "sib");

    prefixDelete("/v1/databases/prefix/", targetDb.getId());

    awaitGone("target database", () -> SdkClients.adminClient().databases().get(targetDb.getId().toString()));
    awaitGone("target schema", () -> SdkClients.adminClient().databaseSchemas().get(targetSchema.getId().toString()));
    awaitGone("target table", () -> SdkClients.adminClient().tables().get(targetTable.getId().toString()));

    assertNotNull(SdkClients.adminClient().databases().get(siblingDb.getId().toString()), "sibling database should survive");
    assertNotNull(SdkClients.adminClient().databaseSchemas().get(siblingSchema.getId().toString()), "sibling schema should survive");
    assertNotNull(SdkClients.adminClient().tables().get(siblingTable.getId().toString()), "sibling table should survive");
    assertNotNull(SdkClients.adminClient().databaseServices().get(service.getId().toString()), "service should survive");
  }

  // ── Schema-level ─────────────────────────────────────────────────────────────

  @Test
  void prefixDelete_schema_removesSchemaAndTablesLeavingSiblingSchemaIntact(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());

    DatabaseSchema targetSchema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());
    List<UUID> targetTableIds = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      Table table = TableTestFactory.createWithName(ns, targetSchema.getFullyQualifiedName(), "tgt" + i);
      targetTableIds.add(table.getId());
    }

    DatabaseSchema siblingSchema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());
    Table siblingTable = TableTestFactory.createWithName(ns, siblingSchema.getFullyQualifiedName(), "sib");

    prefixDelete("/v1/databaseSchemas/prefix/", targetSchema.getId());

    awaitGone("target schema", () -> SdkClients.adminClient().databaseSchemas().get(targetSchema.getId().toString()));
    for (UUID tableId : targetTableIds) {
      awaitGone("target table", () -> SdkClients.adminClient().tables().get(tableId.toString()));
    }

    assertNotNull(SdkClients.adminClient().databaseSchemas().get(siblingSchema.getId().toString()), "sibling schema should survive");
    assertNotNull(SdkClients.adminClient().tables().get(siblingTable.getId().toString()), "sibling table should survive");
    assertNotNull(SdkClients.adminClient().databases().get(database.getId().toString()), "database should survive");
    assertNotNull(SdkClients.adminClient().databaseServices().get(service.getId().toString()), "service should survive");
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private void prefixDelete(String path, UUID id) throws Exception {
    String url = SdkClients.getServerUrl() + path + id;
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .header("Authorization", "Bearer " + SdkClients.getAdminToken())
        .DELETE()
        .build();

    HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(202, response.statusCode(),
        "Expected 202 Accepted from prefix delete " + path + id
            + ", got " + response.statusCode() + ": " + response.body());
  }

  /**
   * Polls until the given fetch throws (entity gone) or the timeout elapses.
   * The prefix delete API is async — the 202 only means the job was queued.
   */
  private void awaitGone(String entityType, ThrowingSupplier<?> fetch) {
    Awaitility.await("Wait for " + entityType + " to be deleted")
        .atMost(DELETE_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .until(() -> {
          try {
            fetch.get();
            return false;
          } catch (Exception e) {
            return true;
          }
        });
  }

  @FunctionalInterface
  private interface ThrowingSupplier<T> {
    T get() throws Exception;
  }
}
