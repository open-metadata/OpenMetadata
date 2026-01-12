/*
 *  Copyright 2022 Collate
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for verifying service connection access control.
 *
 * <p>These tests verify that: - Data Consumer role cannot access service connection details via API
 * - Admin users can access service connection details - Bot users can access service connection
 * details - Data Consumer can access data assets (tables, etc.)
 *
 * <p>This addresses the issue where a user with only "Data Consumer" role could access service
 * connections via the API despite not having access via the UI.
 */
@Execution(ExecutionMode.CONCURRENT)
public class ServiceConnectionAccessIT {

  /**
   * Test that Data Consumer role cannot view messaging service details. The DataConsumerPolicy now
   * uses "dataAsset" instead of "all" resources, so services should not be accessible.
   */
  @Test
  void testDataConsumerCannotViewMessagingService(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();

    MessagingService service = MessagingServiceTestFactory.createKafka(ns);
    assertNotNull(service);
    assertNotNull(service.getId());

    User dataConsumerUser = UserTestFactory.createDataConsumerUser(ns, "consumer_msg_test");
    assertNotNull(dataConsumerUser);

    OpenMetadataClient dataConsumerClient =
        SdkClients.createClient(
            dataConsumerUser.getName(), dataConsumerUser.getEmail(), new String[] {"DataConsumer"});

    assertThrows(
        OpenMetadataException.class,
        () -> dataConsumerClient.messagingServices().get(service.getId().toString()),
        "Data Consumer should not be able to view messaging service");

    cleanupService(adminClient, service.getId().toString());
    cleanupUser(adminClient, dataConsumerUser);
  }

  /**
   * Test that Data Consumer role cannot view database service details. The DataConsumerPolicy now
   * uses "dataAsset" instead of "all" resources, so services should not be accessible.
   */
  @Test
  void testDataConsumerCannotViewDatabaseService(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    assertNotNull(service);
    assertNotNull(service.getId());

    User dataConsumerUser = UserTestFactory.createDataConsumerUser(ns, "consumer_db_test");
    assertNotNull(dataConsumerUser);

    OpenMetadataClient dataConsumerClient =
        SdkClients.createClient(
            dataConsumerUser.getName(), dataConsumerUser.getEmail(), new String[] {"DataConsumer"});

    assertThrows(
        OpenMetadataException.class,
        () -> dataConsumerClient.databaseServices().get(service.getId().toString()),
        "Data Consumer should not be able to view database service");

    cleanupUser(adminClient, dataConsumerUser);
  }

  /**
   * Test that Admin can access service connection details. Admin should always have full access to
   * all resources including services.
   */
  @Test
  void testAdminCanViewMessagingService(TestNamespace ns) {
    OpenMetadataClient adminClient = SdkClients.adminClient();

    MessagingService service = MessagingServiceTestFactory.createKafka(ns);
    assertNotNull(service);
    assertNotNull(service.getId());

    MessagingService fetchedService =
        adminClient.messagingServices().get(service.getId().toString());
    assertNotNull(fetchedService);
    assertEquals(service.getName(), fetchedService.getName());

    cleanupService(adminClient, service.getId().toString());
  }

  /**
   * Test that Data Consumer can still access data assets (tables). The dataAsset resource group
   * should allow access to tables and other data assets.
   */
  @Test
  void testDataConsumerCanViewTable(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();

    Table table = TableTestFactory.createSimple(ns);
    assertNotNull(table);
    assertNotNull(table.getId());

    User dataConsumerUser = UserTestFactory.createDataConsumerUser(ns, "consumer_table_test");
    assertNotNull(dataConsumerUser);

    OpenMetadataClient dataConsumerClient =
        SdkClients.createClient(
            dataConsumerUser.getName(), dataConsumerUser.getEmail(), new String[] {"DataConsumer"});

    Table fetchedTable = dataConsumerClient.tables().get(table.getId().toString());
    assertNotNull(fetchedTable);
    assertEquals(table.getName(), fetchedTable.getName());

    cleanupUser(adminClient, dataConsumerUser);
  }

  /**
   * Test that Data Consumer has ViewAll permission on tables but not on services. This verifies the
   * dataAsset resource group is working correctly.
   */
  @Test
  void testDataConsumerPermissionsOnTableVsService(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();

    User dataConsumerUser = UserTestFactory.createDataConsumerUser(ns, "consumer_perms_test");
    assertNotNull(dataConsumerUser);

    OpenMetadataClient dataConsumerClient =
        SdkClients.createClient(
            dataConsumerUser.getName(), dataConsumerUser.getEmail(), new String[] {"DataConsumer"});

    ResourcePermission tablePermissions = getPermissionForResource(dataConsumerClient, "table");
    assertNotNull(tablePermissions);

    boolean hasTableViewAll =
        tablePermissions.getPermissions().stream()
            .anyMatch(
                p ->
                    p.getOperation() == MetadataOperation.VIEW_ALL
                        && p.getAccess() == Permission.Access.ALLOW);
    assertTrue(hasTableViewAll, "Data Consumer should have VIEW_ALL permission on tables");

    ResourcePermission msgServicePermissions =
        getPermissionForResource(dataConsumerClient, "messagingService");
    assertNotNull(msgServicePermissions);

    boolean hasServiceViewAll =
        msgServicePermissions.getPermissions().stream()
            .anyMatch(
                p ->
                    p.getOperation() == MetadataOperation.VIEW_ALL
                        && p.getAccess() == Permission.Access.ALLOW);
    assertFalse(
        hasServiceViewAll,
        "Data Consumer should NOT have VIEW_ALL permission on messaging services");

    cleanupUser(adminClient, dataConsumerUser);
  }

  /**
   * Test that permissions debug endpoint correctly shows dataAsset-based permissions.
   */
  @Test
  void testDataConsumerPermissionsDebug(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();

    User dataConsumerUser = UserTestFactory.createDataConsumerUser(ns, "consumer_debug_test");
    assertNotNull(dataConsumerUser);

    String debugResponse =
        adminClient
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/permissions/debug/user/" + dataConsumerUser.getName(), null);

    assertNotNull(debugResponse);
    assertTrue(debugResponse.contains("DataConsumer") || debugResponse.contains("dataConsumer"));

    cleanupUser(adminClient, dataConsumerUser);
  }

  private ResourcePermission getPermissionForResource(OpenMetadataClient client, String resource)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/permissions/" + resource, null);
    return new com.fasterxml.jackson.databind.ObjectMapper()
        .readValue(response, ResourcePermission.class);
  }

  private void cleanupService(OpenMetadataClient client, String serviceId) {
    try {
      java.util.Map<String, String> params = new java.util.HashMap<>();
      params.put("hardDelete", "true");
      params.put("recursive", "true");
      client.messagingServices().delete(serviceId, params);
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  private void cleanupUser(OpenMetadataClient client, User user) {
    try {
      java.util.Map<String, String> params = new java.util.HashMap<>();
      params.put("hardDelete", "true");
      client.users().delete(user.getId().toString(), params);
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }
}
