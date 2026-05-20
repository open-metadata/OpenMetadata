/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.*;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.*;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

/**
 * Tests for the validateLineageDetails logic in LineageRepository.
 * This test verifies the filtering behavior of the new implementation.
 */
class LineageRepositoryTest {

  private static MockedStatic<Entity> mockedEntity;
  private static SearchRepository searchRepository;

  @BeforeAll
  static void initMocks() {
    searchRepository = mock(SearchRepository.class);
    SearchClient searchClient = mock(SearchClient.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    IndexMapping indexMapping = mock(IndexMapping.class);
    when(indexMapping.getIndexName(any())).thenReturn("test-lineage-index");
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchRepository.getIndexMapping(any())).thenReturn(indexMapping);
    when(searchRepository.getClusterAlias()).thenReturn("default");
    mockedEntity = mockStatic(Entity.class);
    mockedEntity.when(Entity::getSearchRepository).thenReturn(searchRepository);
    mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
  }

  @AfterAll
  static void closeMocks() {
    if (mockedEntity != null) {
      mockedEntity.close();
    }
  }

  private EntityReference fromEntity;
  private EntityReference toEntity;
  private UUID fromEntityId;
  private UUID toEntityId;

  @BeforeEach
  void setUp() {
    fromEntityId = UUID.randomUUID();
    toEntityId = UUID.randomUUID();

    fromEntity =
        new EntityReference()
            .withId(fromEntityId)
            .withType("table")
            .withFullyQualifiedName("database.schema.fromTable");

    toEntity =
        new EntityReference()
            .withId(toEntityId)
            .withType("table")
            .withFullyQualifiedName("database.schema.toTable");
  }

  /**
   * Simulates the validateLineageDetails logic.
   * This is a direct copy of the new implementation for testing purposes.
   */
  private String validateLineageDetailsLogic(
      EntityReference from,
      EntityReference to,
      LineageDetails details,
      Set<String> mockFromColumns,
      Set<String> mockToColumns) {

    if (details == null) {
      return null;
    }

    List<ColumnLineage> columnsLineage = details.getColumnsLineage();

    if (columnsLineage != null && !columnsLineage.isEmpty()) {
      List<ColumnLineage> filteredColumnLineage = new ArrayList<>();
      for (ColumnLineage columnLineage : columnsLineage) {
        // Check if toColumn is valid
        String toColumnName =
            columnLineage.getToColumn().replace(to.getFullyQualifiedName() + ".", "");
        if (!mockToColumns.contains(toColumnName)) {
          // Skip this column lineage if toColumn is invalid
          System.out.println("Invalid toColumn: " + columnLineage.getToColumn());
          continue;
        }

        // Filter fromColumns
        List<String> filteredFromColumns = new ArrayList<>();
        boolean updateFromColumns = false;
        for (String fromColumn : columnLineage.getFromColumns()) {
          String fromColumnName = fromColumn.replace(from.getFullyQualifiedName() + ".", "");
          if (!mockFromColumns.contains(fromColumnName)) {
            System.out.println("Invalid fromColumn: " + fromColumn);
            updateFromColumns = true;
            continue;
          }
          filteredFromColumns.add(fromColumn);
        }

        if (updateFromColumns) {
          columnLineage.setFromColumns(filteredFromColumns);
        }

        // Only add to filtered list if there are valid fromColumns
        if (!filteredFromColumns.isEmpty()) {
          filteredColumnLineage.add(columnLineage);
        }
      }
      details.setColumnsLineage(filteredColumnLineage);
    }

    return JsonUtils.pojoToJson(details);
  }

  @Test
  void testValidateLineageDetails_NullDetails_ReturnsNull() {
    String result =
        validateLineageDetailsLogic(fromEntity, toEntity, null, new HashSet<>(), new HashSet<>());
    assertNull(result);
  }

  @Test
  void testValidateLineageDetails_EmptyColumnsLineage_ReturnsJsonString() {
    LineageDetails details = new LineageDetails();

    String result =
        validateLineageDetailsLogic(
            fromEntity, toEntity, details, new HashSet<>(), new HashSet<>());

    assertNotNull(result);
    LineageDetails deserializedDetails = JsonUtils.readValue(result, LineageDetails.class);
    assertNotNull(deserializedDetails);
    assertTrue(
        deserializedDetails.getColumnsLineage() == null
            || deserializedDetails.getColumnsLineage().isEmpty());
  }

