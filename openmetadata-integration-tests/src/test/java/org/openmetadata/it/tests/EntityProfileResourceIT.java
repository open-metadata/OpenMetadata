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

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for entity profile and usage data operations.
 *
 * <p>Tests profile data submission and retrieval for tables including: - Adding table profile data
 * - Adding column profile data - Retrieving latest profile data - Retrieving profile data with
 * query parameters
 *
 * <p>Test isolation: Uses TestNamespace for unique entity naming Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class EntityProfileResourceIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @Test
  void testAddTableProfile(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTable(ns);

    Long timestamp = System.currentTimeMillis();
    TableProfile tableProfile =
        new TableProfile()
            .withTimestamp(timestamp)
            .withRowCount(1000.0)
            .withColumnCount(5.0)
            .withSizeInByte(50000.0);

    CreateTableProfile createTableProfile = new CreateTableProfile().withTableProfile(tableProfile);

    String path = "/v1/tables/" + table.getId() + "/tableProfile";
    Table updatedTable =
        client.getHttpClient().execute(HttpMethod.PUT, path, createTableProfile, Table.class);

    assertNotNull(updatedTable);
    assertEquals(table.getId(), updatedTable.getId());

    Table retrievedTable =
        getTableWithProfile(
            client, table.getFullyQualifiedName(), timestamp - 1000, timestamp + 1000);
    assertNotNull(retrievedTable);
    assertNotNull(retrievedTable.getProfile());
    assertEquals(1000.0, retrievedTable.getProfile().getRowCount());
    assertEquals(5.0, retrievedTable.getProfile().getColumnCount());
  }

  @Test
  void testAddTableAndColumnProfile(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTable(ns);

    Long timestamp = System.currentTimeMillis();
    TableProfile tableProfile =
        new TableProfile()
            .withTimestamp(timestamp)
            .withRowCount(2500.0)
            .withColumnCount(5.0)
            .withSizeInByte(125000.0);

    ColumnProfile idColumnProfile =
        new ColumnProfile()
            .withName("id")
            .withTimestamp(timestamp)
            .withValuesCount(2500.0)
            .withUniqueCount(2500.0)
            .withNullCount(0.0)
            .withDistinctCount(2500.0);

    ColumnProfile nameColumnProfile =
        new ColumnProfile()
            .withName("name")
            .withTimestamp(timestamp)
            .withValuesCount(2500.0)
            .withUniqueCount(2450.0)
            .withNullCount(50.0)
            .withDistinctCount(2450.0);

    CreateTableProfile createTableProfile =
        new CreateTableProfile()
            .withTableProfile(tableProfile)
            .withColumnProfile(List.of(idColumnProfile, nameColumnProfile));

    String path = "/v1/tables/" + table.getId() + "/tableProfile";
    Table updatedTable =
        client.getHttpClient().execute(HttpMethod.PUT, path, createTableProfile, Table.class);

    assertNotNull(updatedTable);
    assertEquals(table.getId(), updatedTable.getId());

    Table retrievedTable =
        getTableWithProfile(
            client, table.getFullyQualifiedName(), timestamp - 1000, timestamp + 1000);
    assertNotNull(retrievedTable);
    assertNotNull(retrievedTable.getProfile());
    assertEquals(2500.0, retrievedTable.getProfile().getRowCount());

    assertNotNull(retrievedTable.getColumns());
    Column retrievedIdColumn =
        retrievedTable.getColumns().stream()
            .filter(col -> "id".equals(col.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(retrievedIdColumn);
    assertNotNull(retrievedIdColumn.getProfile());
    assertEquals(2500.0, retrievedIdColumn.getProfile().getValuesCount());
    assertEquals(2500.0, retrievedIdColumn.getProfile().getUniqueCount());

    Column retrievedNameColumn =
        retrievedTable.getColumns().stream()
            .filter(col -> "name".equals(col.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(retrievedNameColumn);
    assertNotNull(retrievedNameColumn.getProfile());
    assertEquals(2500.0, retrievedNameColumn.getProfile().getValuesCount());
    assertEquals(50.0, retrievedNameColumn.getProfile().getNullCount());
  }

  @Test
  void testGetLatestTableProfile(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTable(ns);

    Long timestamp1 = System.currentTimeMillis() - 10000;
    TableProfile tableProfile1 =
        new TableProfile().withTimestamp(timestamp1).withRowCount(1000.0).withColumnCount(5.0);

    CreateTableProfile createTableProfile1 =
        new CreateTableProfile().withTableProfile(tableProfile1);

    String path = "/v1/tables/" + table.getId() + "/tableProfile";
    client.getHttpClient().execute(HttpMethod.PUT, path, createTableProfile1, Table.class);

    Long timestamp2 = System.currentTimeMillis();
    TableProfile tableProfile2 =
        new TableProfile().withTimestamp(timestamp2).withRowCount(1500.0).withColumnCount(5.0);

    CreateTableProfile createTableProfile2 =
        new CreateTableProfile().withTableProfile(tableProfile2);

    client.getHttpClient().execute(HttpMethod.PUT, path, createTableProfile2, Table.class);

    String latestPath = "/v1/tables/" + table.getFullyQualifiedName() + "/tableProfile/latest";
    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, latestPath, null, null);

    assertNotNull(response);
    Table tableWithLatestProfile = OBJECT_MAPPER.readValue(response, Table.class);
    assertNotNull(tableWithLatestProfile);
    assertNotNull(tableWithLatestProfile.getProfile());
    assertEquals(1500.0, tableWithLatestProfile.getProfile().getRowCount());
    assertTrue(tableWithLatestProfile.getProfile().getTimestamp() >= timestamp1);
  }

  @Test
  void testAddMultipleProfileSnapshots(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTable(ns);
    String path = "/v1/tables/" + table.getId() + "/tableProfile";

    for (int i = 0; i < 3; i++) {
      Long timestamp = System.currentTimeMillis() - (2 - i) * 5000;
      TableProfile tableProfile =
          new TableProfile()
              .withTimestamp(timestamp)
              .withRowCount(1000.0 + (i * 500.0))
              .withColumnCount(5.0)
              .withSizeInByte(50000.0 + (i * 25000.0));

      ColumnProfile idColumnProfile =
          new ColumnProfile()
              .withName("id")
              .withTimestamp(timestamp)
              .withValuesCount(1000.0 + (i * 500.0))
              .withUniqueCount(1000.0 + (i * 500.0))
              .withNullCount(0.0);

      CreateTableProfile createTableProfile =
          new CreateTableProfile()
              .withTableProfile(tableProfile)
              .withColumnProfile(List.of(idColumnProfile));

      client.getHttpClient().execute(HttpMethod.PUT, path, createTableProfile, Table.class);
    }

    Long startTs = System.currentTimeMillis() - 15000;
    Long endTs = System.currentTimeMillis() + 1000;

    Table retrievedTable =
        getTableWithProfile(client, table.getFullyQualifiedName(), startTs, endTs);
    assertNotNull(retrievedTable);
    assertNotNull(retrievedTable.getProfile());
    assertTrue(retrievedTable.getProfile().getRowCount() >= 1000.0);
  }

  @Test
  void testProfileDataWithEmptyColumnProfile(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTable(ns);

    Long timestamp = System.currentTimeMillis();
    TableProfile tableProfile =
        new TableProfile()
            .withTimestamp(timestamp)
            .withRowCount(500.0)
            .withColumnCount(5.0)
            .withSizeInByte(25000.0);

    CreateTableProfile createTableProfile =
        new CreateTableProfile().withTableProfile(tableProfile).withColumnProfile(List.of());

    String path = "/v1/tables/" + table.getId() + "/tableProfile";
    Table updatedTable =
        client.getHttpClient().execute(HttpMethod.PUT, path, createTableProfile, Table.class);

    assertNotNull(updatedTable);

    Table retrievedTable =
        getTableWithProfile(
            client, table.getFullyQualifiedName(), timestamp - 1000, timestamp + 1000);
    assertNotNull(retrievedTable);
    assertNotNull(retrievedTable.getProfile());
    assertEquals(500.0, retrievedTable.getProfile().getRowCount());
  }

  @Test
  void testGetProfileWithDateRange(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTable(ns);
    String path = "/v1/tables/" + table.getId() + "/tableProfile";

    Long oldTimestamp = System.currentTimeMillis() - 20000;
    TableProfile oldProfile =
        new TableProfile().withTimestamp(oldTimestamp).withRowCount(100.0).withColumnCount(5.0);

    CreateTableProfile createOldProfile = new CreateTableProfile().withTableProfile(oldProfile);
    client.getHttpClient().execute(HttpMethod.PUT, path, createOldProfile, Table.class);

    Long recentTimestamp = System.currentTimeMillis();
    TableProfile recentProfile =
        new TableProfile().withTimestamp(recentTimestamp).withRowCount(2000.0).withColumnCount(5.0);

    CreateTableProfile createRecentProfile =
        new CreateTableProfile().withTableProfile(recentProfile);
    client.getHttpClient().execute(HttpMethod.PUT, path, createRecentProfile, Table.class);

    Table recentTable =
        getTableWithProfile(
            client, table.getFullyQualifiedName(), recentTimestamp - 5000, recentTimestamp + 1000);
    assertNotNull(recentTable);
    assertNotNull(recentTable.getProfile());
    assertEquals(2000.0, recentTable.getProfile().getRowCount());
  }

  private Table createTestTable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable request = new CreateTable();
    request.setName(ns.prefix("profileTable"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setDescription("Test table for profile data");

    List<Column> columns =
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build(),
            ColumnBuilder.of("email", "VARCHAR").dataLength(255).build(),
            ColumnBuilder.of("created_at", "TIMESTAMP").build(),
            ColumnBuilder.of("updated_at", "TIMESTAMP").build());
    request.setColumns(columns);

    return client.tables().create(request);
  }

  private Table getTableWithProfile(OpenMetadataClient client, String fqn, Long startTs, Long endTs)
      throws Exception {
    String path = "/v1/tables/" + fqn + "/tableProfile";

    RequestOptions options =
        RequestOptions.builder()
            .queryParam("startTs", String.valueOf(startTs))
            .queryParam("endTs", String.valueOf(endTs))
            .build();

    String response = client.getHttpClient().executeForString(HttpMethod.GET, path, null, options);

    return OBJECT_MAPPER.readValue(response, Table.class);
  }
}
