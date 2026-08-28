package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
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
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;

/**
 * Integration tests for the sourceHash fast-path in the bulk create/update path ({@code PUT
 * /v1/tables/bulk}).
 *
 * <p>The connector stamps every entity with a {@code sourceHash}. When a bulk-update entity carries
 * a sourceHash equal to the stored one, the server must skip field hydration and diffing entirely
 * and report a no-change success - without a version bump. When the hash differs (or is absent),
 * the entity must go through the normal diff path.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class BulkSourceHashFastPathIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

  @Test
  void test_identicalBatch_isAllSuccess_withNoVersionBump(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    List<CreateTable> batch = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      batch.add(table(ns, schemaFqn, "fp_same_" + i, "desc " + i, "hash-" + i));
    }

    BulkOperationResult created = BulkApi.upsert("tables", batch);
    assertEquals(5, created.getNumberOfRowsPassed().intValue(), "all 5 tables created");

    List<Double> versionsAfterCreate = new ArrayList<>();
    for (CreateTable ct : batch) {
      versionsAfterCreate.add(getTable(tableFqn(schemaFqn, ct.getName())).getVersion());
    }

    // Re-send the identical batch: every table has a matching sourceHash -> fast-path skip.
    BulkOperationResult resent = BulkApi.upsert("tables", batch);
    assertEquals(5, resent.getNumberOfRowsPassed().intValue(), "all 5 tables processed on re-send");
    assertEquals(0, resent.getNumberOfRowsFailed().intValue(), "no failures on re-send");

    for (int i = 0; i < batch.size(); i++) {
      Table t = getTable(tableFqn(schemaFqn, batch.get(i).getName()));
      assertEquals(
          versionsAfterCreate.get(i),
          t.getVersion(),
          "version must not change for a sourceHash-unchanged table");
      assertEquals("hash-" + i, t.getSourceHash(), "stored sourceHash preserved");
    }
  }

  @Test
  void test_matchingSourceHash_skipsFieldDiff(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    CreateTable original = table(ns, schemaFqn, "fp_skip", "original description", "stable-hash");
    BulkApi.upsert("tables", List.of(original));

    String fqn = tableFqn(schemaFqn, original.getName());
    Double versionAfterCreate = getTable(fqn).getVersion();

    // Same sourceHash but a changed description. The fast-path must skip the entity entirely,
    // so the description change is NOT applied even though the caller is an admin (non-bot).
    CreateTable changedDesc = table(ns, schemaFqn, "fp_skip", "changed description", "stable-hash");
    BulkApi.upsert("tables", List.of(changedDesc));

    Table after = getTable(fqn);
    assertEquals(
        "original description",
        after.getDescription(),
        "matching sourceHash must short-circuit before any field diff");
    assertEquals(versionAfterCreate, after.getVersion(), "no version bump on fast-path skip");
  }

  @Test
  void test_changedSourceHash_appliesUpdate(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    CreateTable original = table(ns, schemaFqn, "fp_changed", "original description", "hash-v1");
    BulkApi.upsert("tables", List.of(original));

    String fqn = tableFqn(schemaFqn, original.getName());
    Double versionAfterCreate = getTable(fqn).getVersion();

    CreateTable updated = table(ns, schemaFqn, "fp_changed", "changed description", "hash-v2");
    BulkApi.upsert("tables", List.of(updated));

    Table after = getTable(fqn);
    assertEquals(
        "changed description",
        after.getDescription(),
        "a changed sourceHash must take the full diff path");
    assertTrue(
        after.getVersion() > versionAfterCreate, "version must bump when the entity changed");
    assertEquals("hash-v2", after.getSourceHash(), "new sourceHash stored");
  }

  @Test
  void test_nullSourceHash_fallsThroughToDiff(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    CreateTable original = table(ns, schemaFqn, "fp_null", "original description", "hash-v1");
    BulkApi.upsert("tables", List.of(original));

    String fqn = tableFqn(schemaFqn, original.getName());

    // No sourceHash on the incoming entity -> never eligible for the fast-path.
    CreateTable noHash = table(ns, schemaFqn, "fp_null", "changed description", null);
    BulkApi.upsert("tables", List.of(noHash));

    Table after = getTable(fqn);
    assertEquals(
        "changed description",
        after.getDescription(),
        "a null sourceHash must fall through to the normal diff path");
  }

  @Test
  void test_softDeletedTable_isRestored_evenWithMatchingHash(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    CreateTable original = table(ns, schemaFqn, "fp_restore", "desc", "restore-hash");
    BulkApi.upsert("tables", List.of(original));

    String fqn = tableFqn(schemaFqn, original.getName());
    Table createdTable = getTable(fqn);
    softDelete(createdTable.getId().toString());
    assertTrue(Boolean.TRUE.equals(getTable(fqn).getDeleted()), "table is soft-deleted");

    // Re-send with the SAME sourceHash. A deleted original must NOT be fast-path-skipped -
    // the bulk path has to restore it.
    BulkApi.upsert("tables", List.of(original));

    Table restored = getTable(fqn);
    assertFalse(
        Boolean.TRUE.equals(restored.getDeleted()),
        "soft-deleted table must be restored by the bulk path");
  }

  @Test
  void test_manualPatchClearsSourceHash_soSameHashReappliesTags(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String tagFqn = createClassificationAndTag(ns);
    TagLabel tag =
        new TagLabel()
            .withTagFQN(tagFqn)
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);

    CreateTable original =
        table(ns, schemaFqn, "fp_patch_tags", "desc", "hash-patch-tags").withTags(List.of(tag));
    BulkApi.upsert("tables", List.of(original));

    String fqn = tableFqn(schemaFqn, original.getName());
    Table created = getTable(fqn);
    assertTrue(
        created.getTags() != null
            && created.getTags().stream().anyMatch(t -> tagFqn.equals(t.getTagFQN())),
        "tag must be applied on create");

    // Simulate a UI/automation edit that removes the tag via PATCH (out-of-band vs. ingestion).
    patchTableTagsToEmpty(created.getId().toString());

    Table patched = getTable(fqn);
    assertTrue(
        patched.getTags() == null || patched.getTags().isEmpty(),
        "tag must be cleared by the manual PATCH");
    assertNull(patched.getSourceHash(), "PATCH must clear the stored sourceHash");

    // Re-ingest the same source content with the same sourceHash. The fast-path must NOT skip the
    // entity (the stored hash was cleared above), so the source tag is re-applied.
    BulkApi.upsert("tables", List.of(original));

    Table after = getTable(fqn);
    assertTrue(
        after.getTags() != null
            && after.getTags().stream().anyMatch(t -> tagFqn.equals(t.getTagFQN())),
        "tag must be re-applied on re-ingest even with a matching sourceHash");
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

  private String tableFqn(String schemaFqn, String tableName) {
    return schemaFqn + "." + tableName;
  }

  /** Creates a classification + tag over raw HTTP and returns the tag's fully qualified name. */
  private String createClassificationAndTag(TestNamespace ns) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String adminToken = SdkClients.getAdminToken();

    String clsName = ns.prefix("fp_cls");
    String clsBody = "{\"name\":\"" + clsName + "\",\"description\":\"regression classification\"}";
    HttpResponse<String> clsResp =
        HTTP_CLIENT.send(
            HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/v1/classifications"))
                .header("Authorization", "Bearer " + adminToken)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(clsBody))
                .build(),
            HttpResponse.BodyHandlers.ofString());
    assertTrue(
        clsResp.statusCode() == 200 || clsResp.statusCode() == 201,
        "create classification: " + clsResp.statusCode() + " " + clsResp.body());
    String clsFqn = OBJECT_MAPPER.readTree(clsResp.body()).get("fullyQualifiedName").asText();

    String tagBody =
        "{\"name\":\"fp_tag\",\"description\":\"regression tag\",\"classification\":\""
            + clsFqn
            + "\"}";
    HttpResponse<String> tagResp =
        HTTP_CLIENT.send(
            HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/v1/tags"))
                .header("Authorization", "Bearer " + adminToken)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(tagBody))
                .build(),
            HttpResponse.BodyHandlers.ofString());
    assertTrue(
        tagResp.statusCode() == 200 || tagResp.statusCode() == 201,
        "create tag: " + tagResp.statusCode() + " " + tagResp.body());
    return OBJECT_MAPPER.readTree(tagResp.body()).get("fullyQualifiedName").asText();
  }

  /** PATCHes the table to replace its tags with an empty list (a manual, out-of-band edit). */
  private void patchTableTagsToEmpty(String tableId) throws Exception {
    String patchBody = "[{\"op\":\"replace\",\"path\":\"/tags\",\"value\":[]}]";
    HttpResponse<String> response =
        HTTP_CLIENT.send(
            HttpRequest.newBuilder()
                .uri(URI.create(SdkClients.getServerUrl() + "/v1/tables/" + tableId))
                .header("Authorization", "Bearer " + SdkClients.getAdminToken())
                .header("Content-Type", "application/json-patch+json")
                .method("PATCH", HttpRequest.BodyPublishers.ofString(patchBody))
                .build(),
            HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), "PATCH table tags: " + response.body());
  }

  private Table getTable(String fqn) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl()
                        + "/v1/tables/name/"
                        + fqn
                        + "?fields=sourceHash,tags&include=all"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), "get table " + fqn + ": " + response.body());
    Table table = OBJECT_MAPPER.readValue(response.body(), Table.class);
    assertNotNull(table.getId());
    return table;
  }

  private void softDelete(String tableId) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/tables/" + tableId))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .DELETE()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertTrue(
        response.statusCode() == 200 || response.statusCode() == 204,
        "soft delete failed: " + response.statusCode() + " " + response.body());
  }
}