  @Test
  void testValidateLineageDetails_AllValidColumns_NoFiltering() {
    Set<String> fromColumns = new HashSet<>(Arrays.asList("column1", "column2"));
    Set<String> toColumns = new HashSet<>(List.of("targetColumn1"));

    List<ColumnLineage> columnLineages = new ArrayList<>();
    ColumnLineage columnLineage =
        new ColumnLineage()
            .withFromColumns(
                Arrays.asList(
                    "database.schema.fromTable.column1", "database.schema.fromTable.column2"))
            .withToColumn("database.schema.toTable.targetColumn1");
    columnLineages.add(columnLineage);

    LineageDetails details = new LineageDetails().withColumnsLineage(columnLineages);

    String result =
        validateLineageDetailsLogic(fromEntity, toEntity, details, fromColumns, toColumns);

    assertNotNull(result);
    LineageDetails deserializedDetails = JsonUtils.readValue(result, LineageDetails.class);
    assertEquals(1, deserializedDetails.getColumnsLineage().size());
    assertEquals(2, deserializedDetails.getColumnsLineage().get(0).getFromColumns().size());
    assertTrue(
        deserializedDetails
            .getColumnsLineage()
            .get(0)
            .getFromColumns()
            .contains("database.schema.fromTable.column1"));
    assertTrue(
        deserializedDetails
            .getColumnsLineage()
            .get(0)
            .getFromColumns()
            .contains("database.schema.fromTable.column2"));
  }

  @Test
  void testValidateLineageDetails_InvalidToColumn_FiltersOutColumnLineage() {
    Set<String> fromColumns = new HashSet<>(List.of("column1"));
    Set<String> toColumns = new HashSet<>(List.of("differentColumn"));

    List<ColumnLineage> columnLineages = new ArrayList<>();
    ColumnLineage columnLineage =
        new ColumnLineage()
            .withFromColumns(List.of("database.schema.fromTable.column1"))
            .withToColumn("database.schema.toTable.invalidColumn");
    columnLineages.add(columnLineage);

    LineageDetails details = new LineageDetails().withColumnsLineage(columnLineages);

    String result =
        validateLineageDetailsLogic(fromEntity, toEntity, details, fromColumns, toColumns);

    assertNotNull(result);
    LineageDetails deserializedDetails = JsonUtils.readValue(result, LineageDetails.class);
    assertTrue(
        deserializedDetails.getColumnsLineage().isEmpty(),
        "Column lineage with invalid toColumn should be filtered out");
  }

  @Test
  void testValidateLineageDetails_InvalidFromColumns_FiltersOutInvalidColumns() {
    Set<String> fromColumns = new HashSet<>(List.of("validColumn"));
    Set<String> toColumns = new HashSet<>(List.of("targetColumn"));

    List<ColumnLineage> columnLineages = new ArrayList<>();
    ColumnLineage columnLineage =
        new ColumnLineage()
            .withFromColumns(
                Arrays.asList(
                    "database.schema.fromTable.validColumn",
                    "database.schema.fromTable.invalidColumn1",
                    "database.schema.fromTable.invalidColumn2"))
            .withToColumn("database.schema.toTable.targetColumn");
    columnLineages.add(columnLineage);

    LineageDetails details = new LineageDetails().withColumnsLineage(columnLineages);

    String result =
        validateLineageDetailsLogic(fromEntity, toEntity, details, fromColumns, toColumns);

    assertNotNull(result);
    LineageDetails deserializedDetails = JsonUtils.readValue(result, LineageDetails.class);
    assertEquals(1, deserializedDetails.getColumnsLineage().size());
    assertEquals(
        1,
        deserializedDetails.getColumnsLineage().get(0).getFromColumns().size(),
        "Only valid fromColumns should remain");
    assertEquals(
        "database.schema.fromTable.validColumn",
        deserializedDetails.getColumnsLineage().get(0).getFromColumns().get(0));
  }

