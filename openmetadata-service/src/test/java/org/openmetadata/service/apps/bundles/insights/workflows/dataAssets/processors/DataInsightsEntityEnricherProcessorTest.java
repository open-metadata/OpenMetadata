package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow.ENTITY_TYPE_FIELDS_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;

import java.lang.reflect.Method;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.ColumnsEntityInterface;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;

@ExtendWith(MockitoExtension.class)
class DataInsightsEntityEnricherProcessorTest {

  private DataInsightsEntityEnricherProcessor processor;
  private Method enrichEntityMethod;

  @BeforeEach
  void setUp() throws Exception {
    processor = new DataInsightsEntityEnricherProcessor(100);
    enrichEntityMethod =
        DataInsightsEntityEnricherProcessor.class.getDeclaredMethod(
            "enrichEntity", Map.class, Map.class);
    enrichEntityMethod.setAccessible(true);
  }

  @Test
  void testHasColumnDescriptionAllColumnsDescribed() throws Exception {
    List<Column> columns =
        List.of(
            createColumn("col1", "Description for col1"),
            createColumn("col2", "Description for col2"),
            createColumn("col3", "Description for col3"));

    MockColumnsEntity entity = new MockColumnsEntity(columns, "test description");
    Map<String, Object> result = invokeEnrichEntity(entity, "table");

    assertEquals(3, result.get("numberOfColumns"));
    assertEquals(3, result.get("numberOfColumnsWithDescription"));
    assertEquals(1, result.get("hasColumnDescription"));
  }

  @Test
  void testHasColumnDescriptionNoColumnsDescribed() throws Exception {
    List<Column> columns =
        List.of(createColumn("col1", null), createColumn("col2", null), createColumn("col3", ""));

    MockColumnsEntity entity = new MockColumnsEntity(columns, "test description");
    Map<String, Object> result = invokeEnrichEntity(entity, "table");

    assertEquals(3, result.get("numberOfColumns"));
    assertEquals(0, result.get("numberOfColumnsWithDescription"));
    assertEquals(0, result.get("hasColumnDescription"));
  }

  @Test
  void testHasColumnDescriptionPartialColumnsDescribed() throws Exception {
    List<Column> columns =
        List.of(
            createColumn("col1", "Description for col1"),
            createColumn("col2", null),
            createColumn("col3", "Description for col3"));

    MockColumnsEntity entity = new MockColumnsEntity(columns, "test description");
    Map<String, Object> result = invokeEnrichEntity(entity, "table");

    assertEquals(3, result.get("numberOfColumns"));
    assertEquals(2, result.get("numberOfColumnsWithDescription"));
    assertEquals(0, result.get("hasColumnDescription"));
  }

  @Test
  void testHasColumnDescriptionSingleColumnWithDescription() throws Exception {
    List<Column> columns = List.of(createColumn("col1", "Has description"));

    MockColumnsEntity entity = new MockColumnsEntity(columns, "test description");
    Map<String, Object> result = invokeEnrichEntity(entity, "table");

    assertEquals(1, result.get("numberOfColumns"));
    assertEquals(1, result.get("numberOfColumnsWithDescription"));
    assertEquals(1, result.get("hasColumnDescription"));
  }

  @Test
  void testHasColumnDescriptionSingleColumnWithoutDescription() throws Exception {
    List<Column> columns = List.of(createColumn("col1", null));

    MockColumnsEntity entity = new MockColumnsEntity(columns, "test description");
    Map<String, Object> result = invokeEnrichEntity(entity, "table");

    assertEquals(1, result.get("numberOfColumns"));
    assertEquals(0, result.get("numberOfColumnsWithDescription"));
    assertEquals(0, result.get("hasColumnDescription"));
  }

  @Test
  void testEntityWithoutColumnsDoesNotHaveColumnFields() throws Exception {
    MockEntity entity = new MockEntity("test description");
    Map<String, Object> result = invokeEnrichEntity(entity, "pipeline");

    assertFalse(result.containsKey("numberOfColumns"));
    assertFalse(result.containsKey("numberOfColumnsWithDescription"));
    assertFalse(result.containsKey("hasColumnDescription"));
  }

  @Test
  void testHasDescriptionWithDescription() throws Exception {
    MockEntity entity = new MockEntity("Some description");
    Map<String, Object> result = invokeEnrichEntity(entity, "pipeline");

    assertEquals(1, result.get("hasDescription"));
  }

