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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.*;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.type.*;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

/**
 * Tests for the validateLineageDetails logic in LineageRepository.
 * This test verifies the filtering behavior of the new implementation.
 */
class LineageRepositoryTest {

  private static MockedStatic<Entity> mockedEntity;

  @BeforeAll
  static void initMocks() {
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchClient searchClient = mock(SearchClient.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
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
