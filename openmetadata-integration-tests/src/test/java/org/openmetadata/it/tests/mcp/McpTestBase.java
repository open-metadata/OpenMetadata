package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
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

public abstract class McpTestBase {

  protected static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  protected static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  protected static String authToken;

  protected static void initAuth() throws Exception {
    authToken =
        "Bearer "
            + JwtAuthProvider.tokenFor(
                "admin@open-metadata.org", "admin@open-metadata.org", new String[] {"admin"}, 3600);
  }

  protected static Table createServiceDatabaseSchemaTable(String prefix) throws Exception {
    String serviceName = prefix + "_service_" + UUID.randomUUID().toString().substring(0, 8);
    DatabaseConnection connection =
        new DatabaseConnection()
            .withConfig(
                new MysqlConnection()
                    .withHostPort("localhost:3306")
                    .withUsername("test")
                    .withAuthType(new basicAuth().withPassword("test")));

    CreateDatabaseService createDatabaseService =
        new CreateDatabaseService()
            .withName(serviceName)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(connection);

    DatabaseService databaseService =
        post("services/databaseServices", createDatabaseService, DatabaseService.class);

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName(prefix + "_database_" + UUID.randomUUID().toString().substring(0, 8))
            .withDescription("Test database for MCP")
            .withService(databaseService.getFullyQualifiedName());

    Database testDatabase = post("databases", createDatabase, Database.class);

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName(prefix + "_schema")
            .withDescription("Test schema for MCP")
            .withDatabase(testDatabase.getFullyQualifiedName());

    DatabaseSchema testSchema = post("databaseSchemas", createSchema, DatabaseSchema.class);

    List<Column> columns =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary key"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(50)
                .withDescription("Entity name"),
            new Column()
                .withName("created_at")
                .withDataType(ColumnDataType.TIMESTAMP)
                .withDescription("Creation timestamp"));

    CreateTable createTable =
        new CreateTable()
            .withName(prefix + "_table")
            .withDescription("Test table for MCP")
            .withDatabaseSchema(testSchema.getFullyQualifiedName())
            .withColumns(columns);

    return post("tables", createTable, Table.class);
  }

  protected static <T> T post(String path, Object body, Class<T> responseType) throws Exception {
    String baseUrl = TestSuiteBootstrap.getBaseUrl();
    String jsonBody = OBJECT_MAPPER.writeValueAsString(body);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/v1/" + path))
            .header("Content-Type", "application/json")
            .header("Authorization", authToken)
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .timeout(Duration.ofSeconds(30))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200 && response.statusCode() != 201) {
      throw new RuntimeException("HTTP " + response.statusCode() + ": " + response.body());
    }
    return OBJECT_MAPPER.readValue(response.body(), responseType);
  }

  protected static void delete(String path) throws Exception {
    String baseUrl = TestSuiteBootstrap.getBaseUrl();
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/v1/" + path))
            .header("Authorization", authToken)
            .DELETE()
            .timeout(Duration.ofSeconds(30))
            .build();
    HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  protected String getMcpUrl(String path) {
    return TestSuiteBootstrap.getBaseUrl() + path;
  }

  protected JsonNode executeMcpRequest(java.util.Map<String, Object> mcpRequest) throws Exception {
    String requestBody = OBJECT_MAPPER.writeValueAsString(mcpRequest);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp")))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", authToken)
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertThat(response.statusCode()).isEqualTo(200);

    String responseBody = response.body();
    String jsonContent = extractJsonFromResponse(responseBody);
    return OBJECT_MAPPER.readTree(jsonContent);
  }

  protected static String extractJsonFromResponse(String responseBody) {
    if (responseBody.startsWith("id:") || responseBody.startsWith("data:")) {
      StringBuilder dataLines = new StringBuilder();
      for (String line : responseBody.split("\n")) {
        if (line.startsWith("data:")) {
          if (dataLines.length() > 0) {
            dataLines.append("\n");
          }
          dataLines.append(line.substring(5).trim());
        }
      }
      if (dataLines.length() > 0) {
        return dataLines.toString();
      }
    }
    return responseBody;
  }
}