  @Test
  void testValidateLineageDetails_AllFromColumnsInvalid_RemovesEntireColumnLineage() {
    Set<String> fromColumns = new HashSet<>(List.of("otherColumn"));
    Set<String> toColumns = new HashSet<>(List.of("targetColumn"));

    List<ColumnLineage> columnLineages = new ArrayList<>();
    ColumnLineage columnLineage =
        new ColumnLineage()
            .withFromColumns(
                Arrays.asList(
                    "database.schema.fromTable.invalidColumn1",
                    "database.schema.fromTable.invalidColumn2"))
            .withToColumn("database.schema.toTable.targetColumn");
    columnLineages.add(columnLineage);

    LineageDetails details = new LineageDetails().withColumnsLineage(columnLineages);

    String result =
        validateLineageDetailsLogic(fromEntity, toEntity, details, fromColumns, toColumns);

    assertNotNull(result);
    LineageDetails deserializedDetails = JsonUtils.readValue(result, LineageDetails.class);
    assertTrue(
        deserializedDetails.getColumnsLineage().isEmpty(),
        "Column lineage with all invalid fromColumns should be removed");
  }

  @Test
  void testValidateLineageDetails_MixedValidAndInvalidColumnLineages() {
    Set<String> fromColumns = new HashSet<>(Arrays.asList("column1", "column2", "column3"));
    Set<String> toColumns = new HashSet<>(Arrays.asList("targetColumn1", "targetColumn2"));

    List<ColumnLineage> columnLineages = new ArrayList<>();

    // Valid column lineage
    ColumnLineage validLineage =
        new ColumnLineage()
            .withFromColumns(List.of("database.schema.fromTable.column1"))
            .withToColumn("database.schema.toTable.targetColumn1");

    // Invalid toColumn lineage (should be filtered out)
    ColumnLineage invalidToLineage =
        new ColumnLineage()
            .withFromColumns(List.of("database.schema.fromTable.column2"))
            .withToColumn("database.schema.toTable.invalidTarget");

    // Partially valid fromColumns lineage
    ColumnLineage partialLineage =
        new ColumnLineage()
            .withFromColumns(
                Arrays.asList(
                    "database.schema.fromTable.column3", "database.schema.fromTable.invalidColumn"))
            .withToColumn("database.schema.toTable.targetColumn2");

    columnLineages.add(validLineage);
    columnLineages.add(invalidToLineage);
    columnLineages.add(partialLineage);

    LineageDetails details = new LineageDetails().withColumnsLineage(columnLineages);

    String result =
        validateLineageDetailsLogic(fromEntity, toEntity, details, fromColumns, toColumns);

    assertNotNull(result);
    LineageDetails deserializedDetails = JsonUtils.readValue(result, LineageDetails.class);
    assertEquals(
        2,
        deserializedDetails.getColumnsLineage().size(),
        "Should have 2 valid column lineages after filtering");

    // Verify first valid lineage
    assertEquals(1, deserializedDetails.getColumnsLineage().get(0).getFromColumns().size());
    assertEquals(
        "database.schema.fromTable.column1",
        deserializedDetails.getColumnsLineage().get(0).getFromColumns().get(0));
    assertEquals(
        "database.schema.toTable.targetColumn1",
        deserializedDetails.getColumnsLineage().get(0).getToColumn());

    // Verify partially valid lineage
    assertEquals(1, deserializedDetails.getColumnsLineage().get(1).getFromColumns().size());
    assertEquals(
        "database.schema.fromTable.column3",
        deserializedDetails.getColumnsLineage().get(1).getFromColumns().get(0));
    assertEquals(
        "database.schema.toTable.targetColumn2",
        deserializedDetails.getColumnsLineage().get(1).getToColumn());
  }

