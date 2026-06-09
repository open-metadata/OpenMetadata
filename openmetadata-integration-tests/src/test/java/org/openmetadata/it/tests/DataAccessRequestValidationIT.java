/*
 *  Copyright 2024 Collate
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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.services.connections.database.PolicyAgentConfig;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;

/**
 * Integration tests for Data Access Request capability validation in {@link
 * org.openmetadata.service.tasks.TaskFieldValidator#validateDataAccessCapabilities(Task)}.
 *
 * <p>Covers: connectors that have not configured a policy agent (lenient — all access types
 * allowed), connectors that enabled the policy agent with specific support flags (each accessType
 * checked against the matching flag), and Data Product targets (ColumnLevel always rejected
 * because the request can span multiple backing services).
 *
 * <p>Also covers the one-active-request-per-entity rule enforced in {@link
 * org.openmetadata.service.jdbi3.TaskRepository}: a user cannot submit a second active Data Access
 * Request for an entity they already have an active request for, while a different user requesting
 * the same entity, the same user requesting a different entity, or the same user re-requesting an
 * entity whose prior request has reached a terminal status, all remain allowed.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DataAccessRequestValidationIT {

  private static String entityLink(String entityType, String entityFqn) {
    return String.format("<#E::%s::%s>", entityType, entityFqn);
  }

  private static Map<String, Object> dataAccessPayload(String accessType) {
    return Map.of(
        "accessType", accessType,
        "requestedAccess", "Read",
        "reason", "integration-test",
        "duration", "P14D");
  }

  private static Table createTableOnSnowflakeService(
      TestNamespace ns, SnowflakeConnection connection) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String serviceName = ns.prefix("dar_snowflake_" + uniqueId);
    CreateDatabaseService createService =
        new CreateDatabaseService()
            .withName(serviceName)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Snowflake)
            .withConnection(new DatabaseConnection().withConfig(connection));
    DatabaseService service = SdkClients.adminClient().databaseServices().create(createService);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    return TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
  }

  private static SnowflakeConnection baseSnowflakeConnection() {
    return new SnowflakeConnection()
        .withAccount("dar-test")
        .withUsername("dar-user")
        .withWarehouse("dar-warehouse");
  }

  private static DataProduct createDataProductWithDomain(TestNamespace ns) {
    String domainName = ns.prefix("dar_domain");
    Domain domain;
    try {
      domain = SdkClients.adminClient().domains().getByName(domainName);
    } catch (Exception e) {
      domain =
          SdkClients.adminClient()
              .domains()
              .create(
                  new CreateDomain()
                      .withName(domainName)
                      .withDescription("Domain for DAR validation")
                      .withDomainType(DomainType.AGGREGATE));
    }
    return SdkClients.adminClient()
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.prefix("dar_dataproduct"))
                .withDescription("DataProduct for DAR validation")
                .withDomains(List.of(domain.getFullyQualifiedName())));
  }

  private static Task createDataAccessRequest(
      TestNamespace ns, String entityType, String entityFqn, Map<String, Object> payload) {
    return createDataAccessRequest(SdkClients.adminClient(), ns, entityType, entityFqn, payload);
  }

  private static Task createDataAccessRequest(
      OpenMetadataClient client,
      TestNamespace ns,
      String entityType,
      String entityFqn,
      Map<String, Object> payload) {
    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("dar_" + entityType + "_" + UUID.randomUUID()))
            .withCategory(TaskCategory.DataAccess)
            .withType(TaskEntityType.DataAccessRequest)
            .withAbout(entityLink(entityType, entityFqn))
            .withPayload(payload);
    return client.tasks().create(request);
  }

  @Test
  void testDarOnTableWithUnconfiguredPolicyAgent_allowsAllAccessTypes(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());

    Task fullAccessTask =
        createDataAccessRequest(
            ns, "table", table.getFullyQualifiedName(), dataAccessPayload("FullAccess"));
    Task maskedTask =
        createDataAccessRequest(
            ns, "table", table.getFullyQualifiedName(), dataAccessPayload("Masked"));
    Task columnLevelTask =
        createDataAccessRequest(
            ns, "table", table.getFullyQualifiedName(), dataAccessPayload("ColumnLevel"));

    assertNotNull(fullAccessTask.getId());
    assertNotNull(maskedTask.getId());
    assertNotNull(columnLevelTask.getId());
  }

  @Test
  void testDarOnTableWithEnabledPolicyAgent_rejectsUnsupportedColumnLevel(TestNamespace ns) {
    SnowflakeConnection connection =
        baseSnowflakeConnection()
            .withPolicyAgentConfig(
                new PolicyAgentConfig()
                    .withEnabled(true)
                    .withSupportsFullAccess(true)
                    .withSupportsMaskedAccess(true)
                    .withSupportsColumnAccess(false));
    Table table = createTableOnSnowflakeService(ns, connection);

    Task fullAccessTask =
        createDataAccessRequest(
            ns, "table", table.getFullyQualifiedName(), dataAccessPayload("FullAccess"));
    assertNotNull(fullAccessTask.getId());

    Task maskedTask =
        createDataAccessRequest(
            ns, "table", table.getFullyQualifiedName(), dataAccessPayload("Masked"));
    assertNotNull(maskedTask.getId());

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () ->
                createDataAccessRequest(
                    ns, "table", table.getFullyQualifiedName(), dataAccessPayload("ColumnLevel")));
    assertTrue(
        rejection.getMessage().contains("Column-level access is not supported"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }

  @Test
  void testDarOnTableWithEnabledPolicyAgent_rejectsFullAccessWhenUnsupported(TestNamespace ns) {
    SnowflakeConnection connection =
        baseSnowflakeConnection()
            .withPolicyAgentConfig(
                new PolicyAgentConfig()
                    .withEnabled(true)
                    .withSupportsFullAccess(false)
                    .withSupportsMaskedAccess(true)
                    .withSupportsColumnAccess(false));
    Table table = createTableOnSnowflakeService(ns, connection);

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () ->
                createDataAccessRequest(
                    ns, "table", table.getFullyQualifiedName(), dataAccessPayload("FullAccess")));
    assertTrue(
        rejection.getMessage().contains("Full access is not supported"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }

  @Test
  void testDarOnTableWithDisabledPolicyAgent_allowsAllAccessTypes(TestNamespace ns) {
    SnowflakeConnection connection =
        baseSnowflakeConnection()
            .withPolicyAgentConfig(
                new PolicyAgentConfig()
                    .withEnabled(false)
                    .withSupportsFullAccess(false)
                    .withSupportsMaskedAccess(false)
                    .withSupportsColumnAccess(false));
    Table table = createTableOnSnowflakeService(ns, connection);

    Task columnLevelTask =
        createDataAccessRequest(
            ns, "table", table.getFullyQualifiedName(), dataAccessPayload("ColumnLevel"));
    assertEquals(TaskEntityType.DataAccessRequest, columnLevelTask.getType());
  }

  @Test
  void testDarOnDataProduct_rejectsColumnLevel(TestNamespace ns) {
    DataProduct dataProduct = createDataProductWithDomain(ns);

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () ->
                createDataAccessRequest(
                    ns,
                    "dataProduct",
                    dataProduct.getFullyQualifiedName(),
                    dataAccessPayload("ColumnLevel")));
    assertTrue(
        rejection.getMessage().contains("Column-level access is not supported for Data Products"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }

  @Test
  void testDarOnDataProduct_allowsFullAccessAndMasked(TestNamespace ns) {
    DataProduct dataProduct = createDataProductWithDomain(ns);

    Task fullAccessTask =
        createDataAccessRequest(
            ns,
            "dataProduct",
            dataProduct.getFullyQualifiedName(),
            dataAccessPayload("FullAccess"));
    Task maskedTask =
        createDataAccessRequest(
            ns, "dataProduct", dataProduct.getFullyQualifiedName(), dataAccessPayload("Masked"));

    assertNotNull(fullAccessTask.getId());
    assertNotNull(maskedTask.getId());
  }

  @Test
  void testDuplicateActiveDarBySameUser_rejected(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());

    Task firstRequest =
        createDataAccessRequest(
            ns, "table", table.getFullyQualifiedName(), dataAccessPayload("FullAccess"));
    assertNotNull(firstRequest.getId());

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () ->
                createDataAccessRequest(
                    ns, "table", table.getFullyQualifiedName(), dataAccessPayload("Masked")));
    assertTrue(
        rejection.getMessage().contains("active data access request"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
    assertTrue(
        rejection.getMessage().contains(firstRequest.getTaskId()),
        () -> "Rejection should reference existing task: " + rejection.getMessage());
  }

  @Test
  void testDuplicateDarByDifferentUsers_allowed(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());

    Task user1Request =
        createDataAccessRequest(
            SdkClients.user1Client(),
            ns,
            "table",
            table.getFullyQualifiedName(),
            dataAccessPayload("FullAccess"));
    Task user2Request =
        createDataAccessRequest(
            SdkClients.user2Client(),
            ns,
            "table",
            table.getFullyQualifiedName(),
            dataAccessPayload("FullAccess"));

    assertNotNull(user1Request.getId());
    assertNotNull(user2Request.getId());
  }

  @Test
  void testActiveDarBySameUserOnDifferentEntities_allowed(TestNamespace ns) {
    Table firstTable = createTableOnSnowflakeService(ns, baseSnowflakeConnection());
    Table secondTable = createTableOnSnowflakeService(ns, baseSnowflakeConnection());

    Task firstRequest =
        createDataAccessRequest(
            ns, "table", firstTable.getFullyQualifiedName(), dataAccessPayload("FullAccess"));
    Task secondRequest =
        createDataAccessRequest(
            ns, "table", secondTable.getFullyQualifiedName(), dataAccessPayload("FullAccess"));

    assertNotNull(firstRequest.getId());
    assertNotNull(secondRequest.getId());
  }

  @Test
  void testDarAfterPreviousRequestTerminal_allowed(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());

    Task firstRequest =
        createDataAccessRequest(
            ns, "table", table.getFullyQualifiedName(), dataAccessPayload("FullAccess"));
    SdkClients.adminClient().tasks().close(firstRequest.getId().toString());

    Task secondRequest =
        createDataAccessRequest(
            ns, "table", table.getFullyQualifiedName(), dataAccessPayload("FullAccess"));
    assertNotNull(secondRequest.getId());
  }

  @Test
  void testDarWithInvalidAccessType_rejectedByFormSchema(TestNamespace ns) {
    Table table = createTableOnSnowflakeService(ns, baseSnowflakeConnection());

    InvalidRequestException rejection =
        assertThrows(
            InvalidRequestException.class,
            () ->
                createDataAccessRequest(
                    ns, "table", table.getFullyQualifiedName(), dataAccessPayload("Bogus")));
    assertTrue(
        rejection.getMessage().contains("Invalid task payload"),
        () -> "Unexpected rejection message: " + rejection.getMessage());
  }
}
