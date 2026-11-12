package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.TextChunkManager;

class VectorDocBuilderTest {

  private static final EmbeddingClient MOCK_CLIENT =
      new EmbeddingClientTest.MockEmbeddingClient(384);

  static {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", "table");
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("database", "database");
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("glossaryterm", "glossaryTerm");
  }

  @Test
  void testBuildEmbeddingFieldsBasic() {
    Table table = createTestTable("test_table", "Test Table", "A test table for unit testing");

    Map<String, Object> fields = VectorDocBuilder.buildEmbeddingFields(table, MOCK_CLIENT);

    assertNotNull(fields);
    assertEquals(table.getId().toString(), fields.get("parentId"));
    assertNotNull(fields.get("embedding"));
    assertNotNull(fields.get("textToLLMContext"));
    assertNotNull(fields.get("textToEmbed"));
    assertNotNull(fields.get("fingerprint"));
    assertEquals(0, fields.get("chunkIndex"));
    assertTrue((int) fields.get("chunkCount") >= 1);
  }

  @Test
  void testSemanticTextDropsStructuralScaffolding() {
    Table table = createTestTable("orders", null, "Order table");
    table.setFullyQualifiedName("postgres.jaffle_shop.public.orders");

    String semantic = VectorDocBuilder.buildSemanticMetaLightText(table, "table");

    assertTrue(semantic.contains("orders"));
    assertFalse(semantic.contains("name:"));
    assertFalse(semantic.contains("displayName:"));
    assertFalse(semantic.contains("entityType:"));
    assertFalse(semantic.contains("serviceType:"));
    assertFalse(semantic.contains("fullyQualifiedName:"));
    assertFalse(semantic.contains("postgres.jaffle_shop.public.orders"));
    assertFalse(semantic.contains("[]"));
    assertFalse(semantic.contains(" | "));
  }

  @Test
  void testSemanticTextIncludesPopulatedFieldsAsPhrases() {
    Table table = createTestTable("orders", "Orders Display", "desc");
    TagLabel tag = new TagLabel();
    tag.setTagFQN("PII.Sensitive");
    tag.setName("Sensitive");
    table.setTags(List.of(tag));

    String semantic = VectorDocBuilder.buildSemanticMetaLightText(table, "table");

    assertTrue(semantic.contains("Orders Display"));
    assertTrue(semantic.contains("orders"));
    assertTrue(semantic.contains("Tagged as PII Sensitive"));
    assertFalse(semantic.contains("owners"));
    assertFalse(semantic.contains("user."));
  }

  @Test
  void testSemanticBodyTextSkipsEmptyDescriptionAndColumns() {
    Table table = createTestTable("empty", null, null);
    table.setColumns(null);

    String semanticBody = VectorDocBuilder.buildSemanticBodyText(table, "table");

    assertEquals("", semanticBody);
  }

  @Test
  void testSemanticTextPrependsTypeLabelWhenContentIsEmpty() {
    Table table = new Table();
    table.setId(UUID.randomUUID());
    table.setName("lonely");
    table.setDeleted(false);

    Map<String, Object> fields = VectorDocBuilder.buildEmbeddingFields(table, MOCK_CLIENT);
    String semantic = (String) fields.get("textToEmbed");

    assertEquals("table lonely", semantic);
  }

  @Test
  void testSemanticTextJoinsMetaAndBodyWithPeriod() {
    Table table = createTestTable("customers", "Customers dashboard", "A sample dashboard");

    Map<String, Object> fields = VectorDocBuilder.buildEmbeddingFields(table, MOCK_CLIENT);
    String semantic = (String) fields.get("textToEmbed");

    assertTrue(semantic.startsWith("table Customers dashboard (customers)"));
    assertTrue(semantic.contains(". A sample dashboard"));
    assertFalse(semantic.contains("chunk"));
  }

