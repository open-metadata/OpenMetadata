package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.env.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.feed.CreateSuggestion;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Suggestion;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.SuggestionStatus;
import org.openmetadata.schema.type.SuggestionType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SuggestionsResourceIT {

  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  @BeforeAll
  public static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void testCreateDescriptionSuggestion(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withDescription("Suggested description for table")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(entityLink);

    Suggestion suggestion = createSuggestion(createSuggestion);

    assertNotNull(suggestion);
    assertNotNull(suggestion.getId());
    assertEquals("Suggested description for table", suggestion.getDescription());
    assertEquals(entityLink, suggestion.getEntityLink());
    assertEquals(SuggestionType.SuggestDescription, suggestion.getType());
    assertEquals(SuggestionStatus.Open, suggestion.getStatus());
  }

  @Test
  void testCreateTagSuggestion(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    TagLabel tagLabel = SharedEntities.get().PERSONAL_DATA_TAG_LABEL;

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withTagLabels(List.of(tagLabel))
            .withType(SuggestionType.SuggestTagLabel)
            .withEntityLink(entityLink);

    Suggestion suggestion = createSuggestion(createSuggestion);

    assertNotNull(suggestion);
    assertNotNull(suggestion.getId());
    assertEquals(entityLink, suggestion.getEntityLink());
    assertEquals(SuggestionType.SuggestTagLabel, suggestion.getType());
    assertEquals(SuggestionStatus.Open, suggestion.getStatus());
    assertNotNull(suggestion.getTagLabels());
    assertEquals(1, suggestion.getTagLabels().size());
    assertEquals(tagLabel.getTagFQN(), suggestion.getTagLabels().get(0).getTagFQN());
  }

  @Test
  void testCreateColumnDescriptionSuggestion(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String columnLink =
        String.format("<#E::table::%s::columns::id>", table.getFullyQualifiedName());

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withDescription("Suggested description for id column")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(columnLink);

    Suggestion suggestion = createSuggestion(createSuggestion);

    assertNotNull(suggestion);
    assertNotNull(suggestion.getId());
    assertEquals("Suggested description for id column", suggestion.getDescription());
    assertEquals(columnLink, suggestion.getEntityLink());
    assertEquals(SuggestionStatus.Open, suggestion.getStatus());
  }

  @Test
  void testAcceptDescriptionSuggestion(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withDescription("Updated table description")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(entityLink);

    Suggestion suggestion = createSuggestion(createSuggestion);
    assertNotNull(suggestion);
    assertEquals(SuggestionStatus.Open, suggestion.getStatus());

    acceptSuggestion(suggestion.getId());

    Suggestion acceptedSuggestion = getSuggestion(suggestion.getId());
    assertEquals(SuggestionStatus.Accepted, acceptedSuggestion.getStatus());

    Table updatedTable = SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName());
    assertEquals("Updated table description", updatedTable.getDescription());
  }

  @Test
  void testAcceptTagSuggestion(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    TagLabel tagLabel = SharedEntities.get().PERSONAL_DATA_TAG_LABEL;

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withTagLabels(List.of(tagLabel))
            .withType(SuggestionType.SuggestTagLabel)
            .withEntityLink(entityLink);

    Suggestion suggestion = createSuggestion(createSuggestion);
    assertNotNull(suggestion);

    acceptSuggestion(suggestion.getId());

    Suggestion acceptedSuggestion = getSuggestion(suggestion.getId());
    assertEquals(SuggestionStatus.Accepted, acceptedSuggestion.getStatus());

    Table updatedTable =
        Tables.findByName(table.getFullyQualifiedName()).withFields("tags").fetch().get();
    assertNotNull(updatedTable.getTags());
    assertTrue(
        updatedTable.getTags().stream()
            .anyMatch(tag -> tag.getTagFQN().equals(tagLabel.getTagFQN())));
  }

  @Test
  void testRejectSuggestion(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withDescription("Suggestion to be rejected")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(entityLink);

    Suggestion suggestion = createSuggestion(createSuggestion);
    assertNotNull(suggestion);
    assertEquals(SuggestionStatus.Open, suggestion.getStatus());

    rejectSuggestion(suggestion.getId());

    Suggestion rejectedSuggestion = getSuggestion(suggestion.getId());
    assertEquals(SuggestionStatus.Rejected, rejectedSuggestion.getStatus());

    Table unchangedTable = Tables.findByName(table.getFullyQualifiedName()).fetch().get();
    assertNotEquals("Suggestion to be rejected", unchangedTable.getDescription());
  }

  @Test
  void testListSuggestionsByEntity(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateSuggestion suggestion1 =
        new CreateSuggestion()
            .withDescription("First suggestion")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(entityLink);

    CreateSuggestion suggestion2 =
        new CreateSuggestion()
            .withDescription("Second suggestion")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(entityLink);

    Suggestion created1 = createSuggestion(suggestion1);
    Suggestion created2 = createSuggestion(suggestion2);

    SuggestionList suggestionList = listSuggestionsByEntity(table.getFullyQualifiedName());

    assertNotNull(suggestionList);
    assertNotNull(suggestionList.getData());
    assertTrue(suggestionList.getData().size() >= 2);

    List<UUID> suggestionIds = suggestionList.getData().stream().map(Suggestion::getId).toList();
    assertTrue(suggestionIds.contains(created1.getId()));
    assertTrue(suggestionIds.contains(created2.getId()));
  }

  @Test
  void testListSuggestionsByUser(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    User testUser = UserTestFactory.createUser(ns, "suggestionUser");
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withDescription("User-specific suggestion")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(entityLink);

    Suggestion suggestion = createSuggestion(createSuggestion);

    SuggestionList suggestionList =
        listSuggestionsWithFilters(
            table.getFullyQualifiedName(), suggestion.getCreatedBy().getId(), null, null);

    assertNotNull(suggestionList);
    assertNotNull(suggestionList.getData());
    assertTrue(suggestionList.getData().size() >= 1);
    assertTrue(
        suggestionList.getData().stream().anyMatch(s -> s.getId().equals(suggestion.getId())));
  }

  @Test
  void testListSuggestionsByStatus(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withDescription("Suggestion for status filter")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(entityLink);

    Suggestion suggestion = createSuggestion(createSuggestion);

    SuggestionList openSuggestions =
        listSuggestionsWithFilters(
            table.getFullyQualifiedName(), null, null, SuggestionStatus.Open.toString());

    assertNotNull(openSuggestions);
    assertNotNull(openSuggestions.getData());
    assertTrue(
        openSuggestions.getData().stream().anyMatch(s -> s.getId().equals(suggestion.getId())));

    acceptSuggestion(suggestion.getId());

    SuggestionList acceptedSuggestions =
        listSuggestionsWithFilters(
            table.getFullyQualifiedName(), null, null, SuggestionStatus.Accepted.toString());

    assertNotNull(acceptedSuggestions);
    assertTrue(
        acceptedSuggestions.getData().stream().anyMatch(s -> s.getId().equals(suggestion.getId())));
  }

  @Test
  void testAcceptAllSuggestions(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    User suggestionOwner = UserTestFactory.createUser(ns, "bulkUser");
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    for (int i = 1; i <= 3; i++) {
      CreateSuggestion createSuggestion =
          new CreateSuggestion()
              .withDescription("Bulk suggestion " + i)
              .withType(SuggestionType.SuggestDescription)
              .withEntityLink(entityLink);
      createSuggestion(createSuggestion);
    }

    SuggestionList openSuggestions =
        listSuggestionsWithFilters(
            table.getFullyQualifiedName(), null, null, SuggestionStatus.Open.toString());
    int initialOpenCount = openSuggestions.getPaging().getTotal();
    assertTrue(initialOpenCount >= 3);

    acceptAllSuggestions(table.getFullyQualifiedName(), null, SuggestionType.SuggestDescription);

    SuggestionList remainingOpenSuggestions =
        listSuggestionsWithFilters(
            table.getFullyQualifiedName(),
            null,
            SuggestionType.SuggestDescription.toString(),
            SuggestionStatus.Open.toString());

    assertEquals(0, remainingOpenSuggestions.getPaging().getTotal());
  }

  @Test
  void testRejectAllSuggestions(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    for (int i = 1; i <= 3; i++) {
      CreateSuggestion createSuggestion =
          new CreateSuggestion()
              .withDescription("Suggestion to reject " + i)
              .withType(SuggestionType.SuggestDescription)
              .withEntityLink(entityLink);
      createSuggestion(createSuggestion);
    }

    SuggestionList openSuggestions =
        listSuggestionsWithFilters(
            table.getFullyQualifiedName(), null, null, SuggestionStatus.Open.toString());
    int initialOpenCount = openSuggestions.getPaging().getTotal();
    assertTrue(initialOpenCount >= 3);

    rejectAllSuggestions(table.getFullyQualifiedName(), null, SuggestionType.SuggestDescription);

    SuggestionList remainingOpenSuggestions =
        listSuggestionsWithFilters(
            table.getFullyQualifiedName(),
            null,
            SuggestionType.SuggestDescription.toString(),
            SuggestionStatus.Open.toString());

    assertEquals(0, remainingOpenSuggestions.getPaging().getTotal());
  }

  @Test
  void testUpdateSuggestion(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withDescription("Original description")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(entityLink);

    Suggestion suggestion = createSuggestion(createSuggestion);
    assertNotNull(suggestion);

    suggestion.setDescription("Updated description");
    updateSuggestion(suggestion.getId(), suggestion);

    Suggestion updatedSuggestion = getSuggestion(suggestion.getId());
    assertEquals("Updated description", updatedSuggestion.getDescription());
  }

  @Test
  void testAcceptColumnDescriptionSuggestion(TestNamespace ns) throws Exception {
    Table table = createTestTableWithColumns(ns);
    String columnLink =
        String.format("<#E::table::%s::columns::name>", table.getFullyQualifiedName());

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withDescription("Updated name column description")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(columnLink);

    Suggestion suggestion = createSuggestion(createSuggestion);
    acceptSuggestion(suggestion.getId());

    Table updatedTable =
        Tables.findByName(table.getFullyQualifiedName()).withFields("columns").fetch().get();

    Column nameColumn =
        updatedTable.getColumns().stream()
            .filter(col -> col.getName().equals("name"))
            .findFirst()
            .orElse(null);

    assertNotNull(nameColumn);
    assertEquals("Updated name column description", nameColumn.getDescription());
  }

  @Test
  void testAcceptColumnTagSuggestion(TestNamespace ns) throws Exception {
    Table table = createTestTableWithColumns(ns);
    String columnLink =
        String.format("<#E::table::%s::columns::id>", table.getFullyQualifiedName());

    TagLabel tagLabel = SharedEntities.get().PII_SENSITIVE_TAG_LABEL;

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withTagLabels(List.of(tagLabel))
            .withType(SuggestionType.SuggestTagLabel)
            .withEntityLink(columnLink);

    Suggestion suggestion = createSuggestion(createSuggestion);
    acceptSuggestion(suggestion.getId());

    Table updatedTable =
        Tables.findByName(table.getFullyQualifiedName()).withFields("columns,tags").fetch().get();

    Column idColumn =
        updatedTable.getColumns().stream()
            .filter(col -> col.getName().equals("id"))
            .findFirst()
            .orElse(null);

    assertNotNull(idColumn);
    assertNotNull(idColumn.getTags());
    assertTrue(
        idColumn.getTags().stream().anyMatch(tag -> tag.getTagFQN().equals(tagLabel.getTagFQN())));
  }

  @Test
  void testInvalidEntityLink(TestNamespace ns) throws Exception {
    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withDescription("Invalid suggestion")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink("<#E::table::nonexistent_table>");

    assertThrows(Exception.class, () -> createSuggestion(createSuggestion));
  }

  @Test
  void testInvalidEntityLinkFormats(TestNamespace ns) throws Exception {
    CreateSuggestion create =
        new CreateSuggestion()
            .withDescription("Test description")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink("<>");

    assertThrows(Exception.class, () -> createSuggestion(create));

    create.withEntityLink("<#E::>");
    assertThrows(Exception.class, () -> createSuggestion(create));

    create.withEntityLink("<#E::table::>");
    assertThrows(Exception.class, () -> createSuggestion(create));

    create.withEntityLink("<#E::table::tableName");
    assertThrows(Exception.class, () -> createSuggestion(create));
  }

  @Test
  void testCreateSuggestionWithoutDescription(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(entityLink);

    assertThrows(Exception.class, () -> createSuggestion(createSuggestion));
  }

  @Test
  void testPaginationOfSuggestions(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    for (int i = 0; i < 15; i++) {
      CreateSuggestion create =
          new CreateSuggestion()
              .withDescription("Suggestion " + i)
              .withType(SuggestionType.SuggestDescription)
              .withEntityLink(entityLink);
      createSuggestion(create);
    }

    SuggestionList firstPage = listSuggestionsWithPagination(table.getFullyQualifiedName(), 10);
    assertNotNull(firstPage);
    assertEquals(10, firstPage.getData().size());
    assertEquals(15, firstPage.getPaging().getTotal());
    assertNotNull(firstPage.getPaging().getAfter());

    SuggestionList secondPage =
        listSuggestionsWithPagination(
            table.getFullyQualifiedName(), 10, firstPage.getPaging().getAfter(), null);
    assertNotNull(secondPage);
    assertEquals(5, secondPage.getData().size());
    assertNotNull(secondPage.getPaging().getBefore());

    SuggestionList backToFirst =
        listSuggestionsWithPagination(
            table.getFullyQualifiedName(), 10, null, secondPage.getPaging().getBefore());
    assertNotNull(backToFirst);
    assertEquals(10, backToFirst.getData().size());
  }

  @Test
  void testMutuallyExclusiveTags(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    TagLabel tier1Tag =
        new TagLabel()
            .withTagFQN("Tier.Tier1")
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    CreateSuggestion createTier1 =
        new CreateSuggestion()
            .withTagLabels(List.of(tier1Tag))
            .withType(SuggestionType.SuggestTagLabel)
            .withEntityLink(entityLink);

    Suggestion tier1Suggestion = createSuggestion(createTier1);
    acceptSuggestion(tier1Suggestion.getId());

    Table updatedTable =
        Tables.findByName(table.getFullyQualifiedName()).withFields("tags").fetch().get();
    assertNotNull(updatedTable.getTags());
    assertTrue(
        updatedTable.getTags().stream()
            .anyMatch(tag -> tag.getTagFQN().equals(tier1Tag.getTagFQN())));

    TagLabel tier2Tag =
        new TagLabel()
            .withTagFQN("Tier.Tier2")
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    CreateSuggestion createTier2 =
        new CreateSuggestion()
            .withTagLabels(List.of(tier2Tag))
            .withType(SuggestionType.SuggestTagLabel)
            .withEntityLink(entityLink);

    Suggestion tier2Suggestion = createSuggestion(createTier2);
    acceptSuggestion(tier2Suggestion.getId());

    Table finalTable =
        Tables.findByName(table.getFullyQualifiedName()).withFields("tags").fetch().get();
    assertNotNull(finalTable.getTags());
    assertTrue(
        finalTable.getTags().stream()
            .anyMatch(tag -> tag.getTagFQN().equals(tier2Tag.getTagFQN())));
    assertFalse(
        finalTable.getTags().stream()
            .anyMatch(tag -> tag.getTagFQN().equals(tier1Tag.getTagFQN())));
  }

  @Test
  void testNestedColumnSuggestion(TestNamespace ns) throws Exception {
    String shortId = ns.shortPrefix();
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("svc" + shortId, ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName("sc" + shortId, ns, service);

    Column nestedColumn = ColumnBuilder.of("nested", "BIGINT").build();
    Column parentColumn = ColumnBuilder.of("parent", "STRUCT").build();
    parentColumn.withChildren(List.of(nestedColumn));

    Table table =
        Tables.create()
            .name("tbl" + shortId)
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(parentColumn))
            .execute();

    String nestedLink =
        String.format("<#E::table::%s::columns::parent.nested>", table.getFullyQualifiedName());

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withDescription("Nested column description")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(nestedLink);

    Suggestion suggestion = createSuggestion(createSuggestion);
    acceptSuggestion(suggestion.getId());

    Table updatedTable =
        Tables.findByName(table.getFullyQualifiedName()).withFields("columns").fetch().get();
    Column updatedParent = updatedTable.getColumns().get(0);
    Column updatedNested = updatedParent.getChildren().get(0);

    assertEquals("Nested column description", updatedNested.getDescription());
  }

  @Test
  void testDeeplyNestedColumnSuggestion(TestNamespace ns) throws Exception {
    String shortId = ns.shortPrefix();
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("svc" + shortId, ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName("sc" + shortId, ns, service);

    Column level4 = ColumnBuilder.of("level4", "BIGINT").build();
    Column level3 = ColumnBuilder.of("level3", "STRUCT").build();
    level3.withChildren(List.of(level4));
    Column level2 = ColumnBuilder.of("level2", "STRUCT").build();
    level2.withChildren(List.of(level3));
    Column level1 = ColumnBuilder.of("level1", "STRUCT").build();
    level1.withChildren(List.of(level2));

    Table table =
        Tables.create()
            .name("tbl" + shortId)
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(level1))
            .execute();

    String deeplyNestedLink =
        String.format(
            "<#E::table::%s::columns::level1.level2.level3.level4>", table.getFullyQualifiedName());

    CreateSuggestion createSuggestion =
        new CreateSuggestion()
            .withDescription("Deeply nested description")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(deeplyNestedLink);

    Suggestion suggestion = createSuggestion(createSuggestion);
    acceptSuggestion(suggestion.getId());

    Table updatedTable =
        Tables.findByName(table.getFullyQualifiedName()).withFields("columns").fetch().get();
    Column updatedLevel1 = updatedTable.getColumns().get(0);
    Column updatedLevel2 = updatedLevel1.getChildren().get(0);
    Column updatedLevel3 = updatedLevel2.getChildren().get(0);
    Column updatedLevel4 = updatedLevel3.getChildren().get(0);

    assertEquals("Deeply nested description", updatedLevel4.getDescription());
  }

  @Test
  void testBulkAcceptManyColumnSuggestions(TestNamespace ns) throws Exception {
    String shortId = ns.shortPrefix();
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("svc" + shortId, ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName("sc" + shortId, ns, service);

    List<Column> columns = new ArrayList<>();
    for (int i = 1; i <= 50; i++) {
      columns.add(ColumnBuilder.of("column" + i, "VARCHAR").dataLength(255).build());
    }

    Table table =
        Tables.create()
            .name("tbl" + shortId)
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(columns)
            .execute();

    String column25Link =
        String.format("<#E::table::%s::columns::column25>", table.getFullyQualifiedName());
    String column50Link =
        String.format("<#E::table::%s::columns::column50>", table.getFullyQualifiedName());

    CreateSuggestion descSuggestion =
        new CreateSuggestion()
            .withDescription("Updated column25 description")
            .withType(SuggestionType.SuggestDescription)
            .withEntityLink(column25Link);
    createSuggestion(descSuggestion);

    TagLabel tagLabel = SharedEntities.get().PII_SENSITIVE_TAG_LABEL;
    CreateSuggestion tagSuggestion =
        new CreateSuggestion()
            .withTagLabels(List.of(tagLabel))
            .withType(SuggestionType.SuggestTagLabel)
            .withEntityLink(column50Link);
    createSuggestion(tagSuggestion);

    SuggestionList openSuggestions =
        listSuggestionsWithFilters(
            table.getFullyQualifiedName(), null, null, SuggestionStatus.Open.toString());
    assertTrue(openSuggestions.getPaging().getTotal() >= 2);

    acceptAllSuggestions(table.getFullyQualifiedName(), null, SuggestionType.SuggestDescription);
    acceptAllSuggestions(table.getFullyQualifiedName(), null, SuggestionType.SuggestTagLabel);

    SuggestionList remainingOpen =
        listSuggestionsWithFilters(
            table.getFullyQualifiedName(), null, null, SuggestionStatus.Open.toString());
    assertEquals(0, remainingOpen.getPaging().getTotal());

    Table updatedTable =
        Tables.findByName(table.getFullyQualifiedName()).withFields("columns,tags").fetch().get();

    Column column25 =
        updatedTable.getColumns().stream()
            .filter(col -> col.getName().equals("column25"))
            .findFirst()
            .orElse(null);
    assertNotNull(column25);
    assertEquals("Updated column25 description", column25.getDescription());

    Column column50 =
        updatedTable.getColumns().stream()
            .filter(col -> col.getName().equals("column50"))
            .findFirst()
            .orElse(null);
    assertNotNull(column50);
    assertNotNull(column50.getTags());
    assertTrue(
        column50.getTags().stream().anyMatch(tag -> tag.getTagFQN().equals(tagLabel.getTagFQN())));
  }

  // Helper methods

  private Table createTestTable(TestNamespace ns) {
    // Use shortPrefix to avoid FQN length limit (256 chars)
    String shortId = ns.shortPrefix();

    // Create service with short name using factory
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("svc" + shortId, ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName("sc" + shortId, ns, service);

    return TableTestFactory.createSimpleWithName(
        "tbl" + shortId, ns, schema.getFullyQualifiedName());
  }

  private Table createTestTableWithColumns(TestNamespace ns) {
    // Use shortPrefix to avoid FQN length limit (256 chars)
    String shortId = ns.shortPrefix();

    // Create service with short name using factory
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("svc" + shortId, ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName("sc" + shortId, ns, service);

    List<Column> columns =
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build(),
            ColumnBuilder.of("email", "VARCHAR").dataLength(255).build());

    return Tables.create()
        .name("tbl" + shortId)
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(columns)
        .execute();
  }

  private Suggestion createSuggestion(CreateSuggestion createSuggestion) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                "/v1/suggestions",
                createSuggestion,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, Suggestion.class);
  }

  private Suggestion getSuggestion(UUID suggestionId) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/suggestions/" + suggestionId,
                null,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, Suggestion.class);
  }

  private void updateSuggestion(UUID suggestionId, Suggestion suggestion) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/suggestions/" + suggestionId,
            suggestion,
            RequestOptions.builder().build());
  }

  private void acceptSuggestion(UUID suggestionId) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/suggestions/" + suggestionId + "/accept",
            null,
            RequestOptions.builder().build());
  }

  private void rejectSuggestion(UUID suggestionId) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/suggestions/" + suggestionId + "/reject",
            null,
            RequestOptions.builder().build());
  }

  private SuggestionList listSuggestionsByEntity(String entityFQN) throws Exception {
    RequestOptions options = RequestOptions.builder().queryParam("entityFQN", entityFQN).build();

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/suggestions", null, options);
    return MAPPER.readValue(response, SuggestionList.class);
  }

  private SuggestionList listSuggestionsWithFilters(
      String entityFQN, UUID userId, String suggestionType, String status) throws Exception {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();

    if (entityFQN != null) {
      optionsBuilder.queryParam("entityFQN", entityFQN);
    }
    if (userId != null) {
      optionsBuilder.queryParam("userId", userId.toString());
    }
    if (suggestionType != null) {
      optionsBuilder.queryParam("suggestionType", suggestionType);
    }
    if (status != null) {
      optionsBuilder.queryParam("status", status);
    }

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/suggestions", null, optionsBuilder.build());
    return MAPPER.readValue(response, SuggestionList.class);
  }

  private SuggestionList listSuggestionsWithPagination(String entityFQN, Integer limit)
      throws Exception {
    return listSuggestionsWithPagination(entityFQN, limit, null, null);
  }

  private SuggestionList listSuggestionsWithPagination(
      String entityFQN, Integer limit, String after, String before) throws Exception {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();

    if (entityFQN != null) {
      optionsBuilder.queryParam("entityFQN", entityFQN);
    }
    if (limit != null) {
      optionsBuilder.queryParam("limit", limit.toString());
    }
    if (after != null) {
      optionsBuilder.queryParam("after", after);
    }
    if (before != null) {
      optionsBuilder.queryParam("before", before);
    }

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/suggestions", null, optionsBuilder.build());
    return MAPPER.readValue(response, SuggestionList.class);
  }

  private void acceptAllSuggestions(String entityFQN, UUID userId, SuggestionType suggestionType)
      throws Exception {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();

    if (entityFQN != null) {
      optionsBuilder.queryParam("entityFQN", entityFQN);
    }
    if (userId != null) {
      optionsBuilder.queryParam("userId", userId.toString());
    }
    if (suggestionType != null) {
      optionsBuilder.queryParam("suggestionType", suggestionType.toString());
    }

    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/suggestions/accept-all", null, optionsBuilder.build());
  }

  private void rejectAllSuggestions(String entityFQN, UUID userId, SuggestionType suggestionType)
      throws Exception {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();

    if (entityFQN != null) {
      optionsBuilder.queryParam("entityFQN", entityFQN);
    }
    if (userId != null) {
      optionsBuilder.queryParam("userId", userId.toString());
    }
    if (suggestionType != null) {
      optionsBuilder.queryParam("suggestionType", suggestionType.toString());
    }

    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/suggestions/reject-all", null, optionsBuilder.build());
  }

  public static class SuggestionList {
    private List<Suggestion> data;
    private Paging paging;

    public List<Suggestion> getData() {
      return data;
    }

    public void setData(List<Suggestion> data) {
      this.data = data;
    }

    public Paging getPaging() {
      return paging;
    }

    public void setPaging(Paging paging) {
      this.paging = paging;
    }
  }

  public static class Paging {
    private Integer total;
    private String after;
    private String before;

    public Integer getTotal() {
      return total;
    }

    public void setTotal(Integer total) {
      this.total = total;
    }

    public String getAfter() {
      return after;
    }

    public void setAfter(String after) {
      this.after = after;
    }

    public String getBefore() {
      return before;
    }

    public void setBefore(String before) {
      this.before = before;
    }
  }
}
