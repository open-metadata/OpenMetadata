package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

/**
 * Tests that each index class's {@code buildSearchIndexDocInternal} populates ONLY entity-specific
 * fields (not common/tag/service/lineage which are now auto-handled by the template method).
 */
class EntitySpecificFieldsTest {

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo =
        Mockito.mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  // ==================== Empty buildSearchIndexDocInternal ====================

  @Test
  void testDashboardIndex_noEntitySpecificFields() {
    Dashboard d = new Dashboard().withId(UUID.randomUUID()).withName("d");
    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new DashboardIndex(d).buildSearchIndexDocInternal(doc);
    assertTrue(result.isEmpty());
  }

  @Test
  void testMlModelIndex_noEntitySpecificFields() {
    MlModel m = new MlModel().withId(UUID.randomUUID()).withName("m");
    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new MlModelIndex(m).buildSearchIndexDocInternal(doc);
    assertTrue(result.isEmpty());
  }

  // ==================== Simple entity-specific fields ====================

  @Test
  void testSearchEntityIndex_setsIndexType() {
    org.openmetadata.schema.entity.data.SearchIndex si =
        new org.openmetadata.schema.entity.data.SearchIndex()
            .withId(UUID.randomUUID())
            .withName("idx")
            .withIndexType(org.openmetadata.schema.api.data.CreateSearchIndex.IndexType.INDEX);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new SearchEntityIndex(si).buildSearchIndexDocInternal(doc);

    assertEquals(
        org.openmetadata.schema.api.data.CreateSearchIndex.IndexType.INDEX,
        result.get("indexType"));
    assertEquals(1, result.size());
  }

  @Test
  void testStoredProcedureIndex_setsProcessedLineage() {
    StoredProcedure sp = new StoredProcedure().withId(UUID.randomUUID()).withName("sp");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new StoredProcedureIndex(sp).buildSearchIndexDocInternal(doc);

    assertTrue(result.containsKey("processedLineage"));
    assertEquals(1, result.size());
  }

  @Test
  void testPipelineIndex_setsName() {
    Pipeline p =
        new Pipeline().withId(UUID.randomUUID()).withName("etl").withDisplayName("ETL Job");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new PipelineIndex(p).buildSearchIndexDocInternal(doc);

    assertEquals("etl", result.get("name"));
  }

  @Test
  void testPipelineIndex_nameNullFallsBackToDisplayName() {
    Pipeline p = new Pipeline().withId(UUID.randomUUID()).withDisplayName("Fallback");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new PipelineIndex(p).buildSearchIndexDocInternal(doc);

    assertEquals("Fallback", result.get("name"));
  }

  // ==================== Tag disabled field ====================

  @Test
  void testTagIndex_disabledTrue() {
    Tag tag = new Tag().withId(UUID.randomUUID()).withName("deprecated").withDisabled(true);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TagIndex(tag).buildSearchIndexDocInternal(doc);

    assertEquals(true, result.get("disabled"));
  }

  @Test
  void testTagIndex_disabledFalse() {
    Tag tag = new Tag().withId(UUID.randomUUID()).withName("active").withDisabled(false);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TagIndex(tag).buildSearchIndexDocInternal(doc);

    assertEquals(false, result.get("disabled"));
  }

  @Test
  void testTagIndex_disabledNull() {
    Tag tag = new Tag().withId(UUID.randomUUID()).withName("unknown");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TagIndex(tag).buildSearchIndexDocInternal(doc);

    assertEquals(false, result.get("disabled"));
  }

  // ==================== User/Team isBot ====================

  @Test
  void testUserIndex_isBotDefaultNotOverridden() {
    // User.isBot defaults to false (non-null), so buildSearchIndexDocInternal won't set it
    User user = new User().withId(UUID.randomUUID()).withName("alice");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new UserIndex(user).buildSearchIndexDocInternal(doc);

    assertFalse(result.containsKey("isBot"));
  }

  @Test
  void testUserIndex_isBotExplicitlyNull_defaultsToFalse() {
    User user = new User().withId(UUID.randomUUID()).withName("alice").withIsBot(null);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new UserIndex(user).buildSearchIndexDocInternal(doc);

    assertEquals(false, result.get("isBot"));
  }

  @Test
  void testUserIndex_isBotTrueNotOverridden() {
    User user = new User().withId(UUID.randomUUID()).withName("bot").withIsBot(true);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new UserIndex(user).buildSearchIndexDocInternal(doc);

    assertFalse(result.containsKey("isBot"));
  }

  @Test
  void testTeamIndex_setsIsBotFalse() {
    Team team = new Team().withId(UUID.randomUUID()).withName("data-team");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TeamIndex(team).buildSearchIndexDocInternal(doc);

    assertEquals(false, result.get("isBot"));
  }

  // ==================== Column-based entity-specific: columnNames, columnNamesFuzzy
  // ====================

  @Test
  void testTableIndex_columnNamesFromColumns() {
    org.openmetadata.schema.type.Column col1 =
        new org.openmetadata.schema.type.Column()
            .withName("email")
            .withDataType(ColumnDataType.VARCHAR);
    org.openmetadata.schema.type.Column col2 =
        new org.openmetadata.schema.type.Column().withName("age").withDataType(ColumnDataType.INT);

    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("users")
            .withFullyQualifiedName("s.d.sc.users")
            .withColumns(List.of(col1, col2));

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TableIndex(table).buildSearchIndexDocInternal(doc);

    @SuppressWarnings("unchecked")
    List<String> names = (List<String>) result.get("columnNames");
    assertEquals(2, names.size());
    assertTrue(names.contains("email"));
    assertTrue(names.contains("age"));
    assertEquals("email age", result.get("columnNamesFuzzy"));
  }

