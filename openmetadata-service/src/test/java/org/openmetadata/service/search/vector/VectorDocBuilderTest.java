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
  void testFromEntityBasic() {
    Table table = createTestTable("test_table", "Test Table", "A test table for unit testing");

    List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(table, MOCK_CLIENT);

    assertNotNull(docs);
    assertFalse(docs.isEmpty());
    Map<String, Object> doc = docs.getFirst();
    assertEquals(table.getId().toString(), doc.get("parent_id"));
    assertEquals("test_table", doc.get("name"));
    assertEquals("Test Table", doc.get("displayName"));
    assertEquals("service.db.schema.test_table", doc.get("fullyQualifiedName"));
    assertNotNull(doc.get("embedding"));
    assertNotNull(doc.get("fingerprint"));
    assertEquals(0, doc.get("chunk_index"));
    assertEquals(1, doc.get("chunk_count"));
  }

  @Test
  void testFromEntityWithTags() {
    Table table = createTestTable("tagged_table", null, null);

    TagLabel tag = new TagLabel();
    tag.setTagFQN("PII.Sensitive");
    tag.setName("Sensitive");
    table.setTags(List.of(tag));

    List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(table, MOCK_CLIENT);

    Map<String, Object> doc = docs.getFirst();
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> tags = (List<Map<String, Object>>) doc.get("tags");
    assertNotNull(tags);
    assertEquals(1, tags.size());
    assertEquals("PII.Sensitive", tags.getFirst().get("tagFQN"));
  }

  @Test
  void testFromEntityWithTier() {
    Table table = createTestTable("tiered_table", null, null);

    TagLabel tierTag = new TagLabel();
    tierTag.setTagFQN("Tier.Tier1");
    tierTag.setName("Tier1");
    table.setTags(List.of(tierTag));

    List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(table, MOCK_CLIENT);

    Map<String, Object> doc = docs.getFirst();
    @SuppressWarnings("unchecked")
    Map<String, Object> tier = (Map<String, Object>) doc.get("tier");
    assertNotNull(tier);
    assertEquals("Tier.Tier1", tier.get("tagFQN"));
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> tags = (List<Map<String, Object>>) doc.get("tags");
    assertTrue(tags.isEmpty());
  }

  @Test
  void testFromEntityWithOwners() {
    Table table = createTestTable("owned_table", null, null);

    EntityReference owner = new EntityReference();
    owner.setId(UUID.randomUUID());
    owner.setType("user");
    owner.setName("test_user");
    owner.setDisplayName("Test User");
    table.setOwners(List.of(owner));

    List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(table, MOCK_CLIENT);

    Map<String, Object> doc = docs.getFirst();
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> owners = (List<Map<String, Object>>) doc.get("owners");
    assertNotNull(owners);
    assertEquals(1, owners.size());
    assertEquals("test_user", owners.getFirst().get("name"));
    assertEquals("user", owners.getFirst().get("type"));
  }

  @Test
  void testFromEntityWithColumns() {
    Table table = createTestTable("column_table", null, "A table with columns");

    Column col1 = new Column();
    col1.setName("id");
    col1.setDataType(ColumnDataType.INT);
    col1.setDescription("Primary key");

    Column col2 = new Column();
    col2.setName("email");
    col2.setDataType(ColumnDataType.VARCHAR);
    col2.setDescription("User email address");

    table.setColumns(List.of(col1, col2));

    List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(table, MOCK_CLIENT);

    Map<String, Object> doc = docs.getFirst();
    @SuppressWarnings("unchecked")
    List<String> columns = (List<String>) doc.get("columns");
    assertNotNull(columns);
    assertEquals(2, columns.size());
    assertEquals("id", columns.get(0));
    assertEquals("email", columns.get(1));
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
  void testMultiChunkDocument() {
    StringBuilder longDesc = new StringBuilder();
    for (int i = 0; i < 500; i++) {
      longDesc.append("word").append(i).append(" ");
    }
    Table table = createTestTable("chunked_table", null, longDesc.toString());

    List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(table, MOCK_CLIENT);

    assertTrue(docs.size() > 1);
    for (int i = 0; i < docs.size(); i++) {
      assertEquals(i, docs.get(i).get("chunk_index"));
      assertEquals(docs.size(), docs.get(i).get("chunk_count"));
      assertEquals(table.getId().toString(), docs.get(i).get("parent_id"));
    }
  }

  @Test
  void testDeletedFlag() {
    Table table = createTestTable("deleted_table", null, null);
    table.setDeleted(true);

    List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(table, MOCK_CLIENT);

    assertEquals(true, docs.getFirst().get("deleted"));
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