  @Test
  void testHasDescriptionWithoutDescription() throws Exception {
    MockEntity entity = new MockEntity(null);
    Map<String, Object> result = invokeEnrichEntity(entity, "pipeline");

    assertEquals(0, result.get("hasDescription"));
  }

  @Test
  void testHasDescriptionWithEmptyDescription() throws Exception {
    MockEntity entity = new MockEntity("");
    Map<String, Object> result = invokeEnrichEntity(entity, "pipeline");

    assertEquals(0, result.get("hasDescription"));
  }

  @Test
  void testEmptyColumnsListSetsHasColumnDescription() throws Exception {
    MockColumnsEntity entity = new MockColumnsEntity(new ArrayList<>(), "desc");
    Map<String, Object> result = invokeEnrichEntity(entity, "table");

    assertEquals(0, result.get("numberOfColumns"));
    assertEquals(0, result.get("numberOfColumnsWithDescription"));
    assertEquals(1, result.get("hasColumnDescription"));
  }

  @Test
  void testProcessorStatsInitialization() {
    assertNotNull(processor.getStats());
    assertEquals(100, processor.getStats().getTotalRecords());
    assertEquals(0, processor.getStats().getSuccessRecords());
    assertEquals(0, processor.getStats().getFailedRecords());
  }

  @Test
  void testUpdateStats() {
    processor.updateStats(10, 5);
    assertEquals(10, processor.getStats().getSuccessRecords());
    assertEquals(5, processor.getStats().getFailedRecords());
  }

