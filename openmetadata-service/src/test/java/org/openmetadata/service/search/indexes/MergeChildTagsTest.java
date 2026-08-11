package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

/**
 * Tests that child tags (from columns, schema fields) are correctly merged into the "tags" field
 * during {@code buildSearchIndexDocInternal} via {@link TaggableIndex#mergeChildTags}. Verifies
 * single-pass flattening: each index flattens child structures once and uses the result for both
 * name extraction and tag merging.
 */
class MergeChildTagsTest {

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

  private void mockStatics() {
    entityStaticMock
        .when(() -> Entity.getEntityTags(anyString(), any()))
        .thenReturn(Collections.emptyList());
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDao = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relDao);
    when(relDao.findFrom(any(UUID.class), anyString(), anyInt()))
        .thenReturn(Collections.emptyList());
    entityStaticMock.when(Entity::getCollectionDAO).thenReturn(dao);
  }

  // ==================== mergeChildTags unit tests ====================

  @Test
  void testMergeChildTags_mergesIntoExistingEntityTags() {
    TagLabel entityTag =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);
    TagLabel childTag =
        new TagLabel().withTagFQN("PII.Email").withSource(TagLabel.TagSource.CLASSIFICATION);

    Map<String, Object> doc = new HashMap<>();
    doc.put("tags", new ArrayList<>(List.of(entityTag)));

    Set<List<TagLabel>> childTagSets = new HashSet<>();
    childTagSets.add(List.of(childTag));

    // Use a concrete TaggableIndex to call the default method
    mockStatics();
    Table table = new Table().withId(UUID.randomUUID()).withName("t").withFullyQualifiedName("s.t");
    new TableIndex(table).mergeChildTags(doc, childTagSets);

    @SuppressWarnings("unchecked")
    List<TagLabel> merged = (List<TagLabel>) doc.get("tags");
    assertEquals(2, merged.size());
    assertTrue(merged.stream().anyMatch(t -> "PII.Sensitive".equals(t.getTagFQN())));
    assertTrue(merged.stream().anyMatch(t -> "PII.Email".equals(t.getTagFQN())));
  }

  @Test
  void testMergeChildTags_deduplicatesByTagFQN() {
    TagLabel entityTag =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);
    TagLabel childTag =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);

    Map<String, Object> doc = new HashMap<>();
    doc.put("tags", new ArrayList<>(List.of(entityTag)));

    Set<List<TagLabel>> childTagSets = new HashSet<>();
    childTagSets.add(List.of(childTag));

    mockStatics();
    Table table = new Table().withId(UUID.randomUUID()).withName("t").withFullyQualifiedName("s.t");
    new TableIndex(table).mergeChildTags(doc, childTagSets);

    @SuppressWarnings("unchecked")
    List<TagLabel> merged = (List<TagLabel>) doc.get("tags");
    assertEquals(1, merged.size());
  }

  @Test
  void testMergeChildTags_noOpWhenChildTagsNull() {
    TagLabel entityTag =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);

    Map<String, Object> doc = new HashMap<>();
    doc.put("tags", new ArrayList<>(List.of(entityTag)));

    mockStatics();
    Table table = new Table().withId(UUID.randomUUID()).withName("t").withFullyQualifiedName("s.t");
    new TableIndex(table).mergeChildTags(doc, null);

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) doc.get("tags");
    assertEquals(1, tags.size());
  }

  @Test
  void testMergeChildTags_noOpWhenChildTagsEmpty() {
    Map<String, Object> doc = new HashMap<>();
    doc.put("tags", new ArrayList<>(List.of()));

    mockStatics();
    Table table = new Table().withId(UUID.randomUUID()).withName("t").withFullyQualifiedName("s.t");
    new TableIndex(table).mergeChildTags(doc, new HashSet<>());

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) doc.get("tags");
    assertTrue(tags.isEmpty());
  }

  // ==================== End-to-end: buildSearchIndexDoc merges child tags ====================

  @Test
  void testTableIndex_buildDoc_mergesColumnTags() {
    TagLabel colTag =
        new TagLabel().withTagFQN("PII.Email").withSource(TagLabel.TagSource.CLASSIFICATION);
    Column col =
        new Column()
            .withName("email")
            .withDataType(ColumnDataType.VARCHAR)
            .withTags(List.of(colTag));

    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("users")
            .withFullyQualifiedName("svc.db.sc.users")
            .withColumns(List.of(col));

    mockStatics();
    Map<String, Object> result = new TableIndex(table).buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) result.get("tags");
    assertNotNull(tags);
    assertTrue(tags.stream().anyMatch(t -> "PII.Email".equals(t.getTagFQN())));
    // Also verify columnNames was populated (single-pass)
    assertNotNull(result.get("columnNames"));
  }

  @Test
  void testTableIndex_buildDoc_noColumnsNoChildTags() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("empty")
            .withFullyQualifiedName("svc.db.sc.empty");

    mockStatics();
    Map<String, Object> result = new TableIndex(table).buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) result.get("tags");
    assertNotNull(tags);
    assertTrue(tags.isEmpty());
  }

  @Test
  void testTopicIndex_buildDoc_mergesSchemaFieldTags() {
    TagLabel fieldTag =
        new TagLabel().withTagFQN("PII.Address").withSource(TagLabel.TagSource.CLASSIFICATION);
    Field field = new Field().withName("address").withTags(List.of(fieldTag));
    MessageSchema schema = new MessageSchema().withSchemaFields(List.of(field));

    Topic topic =
        new Topic()
            .withId(UUID.randomUUID())
            .withName("events")
            .withFullyQualifiedName("svc.events")
            .withMessageSchema(schema);

    mockStatics();
    Map<String, Object> result = new TopicIndex(topic).buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) result.get("tags");
    assertNotNull(tags);
    assertTrue(tags.stream().anyMatch(t -> "PII.Address".equals(t.getTagFQN())));
    assertNotNull(result.get("fieldNames"));
  }

  @Test
  void testContainerIndex_buildDoc_mergesDataModelColumnTags() {
    TagLabel colTag =
        new TagLabel().withTagFQN("PII.Phone").withSource(TagLabel.TagSource.CLASSIFICATION);
    Column col =
        new Column()
            .withName("phone")
            .withDataType(ColumnDataType.VARCHAR)
            .withTags(List.of(colTag));
    ContainerDataModel dataModel = new ContainerDataModel().withColumns(List.of(col));

    Container container =
        new Container()
            .withId(UUID.randomUUID())
            .withName("bucket")
            .withFullyQualifiedName("svc.bucket")
            .withDataModel(dataModel);

    mockStatics();
    Map<String, Object> result = new ContainerIndex(container).buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) result.get("tags");
    assertNotNull(tags);
    assertTrue(tags.stream().anyMatch(t -> "PII.Phone".equals(t.getTagFQN())));
  }

  @Test
  void testAPIEndpointIndex_buildDoc_mergesBothSchemasTags() {
    TagLabel reqTag =
        new TagLabel().withTagFQN("PII.Name").withSource(TagLabel.TagSource.CLASSIFICATION);
    TagLabel respTag =
        new TagLabel().withTagFQN("PII.SSN").withSource(TagLabel.TagSource.CLASSIFICATION);
    Field reqField = new Field().withName("name").withTags(List.of(reqTag));
    Field respField = new Field().withName("ssn").withTags(List.of(respTag));

    APIEndpoint endpoint =
        new APIEndpoint()
            .withId(UUID.randomUUID())
            .withName("getUser")
            .withFullyQualifiedName("svc.getUser")
            .withRequestSchema(new APISchema().withSchemaFields(List.of(reqField)))
            .withResponseSchema(new APISchema().withSchemaFields(List.of(respField)));

    mockStatics();
    Map<String, Object> result = new APIEndpointIndex(endpoint).buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) result.get("tags");
    assertNotNull(tags);
    assertTrue(tags.stream().anyMatch(t -> "PII.Name".equals(t.getTagFQN())));
    assertTrue(tags.stream().anyMatch(t -> "PII.SSN".equals(t.getTagFQN())));
  }

  @Test
  void testDashboardDataModelIndex_buildDoc_mergesColumnTags() {
    TagLabel colTag =
        new TagLabel().withTagFQN("PII.Revenue").withSource(TagLabel.TagSource.CLASSIFICATION);
    Column col =
        new Column()
            .withName("revenue")
            .withDataType(ColumnDataType.DOUBLE)
            .withTags(List.of(colTag));

    DashboardDataModel model =
        new DashboardDataModel()
            .withId(UUID.randomUUID())
            .withName("sales-model")
            .withFullyQualifiedName("svc.sales-model")
            .withColumns(List.of(col));

    mockStatics();
    Map<String, Object> result = new DashboardDataModelIndex(model).buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) result.get("tags");
    assertNotNull(tags);
    assertTrue(tags.stream().anyMatch(t -> "PII.Revenue".equals(t.getTagFQN())));
  }

  @Test
  void testWorksheetIndex_buildDoc_mergesColumnTags() {
    TagLabel colTag =
        new TagLabel().withTagFQN("PII.Email").withSource(TagLabel.TagSource.CLASSIFICATION);
    Column col =
        new Column()
            .withName("email")
            .withDataType(ColumnDataType.VARCHAR)
            .withTags(List.of(colTag));

    Worksheet ws =
        new Worksheet()
            .withId(UUID.randomUUID())
            .withName("sheet1")
            .withFullyQualifiedName("svc.sheet1")
            .withColumns(List.of(col));

    mockStatics();
    Map<String, Object> result = new WorksheetIndex(ws).buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) result.get("tags");
    assertNotNull(tags);
    assertTrue(tags.stream().anyMatch(t -> "PII.Email".equals(t.getTagFQN())));
  }

  @Test
  void testEntityWithNoChildStructures_tagsUnchanged() {
    // DashboardIndex has no child structures — tags should just be entity-level
    mockStatics();
    TagLabel entityTag =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);
    entityStaticMock
        .when(() -> Entity.getEntityTags(anyString(), any()))
        .thenReturn(List.of(entityTag));
    org.openmetadata.schema.entity.data.Dashboard d =
        new org.openmetadata.schema.entity.data.Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("svc.d");

    Map<String, Object> result = new DashboardIndex(d).buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) result.get("tags");
    assertNotNull(tags);
    assertFalse(tags.isEmpty());
    assertEquals("PII.Sensitive", tags.get(0).getTagFQN());
  }
}