  @Test
  void testValidateLineageDetails_EmptyFromColumns_RemovesColumnLineage() {
    Set<String> fromColumns = new HashSet<>(List.of("column1"));
    Set<String> toColumns = new HashSet<>(List.of("targetColumn"));

    List<ColumnLineage> columnLineages = new ArrayList<>();
    ColumnLineage columnLineage =
        new ColumnLineage()
            .withFromColumns(new ArrayList<>())
            .withToColumn("database.schema.toTable.targetColumn");
    columnLineages.add(columnLineage);

    LineageDetails details = new LineageDetails().withColumnsLineage(columnLineages);

    String result =
        validateLineageDetailsLogic(fromEntity, toEntity, details, fromColumns, toColumns);

    assertNotNull(result);
    LineageDetails deserializedDetails = JsonUtils.readValue(result, LineageDetails.class);
    assertTrue(
        deserializedDetails.getColumnsLineage().isEmpty(),
        "Column lineage with empty fromColumns should be removed");
  }

  @Test
  void testValidateLineageDetails_PreservesOtherLineageDetailsFields() {
    Set<String> fromColumns = new HashSet<>(List.of("column1"));
    Set<String> toColumns = new HashSet<>(List.of("targetColumn"));

    // Setup lineage details with additional fields
    LineageDetails details =
        new LineageDetails()
            .withSqlQuery("SELECT * FROM table")
            .withDescription("Test lineage")
            .withSource(LineageDetails.Source.MANUAL)
            .withCreatedAt(System.currentTimeMillis())
            .withCreatedBy("testUser");

    // Add valid column lineage
    List<ColumnLineage> columnLineages = new ArrayList<>();
    ColumnLineage columnLineage =
        new ColumnLineage()
            .withFromColumns(List.of("database.schema.fromTable.column1"))
            .withToColumn("database.schema.toTable.targetColumn");
    columnLineages.add(columnLineage);
    details.setColumnsLineage(columnLineages);

    String result =
        validateLineageDetailsLogic(fromEntity, toEntity, details, fromColumns, toColumns);

    assertNotNull(result);
    LineageDetails deserializedDetails = JsonUtils.readValue(result, LineageDetails.class);
    assertEquals("SELECT * FROM table", deserializedDetails.getSqlQuery());
    assertEquals("Test lineage", deserializedDetails.getDescription());
    assertEquals(LineageDetails.Source.MANUAL, deserializedDetails.getSource());
    assertEquals("testUser", deserializedDetails.getCreatedBy());
    assertNotNull(deserializedDetails.getCreatedAt());
  }

  @Test
  void testValidateLineageDetails_ColumnNamesWithoutFQNPrefix() {
    Set<String> fromColumns = new HashSet<>(Arrays.asList("column1", "column2"));
    Set<String> toColumns = new HashSet<>(List.of("targetColumn"));

    List<ColumnLineage> columnLineages = new ArrayList<>();
    ColumnLineage columnLineage =
        new ColumnLineage()
            .withFromColumns(
                Arrays.asList(
                    "column1", // Without FQN prefix
                    "column2"))
            .withToColumn("targetColumn");
    columnLineages.add(columnLineage);

    LineageDetails details = new LineageDetails().withColumnsLineage(columnLineages);

    String result =
        validateLineageDetailsLogic(fromEntity, toEntity, details, fromColumns, toColumns);

    assertNotNull(result);
    LineageDetails deserializedDetails = JsonUtils.readValue(result, LineageDetails.class);
    assertEquals(1, deserializedDetails.getColumnsLineage().size());
    assertEquals(2, deserializedDetails.getColumnsLineage().get(0).getFromColumns().size());
  }

  @Test
  void testValidateLineageDetails_ModifiesOriginalColumnLineageList() {
    Set<String> fromColumns = new HashSet<>(List.of("validColumn"));
    Set<String> toColumns = new HashSet<>(List.of("targetColumn"));

    // Create original column lineage with invalid columns
    List<String> originalFromColumns =
        new ArrayList<>(
            Arrays.asList(
                "database.schema.fromTable.validColumn",
                "database.schema.fromTable.invalidColumn"));

    ColumnLineage columnLineage =
        new ColumnLineage()
            .withFromColumns(originalFromColumns)
            .withToColumn("database.schema.toTable.targetColumn");

    List<ColumnLineage> columnLineages = new ArrayList<>();
    columnLineages.add(columnLineage);

    LineageDetails details = new LineageDetails().withColumnsLineage(columnLineages);

    String result =
        validateLineageDetailsLogic(fromEntity, toEntity, details, fromColumns, toColumns);

    assertNotNull(result);

    // Verify that the original details object is modified
    assertEquals(1, details.getColumnsLineage().size());
    assertEquals(
        1,
        details.getColumnsLineage().get(0).getFromColumns().size(),
        "Original fromColumns list should be modified");
    assertEquals(
        "database.schema.fromTable.validColumn",
        details.getColumnsLineage().get(0).getFromColumns().get(0));
  }