  @Test
  void testGlossaryTermConfigHasEntityStatusField() throws Exception {
    String configContent =
        new String(
            getClass()
                .getClassLoader()
                .getResourceAsStream("dataInsights/config.json")
                .readAllBytes());
    assertTrue(configContent.contains("\"entityStatus\""));
    assertFalse(configContent.contains("\"status\""));
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> invokeEnrichEntity(EntityInterface entity, String entityType)
      throws Exception {
    try (MockedStatic<JsonUtils> jsonUtilsMock = Mockito.mockStatic(JsonUtils.class);
        MockedStatic<SearchIndexUtils> searchIndexUtilsMock =
            Mockito.mockStatic(SearchIndexUtils.class);
        MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {

      Map<String, Object> entityMap = new HashMap<>();
      entityMap.put("id", entity.getId());
      entityMap.put("name", entity.getName());
      entityMap.put("description", entity.getDescription());
      entityMap.put("displayName", entity.getDisplayName());
      entityMap.put("fullyQualifiedName", entity.getFullyQualifiedName());
      entityMap.put("version", entity.getVersion());
      if (entity instanceof ColumnsEntityInterface columnsEntity) {
        entityMap.put("columns", columnsEntity.getColumns());
      }

      jsonUtilsMock.when(() -> JsonUtils.getMap(any())).thenReturn(entityMap);

      searchIndexUtilsMock.when(() -> SearchIndexUtils.getChangeSummaryMap(any())).thenReturn(null);
      searchIndexUtilsMock
          .when(() -> SearchIndexUtils.processDescriptionSources(any(), any()))
          .thenReturn(new HashMap<>());
      searchIndexUtilsMock
          .when(() -> SearchIndexUtils.processTagAndTierSources(any(EntityInterface.class)))
          .thenReturn(new SearchIndexUtils.TagAndTierSources());
      searchIndexUtilsMock
          .when(() -> SearchIndexUtils.hasColumns(any()))
          .thenAnswer(
              invocation -> {
                EntityInterface e = invocation.getArgument(0);
                return List.of(e.getClass().getInterfaces()).contains(ColumnsEntityInterface.class);
              });

      entityMock.when(() -> Entity.getEntityTypeFromObject(any())).thenReturn(entityType);

      Map<String, Object> entityVersionMap = new HashMap<>();
      entityVersionMap.put("versionEntity", entity);
      entityVersionMap.put("startTimestamp", 1000L);
      entityVersionMap.put("endTimestamp", 2000L);

      List<String> fields =
          new ArrayList<>(
              List.of(
                  "id",
                  "name",
                  "description",
                  "displayName",
                  "fullyQualifiedName",
                  "columns",
                  "tags",
                  "owners",
                  "deleted",
                  "version"));

      Map<String, Object> contextData = new HashMap<>();
      contextData.put(ENTITY_TYPE_KEY, entityType);
      contextData.put(ENTITY_TYPE_FIELDS_KEY, fields);

      return (Map<String, Object>)
          enrichEntityMethod.invoke(processor, entityVersionMap, contextData);
    }
  }

  private Column createColumn(String name, String description) {
    Column column = new Column();
    column.setName(name);
    column.setDescription(description);
    column.setDataType(ColumnDataType.VARCHAR);
    return column;
  }

  static class MockColumnsEntity implements EntityInterface, ColumnsEntityInterface {
    private final UUID id = UUID.randomUUID();
    private final String fqn = "test.table." + id;
    private final List<Column> columns;
    private final String description;

    MockColumnsEntity(List<Column> columns, String description) {
      this.columns = columns;
      this.description = description;
    }

    @Override
    public List<Column> getColumns() {
      return columns;
    }

    @Override
    public UUID getId() {
      return id;
    }

    @Override
    public String getDescription() {
      return description;
    }

    @Override
    public String getDisplayName() {
      return "Test Table";
    }

    @Override
    public String getName() {
      return "testTable";
    }

    @Override
    public Double getVersion() {
      return 1.0;
    }

    @Override
    public String getUpdatedBy() {
      return "testUser";
    }

    @Override
    public Long getUpdatedAt() {
      return System.currentTimeMillis();
    }

    @Override
    public URI getHref() {
      return null;
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return null;
    }

    @Override
    public ChangeDescription getIncrementalChangeDescription() {
      return null;
    }

    @Override
    public String getFullyQualifiedName() {
      return fqn;
    }

    @Override
    public List<TagLabel> getTags() {
      return null;
    }

    @Override
    public void setId(UUID id) {}

    @Override
    public void setDescription(String description) {}

    @Override
    public void setDisplayName(String displayName) {}

    @Override
    public void setName(String name) {}

    @Override
    public void setVersion(Double newVersion) {}

    @Override
    public void setChangeDescription(ChangeDescription changeDescription) {}

    @Override
    public void setIncrementalChangeDescription(ChangeDescription desc) {}

    @Override
    public void setFullyQualifiedName(String fullyQualifiedName) {}

    @Override
    public void setUpdatedBy(String admin) {}

    @Override
    public void setUpdatedAt(Long updatedAt) {}

    @Override
    public void setHref(URI href) {}

    @Override
    public <T extends EntityInterface> T withHref(URI href) {
      return (T) this;
    }
  }

  static class MockEntity implements EntityInterface {
    private final UUID id = UUID.randomUUID();
    private final String fqn = "test.entity." + id;
    private final String description;

    MockEntity(String description) {
      this.description = description;
    }

    @Override
    public UUID getId() {
      return id;
    }

    @Override
    public String getDescription() {
      return description;
    }

    @Override
    public String getDisplayName() {
      return "Test Entity";
    }

    @Override
    public String getName() {
      return "testEntity";
    }

    @Override
    public Double getVersion() {
      return 1.0;
    }

    @Override
    public String getUpdatedBy() {
      return "testUser";
    }

    @Override
    public Long getUpdatedAt() {
      return System.currentTimeMillis();
    }

    @Override
    public URI getHref() {
      return null;
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return null;
    }

    @Override
    public ChangeDescription getIncrementalChangeDescription() {
      return null;
    }

    @Override
    public String getFullyQualifiedName() {
      return fqn;
    }

    @Override
    public List<TagLabel> getTags() {
      return null;
    }

    @Override
    public void setId(UUID id) {}

    @Override
    public void setDescription(String description) {}

    @Override
    public void setDisplayName(String displayName) {}

    @Override
    public void setName(String name) {}

    @Override
    public void setVersion(Double newVersion) {}

    @Override
    public void setChangeDescription(ChangeDescription changeDescription) {}

    @Override
    public void setIncrementalChangeDescription(ChangeDescription desc) {}

    @Override
    public void setFullyQualifiedName(String fullyQualifiedName) {}

    @Override
    public void setUpdatedBy(String admin) {}

    @Override
    public void setUpdatedAt(Long updatedAt) {}

    @Override
    public void setHref(URI href) {}

    @Override
    public <T extends EntityInterface> T withHref(URI href) {
      return (T) this;
    }
  }
}
