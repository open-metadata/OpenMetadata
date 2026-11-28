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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.io.StringReader;
import java.lang.reflect.Method;
import java.util.*;
import java.util.stream.Collectors;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVRecord;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.LineageSettings;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.*;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.slf4j.LoggerFactory;

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
  void testValidateLineageDetails_EntityOnlyAI_lineageDoesNotLogColumnErrors() {
    final LineageRepository repository = new LineageRepository();
    final EntityReference llmModel = entityReference("llmModel", "service.model");
    final EntityReference aiApplication = entityReference("aiApplication", "application");
    final LineageDetails details =
        new LineageDetails()
            .withDescription("Uses the model")
            .withSource(LineageDetails.Source.MANUAL);
    final Logger logger = (Logger) LoggerFactory.getLogger(LineageRepository.class);
    final ListAppender<ILoggingEvent> appender = attachListAppender(logger);

    try {
      final String result = repository.validateLineageDetails(llmModel, aiApplication, details);
      assertNotNull(result);
      assertNoColumnLineageErrors(appender);
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  private static EntityReference entityReference(final String type, final String fqn) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withFullyQualifiedName(fqn);
  }

  @Test
  void testValidateLineageDetails_TableColumnToMetric_KeepsColumnLineage() {
    final LineageRepository repository = new LineageRepository();
    final EntityReference table = entityReference(Entity.TABLE, "db.schema.sales");
    final EntityReference metric = entityReference(Entity.METRIC, "metricService.total_sales");
    mockSalesTable(table);

    final LineageDetails details =
        columnLineageDetails("db.schema.sales.amount", metric.getFullyQualifiedName());

    final LineageDetails saved =
        JsonUtils.readValue(
            repository.validateLineageDetails(table, metric, details), LineageDetails.class);

    assertEquals(1, saved.getColumnsLineage().size());
    assertEquals("metricService.total_sales", saved.getColumnsLineage().get(0).getToColumn());
    assertEquals(
        List.of("db.schema.sales.amount"), saved.getColumnsLineage().get(0).getFromColumns());
  }

  @Test
  void testValidateLineageDetails_MetricToTableColumn_KeepsColumnLineage() {
    final LineageRepository repository = new LineageRepository();
    final EntityReference metric = entityReference(Entity.METRIC, "metricService.total_sales");
    final EntityReference table = entityReference(Entity.TABLE, "db.schema.sales");
    mockSalesTable(table);

    final LineageDetails details =
        columnLineageDetails(metric.getFullyQualifiedName(), "db.schema.sales.amount");

    final LineageDetails saved =
        JsonUtils.readValue(
            repository.validateLineageDetails(metric, table, details), LineageDetails.class);

    assertEquals(1, saved.getColumnsLineage().size());
    assertEquals("db.schema.sales.amount", saved.getColumnsLineage().get(0).getToColumn());
    assertEquals(
        List.of("metricService.total_sales"), saved.getColumnsLineage().get(0).getFromColumns());
  }

  @Test
  void testValidateLineageDetails_UnknownMetricChild_IsFilteredOut() {
    final LineageRepository repository = new LineageRepository();
    final EntityReference table = entityReference(Entity.TABLE, "db.schema.sales");
    final EntityReference metric = entityReference(Entity.METRIC, "metricService.total_sales");
    mockSalesTable(table);

    final LineageDetails details =
        columnLineageDetails(
            "db.schema.sales.amount", metric.getFullyQualifiedName() + ".not_a_column");

    final LineageDetails saved =
        JsonUtils.readValue(
            repository.validateLineageDetails(table, metric, details), LineageDetails.class);

    assertTrue(saved.getColumnsLineage().isEmpty());
  }

  private static void mockSalesTable(final EntityReference table) {
    final Table salesTable =
        new Table()
            .withId(table.getId())
            .withName("sales")
            .withFullyQualifiedName(table.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("amount")
                        .withDataType(ColumnDataType.BIGINT)
                        .withFullyQualifiedName(table.getFullyQualifiedName() + ".amount")));
    mockedEntity
        .when(() -> Entity.getEntity(Entity.TABLE, table.getId(), "columns", Include.NON_DELETED))
        .thenReturn(salesTable);
  }

  private static LineageDetails columnLineageDetails(
      final String fromColumn, final String toColumn) {
    return new LineageDetails()
        .withSource(LineageDetails.Source.MANUAL)
        .withColumnsLineage(
            List.of(
                new ColumnLineage()
                    .withFromColumns(new ArrayList<>(List.of(fromColumn)))
                    .withToColumn(toColumn)));
  }

  private static ListAppender<ILoggingEvent> attachListAppender(final Logger logger) {
    final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
    return appender;
  }

  private static void assertNoColumnLineageErrors(final ListAppender<ILoggingEvent> appender) {
    assertTrue(
        appender.list.stream()
            .filter(event -> event.getLevel() == Level.ERROR)
            .noneMatch(event -> event.getFormattedMessage().contains("for column lineage")));
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

    EntityInterface<?> fromEntityMock = mock(EntityInterface.class);
    when(fromEntityMock.getService()).thenReturn(fromServiceRef);
    when(fromEntityMock.getEntityReference()).thenReturn(fromRef);

    EntityInterface<?> toEntityMock = mock(EntityInterface.class);
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
            LineageDetails.class,
            boolean.class);
    buildExtendedLineage.setAccessible(true);
    buildExtendedLineage.invoke(repo, fromRef, toRef, entityDetails, null, false);

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

    EntityInterface<?> fromEntityMock = mock(EntityInterface.class);
    when(fromEntityMock.getService()).thenReturn(fromServiceRef);
    when(fromEntityMock.getEntityReference()).thenReturn(fromRef);

    EntityInterface<?> toEntityMock = mock(EntityInterface.class);
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
            LineageDetails.class,
            boolean.class);
    buildExtendedLineage.setAccessible(true);
    buildExtendedLineage.invoke(repo, fromRef, toRef, entityDetails, null, false);

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
  /**
   * A pipeline-annotated edge is projected as fromService → pipelineService → toService only. The
   * direct fromService → toService edge must not also be created, or the service graph draws two
   * parallel paths for the same flow of data.
   */
  @Test
  void testPipelineServiceEdges_WithDistinctPipelineService_RoutesThroughPipelineOnly()
      throws Exception {
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

    EntityInterface<?> fromEntityMock = mock(EntityInterface.class);
    when(fromEntityMock.getService()).thenReturn(fromServiceRef);
    when(fromEntityMock.getEntityReference()).thenReturn(fromRef);

    EntityInterface<?> toEntityMock = mock(EntityInterface.class);
    when(toEntityMock.getService()).thenReturn(toServiceRef);
    when(toEntityMock.getEntityReference()).thenReturn(toRef);

    EntityInterface<?> pipelineEntityMock = mock(EntityInterface.class);
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
            LineageDetails.class,
            boolean.class);
    buildExtendedLineage.setAccessible(true);
    buildExtendedLineage.invoke(repo, fromRef, toRef, entityDetails, null, false);

    verify(relDAO, times(2))
        .insert(fromCaptor.capture(), toCaptor.capture(), any(), any(), anyInt(), any());

    List<UUID> insertedFromIds = fromCaptor.getAllValues();
    List<UUID> insertedToIds = toCaptor.getAllValues();

    assertTrue(
        edgePairExists(insertedFromIds, insertedToIds, fromServiceId, pipelineServiceId),
        "fromService→pipelineService edge must be created");
    assertTrue(
        edgePairExists(insertedFromIds, insertedToIds, pipelineServiceId, toServiceId),
        "pipelineService→toService edge must be created");
    assertFalse(
        edgePairExists(insertedFromIds, insertedToIds, fromServiceId, toServiceId),
        "direct fromService→toService edge must NOT be created alongside the pipeline hops");
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

    EntityInterface<?> fromEntityMock = mock(EntityInterface.class);
    when(fromEntityMock.getService()).thenReturn(fromServiceRef);
    when(fromEntityMock.getEntityReference()).thenReturn(fromRef);

    EntityInterface<?> toEntityMock = mock(EntityInterface.class);
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
            LineageDetails.class,
            boolean.class);
    buildExtendedLineage.setAccessible(true);
    buildExtendedLineage.invoke(repo, fromRef, toRef, entityDetails, null, false);

    verify(relDAO, times(1)).insert(any(), any(), any(), any(), anyInt(), any());
  }

  /**
   * A service edge written straight through PUT /v1/lineage carries no assetEdges refcount. The
   * first child edge rolled up into it has to be counted as its first contributor instead of
   * failing the request.
   */
  @Test
  void testServiceEdge_ExistingEdgeWithoutAssetEdges_CountsChildEdgeAsFirstContributor()
      throws Exception {
    EntityReference fromService = serviceRef("databaseService");
    EntityReference toService = serviceRef("messagingService");

    CollectionDAO.EntityRelationshipDAO relDAO =
        rollUpChildEdge(fromService, toService, new LineageDetails(), new LineageDetails(), null);

    assertEquals(1, storedAssetEdges(relDAO, fromService, toService));
  }

  /**
   * Attaching a pipeline to an existing child edge releases the direct service edge it fed. A
   * direct edge with no assetEdges refcount has no other contributor on record, so releasing it
   * deletes it instead of failing the request.
   */
  @Test
  void testServiceEdge_ReleasingDirectEdgeWithoutAssetEdges_DeletesIt() throws Exception {
    EntityReference fromService = serviceRef("databaseService");
    EntityReference toService = serviceRef("messagingService");

    CollectionDAO.EntityRelationshipDAO relDAO =
        rollUpChildEdge(
            fromService, toService, new LineageDetails(), withPipeline(), new LineageDetails());

    verify(relDAO)
        .delete(
            fromService.getId(),
            fromService.getType(),
            toService.getId(),
            toService.getType(),
            Relationship.UPSTREAM.ordinal());
  }

  @Test
  void testServiceEdge_ReleasingDirectEdgeOtherChildrenStillFeed_DecrementsIt() throws Exception {
    EntityReference fromService = serviceRef("databaseService");
    EntityReference toService = serviceRef("messagingService");

    CollectionDAO.EntityRelationshipDAO relDAO =
        rollUpChildEdge(
            fromService,
            toService,
            new LineageDetails().withAssetEdges(2),
            withPipeline(),
            new LineageDetails());

    assertEquals(1, storedAssetEdges(relDAO, fromService, toService));
  }

  /**
   * Rolls one table-to-table child edge up into service lineage while the direct edge between the
   * two services is already stored as {@code storedServiceEdge}. A non-null {@code priorChildEdge}
   * makes it an update of an existing child edge. Returns the DAO the rollup wrote through.
   */
  private CollectionDAO.EntityRelationshipDAO rollUpChildEdge(
      EntityReference fromService,
      EntityReference toService,
      LineageDetails storedServiceEdge,
      LineageDetails childEdge,
      LineageDetails priorChildEdge)
      throws Exception {
    String entityType = "table";
    EntityReference fromRef = new EntityReference().withId(UUID.randomUUID()).withType(entityType);
    EntityReference toRef = new EntityReference().withId(UUID.randomUUID()).withType(entityType);

    EntityInterface<?> fromEntityMock = mock(EntityInterface.class);
    when(fromEntityMock.getService()).thenReturn(fromService);
    when(fromEntityMock.getEntityReference()).thenReturn(fromRef);
    EntityInterface<?> toEntityMock = mock(EntityInterface.class);
    when(toEntityMock.getService()).thenReturn(toService);
    when(toEntityMock.getEntityReference()).thenReturn(toRef);

    CollectionDAO freshDao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(freshDao.relationshipDAO()).thenReturn(relDAO);
    when(relDAO.getRecord(eq(fromService.getId()), eq(toService.getId()), anyInt()))
        .thenReturn(
            CollectionDAO.EntityRelationshipObject.builder()
                .json(JsonUtils.pojoToJson(storedServiceEdge))
                .build());

    mockedEntity.when(Entity::getCollectionDAO).thenReturn(freshDao);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "service")).thenReturn(true);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "domains")).thenReturn(false);
    mockedEntity.when(() -> Entity.entityHasField(entityType, "dataProducts")).thenReturn(false);
    mockedEntity
        .when(() -> Entity.getEntity(eq(entityType), eq(fromRef.getId()), any(), any()))
        .thenReturn(fromEntityMock);
    mockedEntity
        .when(() -> Entity.getEntity(eq(entityType), eq(toRef.getId()), any(), any()))
        .thenReturn(toEntityMock);
    if (childEdge.getPipeline() != null) {
      EntityInterface<?> pipelineEntityMock = mock(EntityInterface.class);
      when(pipelineEntityMock.getService()).thenReturn(serviceRef("pipelineService"));
      mockedEntity.when(() -> Entity.entityHasField("pipeline", "service")).thenReturn(true);
      mockedEntity
          .when(
              () ->
                  Entity.getEntity(
                      eq("pipeline"), eq(childEdge.getPipeline().getId()), any(), any()))
          .thenReturn(pipelineEntityMock);
    }

    Method buildExtendedLineage =
        LineageRepository.class.getDeclaredMethod(
            "buildExtendedLineage",
            EntityReference.class,
            EntityReference.class,
            LineageDetails.class,
            LineageDetails.class,
            boolean.class);
    buildExtendedLineage.setAccessible(true);
    buildExtendedLineage.invoke(
        new LineageRepository(), fromRef, toRef, childEdge, priorChildEdge, priorChildEdge != null);
    return relDAO;
  }

  private static Integer storedAssetEdges(
      CollectionDAO.EntityRelationshipDAO relDAO,
      EntityReference fromService,
      EntityReference toService) {
    ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
    verify(relDAO)
        .insert(
            eq(fromService.getId()),
            eq(toService.getId()),
            any(),
            any(),
            anyInt(),
            jsonCaptor.capture());
    return JsonUtils.readValue(jsonCaptor.getValue(), LineageDetails.class).getAssetEdges();
  }

  private static EntityReference serviceRef(String serviceType) {
    return new EntityReference().withId(UUID.randomUUID()).withType(serviceType);
  }

  private static LineageDetails withPipeline() {
    return new LineageDetails()
        .withPipeline(new EntityReference().withId(UUID.randomUUID()).withType("pipeline"));
  }

  @Test
  void testPreserveAssetEdges_DirectWriteKeepsStoredRefcount() {
    LineageDetails incoming = new LineageDetails().withAssetEdges(7);

    LineageRepository.preserveAssetEdges(incoming, new LineageDetails().withAssetEdges(3));

    assertEquals(3, incoming.getAssetEdges());
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
        entityId, "table", LineageDetails.Source.OPEN_LINEAGE.value(), "test-user");

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

  @Test
  void testGetLineageEdgeEnds_ReturnsTypedEndsOfTheUpstreamRecord() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relationshipDAO);
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();
    CollectionDAO.EntityRelationshipObject record =
        CollectionDAO.EntityRelationshipObject.builder()
            .fromId(fromId.toString())
            .toId(toId.toString())
            .fromEntity("table")
            .toEntity("dashboard")
            .relation(Relationship.UPSTREAM.ordinal())
            .json("{}")
            .build();
    when(relationshipDAO.getRecord(fromId, toId, Relationship.UPSTREAM.ordinal()))
        .thenReturn(record);

    mockedEntity.when(Entity::getCollectionDAO).thenReturn(dao);

    List<EntityReference> ends = new LineageRepository().getLineageEdgeEnds(fromId, toId);

    assertEquals(2, ends.size());
    assertEquals(fromId, ends.getFirst().getId());
    assertEquals("table", ends.getFirst().getType());
    assertEquals(toId, ends.getLast().getId());
    assertEquals("dashboard", ends.getLast().getType());
  }

  @Test
  void testGetLineageEdgeEnds_ThrowsNotFoundWhenNoRowExists() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relationshipDAO);
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();
    when(relationshipDAO.getRecord(fromId, toId, Relationship.UPSTREAM.ordinal())).thenReturn(null);

    mockedEntity.when(Entity::getCollectionDAO).thenReturn(dao);

    LineageRepository lineageRepository = new LineageRepository();
    assertThrows(
        EntityNotFoundException.class, () -> lineageRepository.getLineageEdgeEnds(fromId, toId));
  }

  /**
   * The edge's pipeline is copied, as stored, into the downstream entity's search document, which
   * every user can read. Naming a service there would copy its connection, so the write is refused
   * before anything is stored or loaded.
   */
  @Test
  void testAddLineage_ServiceAsNewPipeline_IsRejectedBeforeStoring() {
    EntityReference serviceRef =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.DATABASE_SERVICE);
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.getRecord(fromEntityId, toEntityId, Relationship.UPSTREAM.ordinal()))
        .thenReturn(null);
    mockedEntity.when(Entity::getCollectionDAO).thenReturn(dao);
    mockedEntity
        .when(() -> Entity.getEntityReferenceById(eq("table"), eq(fromEntityId), any()))
        .thenReturn(fromEntity);
    mockedEntity
        .when(() -> Entity.getEntityReferenceById(eq("table"), eq(toEntityId), any()))
        .thenReturn(toEntity);
    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(fromEntity)
                    .withToEntity(toEntity)
                    .withLineageDetails(new LineageDetails().withPipeline(serviceRef)));

    LineageRepository repository = new LineageRepository();
    IllegalArgumentException rejected =
        assertThrows(
            IllegalArgumentException.class, () -> repository.addLineage(addLineage, "user"));

    assertTrue(rejected.getMessage().contains(Entity.DATABASE_SERVICE), rejected.getMessage());
    verify(relationshipDAO, times(0)).insert(any(), any(), any(), any(), anyInt(), any());
    mockedEntity.verify(() -> Entity.getEntity(eq(serviceRef), any(), any()), times(0));
  }

  /** An edge stored with a service before the restriction is indexed without it, never a copy. */
  @Test
  void testBuildEntityLineageData_ServicePipeline_IsNotCopied() {
    EntityReference serviceRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.DATABASE_SERVICE)
            .withFullyQualifiedName("warehouse");
    LineageDetails details =
        new LineageDetails().withPipeline(serviceRef).withSource(LineageDetails.Source.MANUAL);

    var esData = LineageRepository.buildEntityLineageData(fromEntity, toEntity, details);

    assertNull(esData.getPipeline(), "a service must not be copied into the lineage document");
    assertNull(esData.getPipelineEntityType());
    mockedEntity.verify(() -> Entity.getEntity(eq(serviceRef), any(), any()), times(0));
  }

  /**
   * Ingestion re-sends an edge's stored pipeline on every write. A service stored there before the
   * restriction is dropped rather than refused, so those writes keep working and heal the edge.
   */
  @Test
  void testResolveEdgePipeline_ServiceAlreadyOnEdge_IsDropped() throws Exception {
    EntityReference serviceRef =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.DATABASE_SERVICE);
    Method resolveEdgePipeline =
        LineageRepository.class.getDeclaredMethod(
            "resolveEdgePipeline", EntityReference.class, EntityReference.class);
    resolveEdgePipeline.setAccessible(true);

    assertNull(resolveEdgePipeline.invoke(null, serviceRef, serviceRef));
  }

  @Test
  void testNewlyLinkedEdgePipeline_NullOrNonPipeline_NeedsNoViewCheck() {
    EntityReference service =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.DATABASE_SERVICE);
    assertNull(LineageRepository.newlyLinkedEdgePipeline(null, null));
    assertNull(LineageRepository.newlyLinkedEdgePipeline(service, null));
  }

  @Test
  void testNewlyLinkedEdgePipeline_PipelineNotOnEdge_IsReturnedForTheViewCheck() {
    EntityReference pipeline =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.PIPELINE);

    assertSame(pipeline, LineageRepository.newlyLinkedEdgePipeline(pipeline, null));
  }

  @Test
  void testNewlyLinkedEdgePipeline_SamePipelineAlreadyOnEdge_IsNotRechecked() {
    EntityReference pipeline =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.PIPELINE);
    LineageDetails stored = new LineageDetails().withPipeline(pipeline);

    assertNull(LineageRepository.newlyLinkedEdgePipeline(pipeline, stored));
  }

  @Test
  void testNewlyLinkedEdgePipeline_DifferentPipelineThanStored_IsReturned() {
    EntityReference requested =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.STORED_PROCEDURE);
    LineageDetails stored =
        new LineageDetails()
            .withPipeline(
                new EntityReference().withId(UUID.randomUUID()).withType(Entity.PIPELINE));

    assertSame(requested, LineageRepository.newlyLinkedEdgePipeline(requested, stored));
  }

  @Test
  void testExportCsvAsync_NeutralizesFormulaCells() throws Exception {
    when(searchRepository.searchLineage(any(), any())).thenReturn(pipelineEdgeWithFormulas());

    String csv =
        new LineageRepository().exportCsvAsync("db.schema.from", 1, 1, null, "table", false);

    assertFormulaCellsNeutralized(csv);
  }

  @Test
  void testExportByEntityCountCsvAsync_NeutralizesFormulaCells() throws Exception {
    when(searchRepository.searchLineageByEntityCount(any(), any()))
        .thenReturn(pipelineEdgeWithFormulas());

    String csv =
        new LineageRepository()
            .exportByEntityCountCsvAsync(
                "db.schema.from",
                LineageDirection.DOWNSTREAM,
                0,
                10,
                1,
                1,
                null,
                false,
                "table",
                "*");

    assertFormulaCellsNeutralized(csv);
  }

  private static SearchLineageResult pipelineEdgeWithFormulas() {
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();
    Map<String, Object> pipeline =
        Map.of(
            "name", "etl",
            "displayName", "+SUM(1,1)",
            "description", "=HYPERLINK(\"http://example.com\")");
    EsLineageData edge =
        new EsLineageData()
            .withFromEntity(new RelationshipRef().withId(fromId))
            .withToEntity(new RelationshipRef().withId(toId))
            .withPipeline(pipeline);
    return new SearchLineageResult()
        .withNodes(
            Map.of(
                "from", lineageNode(fromId, "db.schema.from"),
                "to", lineageNode(toId, "db.schema.to")))
        .withUpstreamEdges(Map.of("edge", edge))
        .withDownstreamEdges(Map.of());
  }

  private static NodeInformation lineageNode(UUID id, String fqn) {
    return new NodeInformation().withEntity(Map.of("id", id.toString(), "fullyQualifiedName", fqn));
  }

  private static void assertFormulaCellsNeutralized(String csv) throws Exception {
    List<CSVRecord> records =
        CSVFormat.DEFAULT
            .builder()
            .setHeader()
            .setSkipHeaderRecord(true)
            .build()
            .parse(new StringReader(csv))
            .getRecords();
    assertEquals(1, records.size());
    CSVRecord row = records.getFirst();
    assertEquals("db.schema.from", row.get("fromEntityFQN"));
    assertEquals("etl", row.get("pipelineName"));
    assertEquals("'+SUM(1,1)", row.get("pipelineDisplayName"));
    assertEquals("'=HYPERLINK(\"http://example.com\")", row.get("pipelineDescription"));
  }

  /**
   * Every table feeds every other, so a walk 10 hops deep reaches each table on many paths. Each
   * table is still expanded once, and each edge comes back once per direction.
   */
  @Test
  void testGetLineage_DenseGraph_ExpandsEachEntityOnce() {
    List<UUID> tables =
        List.of(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
    Map<UUID, List<UUID>> upstreamOf = new HashMap<>();
    tables.forEach(
        table ->
            upstreamOf.put(table, tables.stream().filter(other -> !other.equals(table)).toList()));
    CollectionDAO.EntityRelationshipDAO relationshipDAO = mockTableGraph(upstreamOf);

    EntityLineage lineage =
        new LineageRepository().get(Entity.TABLE, tables.getFirst().toString(), 10, 10);

    Set<List<UUID>> everyEdge =
        upstreamOf.entrySet().stream()
            .flatMap(entry -> entry.getValue().stream().map(from -> List.of(from, entry.getKey())))
            .collect(Collectors.toSet());
    assertEquals(12, lineage.getUpstreamEdges().size());
    assertEquals(everyEdge, edgeEnds(lineage.getUpstreamEdges()));
    assertEquals(12, lineage.getDownstreamEdges().size());
    assertEquals(everyEdge, edgeEnds(lineage.getDownstreamEdges()));
    assertEquals(Set.copyOf(tables), Set.copyOf(nodeIds(lineage)));
    int upstream = Relationship.UPSTREAM.ordinal();
    for (UUID table : tables) {
      verify(relationshipDAO, times(1)).findFrom(table, Entity.TABLE, upstream);
      verify(relationshipDAO, times(1)).findTo(table, Entity.TABLE, upstream);
    }
  }

  /**
   * A table two hops away is also three hops away on a longer path. Expanded from that longer path,
   * the tables two hops behind it would fall outside the depth; expanded from the short one, they
   * do not. Both orders of the two paths are walked, since a walk that settles on whichever path it
   * reaches first passes with one of them.
   */
  @Test
  void testGetLineage_EntityOnLongAndShortPath_IsExpandedFromTheShortOne() {
    for (boolean shortPathFirst : new boolean[] {true, false}) {
      assertExpandedFromTheShortPath(shortPathFirst);
    }
  }

  private void assertExpandedFromTheShortPath(boolean shortPathFirst) {
    UUID root = UUID.randomUUID();
    UUID onShortPath = UUID.randomUUID();
    UUID onLongPath = UUID.randomUUID();
    UUID furtherOnLongPath = UUID.randomUUID();
    UUID shared = UUID.randomUUID();
    UUID behindShared = UUID.randomUUID();
    UUID furthest = UUID.randomUUID();
    mockTableGraph(
        Map.of(
            root,
                shortPathFirst
                    ? List.of(onShortPath, onLongPath)
                    : List.of(onLongPath, onShortPath),
            onShortPath, List.of(shared),
            onLongPath, List.of(furtherOnLongPath),
            furtherOnLongPath, List.of(shared),
            shared, List.of(behindShared),
            behindShared, List.of(furthest)));

    EntityLineage lineage = new LineageRepository().get(Entity.TABLE, root.toString(), 4, 0);

    String order = "shortPathFirst=" + shortPathFirst;
    assertEquals(7, lineage.getUpstreamEdges().size(), order);
    assertEquals(
        Set.of(
            List.of(onShortPath, root),
            List.of(onLongPath, root),
            List.of(shared, onShortPath),
            List.of(furtherOnLongPath, onLongPath),
            List.of(shared, furtherOnLongPath),
            List.of(behindShared, shared),
            List.of(furthest, behindShared)),
        edgeEnds(lineage.getUpstreamEdges()),
        order);
    assertTrue(lineage.getDownstreamEdges().isEmpty(), order);
  }

  /** A pipeline is walked through the edges that name it as their pipeline. */
  @Test
  void testGetLineage_PipelineRoot_WalksTheEdgesThatNameIt() {
    UUID pipeline = UUID.randomUUID();
    UUID source = UUID.randomUUID();
    UUID target = UUID.randomUUID();
    CollectionDAO.EntityRelationshipDAO relationshipDAO = mockRelationships();
    int upstream = Relationship.UPSTREAM.ordinal();
    when(relationshipDAO.findFromPipeline(pipeline, upstream))
        .thenReturn(tableRecords(List.of(source)));
    when(relationshipDAO.findToPipeline(pipeline, upstream))
        .thenReturn(tableRecords(List.of(target)));
    mockedEntity
        .when(() -> Entity.getEntityReferenceById(eq(Entity.PIPELINE), eq(pipeline), any()))
        .thenReturn(new EntityReference().withId(pipeline).withType(Entity.PIPELINE));

    EntityLineage lineage = new LineageRepository().get(Entity.PIPELINE, pipeline.toString(), 1, 1);

    assertEquals(Set.of(List.of(source, pipeline)), edgeEnds(lineage.getUpstreamEdges()));
    assertEquals(Set.of(List.of(pipeline, target)), edgeEnds(lineage.getDownstreamEdges()));
  }

  private CollectionDAO.EntityRelationshipDAO mockRelationships() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relationshipDAO);
    mockedEntity.when(Entity::getCollectionDAO).thenReturn(dao);
    mockedEntity
        .when(() -> Entity.getEntityReferenceById(eq(Entity.TABLE), any(UUID.class), any()))
        .thenAnswer(
            call -> new EntityReference().withId(call.getArgument(1)).withType(Entity.TABLE));
    return relationshipDAO;
  }

  /** Mocks a graph of tables from the tables directly upstream of each one. */
  private CollectionDAO.EntityRelationshipDAO mockTableGraph(Map<UUID, List<UUID>> upstreamOf) {
    CollectionDAO.EntityRelationshipDAO relationshipDAO = mockRelationships();
    Map<UUID, List<UUID>> downstreamOf = new HashMap<>();
    upstreamOf.forEach(
        (table, upstreams) ->
            upstreams.forEach(
                from -> downstreamOf.computeIfAbsent(from, key -> new ArrayList<>()).add(table)));
    int upstream = Relationship.UPSTREAM.ordinal();
    when(relationshipDAO.findFrom(any(UUID.class), eq(Entity.TABLE), eq(upstream)))
        .thenAnswer(call -> tableRecords(upstreamOf.getOrDefault(call.getArgument(0), List.of())));
    when(relationshipDAO.findTo(any(UUID.class), eq(Entity.TABLE), eq(upstream)))
        .thenAnswer(
            call -> tableRecords(downstreamOf.getOrDefault(call.getArgument(0), List.of())));
    return relationshipDAO;
  }

  private static List<CollectionDAO.EntityRelationshipRecord> tableRecords(List<UUID> ids) {
    return ids.stream()
        .map(
            id ->
                CollectionDAO.EntityRelationshipRecord.builder()
                    .id(id)
                    .type(Entity.TABLE)
                    .json("{}")
                    .build())
        .toList();
  }

  private static Set<List<UUID>> edgeEnds(List<Edge> edges) {
    return edges.stream()
        .map(edge -> List.of(edge.getFromEntity(), edge.getToEntity()))
        .collect(Collectors.toSet());
  }

  private static List<UUID> nodeIds(EntityLineage lineage) {
    return lineage.getNodes().stream().map(EntityReference::getId).toList();
  }

  // --- Bug fix: OpenLineage no-facet events must not wipe stored column-level lineage ---

  /**
   * OpenLineage events without a columnLineage facet map to LineageDetails with columnsLineage ==
   * null. preserveAssetEdges must restore the stored column lineage, mirroring its existing role
   * for assetEdges, so the next no-facet addLineage does not silently wipe column-level lineage
   * already stored on the edge.
   */
  @Test
  void testPreserveAssetEdges_IncomingColumnsLineageNull_PreservesStoredColumnsLineage() {
    ColumnLineage stored =
        new ColumnLineage().withFromColumns(List.of("db.s.from.col")).withToColumn("db.s.to.col");
    LineageDetails prior = new LineageDetails().withColumnsLineage(List.of(stored));
    LineageDetails incoming = new LineageDetails().withColumnsLineage(null);

    LineageRepository.preserveAssetEdges(incoming, prior);

    assertNotNull(incoming.getColumnsLineage());
    assertEquals(1, incoming.getColumnsLineage().size());
    assertEquals(stored, incoming.getColumnsLineage().get(0));
  }

  /**
   * An explicit empty list is the UI's clear-all signal (the column-lineage editor sends {@code
   * columnsLineage: []} when the last column mapping is removed). Restoring the stored entries on
   * an empty list would silently re-instate the removed mappings on refresh, so an empty list must
   * pass through unchanged. Only {@code null} (the OpenLineage no-facet signal) is restored.
   */
  @Test
  void testPreserveAssetEdges_IncomingColumnsLineageEmpty_KeepsEmptyClearsStored() {
    ColumnLineage stored =
        new ColumnLineage().withFromColumns(List.of("db.s.from.col")).withToColumn("db.s.to.col");
    LineageDetails prior = new LineageDetails().withColumnsLineage(List.of(stored));
    LineageDetails incoming = new LineageDetails().withColumnsLineage(new ArrayList<>());

    LineageRepository.preserveAssetEdges(incoming, prior);

    assertNotNull(incoming.getColumnsLineage());
    assertTrue(incoming.getColumnsLineage().isEmpty(), "empty list must not be restored");
  }

  /**
   * The restored list is a deep copy: mutating the incoming entries through {@code
   * validateLineageDetails} (which filters invalid fromColumns in place) must not reach the prior
   * edge's {@link ColumnLineage} objects, or {@code payloadChanged} would compare two already-mutated
   * references and miss a real change.
   */
  @Test
  void testPreserveAssetEdges_RestoredColumnsLineageIsDeepCopyOfPrior() {
    ColumnLineage stored =
        new ColumnLineage()
            .withFromColumns(new ArrayList<>(List.of("db.s.from.col")))
            .withToColumn("db.s.to.col")
            .withFunction("coalesce(a, b)");
    LineageDetails prior = new LineageDetails().withColumnsLineage(List.of(stored));
    LineageDetails incoming = new LineageDetails().withColumnsLineage(null);

    LineageRepository.preserveAssetEdges(incoming, prior);

    assertNotSame(stored, incoming.getColumnsLineage().get(0), "entry must be a copy, not shared");
    assertNotSame(
        prior.getColumnsLineage(), incoming.getColumnsLineage(), "list must be a copy, not shared");
    assertEquals("coalesce(a, b)", incoming.getColumnsLineage().get(0).getFunction());
    // Mutating the restored entry must not bleed into the prior edge.
    incoming.getColumnsLineage().get(0).getFromColumns().add("db.s.from.extra");
    assertEquals(
        List.of("db.s.from.col"), stored.getFromColumns(), "prior entry must be untouched");
  }

  /**
   * Replace semantics: a write that DOES carry a columnLineage facet overrides the stored entries.
   * The fix must not turn every addLineage into a union-merge; explicit rewrites still overwrite.
   */
  @Test
  void testPreserveAssetEdges_IncomingColumnsLineageNonEmpty_KeepsIncomingColumnsLineage() {
    ColumnLineage priorEntry =
        new ColumnLineage()
            .withFromColumns(List.of("db.s.from.prior"))
            .withToColumn("db.s.to.prior");
    ColumnLineage incomingEntry =
        new ColumnLineage()
            .withFromColumns(List.of("db.s.from.fresh"))
            .withToColumn("db.s.to.fresh");
    LineageDetails prior = new LineageDetails().withColumnsLineage(List.of(priorEntry));
    LineageDetails incoming = new LineageDetails().withColumnsLineage(List.of(incomingEntry));

    LineageRepository.preserveAssetEdges(incoming, prior);

    assertEquals(1, incoming.getColumnsLineage().size());
    assertEquals(incomingEntry, incoming.getColumnsLineage().get(0));
  }

  /** On a new edge (prior == null), nothing is restored and the helper is a no-op. */
  @Test
  void testPreserveAssetEdges_PriorIsNull_DoesNotTouchColumnsLineage() {
    LineageDetails incoming = new LineageDetails().withColumnsLineage(null);

    LineageRepository.preserveAssetEdges(incoming, null);

    assertNull(incoming.getColumnsLineage());
  }

  /**
   * End-to-end bug fix: a second addLineage carrying columnsLineage == null (i.e. an OpenLineage
   * run event without a columnLineage facet) must preserve the column-level lineage already stored
   * on the from->to edge, both in the re-inserted edge json (the high-frequency wipe surface) and
   * must not emit a spurious ENTITY_LINEAGE_UPDATED change event for the unchanged columns.
   */
  @Test
  void testAddLineage_RepeatedWriteWithNullColumnsLineage_PreservesStoredColumnLineage() {
    ColumnLineage storedColumnLineage =
        new ColumnLineage()
            .withFromColumns(List.of("database.schema.fromTable.amount"))
            .withToColumn("database.schema.toTable.amount");
    LineageDetails prior =
        new LineageDetails()
            .withSource(LineageDetails.Source.OPEN_LINEAGE)
            .withColumnsLineage(List.of(storedColumnLineage));
    LineageDetails incoming = new LineageDetails().withSource(LineageDetails.Source.OPEN_LINEAGE);
    // Mirrors OpenLineageMapper.withColumnsLineage(columnLineage.isEmpty() ? null : columnLineage)
    incoming.setColumnsLineage(null);

    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);
    when(dao.relationshipDAO()).thenReturn(relDAO);
    when(dao.changeEventDAO()).thenReturn(changeEventDAO);
    when(relDAO.getRecord(fromEntityId, toEntityId, Relationship.UPSTREAM.ordinal()))
        .thenReturn(
            CollectionDAO.EntityRelationshipObject.builder()
                .json(JsonUtils.pojoToJson(prior))
                .build());
    mockedEntity.when(Entity::getCollectionDAO).thenReturn(dao);
    mockedEntity
        .when(() -> Entity.getEntityReferenceById(eq("table"), eq(fromEntityId), any()))
        .thenReturn(fromEntity);
    mockedEntity
        .when(() -> Entity.getEntityReferenceById(eq("table"), eq(toEntityId), any()))
        .thenReturn(toEntity);
    mockTableForLineage(fromEntity, "amount");
    mockTableForLineage(toEntity, "amount");

    ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
    new LineageRepository()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(fromEntity)
                        .withToEntity(toEntity)
                        .withLineageDetails(incoming)),
            "user");

    verify(relDAO)
        .insert(
            eq(fromEntityId),
            eq(toEntityId),
            any(),
            any(),
            eq(Relationship.UPSTREAM.ordinal()),
            jsonCaptor.capture());
    LineageDetails persisted = JsonUtils.readValue(jsonCaptor.getValue(), LineageDetails.class);
    assertNotNull(
        persisted.getColumnsLineage(), "stored column lineage must survive a no-facet write");
    assertEquals(1, persisted.getColumnsLineage().size());
    assertEquals(
        "database.schema.toTable.amount", persisted.getColumnsLineage().get(0).getToColumn());
    assertEquals(
        List.of("database.schema.fromTable.amount"),
        persisted.getColumnsLineage().get(0).getFromColumns());

    // After preservation the (re-validated) incoming columns match the prior edge, so a
    // spurious ENTITY_LINEAGE_UPDATED event would fire without the fix; pin its absence.
    verify(changeEventDAO, never()).insert(any());
  }

  /**
   * A write that DOES carry column-level lineage overrides the stored entries (replace, not
   * merge), so updating column lineage through addLineage still works after the fix.
   */
  @Test
  void testAddLineage_WriteWithNonNullColumnsLineage_ReplacesStoredColumnLineage() {
    ColumnLineage priorEntry =
        new ColumnLineage()
            .withFromColumns(List.of("database.schema.fromTable.prior"))
            .withToColumn("database.schema.toTable.prior");
    LineageDetails prior =
        new LineageDetails()
            .withSource(LineageDetails.Source.OPEN_LINEAGE)
            .withColumnsLineage(List.of(priorEntry));
    ColumnLineage freshEntry =
        new ColumnLineage()
            .withFromColumns(List.of("database.schema.fromTable.amount"))
            .withToColumn("database.schema.toTable.amount");
    LineageDetails incoming =
        new LineageDetails()
            .withSource(LineageDetails.Source.OPEN_LINEAGE)
            .withColumnsLineage(List.of(freshEntry));

    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);
    when(dao.relationshipDAO()).thenReturn(relDAO);
    when(dao.changeEventDAO()).thenReturn(changeEventDAO);
    when(relDAO.getRecord(fromEntityId, toEntityId, Relationship.UPSTREAM.ordinal()))
        .thenReturn(
            CollectionDAO.EntityRelationshipObject.builder()
                .json(JsonUtils.pojoToJson(prior))
                .build());
    mockedEntity.when(Entity::getCollectionDAO).thenReturn(dao);
    mockedEntity
        .when(() -> Entity.getEntityReferenceById(eq("table"), eq(fromEntityId), any()))
        .thenReturn(fromEntity);
    mockedEntity
        .when(() -> Entity.getEntityReferenceById(eq("table"), eq(toEntityId), any()))
        .thenReturn(toEntity);
    mockTableForLineage(fromEntity, "amount");
    mockTableForLineage(toEntity, "amount");

    ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
    new LineageRepository()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(fromEntity)
                        .withToEntity(toEntity)
                        .withLineageDetails(incoming)),
            "user");

    verify(relDAO)
        .insert(
            eq(fromEntityId),
            eq(toEntityId),
            any(),
            any(),
            eq(Relationship.UPSTREAM.ordinal()),
            jsonCaptor.capture());
    LineageDetails persisted = JsonUtils.readValue(jsonCaptor.getValue(), LineageDetails.class);
    // Replace semantics: the incoming entry overwrites the prior entry, not merges with it.
    assertEquals(1, persisted.getColumnsLineage().size());
    assertEquals(
        "database.schema.toTable.amount", persisted.getColumnsLineage().get(0).getToColumn());
    assertEquals(
        List.of("database.schema.fromTable.amount"),
        persisted.getColumnsLineage().get(0).getFromColumns());
  }

  /**
   * After preserveAssetEdges restores the stored column lineage into the incoming details, the
   * column lineage matches the prior edge, so decideEventType must not signal a change event.
   * Before the fix, a null incoming columnsLineage diffed against a non-null prior was reported as
   * a change, emitting a spurious ENTITY_LINEAGE_UPDATED event per routine no-facet event.
   */
  @Test
  void testDecideEventType_AfterPreservationOfNullColumnsLineage_NoSpuriousUpdateEvent()
      throws Exception {
    ColumnLineage stored =
        new ColumnLineage().withFromColumns(List.of("db.s.from.col")).withToColumn("db.s.to.col");
    LineageDetails prior =
        new LineageDetails()
            .withSource(LineageDetails.Source.OPEN_LINEAGE)
            .withColumnsLineage(List.of(stored));
    LineageDetails incoming = new LineageDetails().withSource(LineageDetails.Source.OPEN_LINEAGE);
    incoming.setColumnsLineage(null);
    // A real addLineage runs preserveAssetEdges before decideEventType; mirror that here so the
    // assertion reflects the post-fix end-to-end behaviour, not the unfiltered payload.
    LineageRepository.preserveAssetEdges(incoming, prior);

    Method decideEventType =
        LineageRepository.class.getDeclaredMethod(
            "decideEventType", LineageDetails.class, LineageDetails.class);
    decideEventType.setAccessible(true);

    @SuppressWarnings("unchecked")
    Optional<EventType> result =
        (Optional<EventType>) decideEventType.invoke(null, prior, incoming);

    assertTrue(result.isEmpty(), "no ENTITY_LINEAGE_UPDATED event for preserved column lineage");
  }

  /**
   * Without preservation the diff between a null incoming columnsLineage and a non-null prior is
   * reported as a change. Pins the gap the fix closes so the rationale stays explicit: it is the
   * preservation (not an unrelated change-event suppression) that eliminates the spurious update.
   */
  @Test
  void testPayloadChanged_NullIncomingColumnsLineageVsNonNullPrior_ReportsChanged()
      throws Exception {
    ColumnLineage stored =
        new ColumnLineage().withFromColumns(List.of("db.s.from.col")).withToColumn("db.s.to.col");
    LineageDetails prior =
        new LineageDetails()
            .withSource(LineageDetails.Source.OPEN_LINEAGE)
            .withColumnsLineage(List.of(stored));
    LineageDetails incoming = new LineageDetails().withSource(LineageDetails.Source.OPEN_LINEAGE);
    incoming.setColumnsLineage(null);

    Method payloadChanged =
        LineageRepository.class.getDeclaredMethod(
            "payloadChanged", LineageDetails.class, LineageDetails.class);
    payloadChanged.setAccessible(true);

    assertTrue((boolean) payloadChanged.invoke(null, prior, incoming));
  }

  /**
   * Stubs {@link Entity#getEntity} for the given table with a column-bearing {@link Table} entity
   * serving both getChildrenNames (fields=columns + Include.NON_DELETED) and buildExtendedLineage
   * (fields="" + Include.ALL), so addLineage can complete without touching real repositories.
   */
  private static void mockTableForLineage(EntityReference tableRef, String columnName) {
    String fqn = tableRef.getFullyQualifiedName();
    Table table =
        new Table()
            .withId(tableRef.getId())
            .withName("t")
            .withFullyQualifiedName(fqn)
            .withColumns(
                List.of(
                    new Column()
                        .withName(columnName)
                        .withDataType(ColumnDataType.BIGINT)
                        .withFullyQualifiedName(fqn + "." + columnName)));
    mockedEntity
        .when(() -> Entity.getEntity(eq(Entity.TABLE), eq(tableRef.getId()), any(), any()))
        .thenReturn(table);
  }

  @Test
  void testBuildEntityLineageData_PropagatesDependencyTypeAndIndirectColumns() {
    IndirectColumn indirectColumn =
        new IndirectColumn()
            .withFromColumn("database.schema.fromTable.status")
            .withTransformationType("INDIRECT")
            .withTransformationSubtype("FILTER")
            .withDescription("WHERE status = 'ACTIVE'");
    LineageDetails details =
        new LineageDetails()
            .withSource(LineageDetails.Source.OPEN_LINEAGE)
            .withDependencyType(DependencyType.INDIRECT)
            .withIndirectColumns(List.of(indirectColumn));

    EsLineageData esData = LineageRepository.buildEntityLineageData(fromEntity, toEntity, details);

    assertEquals(DependencyType.INDIRECT, esData.getDependencyType());
    assertEquals(List.of(indirectColumn), esData.getIndirectColumns());
  }

  @Test
  void testMergeDependencyType_DirectBeatsIndirectConservatively() {
    LineageDetails direct = new LineageDetails().withDependencyType(DependencyType.DIRECT);
    LineageDetails indirect = new LineageDetails().withDependencyType(DependencyType.INDIRECT);
    LineageDetails unsetNoFacet = new LineageDetails().withColumnsLineage(null);
    LineageDetails unsetWithDirectColumn =
        new LineageDetails()
            .withColumnsLineage(
                List.of(
                    new ColumnLineage()
                        .withFromColumns(List.of("db.s.a.id"))
                        .withToColumn("db.s.b.id")));

    assertEquals(DependencyType.DIRECT, LineageRepository.mergeDependencyType(direct, indirect));
    assertEquals(DependencyType.DIRECT, LineageRepository.mergeDependencyType(indirect, direct));
    assertEquals(
        DependencyType.INDIRECT, LineageRepository.mergeDependencyType(indirect, indirect));
    assertEquals(
        DependencyType.DIRECT, LineageRepository.mergeDependencyType(unsetNoFacet, indirect));
    assertEquals(
        DependencyType.INDIRECT, LineageRepository.mergeDependencyType(indirect, unsetNoFacet));
    assertEquals(
        DependencyType.DIRECT,
        LineageRepository.mergeDependencyType(indirect, unsetWithDirectColumn));
    assertNull(LineageRepository.mergeDependencyType(unsetNoFacet, unsetNoFacet));
  }

  @Test
  void testPreserveAssetEdges_UnionsIndirectColumnsWithoutDuplicatesAndCopiesStructuredFields() {
    IndirectColumn filterCol =
        new IndirectColumn()
            .withFromColumn("database.schema.fromTable.status")
            .withTransformationType("INDIRECT")
            .withTransformationSubtype("FILTER");
    IndirectColumn joinCol =
        new IndirectColumn()
            .withFromColumn("database.schema.fromTable.team_id")
            .withTransformationType("INDIRECT")
            .withTransformationSubtype("JOIN");
    ColumnLineage storedCol =
        new ColumnLineage()
            .withFromColumns(new ArrayList<>(List.of("database.schema.fromTable.amount")))
            .withToColumn("database.schema.toTable.amount")
            .withFunction("DIRECT/AGGREGATION")
            .withTransformationType("DIRECT")
            .withTransformationSubtype("AGGREGATION");

    LineageDetails prior =
        new LineageDetails()
            .withDependencyType(DependencyType.DIRECT)
            .withColumnsLineage(List.of(storedCol))
            .withIndirectColumns(List.of(filterCol));
    LineageDetails incoming =
        new LineageDetails()
            .withDependencyType(DependencyType.INDIRECT)
            .withColumnsLineage(null)
            .withIndirectColumns(List.of(filterCol, joinCol));

    LineageRepository.preserveAssetEdges(incoming, prior);

    assertEquals(DependencyType.DIRECT, incoming.getDependencyType());
    assertEquals(List.of(filterCol, joinCol), incoming.getIndirectColumns());
    assertEquals(1, incoming.getColumnsLineage().size());
    assertEquals("DIRECT", incoming.getColumnsLineage().get(0).getTransformationType());
    assertEquals("AGGREGATION", incoming.getColumnsLineage().get(0).getTransformationSubtype());
  }

  @Test
  void testValidateLineageDetails_ValidatesIndirectColumnsAgainstFromEntity() {
    final LineageRepository repository = new LineageRepository();
    final EntityReference table = entityReference(Entity.TABLE, "db.schema.sales");
    final EntityReference target = entityReference(Entity.TABLE, "db.schema.summary");
    mockSalesTable(table);
    mockTableForLineage(target, "total");

    IndirectColumn validIndirect =
        new IndirectColumn()
            .withFromColumn("db.schema.sales.amount")
            .withTransformationType("INDIRECT")
            .withTransformationSubtype("FILTER");
    IndirectColumn invalidIndirect =
        new IndirectColumn()
            .withFromColumn("db.schema.sales.missing_col")
            .withTransformationType("INDIRECT")
            .withTransformationSubtype("JOIN");
    LineageDetails details =
        new LineageDetails()
            .withSource(LineageDetails.Source.OPEN_LINEAGE)
            .withDependencyType(DependencyType.INDIRECT)
            .withIndirectColumns(List.of(validIndirect, invalidIndirect));

    LineageDetails saved =
        JsonUtils.readValue(
            repository.validateLineageDetails(table, target, details), LineageDetails.class);

    assertEquals(DependencyType.INDIRECT, saved.getDependencyType());
    assertEquals(List.of(validIndirect), saved.getIndirectColumns());
  }

  @Test
  void testLineageSettings_DefaultsShowIndirectEdgesToTrueWhenAbsentInJson() {
    String legacyJson =
        """
        {
          "upstreamDepth": 2,
          "downstreamDepth": 2,
          "lineageLayer": "EntityLineage",
          "pipelineViewMode": "Node"
        }
        """;

    LineageSettings settings = JsonUtils.readValue(legacyJson, LineageSettings.class);

    assertEquals(Boolean.TRUE, settings.getShowIndirectEdges());
  }
}
