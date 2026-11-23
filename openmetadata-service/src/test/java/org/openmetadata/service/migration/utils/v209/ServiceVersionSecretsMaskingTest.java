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

package org.openmetadata.service.migration.utils.v209;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.migration.utils.v209.ServiceVersionSecretsMasking.MASK;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Stream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Runs the 2.0.9 masking step against real MySQL and PostgreSQL. It must mask each listed secret
 * that is still plain text in a service version, and leave everything else as stored: encrypted
 * values, secret references, unlisted fields, other service types, the services' current rows and
 * other entities' versions.
 */
@Testcontainers(disabledWithoutDocker = true)
class ServiceVersionSecretsMaskingTest {
  private static final String PASSWORD = "version-secrets-test";
  private static final String DATABASE = "version_secrets_test";
  private static final String MYSQL_DIALECT = "mysql";
  private static final String POSTGRES_DIALECT = "postgres";
  private static final String PLAIN = "plain-text-secret";
  private static final String FERNET = "fernet:gAAAAABencrypted";
  private static final String REFERENCE = "secret:prod-password";

  @Container
  static final GenericContainer<?> MYSQL =
      new GenericContainer<>(DockerImageName.parse("mysql:8.3.0"))
          .withEnv("MYSQL_DATABASE", DATABASE)
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withEnv("MYSQL_ROOT_HOST", "%")
          .withExposedPorts(3306)
          .waitingFor(
              Wait.forSuccessfulCommand(
                  "mysql --protocol=TCP --host=127.0.0.1 --user=root --password="
                      + PASSWORD
                      + " --execute='SELECT 1'"));

  @Container
  static final GenericContainer<?> POSTGRES =
      new GenericContainer<>(DockerImageName.parse("postgres:15"))
          .withEnv("POSTGRES_DB", DATABASE)
          .withEnv("POSTGRES_PASSWORD", PASSWORD)
          .withExposedPorts(5432)
          .waitingFor(
              Wait.forLogMessage(".*database system is ready to accept connections.*\\n", 2));

  /** A stored row and the JSON it must hold after the step. */
  private record Row(String id, String extension, String before, String after) {}

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void masksOnlyPlainTextListedSecretsInServiceVersionsAndIsIdempotent(final String dialect) {
    try (Handle handle = open(dialect)) {
      createTable(handle, dialect);
      final List<Row> rows = rows();
      rows.forEach(row -> insert(handle, dialect, row));

      ServiceVersionSecretsMasking.maskPlainTextSecrets(handle, connectionType(dialect));

      final Map<String, JsonNode> afterFirstRun = stored(handle, dialect);
      for (final Row row : rows) {
        assertEquals(
            JsonUtils.readTree(row.after()),
            afterFirstRun.get(row.id() + row.extension()),
            row.extension());
      }

      ServiceVersionSecretsMasking.maskPlainTextSecrets(handle, connectionType(dialect));

      assertEquals(afterFirstRun, stored(handle, dialect), "a second run changes nothing");
    }
  }

  private static List<Row> rows() {
    final String id = UUID.randomUUID().toString();
    return Stream.of(pipelineRows(id), otherServiceRows(id), workflowRows(id))
        .flatMap(List::stream)
        .toList();
  }

  /** Each secret of a pipeline service, and the values and rows that are left as they are. */
  private static List<Row> pipelineRows(final String id) {
    return List.of(
        version(
            id,
            "pipelineService.version.0.1",
            databricks("token", PLAIN),
            databricks("token", MASK)),
        version(
            id,
            "pipelineService.version.0.2",
            databricks("clientSecret", PLAIN),
            databricks("clientSecret", MASK)),
        version(
            id,
            "pipelineService.version.0.3",
            databricks("azureClientSecret", PLAIN),
            databricks("azureClientSecret", MASK)),
        unchanged(id, "pipelineService.version.0.4", databricks("token", FERNET)),
        // The database secrets manager reads "secret:" as part of a password, not as a reference;
        // a reference in an old version is masked too, which loses nothing.
        version(
            id,
            "pipelineService.version.0.5",
            databricks("token", REFERENCE),
            databricks("token", MASK)),
        unchanged(id, "pipelineService.version.0.6", databricks("token", "")),
        unchanged(
            id,
            "pipelineService.version.0.7",
            service("Airflow", "{\"authType\":{\"token\":\"" + PLAIN + "\"}}")),
        unchanged(id, "pipelineService.config", databricks("token", PLAIN)),
        unchanged(id, "table.version.0.1", databricks("token", PLAIN)));
  }

