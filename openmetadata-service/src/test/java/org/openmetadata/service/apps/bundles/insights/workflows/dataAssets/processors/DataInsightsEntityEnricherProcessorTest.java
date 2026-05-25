/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;

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
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentContext;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.VersionShape;
import org.openmetadata.service.search.SearchIndexUtils;

/**
 * Behavior of {@link DataInsightsEntityEnricherProcessor#enrichEntity(EnrichmentTarget)} (the
 * pipeline body, package-private for testing). Version-walk and day-fanout live in
 * {@code VersionResolver} / {@code SnapshotMaterializer} respectively and have their own unit
 * tests; this class focuses on what each enrichment step contributes to the snapshot for a
 * single prepared target.
 */
@ExtendWith(MockitoExtension.class)
class DataInsightsEntityEnricherProcessorTest {

  private static final long WINDOW_START = 1_000_000_000L;
  private static final long WINDOW_END = 2_000_000_000L;
  private static final List<String> PROJECTION_FIELDS =
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
          "version");

  private DataInsightsEntityEnricherProcessor processor;

  @BeforeEach
  void setUp() {
    processor = new DataInsightsEntityEnricherProcessor(100);
  }

  @Test
  void testHasColumnDescriptionAllColumnsDescribed() {
    Map<String, Object> result =
        enrichEntity(
            new MockColumnsEntity(
                List.of(
                    createColumn("col1", "Description for col1"),
                    createColumn("col2", "Description for col2"),
                    createColumn("col3", "Description for col3")),
                "test description"),
            "table");

    assertEquals(3, result.get("numberOfColumns"));
    assertEquals(3, result.get("numberOfColumnsWithDescription"));
    assertEquals(1, result.get("hasColumnDescription"));
  }

  @Test
  void testHasColumnDescriptionNoColumnsDescribed() {
    Map<String, Object> result =
        enrichEntity(
            new MockColumnsEntity(
                List.of(
                    createColumn("col1", null),
                    createColumn("col2", null),
                    createColumn("col3", "")),
                "test description"),
            "table");

    assertEquals(3, result.get("numberOfColumns"));
    assertEquals(0, result.get("numberOfColumnsWithDescription"));
    assertEquals(0, result.get("hasColumnDescription"));
  }

  @Test
  void testHasColumnDescriptionPartialColumnsDescribed() {
    Map<String, Object> result =
        enrichEntity(
            new MockColumnsEntity(
                List.of(
                    createColumn("col1", "Description for col1"),
                    createColumn("col2", null),
                    createColumn("col3", "Description for col3")),
                "test description"),
            "table");

    assertEquals(3, result.get("numberOfColumns"));
    assertEquals(2, result.get("numberOfColumnsWithDescription"));
    assertEquals(0, result.get("hasColumnDescription"));
  }

  @Test
  void testHasColumnDescriptionSingleColumnWithDescription() {
    Map<String, Object> result =
        enrichEntity(
            new MockColumnsEntity(
                List.of(createColumn("col1", "Has description")), "test description"),
            "table");

    assertEquals(1, result.get("numberOfColumns"));
    assertEquals(1, result.get("numberOfColumnsWithDescription"));
    assertEquals(1, result.get("hasColumnDescription"));
  }

  @Test
  void testHasColumnDescriptionSingleColumnWithoutDescription() {
    Map<String, Object> result =
        enrichEntity(
            new MockColumnsEntity(List.of(createColumn("col1", null)), "test description"),
            "table");

    assertEquals(1, result.get("numberOfColumns"));
    assertEquals(0, result.get("numberOfColumnsWithDescription"));
    assertEquals(0, result.get("hasColumnDescription"));
  }

  @Test
  void testEntityWithoutColumnsDoesNotHaveColumnFields() {
    Map<String, Object> result = enrichEntity(new MockEntity("test description"), "pipeline");

    assertFalse(result.containsKey("numberOfColumns"));
    assertFalse(result.containsKey("numberOfColumnsWithDescription"));
    assertFalse(result.containsKey("hasColumnDescription"));
  }

  @Test
  void testHasDescriptionWithDescription() {
    Map<String, Object> result = enrichEntity(new MockEntity("Some description"), "pipeline");
    assertEquals(1, result.get("hasDescription"));
  }

  @Test
  void testHasDescriptionWithoutDescription() {
    Map<String, Object> result = enrichEntity(new MockEntity(null), "pipeline");
    assertEquals(0, result.get("hasDescription"));
  }

  @Test
  void testHasDescriptionWithEmptyDescription() {
    Map<String, Object> result = enrichEntity(new MockEntity(""), "pipeline");
    assertEquals(0, result.get("hasDescription"));
  }

  @Test
  void testEmptyColumnsListSetsHasColumnDescription() {
    Map<String, Object> result =
        enrichEntity(new MockColumnsEntity(new ArrayList<>(), "desc"), "table");

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

  @Test
  void testStripNestedColumnChildrenRemovesChildrenAndPreservesOtherFields() throws Exception {
    Map<String, Object> column = new HashMap<>();
    column.put("name", "struct_col");
    column.put("dataType", "STRUCT");
    column.put("description", "A struct column");
    column.put("children", List.of(Map.of("name", "child_field")));

    Map<String, Object> entityMap = new HashMap<>();
    entityMap.put("columns", new ArrayList<>(List.of(column)));

    invokeStripNestedColumnChildren(entityMap);

    assertFalse(column.containsKey("children"));
    assertEquals("struct_col", column.get("name"));
    assertEquals("STRUCT", column.get("dataType"));
    assertEquals("A struct column", column.get("description"));
  }

  @Test
  void testStripNestedColumnChildrenNoOpWhenColumnsKeyAbsent() throws Exception {
    Map<String, Object> entityMap = new HashMap<>();
    entityMap.put("name", "some_entity");

    invokeStripNestedColumnChildren(entityMap);

    assertFalse(entityMap.containsKey("columns"));
  }

  // ───────────────────────────── helpers ─────────────────────────────

  /**
   * Drive the pipeline against a synthetic entity. Mocks {@link SearchIndexUtils} static helpers
   * so each step's contract is exercised without pulling in their real implementations, and
   * stubs {@link Entity#getEntityTypeFromObject(Object)} for the per-step team/tier log lines.
   */
  private Map<String, Object> enrichEntity(EntityInterface entity, String entityType) {
    try (MockedStatic<SearchIndexUtils> searchIndexUtilsMock =
            Mockito.mockStatic(SearchIndexUtils.class);
        MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {

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

      EnrichmentContext context =
          new EnrichmentContext(entityType, PROJECTION_FIELDS, WINDOW_START, WINDOW_END);
      EnrichmentTarget target =
          new EnrichmentTarget(
              entity,
              entityMap,
              new HashMap<>(),
              WINDOW_START,
              WINDOW_END,
              context,
              VersionShape.LATEST_HYDRATED);

      processor.enrichEntity(target);
      return entityMap;
    }
  }

  private void invokeStripNestedColumnChildren(Map<String, Object> entityMap) throws Exception {
    Method stripMethod =
        DataInsightsEntityEnricherProcessor.class.getDeclaredMethod(
            "stripNestedColumnChildren", Map.class);
    stripMethod.setAccessible(true);
    stripMethod.invoke(null, entityMap);
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