  @Test
  void testBuildEntityLineageData_NullPipeline_ProducesNoPipelineInEsData() {
    EntityReference from =
        new EntityReference().withId(UUID.randomUUID()).withFullyQualifiedName("db_service");
    EntityReference to =
        new EntityReference().withId(UUID.randomUUID()).withFullyQualifiedName("kafka_service");
    LineageDetails details = new LineageDetails().withPipeline(null);

    var esData = LineageRepository.buildEntityLineageData(from, to, details);

    assertNull(esData.getPipeline(), "Service-level lineage must not inherit pipeline annotation");
  }

  @Test
  void testLineageDetails_WithPipelineNull_PipelineFieldIsNull() {
    EntityReference pipelineRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("pipeline")
            .withFullyQualifiedName("Flink.my_pipeline");
    LineageDetails details = new LineageDetails().withPipeline(pipelineRef);

    LineageDetails stripped = details.withPipeline(null);

    assertNull(
        stripped.getPipeline(),
        "After withPipeline(null), service-level lineage must have no pipeline");
  }

  /**
   * Bug #1: When entity lineage has a non-null pipeline annotation, the derived service-level edge
   * (new edge) must not inherit that annotation.
   */
  @Test
  void testServiceEdge_WithNonNullEntityPipeline_NewEdgeHasNoPipeline() throws Exception {
    UUID fromEntityId = UUID.randomUUID();
    UUID toEntityId = UUID.randomUUID();
    UUID fromServiceId = UUID.randomUUID();
    UUID toServiceId = UUID.randomUUID();
    String entityType = "table";

    EntityReference fromRef = new EntityReference().withId(fromEntityId).withType(entityType);
    EntityReference toRef = new EntityReference().withId(toEntityId).withType(entityType);
    EntityReference pipelineRef =
        new EntityReference().withId(UUID.randomUUID()).withType("pipeline");
    EntityReference fromServiceRef =
        new EntityReference().withId(fromServiceId).withType("databaseService");
    EntityReference toServiceRef =
        new EntityReference().withId(toServiceId).withType("messagingService");

    LineageDetails entityDetails =
        new LineageDetails().withPipeline(pipelineRef).withCreatedBy("testUser");

    EntityInterface fromEntityMock = mock(EntityInterface.class);
    when(fromEntityMock.getService()).thenReturn(fromServiceRef);
    when(fromEntityMock.getEntityReference()).thenReturn(fromRef);

    EntityInterface toEntityMock = mock(EntityInterface.class);
    when(toEntityMock.getService()).thenReturn(toServiceRef);
    when(toEntityMock.getEntityReference()).thenReturn(toRef);

    CollectionDAO freshDao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(freshDao.relationshipDAO()).thenReturn(relDAO);

    mockedEntity.when(Entity::getCollectionDAO).thenReturn(freshDao);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "service")).thenReturn(true);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "domains")).thenReturn(false);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "dataProducts")).thenReturn(false);
    mockedEntity
        .when(() -> Entity.getEntity(eq(entityType), eq(fromEntityId), any(), any()))
        .thenReturn(fromEntityMock);
    mockedEntity
        .when(() -> Entity.getEntity(eq(entityType), eq(toEntityId), any(), any()))
        .thenReturn(toEntityMock);
    mockedEntity.when(() -> Entity.entityHasField("pipeline", "service")).thenReturn(false);

    ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);

    LineageRepository repo = new LineageRepository();
    Method buildExtendedLineage =
        LineageRepository.class.getDeclaredMethod(
            "buildExtendedLineage",
            EntityReference.class,
            EntityReference.class,
            LineageDetails.class,
            boolean.class);
    buildExtendedLineage.setAccessible(true);
    buildExtendedLineage.invoke(repo, fromRef, toRef, entityDetails, false);

    verify(relDAO)
        .insert(eq(fromServiceId), eq(toServiceId), any(), any(), anyInt(), jsonCaptor.capture());

    LineageDetails captured = JsonUtils.readValue(jsonCaptor.getValue(), LineageDetails.class);
    assertNull(
        captured.getPipeline(),
        "Service-level lineage must not inherit pipeline annotation from entity lineage");
  }

  /**
   * Bug #1: When entity lineage has a non-null pipeline annotation, updating an already-existing
   * service-level edge must also not carry the pipeline annotation forward.
   */
  @Test
  void testServiceEdge_WithNonNullEntityPipeline_ExistingEdgeHasNoPipeline() throws Exception {
    UUID fromEntityId = UUID.randomUUID();
    UUID toEntityId = UUID.randomUUID();
    UUID fromServiceId = UUID.randomUUID();
    UUID toServiceId = UUID.randomUUID();
    String entityType = "table";

    EntityReference fromRef = new EntityReference().withId(fromEntityId).withType(entityType);
    EntityReference toRef = new EntityReference().withId(toEntityId).withType(entityType);
    EntityReference pipelineRef =
        new EntityReference().withId(UUID.randomUUID()).withType("pipeline");
    EntityReference fromServiceRef =
        new EntityReference().withId(fromServiceId).withType("databaseService");
    EntityReference toServiceRef =
        new EntityReference().withId(toServiceId).withType("messagingService");

    LineageDetails entityDetails =
        new LineageDetails().withPipeline(pipelineRef).withCreatedBy("testUser");

    LineageDetails existingServiceDetails =
        new LineageDetails()
            .withSource(LineageDetails.Source.CHILD_ASSETS)
            .withAssetEdges(1)
            .withPipeline(null);
    CollectionDAO.EntityRelationshipObject existingRecord =
        mock(CollectionDAO.EntityRelationshipObject.class);
    when(existingRecord.getJson()).thenReturn(JsonUtils.pojoToJson(existingServiceDetails));

    EntityInterface fromEntityMock = mock(EntityInterface.class);
    when(fromEntityMock.getService()).thenReturn(fromServiceRef);
    when(fromEntityMock.getEntityReference()).thenReturn(fromRef);

    EntityInterface toEntityMock = mock(EntityInterface.class);
    when(toEntityMock.getService()).thenReturn(toServiceRef);
    when(toEntityMock.getEntityReference()).thenReturn(toRef);

    CollectionDAO freshDao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(freshDao.relationshipDAO()).thenReturn(relDAO);
    when(relDAO.getRecord(eq(fromServiceId), eq(toServiceId), anyInt())).thenReturn(existingRecord);

    mockedEntity.when(Entity::getCollectionDAO).thenReturn(freshDao);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "service")).thenReturn(true);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "domains")).thenReturn(false);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "dataProducts")).thenReturn(false);
    mockedEntity
        .when(() -> Entity.getEntity(eq(entityType), eq(fromEntityId), any(), any()))
        .thenReturn(fromEntityMock);
    mockedEntity
        .when(() -> Entity.getEntity(eq(entityType), eq(toEntityId), any(), any()))
        .thenReturn(toEntityMock);
    mockedEntity.when(() -> Entity.entityHasField("pipeline", "service")).thenReturn(false);

    ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);

    LineageRepository repo = new LineageRepository();
    Method buildExtendedLineage =
        LineageRepository.class.getDeclaredMethod(
            "buildExtendedLineage",
            EntityReference.class,
            EntityReference.class,
            LineageDetails.class,
            boolean.class);
    buildExtendedLineage.setAccessible(true);
    buildExtendedLineage.invoke(repo, fromRef, toRef, entityDetails, false);

    verify(relDAO)
        .insert(eq(fromServiceId), eq(toServiceId), any(), any(), anyInt(), jsonCaptor.capture());

    LineageDetails captured = JsonUtils.readValue(jsonCaptor.getValue(), LineageDetails.class);
    assertNull(
        captured.getPipeline(),
        "Updating an existing service-level edge must not inherit pipeline annotation from entity lineage");
  }

  /**
   * Bug #2: When entity lineage has a pipeline whose service is distinct from fromService and
   * toService, three service-level edges must be created: fromService→toService,
   * fromService→pipelineService, and pipelineService→toService.
   */
  @Test
  void testPipelineServiceEdges_WithDistinctPipelineService_CreatesBothEdges() throws Exception {
    UUID fromEntityId = UUID.randomUUID();
    UUID toEntityId = UUID.randomUUID();
    UUID fromServiceId = UUID.randomUUID();
    UUID toServiceId = UUID.randomUUID();
    UUID pipelineId = UUID.randomUUID();
    UUID pipelineServiceId = UUID.randomUUID();
    String entityType = "table";

    EntityReference fromRef = new EntityReference().withId(fromEntityId).withType(entityType);
    EntityReference toRef = new EntityReference().withId(toEntityId).withType(entityType);
    EntityReference pipelineRef = new EntityReference().withId(pipelineId).withType("pipeline");
    EntityReference fromServiceRef =
        new EntityReference().withId(fromServiceId).withType("databaseService");
    EntityReference toServiceRef =
        new EntityReference().withId(toServiceId).withType("messagingService");
    EntityReference pipelineServiceRef =
        new EntityReference().withId(pipelineServiceId).withType("pipelineService");

    LineageDetails entityDetails =
        new LineageDetails().withPipeline(pipelineRef).withCreatedBy("testUser");

    EntityInterface fromEntityMock = mock(EntityInterface.class);
    when(fromEntityMock.getService()).thenReturn(fromServiceRef);
    when(fromEntityMock.getEntityReference()).thenReturn(fromRef);

    EntityInterface toEntityMock = mock(EntityInterface.class);
    when(toEntityMock.getService()).thenReturn(toServiceRef);
    when(toEntityMock.getEntityReference()).thenReturn(toRef);

    EntityInterface pipelineEntityMock = mock(EntityInterface.class);
    when(pipelineEntityMock.getService()).thenReturn(pipelineServiceRef);

    CollectionDAO freshDao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(freshDao.relationshipDAO()).thenReturn(relDAO);

    mockedEntity.when(Entity::getCollectionDAO).thenReturn(freshDao);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "service")).thenReturn(true);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "domains")).thenReturn(false);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "dataProducts")).thenReturn(false);
    mockedEntity
        .when(() -> Entity.getEntity(eq(entityType), eq(fromEntityId), any(), any()))
        .thenReturn(fromEntityMock);
    mockedEntity
        .when(() -> Entity.getEntity(eq(entityType), eq(toEntityId), any(), any()))
        .thenReturn(toEntityMock);
    mockedEntity.when(() -> Entity.entityHasField("pipeline", "service")).thenReturn(true);
    mockedEntity
        .when(() -> Entity.getEntity(eq("pipeline"), eq(pipelineId), any(), any()))
        .thenReturn(pipelineEntityMock);

    ArgumentCaptor<UUID> fromCaptor = ArgumentCaptor.forClass(UUID.class);
    ArgumentCaptor<UUID> toCaptor = ArgumentCaptor.forClass(UUID.class);

    LineageRepository repo = new LineageRepository();
    Method buildExtendedLineage =
        LineageRepository.class.getDeclaredMethod(
            "buildExtendedLineage",
            EntityReference.class,
            EntityReference.class,
            LineageDetails.class,
            boolean.class);
    buildExtendedLineage.setAccessible(true);
    buildExtendedLineage.invoke(repo, fromRef, toRef, entityDetails, false);

    verify(relDAO, times(3))
        .insert(fromCaptor.capture(), toCaptor.capture(), any(), any(), anyInt(), any());

    List<UUID> insertedFromIds = fromCaptor.getAllValues();
    List<UUID> insertedToIds = toCaptor.getAllValues();

    assertTrue(
        edgePairExists(insertedFromIds, insertedToIds, fromServiceId, toServiceId),
        "fromService→toService edge must be created");
    assertTrue(
        edgePairExists(insertedFromIds, insertedToIds, fromServiceId, pipelineServiceId),
        "fromService→pipelineService edge must be created");
    assertTrue(
        edgePairExists(insertedFromIds, insertedToIds, pipelineServiceId, toServiceId),
        "pipelineService→toService edge must be created");
  }

  /**
   * Bug #2: When entity lineage has no pipeline annotation, only the direct service-level edge
   * (fromService→toService) is created — no pipeline service edges.
   */
  @Test
  void testPipelineServiceEdges_WithNoPipeline_OnlyDirectServiceEdgeCreated() throws Exception {
    UUID fromEntityId = UUID.randomUUID();
    UUID toEntityId = UUID.randomUUID();
    UUID fromServiceId = UUID.randomUUID();
    UUID toServiceId = UUID.randomUUID();
    String entityType = "table";

    EntityReference fromRef = new EntityReference().withId(fromEntityId).withType(entityType);
    EntityReference toRef = new EntityReference().withId(toEntityId).withType(entityType);
    EntityReference fromServiceRef =
        new EntityReference().withId(fromServiceId).withType("databaseService");
    EntityReference toServiceRef =
        new EntityReference().withId(toServiceId).withType("messagingService");

    LineageDetails entityDetails =
        new LineageDetails().withPipeline(null).withCreatedBy("testUser");

    EntityInterface fromEntityMock = mock(EntityInterface.class);
    when(fromEntityMock.getService()).thenReturn(fromServiceRef);
    when(fromEntityMock.getEntityReference()).thenReturn(fromRef);

    EntityInterface toEntityMock = mock(EntityInterface.class);
    when(toEntityMock.getService()).thenReturn(toServiceRef);
    when(toEntityMock.getEntityReference()).thenReturn(toRef);

    CollectionDAO freshDao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(freshDao.relationshipDAO()).thenReturn(relDAO);

    mockedEntity.when(Entity::getCollectionDAO).thenReturn(freshDao);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "service")).thenReturn(true);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "domains")).thenReturn(false);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "dataProducts")).thenReturn(false);
    mockedEntity
        .when(() -> Entity.getEntity(eq(entityType), eq(fromEntityId), any(), any()))
        .thenReturn(fromEntityMock);
    mockedEntity
        .when(() -> Entity.getEntity(eq(entityType), eq(toEntityId), any(), any()))
        .thenReturn(toEntityMock);

    LineageRepository repo = new LineageRepository();
    Method buildExtendedLineage =
        LineageRepository.class.getDeclaredMethod(
            "buildExtendedLineage",
            EntityReference.class,
            EntityReference.class,
            LineageDetails.class,
            boolean.class);
    buildExtendedLineage.setAccessible(true);
    buildExtendedLineage.invoke(repo, fromRef, toRef, entityDetails, false);

    verify(relDAO, times(1)).insert(any(), any(), any(), any(), anyInt(), any());
  }

  private boolean edgePairExists(
      List<UUID> fromIds, List<UUID> toIds, UUID expectedFrom, UUID expectedTo) {
    for (int i = 0; i < fromIds.size(); i++) {
      if (fromIds.get(i).equals(expectedFrom) && toIds.get(i).equals(expectedTo)) {
        return true;
      }
    }
    return false;
  }

  @Test
  void testDeleteLineageBySource_OpenLineage_UsesPipelinePath() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.findLineageBySourcePipeline(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyInt()))
        .thenReturn(Collections.emptyList());

    mockedEntity.when(Entity::getCollectionDAO).thenReturn(dao);

    LineageRepository lineageRepository = new LineageRepository();
    UUID entityId = UUID.randomUUID();
    lineageRepository.deleteLineageBySource(
        entityId, "table", LineageDetails.Source.OPEN_LINEAGE.value());

    org.mockito.Mockito.verify(relationshipDAO)
        .findLineageBySourcePipeline(
            entityId,
            "table",
            LineageDetails.Source.OPEN_LINEAGE.value(),
            Relationship.UPSTREAM.ordinal());
    org.mockito.Mockito.verify(relationshipDAO)
        .deleteLineageBySourcePipeline(
            entityId, LineageDetails.Source.OPEN_LINEAGE.value(), Relationship.UPSTREAM.ordinal());
  }
}