  /** Secrets of the other service types, each at its own path. */
  private static List<Row> otherServiceRows(final String id) {
    return List.of(
        version(id, "dashboardService.version.0.1", powerBi(PLAIN), powerBi(MASK)),
        unchanged(id, "dashboardService.version.0.2", powerBi(FERNET)),
        version(id, "dashboardService.version.0.3", superset(PLAIN), superset(MASK)),
        version(
            id, "dashboardService.version.0.4", supersetCloudSql(PLAIN), supersetCloudSql(MASK)),
        version(id, "databaseService.version.0.1", mysqlCloudSql(PLAIN), mysqlCloudSql(MASK)),
        unchanged(
            id,
            "databaseService.version.0.2",
            service("Mysql", "{\"authType\":{\"password\":\"" + FERNET + "\"}}")),
        version(
            id,
            "messagingService.version.0.1",
            service("Kafka", kafka(PLAIN, PLAIN)),
            service("Kafka", kafka(MASK, MASK))),
        version(id, "mcpService.version.0.1", mcp(PLAIN), mcp(MASK)),
        version(
            id,
            "llmService.version.0.1",
            service("VertexAI", "{\"credentials\":\"" + PLAIN + "\"}"),
            service("VertexAI", "{\"credentials\":\"" + MASK + "\"}")),
        unchanged(
            id,
            "mlmodelService.version.0.1",
            service("VertexAI", "{\"credentials\":\"" + PLAIN + "\"}")));
  }

  /** Test Connection requests are masked by their service type; other workflows are not. */
  private static List<Row> workflowRows(final String id) {
    return List.of(
        version(
            id,
            "workflow.version.0.1",
            testConnection("Pipeline", databricks("token", PLAIN)),
            testConnection("Pipeline", databricks("token", MASK))),
        unchanged(
            id, "workflow.version.0.2", testConnection("Dashboard", databricks("token", PLAIN))),
        unchanged(
            id,
            "workflow.version.0.3",
            "{\"name\":\"run-query\",\"workflowType\":\"QUERY_RUNNER\",\"request\":"
                + "{\"query\":\"select 1\",\"connection\":{\"config\":"
                + "{\"type\":\"Mysql\",\"authType\":{\"password\":\""
                + PLAIN
                + "\"}}}}}"),
        unchanged(
            id,
            "workflow.version.0.4",
            testConnection("NotAServiceType", databricks("token", PLAIN))));
  }

  /** {@code consumerConfig} is a map whose every value is a secret. */
  private static String kafka(final String password, final String consumerValue) {
    return "{\"saslPassword\":\""
        + password
        + "\",\"consumerConfig\":{\"sasl.password\":\""
        + consumerValue
        + "\",\"client.id\":\""
        + consumerValue
        + "\"}}";
  }

  /** Each server of the array has its own key; an encrypted one stays as it is. */
  private static String mcp(final String value) {
    return service(
        "Mcp",
        "{\"servers\":[{\"name\":\"a\",\"apiKey\":\""
            + value
            + "\"},{\"name\":\"b\",\"apiKey\":\""
            + FERNET
            + "\"}]}");
  }

  /** A Test Connection workflow version, which holds a service's connection in its request. */
  private static String testConnection(final String serviceType, final String serviceVersion) {
    final JsonNode service = JsonUtils.readTree(serviceVersion);
    return "{\"name\":\"test-connection\",\"request\":{\"serviceType\":\""
        + serviceType
        + "\",\"connectionType\":\""
        + service.path("serviceType").asText()
        + "\",\"connection\":"
        + service.path("connection")
        + "}}";
  }

  private static Row version(
      final String id, final String extension, final String before, final String after) {
    return new Row(id, extension, before, after);
  }

  private static Row unchanged(final String id, final String extension, final String json) {
    return new Row(id, extension, json, json);
  }

  private static String databricks(final String field, final String value) {
    return service(
        "DatabricksPipeline",
        "{\"hostPort\":\"h:443\",\"authType\":{\"" + field + "\":\"" + value + "\"}}");
  }

