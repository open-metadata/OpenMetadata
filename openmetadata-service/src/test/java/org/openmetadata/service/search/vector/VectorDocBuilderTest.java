package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

class VectorDocBuilderTest {

  private static final EmbeddingClient MOCK_CLIENT =
      new EmbeddingClientTest.MockEmbeddingClient(384);

  @Test
  void testBuildEmbeddingFieldsBasic() {
    Table table = createTestTable("test_table", "Test Table", "A test table for unit testing");

    Map<String, Object> fields = VectorDocBuilder.buildEmbeddingFields(table, MOCK_CLIENT);

    assertNotNull(fields);
    assertEquals(table.getId().toString(), fields.get("parentId"));
    assertNotNull(fields.get("embedding"));
    assertNotNull(fields.get("textToEmbed"));
    assertNotNull(fields.get("fingerprint"));
    assertEquals(0, fields.get("chunkIndex"));
    assertTrue((int) fields.get("chunkCount") >= 1);
  }

  @Test
  void testBuildEmbeddingFieldsContainsEmbeddingVector() {
    Table table = createTestTable("vec_table", null, "A table with embedding");

    Map<String, Object> fields = VectorDocBuilder.buildEmbeddingFields(table, MOCK_CLIENT);

    Object embedding = fields.get("embedding");
    assertTrue(embedding instanceof float[]);
    assertEquals(384, ((float[]) embedding).length);
  }

  @Test
  void testBuildEmbeddingFieldsTextToEmbedContainsEntityInfo() {
    Table table = createTestTable("info_table", "Info Display", "Important description");

    Map<String, Object> fields = VectorDocBuilder.buildEmbeddingFields(table, MOCK_CLIENT);

    String textToEmbed = (String) fields.get("textToEmbed");
    assertNotNull(textToEmbed);
    assertTrue(textToEmbed.contains("info_table"));
    assertTrue(textToEmbed.contains("Important description"));
  }

  @Test
  void testFingerprintConsistency() {
    Table table = createTestTable("fp_table", null, "Same description");

    String fp1 = VectorDocBuilder.computeFingerprintForEntity(table);
    String fp2 = VectorDocBuilder.computeFingerprintForEntity(table);

    assertEquals(fp1, fp2);
  }

  @Test
  void testFingerprintChangesWithContent() {
    Table table = createTestTable("fp_table", null, "Original description");
    String fp1 = VectorDocBuilder.computeFingerprintForEntity(table);

    table.setDescription("Modified description");
    String fp2 = VectorDocBuilder.computeFingerprintForEntity(table);

    assertFalse(fp1.equals(fp2));
  }

  @Test
  void testBuildEmbeddingFieldsChunkCount() {
    StringBuilder longDesc = new StringBuilder();
    for (int i = 0; i < 500; i++) {
      longDesc.append("word").append(i).append(" ");
    }
    Table table = createTestTable("chunked_table", null, longDesc.toString());

    Map<String, Object> fields = VectorDocBuilder.buildEmbeddingFields(table, MOCK_CLIENT);

    assertTrue((int) fields.get("chunkCount") > 1);
    assertEquals(0, fields.get("chunkIndex"));
    assertEquals(table.getId().toString(), fields.get("parentId"));
  }

  @Test
  void testMetaLightTextContainsEntityInfo() {
    Table table = createTestTable("meta_table", "Meta Display", "desc");
    table.setFullyQualifiedName("svc.db.schema.meta_table");

    String metaLight = VectorDocBuilder.buildMetaLightText(table, "table");

    assertTrue(metaLight.contains("name: meta_table"));
    assertTrue(metaLight.contains("displayName: Meta Display"));
    assertTrue(metaLight.contains("entityType: table"));
    assertTrue(metaLight.endsWith(" | "));
  }

  @Test
  void testBodyTextContainsDescription() {
    Table table = createTestTable("body_table", null, "This is the body text");

    String bodyText = VectorDocBuilder.buildBodyText(table, "table");

    assertTrue(bodyText.contains("This is the body text"));
  }

