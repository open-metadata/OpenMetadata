package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.store;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.stored;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.write;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.automations.CreateWorkflow;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.SecretsManagerUpdateService;

/**
 * A soft-deleted service or Test Connection workflow can be restored, so {@code migrate}
 * re-encrypts the secrets it still holds in plain text.
 */
@Isolated("Runs migrate's secrets update over every stored service and workflow")
@ExtendWith(TestNamespaceExtension.class)
class SecretsManagerUpdateSoftDeletedIT {
  private static final String PLAIN = "soft-deleted-plain-password";
  private static final String PASSWORD = "/authType/password";

  @Test
  void migrateEncryptsSoftDeletedServicesAndWorkflows(TestNamespace ns) {
    final String serviceId = softDeletedServiceWithPlainPassword(ns);
    final String workflowId = softDeletedWorkflowWithPlainPassword(ns);

    new SecretsManagerUpdateService(SecretsManagerFactory.getSecretsManager(), "openmetadata")
        .updateEntities();

    final JsonNode service = JsonUtils.readTree(stored(false, serviceId));
    final JsonNode workflow = JsonUtils.readTree(storedWorkflow(workflowId));
    assertEncrypted(service.at("/connection/config" + PASSWORD).asText());
    assertEncrypted(workflow.at("/request/connection/config" + PASSWORD).asText());
    assertTrue(service.path("deleted").asBoolean());
    assertTrue(workflow.path("deleted").asBoolean());
  }

  private static void assertEncrypted(String stored) {
    assertTrue(Fernet.isTokenized(stored), "still plain text: " + stored);
    assertEquals(PLAIN, Fernet.getInstance().decrypt(stored));
  }

  private static String softDeletedServiceWithPlainPassword(TestNamespace ns) {
    final CreateDatabaseService request =
        new CreateDatabaseService()
            .withName(ns.prefix("soft_deleted_" + UUID.randomUUID().toString().substring(0, 8)))
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(mysqlConnection());
    final String id =
        write(HttpMethod.POST, "/v1/services/databaseServices", request).path("id").asText();
    ns.trackRoot(Entity.DATABASE_SERVICE, UUID.fromString(id));
    write(HttpMethod.DELETE, "/v1/services/databaseServices/" + id, null);
    final ObjectNode legacy = (ObjectNode) JsonUtils.readTree(stored(false, id));
    ((ObjectNode) legacy.at("/connection/config/authType")).put("password", PLAIN);
    store(false, id, legacy.toString());
    return id;
  }

  private static String softDeletedWorkflowWithPlainPassword(TestNamespace ns) {
    final CreateWorkflow request =
        new CreateWorkflow()
            .withName(ns.prefix("soft_deleted_wf_" + UUID.randomUUID().toString().substring(0, 8)))
            .withWorkflowType(WorkflowType.TEST_CONNECTION)
            .withRequest(
                new TestServiceConnectionRequest()
                    .withServiceType(ServiceType.DATABASE)
                    .withConnectionType("Mysql")
                    .withConnection(mysqlConnection()));
    final String id = SdkClients.adminClient().workflows().create(request).getId().toString();
    ns.trackRoot(Entity.WORKFLOW, UUID.fromString(id));
    final ObjectNode legacy = (ObjectNode) JsonUtils.readTree(storedWorkflow(id));
    ((ObjectNode) legacy.at("/request/connection/config/authType")).put("password", PLAIN);
    legacy.put("deleted", true);
    storeWorkflow(id, legacy.toString());
    return id;
  }

  private static DatabaseConnection mysqlConnection() {
    return new DatabaseConnection()
        .withConfig(
            new MysqlConnection()
                .withHostPort("mysql:3306")
                .withUsername("openmetadata_user")
                .withAuthType(new basicAuth().withPassword(PLAIN)));
  }

  private static String storedWorkflow(String id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT json FROM automations_workflow WHERE id = :id")
                    .bind("id", id)
                    .mapTo(String.class)
                    .one());
  }

  private static void storeWorkflow(String id, String json) {
    final String value =
        TestSuiteBootstrap.getConnectionType() == ConnectionType.POSTGRES
            ? "CAST(:json AS jsonb)"
            : ":json";
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "UPDATE automations_workflow SET json = " + value + " WHERE id = :id")
                    .bind("id", id)
                    .bind("json", json)
                    .execute());
  }
}