  @Test
  void testSemanticBodyIncludesChildContextForContainers() {
    Database database = new Database();
    database.setId(UUID.randomUUID());
    database.setName("customers");
    database.setDeleted(false);

    EntityReference ethereum = new EntityReference();
    ethereum.setId(UUID.randomUUID());
    ethereum.setType("databaseSchema");
    ethereum.setName("CRYPTO_ETHEREUM");
    EntityReference bitcoin = new EntityReference();
    bitcoin.setId(UUID.randomUUID());
    bitcoin.setType("databaseSchema");
    bitcoin.setName("CRYPTO_BITCOIN");
    database.setDatabaseSchemas(List.of(ethereum, bitcoin));

    String body = VectorDocBuilder.buildSemanticBodyText(database, "database");

    assertTrue(body.contains("Contains schemas CRYPTO_ETHEREUM, CRYPTO_BITCOIN"));
  }

  @Test
  void testSemanticBodySkipsChildContextForNonContainers() {
    Table table = createTestTable("orders", null, "Order table");

    String body = VectorDocBuilder.buildSemanticBodyText(table, "table");

    assertFalse(body.contains("Contains"));
  }

  @Test
  void testSemanticMetaLightUsesTypeLabelForContainerWithoutName() {
    Database database = new Database();
    database.setId(UUID.randomUUID());
    database.setDeleted(false);

    String metaLight = VectorDocBuilder.buildSemanticMetaLightText(database, "database");

    assertEquals("database", metaLight);
  }

  @Test
  void testHumanizeEntityTypeSplitsCamelCase() {
    assertEquals("", VectorDocBuilder.humanizeEntityType(null));
    assertEquals("", VectorDocBuilder.humanizeEntityType(""));
    assertEquals("table", VectorDocBuilder.humanizeEntityType("table"));
    assertEquals("database Schema", VectorDocBuilder.humanizeEntityType("databaseSchema"));
    assertEquals("data Product", VectorDocBuilder.humanizeEntityType("dataProduct"));
    assertEquals("api Collection", VectorDocBuilder.humanizeEntityType("apiCollection"));
    assertEquals("glossary Term", VectorDocBuilder.humanizeEntityType("glossaryTerm"));
  }

