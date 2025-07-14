package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.simulateWork;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.util.TestUtils;

/**
 * Integration test demonstrating request latency tracking with component breakdown.
 * This test shows how time is distributed between internal processing, database operations,
 * and search operations.
 */
@Slf4j
class RequestLatencyTrackingTest extends OpenMetadataApplicationTest {

  private String databaseServiceFqn;
  private String databaseFqn;
  private String databaseSchemaFqn;
  private Client prometheusClient;

  @BeforeEach
  void setup() throws Exception {
    long timestamp = System.currentTimeMillis();
    CreateDatabaseService createService =
        new CreateDatabaseService()
            .withName("test_db_service_" + timestamp)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new MysqlConnection()
                            .withUsername("test")
                            .withAuthType(new basicAuth().withPassword("test"))
                            .withHostPort("localhost:3306")
                            .withDatabaseSchema("test")));

    WebTarget serviceTarget = getResource("services/databaseServices");
    DatabaseService dbService =
        TestUtils.post(serviceTarget, createService, DatabaseService.class, ADMIN_AUTH_HEADERS);
    databaseServiceFqn = dbService.getFullyQualifiedName();

    CreateDatabase createDatabase =
        new CreateDatabase().withName("test_database_" + timestamp).withService(databaseServiceFqn);

    WebTarget dbTarget = getResource("databases");
    Database database =
        TestUtils.post(dbTarget, createDatabase, Database.class, ADMIN_AUTH_HEADERS);
    databaseFqn = database.getFullyQualifiedName();

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema().withName("test_schema_" + timestamp).withDatabase(databaseFqn);

    WebTarget schemaTarget = getResource("databaseSchemas");
    DatabaseSchema schema =
        TestUtils.post(schemaTarget, createSchema, DatabaseSchema.class, ADMIN_AUTH_HEADERS);
    databaseSchemaFqn = schema.getFullyQualifiedName();

    prometheusClient = ClientBuilder.newClient();
  }

  @Test
  void testTableApiLatencyTracking() throws HttpResponseException {
    CreateTable createTable =
        new CreateTable()
            .withName("test_latency_table_" + System.currentTimeMillis())
            .withDatabaseSchema(databaseSchemaFqn)
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column()
                        .withName("name")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(50)));

    WebTarget target = getResource("tables");
    Table createdTable = TestUtils.post(target, createTable, Table.class, ADMIN_AUTH_HEADERS);

    LOG.info("Fetching table with fields=* to trigger database operations...");

    WebTarget getTarget = getResource("tables/" + createdTable.getId());
    TestUtils.get(getTarget, Table.class, ADMIN_AUTH_HEADERS);

    // Give metrics a moment to be recorded
    simulateWork(200);

    // Get metrics from Prometheus endpoint
    String prometheusMetrics = getPrometheusMetrics();
    LOG.info("Prometheus metrics:\n{}", prometheusMetrics);

    // Check for request latency metrics
    // The endpoint in metrics appears without the /api/ prefix
    String getEndpoint = "v1/tables/" + createdTable.getId();

    // Verify metrics exist in Prometheus output
    assertTrue(
        prometheusMetrics.contains("request_latency_total"),
        "Prometheus output should contain request_latency_total metrics");

    // Check for specific endpoint metrics - the actual metrics use the endpoint path as-is
    LOG.info("Looking for metrics with endpoint: {}", getEndpoint);

    // Parse and verify latency metrics
    assertLatencyMetricsExist(prometheusMetrics, "request_latency_total", getEndpoint);
    assertLatencyMetricsExist(prometheusMetrics, "request_latency_database", getEndpoint);
    assertLatencyMetricsExist(prometheusMetrics, "request_latency_internal", getEndpoint);
  }

  @Test
  void testSearchApiLatencyTracking() throws HttpResponseException {
    // First create some test data
    long timestamp = System.currentTimeMillis();
    CreateTable create1 =
        new CreateTable()
            .withName("search_test_table_1_" + timestamp)
            .withDatabaseSchema(databaseSchemaFqn)
            .withDescription("Test table for search")
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));

    CreateTable create2 =
        new CreateTable()
            .withName("search_test_table_2_" + timestamp)
            .withDatabaseSchema(databaseSchemaFqn)
            .withDescription("Another test table")
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));

    WebTarget target = getResource("tables");
    TestUtils.post(target, create1, Table.class, ADMIN_AUTH_HEADERS);
    TestUtils.post(target, create2, Table.class, ADMIN_AUTH_HEADERS);

    // Give indexing a moment
    simulateWork(1000);

    // Perform a search operation
    LOG.info("Performing search to trigger Elasticsearch/OpenSearch operations...");

    WebTarget searchTarget =
        getResource("search/query")
            .queryParam("q", "test")
            .queryParam("index", "table_search_index");
    TestUtils.get(searchTarget, String.class, ADMIN_AUTH_HEADERS);

    // Give metrics a moment to be recorded
    simulateWork(200);

    // Get metrics from Prometheus endpoint
    String prometheusMetrics = getPrometheusMetrics();

    // Check for search endpoint metrics
    // The endpoint in metrics appears without the /api/ prefix
    String searchEndpoint = "v1/search/query";

    // Verify search metrics
    assertLatencyMetricsExist(prometheusMetrics, "request_latency_total", searchEndpoint);
    assertLatencyMetricsExist(prometheusMetrics, "request_latency_search", searchEndpoint);

    // Extract and verify search percentage
    String searchPercentagePattern =
        "request_percentage_search.*endpoint=\"" + searchEndpoint + "\"";
    assertTrue(
        prometheusMetrics.matches("(?s).*" + searchPercentagePattern + ".*"),
        "Should have search percentage metrics for endpoint");
  }

  @Test
  void testComplexQueryLatencyTracking() throws HttpResponseException {
    // Create a table with relationships to trigger more database operations
    CreateTable createTable =
        new CreateTable()
            .withName("complex_latency_table_" + System.currentTimeMillis())
            .withDatabaseSchema(databaseSchemaFqn)
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column().withName("customer_id").withDataType(ColumnDataType.BIGINT),
                    new Column().withName("order_date").withDataType(ColumnDataType.DATE)));

    WebTarget createTarget = getResource("tables");
    Table createdTable = TestUtils.post(createTarget, createTable, Table.class, ADMIN_AUTH_HEADERS);

    // Fetch with include=all to trigger maximum database operations

    WebTarget complexTarget =
        getResource("tables/" + createdTable.getId())
            .queryParam("fields", "owners,tags,followers,columns,domain,dataProducts,extension")
            .queryParam("include", "all");
    TestUtils.get(complexTarget, Table.class, ADMIN_AUTH_HEADERS);

    simulateWork(200);

    // Get metrics from Prometheus endpoint
    String prometheusMetrics = getPrometheusMetrics();

    // The endpoint in metrics appears without the /api/ prefix
    String endpoint = "v1/tables/" + createdTable.getId();

    // Verify database operation count
    assertLatencyMetricsExist(prometheusMetrics, "request_latency_database", endpoint);

    // Check that we have multiple database operations recorded
    assertTrue(
        prometheusMetrics.contains("request_operations_database"),
        "Should have database operation count metrics");
  }

  private String getPrometheusMetrics() {
    // Get the admin port from the application
    int adminPort = APP.getAdminPort();
    String prometheusUrl = String.format("http://localhost:%d/prometheus", adminPort);

    LOG.info("Fetching metrics from: {}", prometheusUrl);

    WebTarget prometheusTarget = prometheusClient.target(prometheusUrl);
    Response response = prometheusTarget.request().get();

    assertEquals(200, response.getStatus(), "Prometheus endpoint should return 200");

    String metrics = response.readEntity(String.class);
    response.close();

    return metrics;
  }

  private void assertLatencyMetricsExist(
      String prometheusOutput, String metricName, String endpoint) {
    // Look for metrics that contain the metric name with the endpoint label
    String pattern = metricName + "_seconds.*endpoint=\"" + endpoint.replace("/", "\\/") + "\"";
    assertTrue(
        prometheusOutput.matches("(?s).*" + pattern + ".*"),
        String.format(
            "Prometheus output should contain %s metrics for endpoint %s", metricName, endpoint));
  }
}