  @Test
  void testBodyTextContainsColumns() {
    Table table = createTestTable("col_table", null, "desc");
    Column col = new Column();
    col.setName("my_column");
    col.setDataType(ColumnDataType.VARCHAR);
    table.setColumns(List.of(col));

    String bodyText = VectorDocBuilder.buildBodyText(table, "table");

    assertTrue(bodyText.contains("my_column"));
  }

  @Test
  void testMetaLightTextContainsTags() {
    Table table = createTestTable("tagged_table", null, null);

    TagLabel tag = new TagLabel();
    tag.setTagFQN("PII.Sensitive");
    tag.setName("Sensitive");
    table.setTags(List.of(tag));

    String metaLight = VectorDocBuilder.buildMetaLightText(table, "table");
    assertTrue(metaLight.contains("PII.Sensitive"));
  }

  @Test
  void testMetaLightTextContainsOwners() {
    Table table = createTestTable("owned_table", null, null);

    EntityReference owner = new EntityReference();
    owner.setId(UUID.randomUUID());
    owner.setType("user");
    owner.setName("test_user");
    owner.setDisplayName("Test User");
    table.setOwners(List.of(owner));

    String metaLight = VectorDocBuilder.buildMetaLightText(table, "table");
    assertTrue(metaLight.contains("test_user"));
  }

  @Test
  void testRemoveHtml() {
    assertEquals("hello world", VectorDocBuilder.removeHtml("<p>hello <b>world</b></p>"));
    assertEquals("", VectorDocBuilder.removeHtml(null));
    assertEquals("", VectorDocBuilder.removeHtml(""));
  }

  @Test
  void testOrEmpty() {
    assertEquals("value", VectorDocBuilder.orEmpty("value"));
    assertEquals("[]", VectorDocBuilder.orEmpty(null));
  }

  @Test
  void testJoinOrEmpty() {
    assertEquals("a, b", VectorDocBuilder.joinOrEmpty(List.of("a", "b")));
    assertEquals("[]", VectorDocBuilder.joinOrEmpty(null));
    assertEquals("[]", VectorDocBuilder.joinOrEmpty(List.of()));
  }

  @Test
  void testColumnsToString() {
    Column c1 = new Column();
    c1.setName("col1");
    c1.setDataType(ColumnDataType.INT);
    Column c2 = new Column();
    c2.setName("col2");
    c2.setDataType(ColumnDataType.VARCHAR);

    String result = VectorDocBuilder.columnsToString(List.of(c1, c2));
    assertTrue(result.contains("col1"));
    assertTrue(result.contains("col2"));
  }

  @Test
  void testColumnsToStringNull() {
    assertEquals("[]", VectorDocBuilder.columnsToString(null));
    assertEquals("[]", VectorDocBuilder.columnsToString(List.of()));
  }

  @Test
  void testExtractTierLabel() {
    Table table = createTestTable("tier_table", null, null);
    TagLabel tierTag = new TagLabel();
    tierTag.setTagFQN("Tier.Tier2");
    table.setTags(List.of(tierTag));

    assertEquals("Tier.Tier2", VectorDocBuilder.extractTierLabel(table));
  }

  @Test
  void testExtractTierLabelNoTier() {
    Table table = createTestTable("no_tier_table", null, null);
    TagLabel regularTag = new TagLabel();
    regularTag.setTagFQN("PII.Sensitive");
    table.setTags(List.of(regularTag));

    assertEquals(null, VectorDocBuilder.extractTierLabel(table));
  }

  private Table createTestTable(String name, String displayName, String description) {
    Table table = new Table();
    table.setId(UUID.randomUUID());
    table.setName(name);
    table.setDisplayName(displayName);
    table.setDescription(description);
    table.setFullyQualifiedName("service.db.schema." + name);
    table.setDeleted(false);
    return table;
  }
}
