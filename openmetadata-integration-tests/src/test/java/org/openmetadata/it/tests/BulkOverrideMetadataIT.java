package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.BulkApi;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;

/**
 * Integration tests for the {@code overrideMetadata} flag on the bulk path ({@code PUT
 * /v1/tables/bulk?overrideMetadata=true}).
 *
 * <p>A bot PUT must not clobber user-curated {@code description} / {@code displayName} by default,
 * matching the protection the connector-side PATCH path used to provide. {@code
 * overrideMetadata=true} opts out of that protection and also disables the sourceHash fast-path so
 * the override is actually applied.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class BulkOverrideMetadataIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

  @Test
  void test_botCannotOverwriteDescription_withoutOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_desc_off", "curated description", "hash-v1");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_desc_off", "connector description", "hash-v2");
    BulkApi.upsert("tables", List.of(changed), false, botToken);

    assertEquals(
        "curated description",
        getTable(fqn).getDescription(),
        "a bot PUT must not overwrite a non-empty description without overrideMetadata");
  }

  @Test
  void test_botOverwritesDescription_withOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_desc_on", "curated description", "hash-v1");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_desc_on", "connector description", "hash-v2");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    assertEquals(
        "connector description",
        getTable(fqn).getDescription(),
        "overrideMetadata=true lets a bot PUT overwrite the description");
  }

  @Test
  void test_overrideMetadata_disablesSourceHashFastPath(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_fastpath", "curated description", "stable");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();

    // Same sourceHash but a changed description. With overrideMetadata=true the fast-path is
    // disabled, so the entity is diffed and the override is applied.
    CreateTable changed = table(ns, schemaFqn, "ovr_fastpath", "connector description", "stable");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    assertEquals(
        "connector description",
        getTable(fqn).getDescription(),
        "overrideMetadata=true must disable the sourceHash fast-path");
  }

  @Test
  void test_botCannotOverwriteDisplayName_withoutOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_dn_off", "desc", "hash-v1");
    original.setDisplayName("Curated Display Name");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_dn_off", "desc", "hash-v2");
    changed.setDisplayName("Connector Display Name");
    BulkApi.upsert("tables", List.of(changed), false, botToken);

    assertEquals(
        "Curated Display Name",
        getTable(fqn).getDisplayName(),
        "a bot PUT must not overwrite a non-empty displayName without overrideMetadata");
  }

  // ===================================================================
  // HELPERS
  // ===================================================================

  private String setupSchema(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    return schema.getFullyQualifiedName();
  }

  private CreateTable table(
      TestNamespace ns, String schemaFqn, String baseName, String description, String sourceHash) {
    CreateTable createTable =
        new CreateTable()
            .withName(ns.prefix(baseName))
            .withDatabaseSchema(schemaFqn)
            .withDescription(description)
            .withColumns(List.of(new Column().withName("c1").withDataType(ColumnDataType.STRING)));
    createTable.setSourceHash(sourceHash);
    return createTable;
  }

  private Table getTable(String fqn) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/tables/name/" + fqn))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), "get table " + fqn + ": " + response.body());
    Table table = OBJECT_MAPPER.readValue(response.body(), Table.class);
    assertNotNull(table.getId());
    return table;
  }
}
