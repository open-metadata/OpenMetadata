/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.resources.columns;

import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.datamodels.DashboardDataModelResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.service.resources.services.DashboardServiceResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.resources.tags.ClassificationResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ColumnResourceTest extends OpenMetadataApplicationTest {

  private Table table;
  private DashboardDataModel dashboardDataModel;
  private TableResourceTest tableResourceTest;
  private DashboardDataModelResourceTest dataModelResourceTest;
  private Classification personalDataClassification;
  private Classification businessMetricsClassification;
  private Classification piiClassification;
  private Tag personalDataTag;
  private Tag businessMetricsTag;
  private Tag piiTag;
  private Glossary testGlossary;
  private GlossaryTerm businessTermsGlossaryTerm;
  private GlossaryTerm technicalTermsGlossaryTerm;
  private GlossaryTerm identifierGlossaryTerm;

  private static final String COLUMN_UPDATE_PATH = "columns/name/";

  @BeforeAll
  void setup(TestInfo test) throws IOException {
    ClassificationResourceTest classificationTest = new ClassificationResourceTest();
    String testId = test.getDisplayName().replaceAll("[^A-Za-z0-9]", "");

    CreateClassification createPersonalDataClassification =
        new CreateClassification()
            .withName("PersonalData" + testId)
            .withDescription("Personal data classification for privacy");
    personalDataClassification =
        classificationTest.createEntity(createPersonalDataClassification, ADMIN_AUTH_HEADERS);

    CreateClassification createBusinessMetricsClassification =
        new CreateClassification()
            .withName("BusinessMetrics" + testId)
            .withDescription("Business metrics classification");
    businessMetricsClassification =
        classificationTest.createEntity(createBusinessMetricsClassification, ADMIN_AUTH_HEADERS);

    CreateClassification createPiiClassification =
        new CreateClassification()
            .withName("PII" + testId)
            .withDescription("Personal Identifiable Information classification");
    piiClassification =
        classificationTest.createEntity(createPiiClassification, ADMIN_AUTH_HEADERS);

    TagResourceTest tagTest = new TagResourceTest();
    CreateTag createPersonalTag =
        new CreateTag()
            .withName("Personal")
            .withDescription("Personal data tag")
            .withClassification(personalDataClassification.getFullyQualifiedName());
    personalDataTag = tagTest.createEntity(createPersonalTag, ADMIN_AUTH_HEADERS);

    CreateTag createBusinessTag =
        new CreateTag()
            .withName("Revenue")
            .withDescription("Revenue metrics tag")
            .withClassification(businessMetricsClassification.getFullyQualifiedName());
    businessMetricsTag = tagTest.createEntity(createBusinessTag, ADMIN_AUTH_HEADERS);

    CreateTag createPiiTag =
        new CreateTag()
            .withName("Sensitive")
            .withDescription("Sensitive PII data tag")
            .withClassification(piiClassification.getFullyQualifiedName());
    piiTag = tagTest.createEntity(createPiiTag, ADMIN_AUTH_HEADERS);

    GlossaryResourceTest glossaryTest = new GlossaryResourceTest();
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName("TestGlossary" + testId)
            .withDescription("Test glossary for column tests");
    testGlossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    GlossaryTermResourceTest glossaryTermTest = new GlossaryTermResourceTest();
    CreateGlossaryTerm createBusinessTerm =
        new CreateGlossaryTerm()
            .withName("CustomerData" + testId)
            .withDescription("Customer data business term")
            .withGlossary(testGlossary.getFullyQualifiedName());
    businessTermsGlossaryTerm =
        glossaryTermTest.createEntity(createBusinessTerm, ADMIN_AUTH_HEADERS);

    CreateGlossaryTerm createTechnicalTerm =
        new CreateGlossaryTerm()
            .withName("ContactInfo" + testId)
            .withDescription("Contact information technical term")
            .withGlossary(testGlossary.getFullyQualifiedName());
    technicalTermsGlossaryTerm =
        glossaryTermTest.createEntity(createTechnicalTerm, ADMIN_AUTH_HEADERS);

    CreateGlossaryTerm createIdentifierTerm =
        new CreateGlossaryTerm()
            .withName("Identifier" + testId)
            .withDescription("Technical identifier term")
            .withGlossary(testGlossary.getFullyQualifiedName());
    identifierGlossaryTerm =
        glossaryTermTest.createEntity(createIdentifierTerm, ADMIN_AUTH_HEADERS);

    DatabaseServiceResourceTest dbServiceTest = new DatabaseServiceResourceTest();
    CreateDatabaseService createDBService =
        dbServiceTest.createRequest(test).withName("basic_column_test_db_service");
    DatabaseService databaseService =
        dbServiceTest.createEntity(createDBService, ADMIN_AUTH_HEADERS);

    DatabaseResourceTest dbTest = new DatabaseResourceTest();
    CreateDatabase createDB =
        new CreateDatabase()
            .withName("basic_column_test_database")
            .withService(databaseService.getFullyQualifiedName());
    Database database = dbTest.createEntity(createDB, ADMIN_AUTH_HEADERS);

    DatabaseSchemaResourceTest schemaTest = new DatabaseSchemaResourceTest();
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("basic_column_test_schema")
            .withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    List<Column> columns =
        Arrays.asList(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withConstraint(ColumnConstraint.PRIMARY_KEY),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255),
            new Column()
                .withName("email")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255));

    tableResourceTest = new TableResourceTest();
    CreateTable createTable =
        new CreateTable()
            .withName("basic_column_test_table")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(columns);
    table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    DashboardServiceResourceTest dashServiceTest = new DashboardServiceResourceTest();
    CreateDashboardService createDashService =
        dashServiceTest.createRequest(test).withName("basic_column_test_dash_service");
    DashboardService dashboardService =
        dashServiceTest.createEntity(createDashService, ADMIN_AUTH_HEADERS);

    List<Column> dataModelColumns =
        Arrays.asList(
            new Column().withName("metric1").withDataType(ColumnDataType.DOUBLE),
            new Column().withName("dimension1").withDataType(ColumnDataType.STRING));

    dataModelResourceTest = new DashboardDataModelResourceTest();
    CreateDashboardDataModel createDataModel =
        new CreateDashboardDataModel()
            .withName("basic_column_test_datamodel")
            .withService(dashboardService.getFullyQualifiedName())
            .withColumns(dataModelColumns)
            .withDataModelType(DataModelType.MetabaseDataModel);
    dashboardDataModel = dataModelResourceTest.createEntity(createDataModel, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_updateTableColumn_displayName() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".name";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Full Name");

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);

    assertEquals("Full Name", updatedColumn.getDisplayName());
    assertEquals("name", updatedColumn.getName());
    assertEquals(ColumnDataType.VARCHAR, updatedColumn.getDataType());

    Table updatedTable = tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column nameColumn =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals("name"))
            .findFirst()
            .orElseThrow();
    assertEquals("Full Name", nameColumn.getDisplayName());
  }

  @Test
  void test_updateTableColumn_description() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".email";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDescription("User's email address");

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);

    assertEquals("User's email address", updatedColumn.getDescription());

    Table updatedTable = tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column emailColumn =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();
    assertEquals("User's email address", emailColumn.getDescription());
  }

  @Test
  void test_updateTableColumn_tags() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".id";
    UpdateColumn updateColumn = new UpdateColumn();

    org.openmetadata.schema.type.TagLabel personalDataTagLabel =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    updateColumn.setTags(listOf(personalDataTagLabel));
    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);

    assertNotNull(updatedColumn.getTags());
    assertEquals(1, updatedColumn.getTags().size());
    assertEquals(
        personalDataTag.getFullyQualifiedName(), updatedColumn.getTags().get(0).getTagFQN());

    Table updatedTable =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column idColumn =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals("id"))
            .findFirst()
            .orElseThrow();
    assertEquals(1, idColumn.getTags().size());
    assertEquals(personalDataTag.getFullyQualifiedName(), idColumn.getTags().get(0).getTagFQN());
  }

  @Test
  void test_updateTableColumn_constraint() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".email";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setConstraint(ColumnConstraint.UNIQUE);

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);

    assertEquals(ColumnConstraint.UNIQUE, updatedColumn.getConstraint());

    Table updatedTable = tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column emailColumn =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();
    assertEquals(ColumnConstraint.UNIQUE, emailColumn.getConstraint());
  }

  @Test
  void test_updateDashboardDataModelColumn() throws IOException {
    String columnFQN = dashboardDataModel.getFullyQualifiedName() + ".metric1";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Sales Metric");
    updateColumn.setDescription("Total sales amount");
    updateColumn.setConstraint(
        ColumnConstraint.PRIMARY_KEY); // Should be ignored for dashboard data model

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn, "dashboardDataModel");
    assertEquals("Sales Metric", updatedColumn.getDisplayName());
    assertEquals("Total sales amount", updatedColumn.getDescription());
    assertNull(updatedColumn.getConstraint());

    DashboardDataModel updatedDataModel =
        dataModelResourceTest.getEntity(dashboardDataModel.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column metric1Column =
        updatedDataModel.getColumns().stream()
            .filter(c -> c.getName().equals("metric1"))
            .findFirst()
            .orElseThrow();
    assertEquals("Sales Metric", metric1Column.getDisplayName());
    assertEquals("Total sales amount", metric1Column.getDescription());
    assertNull(metric1Column.getConstraint());
  }

  @Test
  void test_updateDashboardDataModelColumn_tagsAndGlossaryTerms() throws IOException {
    String columnFQN = dashboardDataModel.getFullyQualifiedName() + ".dimension1";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Customer Dimension");
    updateColumn.setDescription("Customer dimension for analysis");

    // Add both classification tags and glossary terms to dashboard data model column
    org.openmetadata.schema.type.TagLabel classificationTag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(businessMetricsTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    org.openmetadata.schema.type.TagLabel glossaryTerm =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(technicalTermsGlossaryTerm.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY);

    updateColumn.setTags(listOf(classificationTag, glossaryTerm));

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn, "dashboardDataModel");

    assertEquals("Customer Dimension", updatedColumn.getDisplayName());
    assertEquals("Customer dimension for analysis", updatedColumn.getDescription());
    assertNotNull(updatedColumn.getTags());
    assertEquals(2, updatedColumn.getTags().size());

    // Verify persistence in dashboard data model
    DashboardDataModel updatedDataModel =
        dataModelResourceTest.getEntity(
            dashboardDataModel.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column dimension1Column =
        updatedDataModel.getColumns().stream()
            .filter(c -> c.getName().equals("dimension1"))
            .findFirst()
            .orElseThrow();

    assertEquals("Customer Dimension", dimension1Column.getDisplayName());
    assertEquals("Customer dimension for analysis", dimension1Column.getDescription());
    assertEquals(2, dimension1Column.getTags().size());

    // Verify both tag types are present
    boolean hasClassification =
        dimension1Column.getTags().stream()
            .anyMatch(tag -> tag.getSource() == TagLabel.TagSource.CLASSIFICATION);
    boolean hasGlossary =
        dimension1Column.getTags().stream()
            .anyMatch(tag -> tag.getSource() == TagLabel.TagSource.GLOSSARY);

    assertTrue(hasClassification);
    assertTrue(hasGlossary);
  }

  @Test
  void test_updateColumn_multipleUpdatesAtOnce() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".name";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Customer Name");
    updateColumn.setDescription("Name of the customer");

    org.openmetadata.schema.type.TagLabel piiTagLabel =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(piiTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    updateColumn.setTags(listOf(piiTagLabel));

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);
    assertEquals("Customer Name", updatedColumn.getDisplayName());
    assertEquals("Name of the customer", updatedColumn.getDescription());
    assertEquals(1, updatedColumn.getTags().size());
    assertEquals(piiTag.getFullyQualifiedName(), updatedColumn.getTags().get(0).getTagFQN());

    Table updatedTable =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column nameColumn =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals("name"))
            .findFirst()
            .orElseThrow();
    assertEquals("Customer Name", nameColumn.getDisplayName());
    assertEquals("Name of the customer", nameColumn.getDescription());
    assertEquals(1, nameColumn.getTags().size());
  }

  @Test
  void test_updateColumn_nonExistentColumn_404() {
    String invalidColumnFQN = table.getFullyQualifiedName() + ".nonexistent";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Should Fail");

    assertResponse(
        () -> updateColumnByFQN(invalidColumnFQN, updateColumn),
        NOT_FOUND,
        "Column not found: " + invalidColumnFQN);
  }

  @Test
  void test_updateColumn_glossaryTerms() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".email";
    UpdateColumn updateColumn = new UpdateColumn();

    // Add glossary terms using source: "Glossary"
    org.openmetadata.schema.type.TagLabel glossaryTerm1 =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(businessTermsGlossaryTerm.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY);

    org.openmetadata.schema.type.TagLabel glossaryTerm2 =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(technicalTermsGlossaryTerm.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY);

    updateColumn.setTags(listOf(glossaryTerm1, glossaryTerm2));
    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);

    assertNotNull(updatedColumn.getTags());
    assertEquals(2, updatedColumn.getTags().size());
    // Sorted order of glossary terms
    assertEquals(
        technicalTermsGlossaryTerm.getFullyQualifiedName(),
        updatedColumn.getTags().get(0).getTagFQN());
    assertEquals(TagLabel.TagSource.GLOSSARY, updatedColumn.getTags().get(0).getSource());
    assertEquals(
        businessTermsGlossaryTerm.getFullyQualifiedName(),
        updatedColumn.getTags().get(1).getTagFQN());
    assertEquals(TagLabel.TagSource.GLOSSARY, updatedColumn.getTags().get(1).getSource());
  }

  @Test
  void test_updateColumn_mixedTagsAndGlossaryTerms() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".id";
    UpdateColumn updateColumn = new UpdateColumn();

    // Mix classification tags and glossary terms
    org.openmetadata.schema.type.TagLabel classificationTag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    org.openmetadata.schema.type.TagLabel glossaryTerm =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(identifierGlossaryTerm.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY);

    updateColumn.setTags(listOf(classificationTag, glossaryTerm));
    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);

    assertNotNull(updatedColumn.getTags());
    assertEquals(2, updatedColumn.getTags().size());

    // Verify both types are present
    boolean hasClassification =
        updatedColumn.getTags().stream()
            .anyMatch(tag -> tag.getSource() == TagLabel.TagSource.CLASSIFICATION);
    boolean hasGlossary =
        updatedColumn.getTags().stream()
            .anyMatch(tag -> tag.getSource() == TagLabel.TagSource.GLOSSARY);

    assertTrue(hasClassification);
    assertTrue(hasGlossary);
  }

  @Test
  void test_updateColumn_emptyStringValuesDeleteFields() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".name";

    // First set some values
    UpdateColumn initialUpdate = new UpdateColumn();
    initialUpdate.setDisplayName("Initial Display Name");
    initialUpdate.setDescription("Initial description");
    org.openmetadata.schema.type.TagLabel testTag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);
    initialUpdate.setTags(listOf(testTag));
    updateColumnByFQN(columnFQN, initialUpdate);

    // Now try to "update" with empty string values - should delete the fields
    UpdateColumn emptyUpdate = new UpdateColumn();
    emptyUpdate.setDisplayName(""); // Empty string should delete displayName
    emptyUpdate.setDescription("   "); // Whitespace only should delete description
    // Don't set tags - null tags should be ignored, but empty array should remove tags

    Column updatedColumn = updateColumnByFQN(columnFQN, emptyUpdate);

    // String values should be deleted (set to null), tags should remain since we didn't send tags
    // field
    assertNull(updatedColumn.getDisplayName());
    assertNull(updatedColumn.getDescription());
    assertEquals(1, updatedColumn.getTags().size());
  }

  @Test
  void test_updateColumn_selectiveTagRemoval() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".name";

    // Start with multiple tags and glossary terms
    UpdateColumn addAllUpdate = new UpdateColumn();
    org.openmetadata.schema.type.TagLabel classificationTag1 =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);
    org.openmetadata.schema.type.TagLabel classificationTag2 =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(piiTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);
    org.openmetadata.schema.type.TagLabel glossaryTerm1 =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(businessTermsGlossaryTerm.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY);
    org.openmetadata.schema.type.TagLabel glossaryTerm2 =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(technicalTermsGlossaryTerm.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY);

    addAllUpdate.setTags(
        listOf(classificationTag1, classificationTag2, glossaryTerm1, glossaryTerm2));
    updateColumnByFQN(columnFQN, addAllUpdate);

    // Verify all 4 tags were added (2 classifications + 2 glossary terms)
    Table tableWithAllTags =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column nameColumn =
        tableWithAllTags.getColumns().stream()
            .filter(c -> c.getName().equals("name"))
            .findFirst()
            .orElseThrow();
    assertEquals(4, nameColumn.getTags().size());

    // Remove a single classification tag (keep personalDataTag, remove piiTag, keep both glossary
    // terms)
    UpdateColumn removeOneClassificationTag = new UpdateColumn();
    removeOneClassificationTag.setTags(listOf(classificationTag1, glossaryTerm1, glossaryTerm2));
    updateColumnByFQN(columnFQN, removeOneClassificationTag);

    // Verify only 3 tags remain (1 classification + 2 glossary terms)
    Table tableAfterFirstRemoval =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column nameColumnAfter1 =
        tableAfterFirstRemoval.getColumns().stream()
            .filter(c -> c.getName().equals("name"))
            .findFirst()
            .orElseThrow();
    assertEquals(3, nameColumnAfter1.getTags().size());
    assertTrue(
        nameColumnAfter1.getTags().stream()
            .anyMatch(tag -> tag.getTagFQN().equals(personalDataTag.getFullyQualifiedName())));
    assertFalse(
        nameColumnAfter1.getTags().stream()
            .anyMatch(
                tag -> tag.getTagFQN().equals(piiTag.getFullyQualifiedName()))); // PII tag removed

    // Remove a single glossary term (keep classification, remove businessTermsGlossaryTerm, keep
    // technicalTermsGlossaryTerm)
    UpdateColumn removeOneGlossaryTerm = new UpdateColumn();
    removeOneGlossaryTerm.setTags(listOf(classificationTag1, glossaryTerm2));
    updateColumnByFQN(columnFQN, removeOneGlossaryTerm);

    // Verify only 2 tags remain (1 classification + 1 glossary term)
    Table tableAfterSecondRemoval =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column nameColumnAfter2 =
        tableAfterSecondRemoval.getColumns().stream()
            .filter(c -> c.getName().equals("name"))
            .findFirst()
            .orElseThrow();
    assertEquals(2, nameColumnAfter2.getTags().size());
    assertTrue(
        nameColumnAfter2.getTags().stream()
            .anyMatch(tag -> tag.getTagFQN().equals(personalDataTag.getFullyQualifiedName())));
    assertTrue(
        nameColumnAfter2.getTags().stream()
            .anyMatch(
                tag -> tag.getTagFQN().equals(technicalTermsGlossaryTerm.getFullyQualifiedName())));
    assertFalse(
        nameColumnAfter2.getTags().stream()
            .anyMatch(
                tag ->
                    tag.getTagFQN()
                        .equals(
                            businessTermsGlossaryTerm
                                .getFullyQualifiedName()))); // Business term removed

    // Remove multiple tags at once (keep only 1 glossary term)
    UpdateColumn removeMultipleTags = new UpdateColumn();
    removeMultipleTags.setTags(listOf(glossaryTerm2));
    updateColumnByFQN(columnFQN, removeMultipleTags);

    // Verify only 1 tag remains
    Table tableAfterMultipleRemoval =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column nameColumnAfter3 =
        tableAfterMultipleRemoval.getColumns().stream()
            .filter(c -> c.getName().equals("name"))
            .findFirst()
            .orElseThrow();
    assertEquals(1, nameColumnAfter3.getTags().size());
    assertEquals(
        technicalTermsGlossaryTerm.getFullyQualifiedName(),
        nameColumnAfter3.getTags().get(0).getTagFQN());
  }

  @Test
  void test_updateColumn_removeAllVsRemoveSpecific() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".email";

    // Add multiple different types of tags
    UpdateColumn addMixedTags = new UpdateColumn();
    org.openmetadata.schema.type.TagLabel classificationTag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);
    org.openmetadata.schema.type.TagLabel glossaryTerm =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(businessTermsGlossaryTerm.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY);
    addMixedTags.setTags(listOf(classificationTag, glossaryTerm));
    updateColumnByFQN(columnFQN, addMixedTags);

    // Verify both tags were added
    Table tableWithMixedTags =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column emailColumn =
        tableWithMixedTags.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();
    assertEquals(2, emailColumn.getTags().size());

    // Remove only classification tags (keep glossary terms)
    UpdateColumn keepOnlyGlossaryTerms = new UpdateColumn();
    keepOnlyGlossaryTerms.setTags(listOf(glossaryTerm));
    updateColumnByFQN(columnFQN, keepOnlyGlossaryTerms);

    // Verify only glossary term remains
    Table tableWithOnlyGlossary =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column emailColumnWithGlossary =
        tableWithOnlyGlossary.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();
    assertEquals(1, emailColumnWithGlossary.getTags().size());
    assertEquals(TagLabel.TagSource.GLOSSARY, emailColumnWithGlossary.getTags().get(0).getSource());
    assertEquals(
        businessTermsGlossaryTerm.getFullyQualifiedName(),
        emailColumnWithGlossary.getTags().get(0).getTagFQN());

    // Remove all tags with empty array
    UpdateColumn removeAllTags = new UpdateColumn();
    removeAllTags.setTags(new java.util.ArrayList<>());
    updateColumnByFQN(columnFQN, removeAllTags);

    // Verify all tags are removed
    Table tableWithNoTags =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column emailColumnWithoutTags =
        tableWithNoTags.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();
    assertTrue(
        emailColumnWithoutTags.getTags() == null || emailColumnWithoutTags.getTags().isEmpty());
  }

  @Test
  void test_updateColumn_invalidTag_404() {
    String columnFQN = table.getFullyQualifiedName() + ".id";

    // Test that the API returns 404 when trying to use non-existent tags
    UpdateColumn updateColumn = new UpdateColumn();
    org.openmetadata.schema.type.TagLabel invalidTag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN("NonExistent.DisabledTag")
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    updateColumn.setTags(listOf(invalidTag));

    // Should throw 404 error for non-existent tag
    assertResponse(
        () -> updateColumnByFQN(columnFQN, updateColumn),
        NOT_FOUND,
        "tag instance for NonExistent.DisabledTag not found");
  }

  @Test
  void test_updateColumn_invalidGlossaryTerm_404() {
    String columnFQN = table.getFullyQualifiedName() + ".name";

    // Test that the API returns 404 when trying to use non-existent glossary terms
    UpdateColumn updateColumn = new UpdateColumn();
    org.openmetadata.schema.type.TagLabel invalidGlossaryTerm =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN("NonExistent.DraftTerm")
            .withSource(TagLabel.TagSource.GLOSSARY);

    updateColumn.setTags(listOf(invalidGlossaryTerm));

    // Should throw 404 error for non-existent glossary term
    assertResponse(
        () -> updateColumnByFQN(columnFQN, updateColumn),
        NOT_FOUND,
        "glossaryTerm instance for NonExistent.DraftTerm not found");
  }

  @Test
  void test_updateColumn_validTagOnly() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".email";

    // Test that valid tags are applied successfully
    UpdateColumn updateColumn = new UpdateColumn();
    org.openmetadata.schema.type.TagLabel validTag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    updateColumn.setTags(listOf(validTag));
    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);

    // Valid tag should be applied successfully
    assertNotNull(updatedColumn.getTags());
    assertEquals(1, updatedColumn.getTags().size());
    assertEquals(
        personalDataTag.getFullyQualifiedName(), updatedColumn.getTags().get(0).getTagFQN());
  }

  @Test
  void test_updateColumn_tagRemovalSupport() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".email";

    UpdateColumn addTagsUpdate = new UpdateColumn();
    org.openmetadata.schema.type.TagLabel testTag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);
    addTagsUpdate.setTags(listOf(testTag));
    updateColumnByFQN(columnFQN, addTagsUpdate);

    Table tableWithTags =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column emailColumn =
        tableWithTags.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();
    assertEquals(1, emailColumn.getTags().size());

    UpdateColumn removeTagsUpdate = new UpdateColumn();
    removeTagsUpdate.setTags(new java.util.ArrayList<>());
    updateColumnByFQN(columnFQN, removeTagsUpdate);

    Table tableAfterEmptyUpdate =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column emailColumnAfter =
        tableAfterEmptyUpdate.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();

    assertTrue(emailColumnAfter.getTags() == null || emailColumnAfter.getTags().isEmpty());
  }

  @Test
  void test_updateColumn_nonExistentTable_404() {
    String invalidFQN = "nonexistent.service.database.schema.table.column";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Should Fail");
    assertResponse(
        () -> updateColumnByFQN(invalidFQN, updateColumn),
        NOT_FOUND,
        "table instance for "
            + FullyQualifiedName.getParentEntityFQN(invalidFQN, TABLE)
            + " not found");
  }

  @Test
  void test_updateColumn_databasePersistence() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".id";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Primary ID");
    updateColumn.setDescription("Primary identifier for the record");

    org.openmetadata.schema.type.TagLabel testTag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);
    updateColumn.setTags(listOf(testTag));

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);
    assertEquals("Primary ID", updatedColumn.getDisplayName());
    assertEquals("Primary identifier for the record", updatedColumn.getDescription());
    assertEquals(1, updatedColumn.getTags().size());
    assertEquals(
        personalDataTag.getFullyQualifiedName(), updatedColumn.getTags().get(0).getTagFQN());

    Table persistedTable =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column persistedColumn =
        persistedTable.getColumns().stream()
            .filter(c -> c.getName().equals("id"))
            .findFirst()
            .orElseThrow();

    assertEquals("Primary ID", persistedColumn.getDisplayName());
    assertEquals("Primary identifier for the record", persistedColumn.getDescription());
    assertEquals(1, persistedColumn.getTags().size());
    assertEquals(
        personalDataTag.getFullyQualifiedName(), persistedColumn.getTags().get(0).getTagFQN());

    assertTrue(persistedTable.getVersion() > table.getVersion());
  }

  @Test
  void test_deleteTableColumn_displayName() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".name";

    // First set a display name
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Full Name");
    updateColumnByFQN(columnFQN, updateColumn);

    // Verify display name was set
    Table tableWithDisplayName =
        tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column nameColumn =
        tableWithDisplayName.getColumns().stream()
            .filter(c -> c.getName().equals("name"))
            .findFirst()
            .orElseThrow();
    assertEquals("Full Name", nameColumn.getDisplayName());

    // Now try to delete the display name by sending empty string
    UpdateColumn deleteDisplayName = new UpdateColumn();
    deleteDisplayName.setDisplayName("");
    Column updatedColumn = updateColumnByFQN(columnFQN, deleteDisplayName);

    // Verify display name is deleted/null
    assertNull(updatedColumn.getDisplayName());

    // Verify persistence in table
    Table tableAfterDelete =
        tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column nameColumnAfterDelete =
        tableAfterDelete.getColumns().stream()
            .filter(c -> c.getName().equals("name"))
            .findFirst()
            .orElseThrow();
    assertNull(nameColumnAfterDelete.getDisplayName());
  }

  @Test
  void test_deleteTableColumn_description() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".email";

    // First set a description
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDescription("User's email address");
    updateColumnByFQN(columnFQN, updateColumn);

    // Verify description was set
    Table tableWithDescription =
        tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column emailColumn =
        tableWithDescription.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();
    assertEquals("User's email address", emailColumn.getDescription());

    // Now try to delete the description by sending empty string
    UpdateColumn deleteDescription = new UpdateColumn();
    deleteDescription.setDescription("");
    Column updatedColumn = updateColumnByFQN(columnFQN, deleteDescription);

    // Verify description is deleted/null
    assertNull(updatedColumn.getDescription());

    // Verify persistence in table
    Table tableAfterDelete =
        tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column emailColumnAfterDelete =
        tableAfterDelete.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();
    assertNull(emailColumnAfterDelete.getDescription());
  }

  @Test
  void test_deleteTableColumn_constraint() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".email";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setConstraint(ColumnConstraint.UNIQUE);
    updateColumnByFQN(columnFQN, updateColumn);

    Table tableWithConstraint =
        tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column emailColumn =
        tableWithConstraint.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();
    assertEquals(ColumnConstraint.UNIQUE, emailColumn.getConstraint());

    UpdateColumn deleteConstraint = new UpdateColumn();
    deleteConstraint.setRemoveConstraint(true);
    Column updatedColumn = updateColumnByFQN(columnFQN, deleteConstraint);

    assertNull(updatedColumn.getConstraint());

    Table tableAfterDelete =
        tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column emailColumnAfterDelete =
        tableAfterDelete.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();
    assertNull(emailColumnAfterDelete.getConstraint());
  }

  @Test
  void test_deleteDashboardDataModelColumn_displayName() throws IOException {
    String columnFQN = dashboardDataModel.getFullyQualifiedName() + ".metric1";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Sales Metric");
    updateColumnByFQN(columnFQN, updateColumn, "dashboardDataModel");

    DashboardDataModel dataModelWithDisplayName =
        dataModelResourceTest.getEntity(dashboardDataModel.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column metric1Column =
        dataModelWithDisplayName.getColumns().stream()
            .filter(c -> c.getName().equals("metric1"))
            .findFirst()
            .orElseThrow();
    assertEquals("Sales Metric", metric1Column.getDisplayName());

    UpdateColumn deleteDisplayName = new UpdateColumn();
    deleteDisplayName.setDisplayName("");
    Column updatedColumn = updateColumnByFQN(columnFQN, deleteDisplayName, "dashboardDataModel");

    assertNull(updatedColumn.getDisplayName());

    DashboardDataModel dataModelAfterDelete =
        dataModelResourceTest.getEntity(dashboardDataModel.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column metric1ColumnAfterDelete =
        dataModelAfterDelete.getColumns().stream()
            .filter(c -> c.getName().equals("metric1"))
            .findFirst()
            .orElseThrow();
    assertNull(metric1ColumnAfterDelete.getDisplayName());
  }

  @Test
  void test_deleteDashboardDataModelColumn_description() throws IOException {
    String columnFQN = dashboardDataModel.getFullyQualifiedName() + ".dimension1";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDescription("Customer dimension for analysis");
    updateColumnByFQN(columnFQN, updateColumn, "dashboardDataModel");

    DashboardDataModel dataModelWithDescription =
        dataModelResourceTest.getEntity(dashboardDataModel.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column dimension1Column =
        dataModelWithDescription.getColumns().stream()
            .filter(c -> c.getName().equals("dimension1"))
            .findFirst()
            .orElseThrow();
    assertEquals("Customer dimension for analysis", dimension1Column.getDescription());

    UpdateColumn deleteDescription = new UpdateColumn();
    deleteDescription.setDescription("");
    Column updatedColumn = updateColumnByFQN(columnFQN, deleteDescription, "dashboardDataModel");

    assertNull(updatedColumn.getDescription());

    DashboardDataModel dataModelAfterDelete =
        dataModelResourceTest.getEntity(dashboardDataModel.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column dimension1ColumnAfterDelete =
        dataModelAfterDelete.getColumns().stream()
            .filter(c -> c.getName().equals("dimension1"))
            .findFirst()
            .orElseThrow();
    assertNull(dimension1ColumnAfterDelete.getDescription());
  }

  @Test
  void test_updateColumnWithDerivedTags(TestInfo test) throws IOException {
    // Create a classification and tag
    ClassificationResourceTest classificationTest = new ClassificationResourceTest();
    CreateClassification createClassification =
        new CreateClassification()
            .withName("Tier" + test.getDisplayName().replaceAll("[^A-Za-z0-9]", ""))
            .withDescription("Tier classification for data quality");
    Classification tierClassification =
        classificationTest.createEntity(createClassification, ADMIN_AUTH_HEADERS);

    TagResourceTest tagTest = new TagResourceTest();
    CreateTag createTag =
        new CreateTag()
            .withName("Tier1")
            .withDescription("Tier 1 data")
            .withClassification(tierClassification.getFullyQualifiedName());
    Tag tierTag = tagTest.createEntity(createTag, ADMIN_AUTH_HEADERS);

    // Create a glossary
    GlossaryResourceTest glossaryTest = new GlossaryResourceTest();
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName("TestGlossaryTag" + test.getDisplayName().replaceAll("[^A-Za-z0-9]", ""))
            .withDescription("Test glossary for derived tags");
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create a glossary term with the tier tag
    GlossaryTermResourceTest glossaryTermTest = new GlossaryTermResourceTest();
    CreateGlossaryTerm createGlossaryTerm =
        new CreateGlossaryTerm()
            .withName("CustomerData" + test.getDisplayName().replaceAll("[^A-Za-z0-9]", ""))
            .withDescription("Customer data term")
            .withGlossary(glossary.getFullyQualifiedName())
            .withTags(
                List.of(
                    new TagLabel()
                        .withTagFQN(tierTag.getFullyQualifiedName())
                        .withName(tierTag.getName())
                        .withDisplayName(tierTag.getDisplayName())
                        .withSource(TagLabel.TagSource.CLASSIFICATION)
                        .withState(TagLabel.State.CONFIRMED)));
    GlossaryTerm glossaryTerm =
        glossaryTermTest.createEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
    String columnFQN = FullyQualifiedName.add(table.getFullyQualifiedName(), "id");

    // Update column with the glossary term tag
    UpdateColumn updateColumnWithTags =
        new UpdateColumn()
            .withTags(
                List.of(
                    new TagLabel()
                        .withTagFQN(glossaryTerm.getFullyQualifiedName())
                        .withName(glossaryTerm.getName())
                        .withDisplayName(glossaryTerm.getDisplayName())
                        .withSource(TagLabel.TagSource.GLOSSARY)
                        .withState(TagLabel.State.CONFIRMED)));

    Column updatedColumnWithTags = updateColumnByFQN(columnFQN, updateColumnWithTags);

    // Verify that both the glossary term tag and its associated tier tag are present
    assertNotNull(updatedColumnWithTags.getTags());
    assertEquals(2, updatedColumnWithTags.getTags().size());

    // Verify the glossary term tag
    TagLabel glossaryTag =
        updatedColumnWithTags.getTags().stream()
            .filter(tag -> tag.getSource() == TagLabel.TagSource.GLOSSARY)
            .findFirst()
            .orElse(null);
    assertNotNull(glossaryTag);
    assertEquals(glossaryTerm.getFullyQualifiedName(), glossaryTag.getTagFQN());
    assertEquals(TagLabel.LabelType.MANUAL, glossaryTag.getLabelType());

    // Verify the derived tier tag
    TagLabel derivedTag =
        updatedColumnWithTags.getTags().stream()
            .filter(tag -> tag.getSource() == TagLabel.TagSource.CLASSIFICATION)
            .findFirst()
            .orElse(null);
    assertNotNull(derivedTag);
    assertEquals(tierTag.getFullyQualifiedName(), derivedTag.getTagFQN());
    assertEquals(TagLabel.LabelType.DERIVED, derivedTag.getLabelType());

    // Verify persistence by getting the table again
    Table persistedTable =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column persistedColumn =
        persistedTable.getColumns().stream()
            .filter(c -> c.getName().equals("id"))
            .findFirst()
            .orElseThrow();

    // Verify tags are still present in persisted data
    assertNotNull(persistedColumn.getTags());
    assertEquals(2, persistedColumn.getTags().size());

    // Verify both manual and derived tags are present in persisted data
    boolean hasGlossaryTag =
        persistedColumn.getTags().stream()
            .anyMatch(
                tag ->
                    tag.getSource() == TagLabel.TagSource.GLOSSARY
                        && tag.getTagFQN().equals(glossaryTerm.getFullyQualifiedName()));
    boolean hasDerivedTag =
        persistedColumn.getTags().stream()
            .anyMatch(
                tag ->
                    tag.getSource() == TagLabel.TagSource.CLASSIFICATION
                        && tag.getTagFQN().equals(tierTag.getFullyQualifiedName())
                        && tag.getLabelType() == TagLabel.LabelType.DERIVED);

    assertTrue(hasGlossaryTag, "Glossary tag should be present in persisted data");
    assertTrue(hasDerivedTag, "Derived tag should be present in persisted data");
  }

  private Column updateColumnByFQN(String columnFQN, UpdateColumn updateColumn, String entityType)
      throws IOException {
    WebTarget target =
        getResource(COLUMN_UPDATE_PATH + columnFQN).queryParam("entityType", entityType);
    return TestUtils.put(target, updateColumn, Column.class, OK, ADMIN_AUTH_HEADERS);
  }

  private Column updateColumnByFQN(String columnFQN, UpdateColumn updateColumn) throws IOException {
    return updateColumnByFQN(columnFQN, updateColumn, "table");
  }

  @Test
  void test_updateNestedTableColumn_description() throws IOException {
    // Create a deeply nested column structure
    List<Column> nestedColumns =
        List.of(
            new Column().withName("personal_details").withDataType(ColumnDataType.STRING),
            new Column().withName("other_info").withDataType(ColumnDataType.STRING));
    List<Column> customerInfoChildren =
        List.of(
            new Column()
                .withName("personal_details")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(nestedColumns));
    List<Column> deeplyNestedDataChildren =
        List.of(
            new Column()
                .withName("customer_info")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(customerInfoChildren));
    List<Column> columns =
        List.of(
            new Column()
                .withName("deeply_nested_data")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(deeplyNestedDataChildren));
    CreateTable createTable =
        new CreateTable()
            .withName("deeply_nested_table")
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(columns);
    Table nestedTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Build the FQN for the innermost nested column
    String columnFQN =
        nestedTable.getFullyQualifiedName() + ".deeply_nested_data.customer_info.personal_details";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDescription("<p>Personal details nested structure updated</p>");

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn, "table");
    assertEquals(
        "<p>Personal details nested structure updated</p>", updatedColumn.getDescription());

    // Fetch the table and verify the nested column's description is updated
    Table updatedTable =
        tableResourceTest.getEntity(nestedTable.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column deeplyNestedData = updatedTable.getColumns().getFirst();
    Column customerInfo = deeplyNestedData.getChildren().getFirst();
    Column personalDetails = customerInfo.getChildren().getFirst();
    assertEquals(
        "<p>Personal details nested structure updated</p>", personalDetails.getDescription());
  }
}
