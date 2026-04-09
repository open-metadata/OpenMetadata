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
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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
 * Integration tests for the FQN prefix-based hard deletion endpoint.
 *
 * <p>Verifies that {@code DELETE /v1/services/databaseServices/prefix/{id}} correctly removes the
 * root service and all descendant databases, schemas, and tables in a single bulk operation.
 */
@ExtendWith(TestNamespaceExtension.class)
public class PrefixDeletionIT {

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void prefixDelete_removesServiceAndAllDescendants(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());

    List<UUID> tableIds = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      Table table = TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "t" + i);
      tableIds.add(table.getId());
    }

    prefixDeleteService(service.getId());

    assertEntityGone(() -> SdkClients.adminClient().databaseServices().get(service.getId().toString()), "service");
    assertEntityGone(() -> SdkClients.adminClient().databases().get(database.getId().toString()), "database");
    assertEntityGone(() -> SdkClients.adminClient().databaseSchemas().get(schema.getId().toString()), "schema");
    for (UUID tableId : tableIds) {
      assertEntityGone(() -> SdkClients.adminClient().tables().get(tableId.toString()), "table");
    }
  }

  @Test
  void prefixDelete_serviceWithMultipleDatabasesAndSchemas(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    List<UUID> allDescendantIds = new ArrayList<>();
    for (int d = 0; d < 2; d++) {
      Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
      allDescendantIds.add(database.getId());
      for (int s = 0; s < 2; s++) {
        DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());
        allDescendantIds.add(schema.getId());
        for (int t = 0; t < 3; t++) {
          Table table = TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "t" + d + s + t);
          allDescendantIds.add(table.getId());
        }
      }
    }

    prefixDeleteService(service.getId());

    assertEntityGone(() -> SdkClients.adminClient().databaseServices().get(service.getId().toString()), "service");
    for (UUID id : allDescendantIds) {
      final UUID finalId = id;
      assertThrows(Exception.class, () -> SdkClients.adminClient().tables().get(finalId.toString()));
    }
  }

  @Test
  void prefixDelete_emptyService_deletesJustService(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    assertNotNull(service.getId());

    prefixDeleteService(service.getId());

    assertEntityGone(() -> SdkClients.adminClient().databaseServices().get(service.getId().toString()), "service");
  }

  private void prefixDeleteService(UUID serviceId) throws Exception {
    String url = SdkClients.getServerUrl() + "/v1/services/databaseServices/prefix/" + serviceId;
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .header("Authorization", "Bearer " + SdkClients.getAdminToken())
        .DELETE()
        .build();

    HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(202, response.statusCode(),
        "Expected 202 Accepted from prefix delete, got " + response.statusCode() + ": " + response.body());
  }

  private void assertEntityGone(ThrowingRunnable action, String entityType) {
    assertThrows(Exception.class, action::run,
        entityType + " should be gone after prefix deletion but was still retrievable");
  }

  @FunctionalInterface
  private interface ThrowingRunnable {
    void run() throws Exception;
  }
}