  @Test
  void testTextToEmbedRemainsLegacyFormat() {
    Table table = createTestTable("orders", null, "Order table");

    Map<String, Object> fields = VectorDocBuilder.buildEmbeddingFields(table, MOCK_CLIENT);
    String legacy = (String) fields.get("textToLLMContext");
    String semantic = (String) fields.get("textToEmbed");

    assertTrue(
        legacy.contains("displayName: []"), "legacy textToLLMContext keeps empty placeholders");
    assertTrue(legacy.contains(" | chunk 1/"));
    assertFalse(semantic.contains("[]"));
    assertFalse(semantic.contains("name:"));
    assertTrue(semantic.contains("orders"));
    assertTrue(semantic.contains("Order table"));
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

    String textToLLMContext = (String) fields.get("textToLLMContext");
    assertNotNull(textToLLMContext);
    assertTrue(textToLLMContext.contains("info_table"));
    assertTrue(textToLLMContext.contains("Important description"));
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
  void columnsToString_keepsItsExactFormatForEveryDescriptionShape() {
    assertEquals(
        "order_id (Order key), blank, none, literal",
        VectorDocBuilder.columnsToString(describedBlankNullAndLiteralNullColumns()));
  }

  // Expected values were produced by origin/main's VectorDocBuilder before topics shared the
  // column formatting and chunk-overflow code. Any drift changes the fingerprint or chunk text of
  // every table and re-embeds them all.
  @Test
  void tableChunkText_isByteIdenticalToTheFormatBeforeTopicFields() {
    Table table =
        createTestTable("orders", null, "Customer orders")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withColumns(describedBlankNullAndLiteralNullColumns());

    Map<String, Object> chunk = VectorDocBuilder.fromEntity(table, MOCK_CLIENT).getFirst();

    assertEquals(
        "table orders. Customer orders. Columns include order_id (Order key), blank, none, literal",
        chunk.get("textToEmbed"));
    assertEquals(
        "name: orders; displayName: []; entityType: table; serviceType: []; fullyQualifiedName:"
            + " svc.db.sch.orders; tier: []; certification: []; domains: []; tags: []; Associated"
            + " glossary terms: []; owners: []; customProperties: [] | description: Customer"
            + " orders; columns: order_id (Order key), blank, none, literal | chunk 1/1",
        chunk.get("textToLLMContext"));
  }

  @Test
  void wideTableChunks_areByteIdenticalToTheFormatBeforeTopicFields() {
    List<Column> columns = new ArrayList<>();
    for (int i = 0; i < 300; i++) {
      columns.add(column("column_" + i, "Description of column number " + i));
    }
    Table table =
        createTestTable("wide", null, "Wide table")
            .withFullyQualifiedName("svc.db.sch.wide")
            .withColumns(columns);

    List<Map<String, Object>> chunks = VectorDocBuilder.fromEntity(table, MOCK_CLIENT);

    StringBuilder allText = new StringBuilder();
    for (Map<String, Object> chunk : chunks) {
      allText.append(chunk.get("textToEmbed")).append('\n');
      allText.append(chunk.get("textToLLMContext")).append('\n');
    }
    assertEquals(5, chunks.size());
    assertEquals("9ea24f4c98b8a02850263d6e1db25b67", chunks.getFirst().get("fingerprint"));
    assertEquals(
        "a03ea0d79efb05b3bcf5fdcd53811526",
        TextChunkManager.computeFingerprint(allText.toString()));
  }

  @Test
  void semanticChunkFor_givesTheLastDocEveryOverflowChunk() {
    List<String> contextChunks = List.of("c0", "c1");

    assertEquals("s0", VectorDocBuilder.semanticChunkFor(contextChunks, List.of("s0", "s1"), 0));
    assertEquals("s1", VectorDocBuilder.semanticChunkFor(contextChunks, List.of("s0", "s1"), 1));
    assertEquals(
        "s1 s2", VectorDocBuilder.semanticChunkFor(contextChunks, List.of("s0", "s1", "s2"), 1));
    assertEquals("", VectorDocBuilder.semanticChunkFor(contextChunks, List.of("s0"), 1));
  }

  @Test
  void containerChildNames_reachTheEmbeddingWhenTheSemanticBodyOverflows() {
    // A 379-word description fills the single context chunk ("description: " + 379 words), so the
    // semantic body's "Contains schemas ..." phrase lands in a second semantic chunk.
    StringBuilder description = new StringBuilder("word0");
    for (int i = 1; i < 379; i++) {
      description.append(" word").append(i);
    }
    Database database = new Database();
    database.setId(UUID.randomUUID());
    database.setName("sales");
    database.setFullyQualifiedName("svc.sales");
    database.setDescription(description.toString());
    database.setDatabaseSchemas(
        List.of(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType("databaseSchema")
                .withName("schema_a"),
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType("databaseSchema")
                .withName("schema_b")));

    List<Map<String, Object>> chunks = VectorDocBuilder.fromEntity(database, MOCK_CLIENT);

    assertEquals(1, chunks.size());
    String embedded = (String) chunks.getFirst().get("textToEmbed");
    assertTrue(embedded.endsWith("word378. Contains schemas schema_a, schema_b"), embedded);
    assertTrue(
        ((String) VectorDocBuilder.buildEmbeddingFields(database, MOCK_CLIENT).get("textToEmbed"))
            .endsWith("Contains schemas schema_a, schema_b"));
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
    assertNotNull(fields.get("textToLLMContext"));
    String textToLLMContext = (String) fields.get("textToLLMContext");
    assertTrue(textToLLMContext.contains("finance.profit"));
    assertTrue(textToLLMContext.contains("finance.cost"));
    assertTrue(textToLLMContext.contains("relatedTerms:"));
  }

  @Test
  void testBuildEmbeddingFieldsWithGlossaryTermNoRelatedTerms() {
    GlossaryTerm term = createTestGlossaryTerm("revenue", "Revenue", "Annual revenue");
    term.setRelatedTerms(null);

    Map<String, Object> fields = VectorDocBuilder.buildEmbeddingFields(term, MOCK_CLIENT);

    assertNotNull(fields);
    assertNotNull(fields.get("textToLLMContext"));
    String textToLLMContext = (String) fields.get("textToLLMContext");
    assertTrue(textToLLMContext.contains("relatedTerms:"));
    assertFalse(textToLLMContext.contains("finance."));
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

  @Test
  void testRegisterCustomExtractorIsUsed() {
    String type = "customExtractorTest_" + UUID.randomUUID();
    VectorDocBuilder.registerBodyTextExtractor(
        type, entity -> "custom body for " + entity.getName());

    Table table = createTestTable("ext_table", null, "original desc");
    String body = VectorDocBuilder.buildBodyText(table, type);

    assertEquals("custom body for ext_table", body);
  }

  @Test
  void testCustomExtractorReturningNullFallsBackToDefault() {
    String type = "nullExtractorTest_" + UUID.randomUUID();
    VectorDocBuilder.registerBodyTextExtractor(type, entity -> null);

    Table table = createTestTable("fallback_table", null, "fallback desc");
    String body = VectorDocBuilder.buildBodyText(table, type);

    assertTrue(body.contains("fallback desc"));
  }

  @Test
  void testCustomExtractorThrowingFallsBackToDefault() {
    String type = "throwExtractorTest_" + UUID.randomUUID();
    VectorDocBuilder.registerBodyTextExtractor(
        type,
        entity -> {
          throw new RuntimeException("boom");
        });

    Table table = createTestTable("err_table", null, "safe desc");
    String body = VectorDocBuilder.buildBodyText(table, type);

    assertTrue(body.contains("safe desc"));
  }

  @Test
  void testRegisterExtractorIgnoresNullAndBlank() {
    String type = "ignoreTest_" + UUID.randomUUID();

    VectorDocBuilder.registerBodyTextExtractor(null, entity -> "nope");
    VectorDocBuilder.registerBodyTextExtractor("", entity -> "nope");
    VectorDocBuilder.registerBodyTextExtractor("  ", entity -> "nope");
    VectorDocBuilder.registerBodyTextExtractor(type, null);

    Table table = createTestTable("guard_table", null, "default desc");
    String body = VectorDocBuilder.buildBodyText(table, type);

    assertTrue(body.contains("default desc"));
  }

  @Test
  void testVectorBodyTextContributorRegister() {
    String type = "contributorTest_" + UUID.randomUUID();

    VectorBodyTextContributor contributor =
        new VectorBodyTextContributor() {
          @Override
          public String entityType() {
            return type;
          }

          @Override
          public VectorDocBuilder.BodyTextExtractor extractor() {
            return entity -> "contributed: " + entity.getName();
          }
        };

    contributor.register();

    Table table = createTestTable("contrib_table", null, "ignored");
    String body = VectorDocBuilder.buildBodyText(table, type);

    assertEquals("contributed: contrib_table", body);
  }

  @Test
  void testBuildBodyTextWithNullEntityType() {
    Table table = createTestTable("null_type_table", null, "some desc");
    String body = VectorDocBuilder.buildBodyText(table, null);

    assertTrue(body.contains("some desc"));
  }

  private static List<Column> describedBlankNullAndLiteralNullColumns() {
    return List.of(
        column("order_id", "Order key"),
        column("blank", "  "),
        column("none", null),
        column("literal", "null"));
  }

  private static Column column(String name, String description) {
    return new Column()
        .withName(name)
        .withDataType(ColumnDataType.STRING)
        .withDescription(description);
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
