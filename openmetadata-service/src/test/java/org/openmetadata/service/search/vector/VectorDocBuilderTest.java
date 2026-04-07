package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;
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
    assertInstanceOf(float[].class, embedding);
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

    assertNotEquals(fp1, fp2);
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

    assertNull(VectorDocBuilder.extractTierLabel(table));
  }

  @Test
  void testBuildEmbeddingFieldsWithGlossaryTermRelations() {
    GlossaryTerm term = createTestGlossaryTerm("revenue", "Revenue", "Annual revenue metric");

    EntityReference ref1 = new EntityReference();
    ref1.setId(UUID.randomUUID());
    ref1.setType("glossaryTerm");
    ref1.setName("profit");
    ref1.setDisplayName("Profit");
    ref1.setFullyQualifiedName("finance.profit");

    EntityReference ref2 = new EntityReference();
    ref2.setId(UUID.randomUUID());
    ref2.setType("glossaryTerm");
    ref2.setName("cost");
    ref2.setDisplayName("Cost");
    ref2.setFullyQualifiedName("finance.cost");

    TermRelation rel1 = new TermRelation().withTerm(ref1).withRelationType("broader");
    TermRelation rel2 = new TermRelation().withTerm(ref2).withRelationType("synonym");
    term.setRelatedTerms(List.of(rel1, rel2));

    Map<String, Object> fields = VectorDocBuilder.buildEmbeddingFields(term, MOCK_CLIENT);

    assertNotNull(fields);
    assertNotNull(fields.get("embedding"));
    assertNotNull(fields.get("textToEmbed"));
    String textToEmbed = (String) fields.get("textToEmbed");
    assertTrue(textToEmbed.contains("finance.profit"));
    assertTrue(textToEmbed.contains("finance.cost"));
    assertTrue(textToEmbed.contains("relatedTerms:"));
  }

  @Test
  void testBuildEmbeddingFieldsWithGlossaryTermNoRelatedTerms() {
    GlossaryTerm term = createTestGlossaryTerm("revenue", "Revenue", "Annual revenue");
    term.setRelatedTerms(null);

    Map<String, Object> fields = VectorDocBuilder.buildEmbeddingFields(term, MOCK_CLIENT);

    assertNotNull(fields);
    assertNotNull(fields.get("textToEmbed"));
    String textToEmbed = (String) fields.get("textToEmbed");
    assertTrue(textToEmbed.contains("relatedTerms:"));
    assertFalse(textToEmbed.contains("finance."));
  }

  @Test
  void testGlossaryTermMetaLightIncludesRelatedTerms() {
    GlossaryTerm term = createTestGlossaryTerm("revenue", "Revenue", "Annual revenue");

    EntityReference ref = new EntityReference();
    ref.setId(UUID.randomUUID());
    ref.setType("glossaryTerm");
    ref.setName("profit");
    ref.setFullyQualifiedName("finance.profit");

    TermRelation rel = new TermRelation().withTerm(ref).withRelationType("synonym");
    term.setRelatedTerms(List.of(rel));

    String metaLight = VectorDocBuilder.buildMetaLightText(term, "glossaryTerm");

    assertTrue(metaLight.contains("relatedTerms:"));
    assertTrue(metaLight.contains("finance.profit"));
  }

  @Test
  void testGlossaryTermWithSynonymsInMetaLight() {
    GlossaryTerm term = createTestGlossaryTerm("revenue", "Revenue", "Annual revenue");
    term.setSynonyms(List.of("income", "earnings"));

    String metaLight = VectorDocBuilder.buildMetaLightText(term, "glossaryTerm");

    assertTrue(metaLight.contains("synonyms:"));
    assertTrue(metaLight.contains("income"));
    assertTrue(metaLight.contains("earnings"));
  }

  private GlossaryTerm createTestGlossaryTerm(String name, String displayName, String description) {
    GlossaryTerm term = new GlossaryTerm();
    term.setId(UUID.randomUUID());
    term.setName(name);
    term.setDisplayName(displayName);
    term.setDescription(description);
    term.setFullyQualifiedName("glossary." + name);
    term.setDeleted(false);
    return term;
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
