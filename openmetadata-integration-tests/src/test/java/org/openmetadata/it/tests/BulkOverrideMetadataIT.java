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
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;

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

  @Test
  void test_botCannotOverwriteColumnDescription_withoutOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_col_off", "desc", "hash-v1");
    setColumnDescription(original, "curated column description");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_col_off", "desc", "hash-v2");
    setColumnDescription(changed, "connector column description");
    BulkApi.upsert("tables", List.of(changed), false, botToken);

    assertEquals(
        "curated column description",
        columnDescription(getTable(fqn)),
        "a bot PUT must not overwrite a non-empty column description without overrideMetadata");
  }

  @Test
  void test_botOverwritesColumnDescription_withOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_col_on", "desc", "hash-v1");
    setColumnDescription(original, "curated column description");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_col_on", "desc", "hash-v2");
    setColumnDescription(changed, "connector column description");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    assertEquals(
        "connector column description",
        columnDescription(getTable(fqn)),
        "overrideMetadata=true lets a bot PUT overwrite the column description");
  }

  @Test
  void test_overrideDoesNotBlankColumnDescription(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_col_blank", "desc", "hash-v1");
    setColumnDescription(original, "curated column description");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    // The connector finds no comment on the column, so it omits the field from the payload.
    CreateTable changed = table(ns, schemaFqn, "ovr_col_blank", "desc", "hash-v2");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    assertEquals(
        "curated column description",
        columnDescription(getTable(fqn)),
        "overrideMetadata=true must not blank a column description when none is supplied");
  }

  @Test
  void test_columnDisplayNamePreserved_evenWithOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_col_dn", "desc", "hash-v1");
    original.getColumns().getFirst().withDisplayName("Curated Column");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_col_dn", "desc", "hash-v2");
    changed.getColumns().getFirst().withDisplayName("Connector Column");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    assertEquals(
        "Curated Column",
        getTable(fqn).getColumns().getFirst().getDisplayName(),
        "overrideMetadata governs column descriptions only; a curated column displayName is "
            + "always preserved from a bot PUT");
  }

  @Test
  void test_botReplacesMutuallyExclusiveTableTag_withOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    List<TagLabel> tags = createMutuallyExclusiveTags(ns, "ovr_table_tags");
    CreateTable original = table(ns, schemaFqn, "ovr_table_tags", "desc", "hash-v1");
    original.setTags(List.of(tags.getFirst()));
    BulkApi.upsert("tables", List.of(original), false, BulkApi.botToken());

    CreateTable changed = table(ns, schemaFqn, "ovr_table_tags", "desc", "hash-v2");
    changed.setTags(List.of(tags.getLast()));
    BulkApi.upsert("tables", List.of(changed), true, BulkApi.botToken());

    String fqn = schemaFqn + "." + original.getName();
    assertEquals(List.of(tags.getLast().getTagFQN()), tagFqns(getTable(fqn).getTags()));
  }

  @Test
  void test_botReplacesMutuallyExclusiveColumnTag_withOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    List<TagLabel> tags = createMutuallyExclusiveTags(ns, "ovr_column_tags");
    CreateTable original = table(ns, schemaFqn, "ovr_column_tags", "desc", "hash-v1");
    original.getColumns().getFirst().setTags(List.of(tags.getFirst()));
    BulkApi.upsert("tables", List.of(original), false, BulkApi.botToken());

    CreateTable changed = table(ns, schemaFqn, "ovr_column_tags", "desc", "hash-v2");
    changed.getColumns().getFirst().setTags(List.of(tags.getLast()));
    BulkApi.upsert("tables", List.of(changed), true, BulkApi.botToken());

    String fqn = schemaFqn + "." + original.getName();
    assertEquals(
        List.of(tags.getLast().getTagFQN()),
        tagFqns(getTable(fqn).getColumns().getFirst().getTags()));
  }

  @Test
  void test_overrideDoesNotRemoveTagsWhenNoneSupplied(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    TagLabel tag = createMutuallyExclusiveTags(ns, "ovr_missing_tags").getFirst();
    CreateTable original = table(ns, schemaFqn, "ovr_missing_tags", "desc", "hash-v1");
    original.setTags(List.of(tag));
    BulkApi.upsert("tables", List.of(original), false, BulkApi.botToken());

    CreateTable changed = table(ns, schemaFqn, "ovr_missing_tags", "desc", "hash-v2");
    BulkApi.upsert("tables", List.of(changed), true, BulkApi.botToken());

    String fqn = schemaFqn + "." + original.getName();
    assertEquals(List.of(tag.getTagFQN()), tagFqns(getTable(fqn).getTags()));
  }

  // ===================================================================
  // HELPERS
  // ===================================================================

  private void setColumnDescription(CreateTable createTable, String description) {
    createTable.getColumns().getFirst().withDescription(description);
  }

  private String columnDescription(Table table) {
    return table.getColumns().getFirst().getDescription();
  }

  private String setupSchema(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    return schema.getFullyQualifiedName();
  }

  private List<TagLabel> createMutuallyExclusiveTags(TestNamespace ns, String name) {
    Classification classification =
        SdkClients.adminClient()
            .classifications()
            .create(
                new CreateClassification()
                    .withName(ns.prefix(name))
                    .withDescription("Mutually exclusive tags for override metadata tests")
                    .withMutuallyExclusive(true));
    Tag original = createTag(classification, "original");
    Tag replacement = createTag(classification, "replacement");
    return List.of(tagLabel(original), tagLabel(replacement));
  }

  private Tag createTag(Classification classification, String name) {
    return SdkClients.adminClient()
        .tags()
        .create(
            new CreateTag()
                .withName(name)
                .withDescription("Tag for override metadata tests")
                .withClassification(classification.getName()));
  }

  private TagLabel tagLabel(Tag tag) {
    return new TagLabel()
        .withTagFQN(tag.getFullyQualifiedName())
        .withSource(TagLabel.TagSource.CLASSIFICATION);
  }

  private List<String> tagFqns(List<TagLabel> tags) {
    return tags.stream().map(TagLabel::getTagFQN).toList();
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
            .uri(
                URI.create(
                    SdkClients.getServerUrl() + "/v1/tables/name/" + fqn + "?fields=columns,tags"))
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