  @Test
  void testTableIndex_entitySpecificFieldsPresent() {
    EntityReference dbRef =
        new EntityReference().withId(UUID.randomUUID()).withType("database").withName("db");
    EntityReference schemaRef =
        new EntityReference().withId(UUID.randomUUID()).withType("databaseSchema").withName("sc");

    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("s.d.sc.orders")
            .withLocationPath("/data/orders")
            .withDatabase(dbRef)
            .withDatabaseSchema(schemaRef);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TableIndex(table).buildSearchIndexDocInternal(doc);

    assertEquals("/data/orders", result.get("locationPath"));
    assertNotNull(result.get("database"));
    assertNotNull(result.get("databaseSchema"));
  }

  // ==================== Topic field names ====================

  @Test
  void testTopicIndex_fieldNamesFromSchema() {
    Field f1 = new Field().withName("userId").withDataType(FieldDataType.STRING);
    Field f2 = new Field().withName("event").withDataType(FieldDataType.STRING);
    MessageSchema schema = new MessageSchema().withSchemaFields(List.of(f1, f2));

    Topic topic =
        new Topic()
            .withId(UUID.randomUUID())
            .withName("events")
            .withFullyQualifiedName("svc.events")
            .withMessageSchema(schema);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TopicIndex(topic).buildSearchIndexDocInternal(doc);

    @SuppressWarnings("unchecked")
    List<String> names = (List<String>) result.get("fieldNames");
    assertEquals(2, names.size());
    assertNotNull(result.get("fieldNamesFuzzy"));
    assertNotNull(result.get("messageSchema"));
  }

  @Test
  void testTopicIndex_noSchemaNoFieldNames() {
    Topic topic =
        new Topic().withId(UUID.randomUUID()).withName("t").withFullyQualifiedName("svc.t");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new TopicIndex(topic).buildSearchIndexDocInternal(doc);

    assertFalse(result.containsKey("fieldNames"));
  }

  // ==================== Container fullPath ====================

  @Test
  void testContainerIndex_setsFullPath() {
    Container c =
        new Container()
            .withId(UUID.randomUUID())
            .withName("bucket")
            .withFullyQualifiedName("svc.bucket")
            .withFullPath("s3://my-bucket/data");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new ContainerIndex(c).buildSearchIndexDocInternal(doc);

    assertEquals("s3://my-bucket/data", result.get("fullPath"));
  }

  // ==================== File entity-specific fields ====================

  @Test
  void testFileIndex_entitySpecificFields() {
    EntityReference dir =
        new EntityReference().withId(UUID.randomUUID()).withType("directory").withName("docs");
    File file =
        new File()
            .withId(UUID.randomUUID())
            .withName("report.pdf")
            .withFullyQualifiedName("svc.docs.report.pdf")
            .withDirectory(dir)
            .withMimeType("application/pdf")
            .withPath("/docs/report.pdf")
            .withSize(1024);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new FileIndex(file).buildSearchIndexDocInternal(doc);

    assertNotNull(result.get("directory"));
    assertEquals("application/pdf", result.get("mimeType"));
    assertEquals("/docs/report.pdf", result.get("path"));
    assertEquals(1024, result.get("size"));
  }

  // ==================== Directory entity-specific fields ====================

  @Test
  void testDirectoryIndex_entitySpecificFields() {
    Directory dir =
        new Directory()
            .withId(UUID.randomUUID())
            .withName("shared")
            .withFullyQualifiedName("svc.shared")
            .withPath("/shared")
            .withIsShared(true)
            .withNumberOfFiles(42);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new DirectoryIndex(dir).buildSearchIndexDocInternal(doc);

    assertEquals("/shared", result.get("path"));
    assertEquals(true, result.get("isShared"));
    assertEquals(42, result.get("numberOfFiles"));
  }

  // ==================== Spreadsheet worksheetNames ====================

  @Test
  void testSpreadsheetIndex_worksheetNames() {
    EntityReference ws1 = new EntityReference().withId(UUID.randomUUID()).withName("Sheet1");
    EntityReference ws2 = new EntityReference().withId(UUID.randomUUID()).withName("Sheet2");

    Spreadsheet sp =
        new Spreadsheet()
            .withId(UUID.randomUUID())
            .withName("budget")
            .withFullyQualifiedName("svc.dir.budget")
            .withPath("/budget.xlsx");

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new SpreadsheetIndex(sp).buildSearchIndexDocInternal(doc);

    assertEquals("/budget.xlsx", result.get("path"));
  }

  // ==================== Worksheet entity-specific fields ====================

  @Test
  void testWorksheetIndex_entitySpecificFields() {
    EntityReference spreadsheet =
        new EntityReference().withId(UUID.randomUUID()).withType("spreadsheet").withName("budget");

    Worksheet ws =
        new Worksheet()
            .withId(UUID.randomUUID())
            .withName("Sheet1")
            .withFullyQualifiedName("svc.budget.Sheet1")
            .withSpreadsheet(spreadsheet)
            .withWorksheetId("ws-123")
            .withRowCount(100)
            .withColumnCount(10)
            .withIsHidden(false);

    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = new WorksheetIndex(ws).buildSearchIndexDocInternal(doc);

    assertNotNull(result.get("spreadsheet"));
    assertEquals("ws-123", result.get("worksheetId"));
    assertEquals(100, result.get("rowCount"));
    assertEquals(10, result.get("columnCount"));
    assertEquals(false, result.get("isHidden"));
  }
}