  private static String powerBi(final String value) {
    return service(
        "PowerBI",
        "{\"clientSecret\":\""
            + FERNET
            + "\",\"pbitFilesSource\":{\"securityConfig\":{\"gcpConfig\":"
            + "{\"type\":\"service_account\",\"privateKeyId\":\"kid\",\"privateKey\":\""
            + value
            + "\"}}}}");
  }

  private static String superset(final String value) {
    return service(
        "Superset",
        "{\"connection\":{\"password\":\""
            + FERNET
            + "\",\"sslConfig\":{\"caCertificate\":\""
            + value
            + "\",\"sslCertificate\":\""
            + value
            + "\",\"sslKey\":\""
            + value
            + "\"}}}");
  }

  private static String supersetCloudSql(final String value) {
    return service("Superset", "{\"connection\":" + cloudSqlConfig(value) + "}");
  }

  private static String mysqlCloudSql(final String value) {
    return service("Mysql", cloudSqlConfig(value));
  }

  private static String cloudSqlConfig(final String value) {
    return "{\"authType\":{\"password\":\""
        + value
        + "\",\"gcpConfig\":{\"gcpConfig\":{\"privateKey\":\""
        + value
        + "\"}}}}";
  }

  private static String service(final String serviceType, final String config) {
    return "{\"name\":\"svc\",\"serviceType\":\""
        + serviceType
        + "\",\"connection\":{\"config\":"
        + config
        + "}}";
  }

  private static Handle open(final String dialect) {
    return POSTGRES_DIALECT.equals(dialect)
        ? Jdbi.create(
                "jdbc:postgresql://"
                    + POSTGRES.getHost()
                    + ":"
                    + POSTGRES.getMappedPort(5432)
                    + "/"
                    + DATABASE,
                "postgres",
                PASSWORD)
            .open()
        : Jdbi.create(
                "jdbc:mysql://"
                    + MYSQL.getHost()
                    + ":"
                    + MYSQL.getMappedPort(3306)
                    + "/"
                    + DATABASE
                    + "?allowPublicKeyRetrieval=true&useSSL=false",
                "root",
                PASSWORD)
            .open();
  }

  private static ConnectionType connectionType(final String dialect) {
    return POSTGRES_DIALECT.equals(dialect) ? ConnectionType.POSTGRES : ConnectionType.MYSQL;
  }

  private static void createTable(final Handle handle, final String dialect) {
    final String jsonType = POSTGRES_DIALECT.equals(dialect) ? "JSONB" : "JSON";
    handle.execute("DROP TABLE IF EXISTS entity_extension");
    handle.execute(
        "CREATE TABLE entity_extension (id VARCHAR(36) NOT NULL, extension VARCHAR(256) NOT NULL,"
            + " jsonSchema VARCHAR(256) NOT NULL, json "
            + jsonType
            + " NOT NULL, PRIMARY KEY (id, extension))");
    handle.execute("CREATE INDEX extension_index ON entity_extension (extension)");
  }

  private static void insert(final Handle handle, final String dialect, final Row row) {
    final String json = POSTGRES_DIALECT.equals(dialect) ? "CAST(:json AS JSONB)" : ":json";
    handle
        .createUpdate(
            "INSERT INTO entity_extension (id, extension, jsonSchema, json)"
                + " VALUES (:id, :extension, :jsonSchema, "
                + json
                + ")")
        .bind("id", row.id())
        .bind("extension", row.extension())
        .bind("jsonSchema", row.extension().substring(0, row.extension().indexOf('.')))
        .bind("json", row.before())
        .execute();
  }

  private static Map<String, JsonNode> stored(final Handle handle, final String dialect) {
    final String jsonText = POSTGRES_DIALECT.equals(dialect) ? "json::text" : "CAST(json AS CHAR)";
    final Map<String, JsonNode> stored = new TreeMap<>();
    handle
        .createQuery("SELECT id, extension, " + jsonText + " AS body FROM entity_extension")
        .map(
            (rs, ctx) ->
                Map.entry(
                    rs.getString("id") + rs.getString("extension"),
                    JsonUtils.readTree(rs.getString("body"))))
        .forEach(entry -> stored.put(entry.getKey(), entry.getValue()));
    return stored;
  }
}
