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
import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL_COLUMN;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TABLE_COLUMN;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.BulkColumnUpdatePreview;
import org.openmetadata.schema.api.data.BulkColumnUpdateRequest;
import org.openmetadata.schema.api.data.ColumnGridItem;
import org.openmetadata.schema.api.data.ColumnGridResponse;
import org.openmetadata.schema.api.data.ColumnUpdate;
import org.openmetadata.schema.api.data.ColumnUpdatePreview;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.GroupedColumnsResponse;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.datamodels.DashboardDataModelResourceTest;
import org.openmetadata.service.resources.feeds.FeedResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.service.resources.metadata.TypeResourceTest;
import org.openmetadata.service.resources.services.DashboardServiceResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.resources.tags.ClassificationResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ColumnResourceTest extends OpenMetadataApplicationTest {

  private Table table;
  private DashboardDataModel dashboardDataModel;
  private TableResourceTest tableResourceTest;
  private DashboardDataModelResourceTest dataModelResourceTest;
  private TypeResourceTest typeResourceTest;
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
    typeResourceTest = new TypeResourceTest();
    typeResourceTest.setupTypes();

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

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn, DASHBOARD_DATA_MODEL);
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

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn, DASHBOARD_DATA_MODEL);

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
    updateColumnByFQN(columnFQN, updateColumn, DASHBOARD_DATA_MODEL);

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
    Column updatedColumn = updateColumnByFQN(columnFQN, deleteDisplayName, DASHBOARD_DATA_MODEL);

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
    updateColumnByFQN(columnFQN, updateColumn, DASHBOARD_DATA_MODEL);

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
    Column updatedColumn = updateColumnByFQN(columnFQN, deleteDescription, DASHBOARD_DATA_MODEL);

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

  @Test
  void test_tableColumnChangeEvents() throws IOException {
    // Create a new table specifically for this test to avoid feed pollution
    TableResourceTest isolatedTableTest = new TableResourceTest();
    String testName = "tableColumnFeedTest_" + UUID.randomUUID();

    DatabaseSchema schema =
        new DatabaseSchemaResourceTest()
            .createEntity(
                new CreateDatabaseSchema()
                    .withName(testName)
                    .withDatabase(table.getDatabase().getFullyQualifiedName()),
                ADMIN_AUTH_HEADERS);

    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column()
                .withName("description_col")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255),
            new Column()
                .withName("displayname_col")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255),
            new Column()
                .withName("tags_col")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255));

    CreateTable createIsolatedTable =
        new CreateTable()
            .withName(testName)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(columns);

    Table isolatedTable = isolatedTableTest.createEntity(createIsolatedTable, ADMIN_AUTH_HEADERS);

    // 1. Test description change in feed
    String descriptionColFQN = isolatedTable.getFullyQualifiedName() + ".description_col";
    UpdateColumn updateDescription =
        new UpdateColumn().withDescription("Test description for feed verification");
    Column updatedDescriptionCol = updateColumnByFQN(descriptionColFQN, updateDescription);
    assertEquals("Test description for feed verification", updatedDescriptionCol.getDescription());

    // Verify description change appears in activity feed
    verifyColumnChangeEventInFeed(isolatedTable, "description_col", List.of("description"), TABLE);

    // 2. Test tags/terms change in feed
    String tagsColFQN = isolatedTable.getFullyQualifiedName() + ".tags_col";

    // Create tag label for classification tag
    TagLabel classificationTag =
        new TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    // Create tag label for glossary term
    TagLabel glossaryTerm =
        new TagLabel()
            .withTagFQN(businessTermsGlossaryTerm.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY);

    // Update column with tags
    UpdateColumn updateTags = new UpdateColumn().withTags(List.of(classificationTag, glossaryTerm));
    Column updatedTagsCol = updateColumnByFQN(tagsColFQN, updateTags);

    // Verify tags were added
    assertEquals(2, updatedTagsCol.getTags().size());

    // Verify tags change appears in activity feed
    verifyColumnChangeEventInFeed(isolatedTable, "tags_col", List.of("tags"), TABLE);
  }

  @Test
  void test_dashboardDataModelColumnChangeEvents() throws IOException {
    // Create a new dashboard data model specifically for this test to avoid feed pollution
    DashboardDataModelResourceTest isolatedModelTest = new DashboardDataModelResourceTest();
    String testName = "dataModelColumnFeedTest_" + UUID.randomUUID();

    // Create test data model with simple columns
    List<Column> columns =
        Arrays.asList(
            new Column().withName("metric_col").withDataType(ColumnDataType.NUMERIC),
            new Column()
                .withName("description_col")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255),
            new Column()
                .withName("displayname_col")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255),
            new Column()
                .withName("tags_col")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255));

    CreateDashboardDataModel createIsolatedModel =
        new CreateDashboardDataModel()
            .withName(testName)
            .withService(dashboardDataModel.getService().getFullyQualifiedName())
            .withDataModelType(DataModelType.MetabaseDataModel)
            .withColumns(columns);

    DashboardDataModel isolatedModel =
        isolatedModelTest.createEntity(createIsolatedModel, ADMIN_AUTH_HEADERS);

    // 1. Test description change in feed
    String descriptionColFQN = isolatedModel.getFullyQualifiedName() + ".description_col";
    UpdateColumn updateDescription =
        new UpdateColumn().withDescription("Test data model description for feed verification");
    Column updatedDescriptionCol =
        updateColumnByFQN(descriptionColFQN, updateDescription, DASHBOARD_DATA_MODEL);
    assertEquals(
        "Test data model description for feed verification",
        updatedDescriptionCol.getDescription());

    // 2. Test tags/terms change in feed
    String tagsColFQN = isolatedModel.getFullyQualifiedName() + ".tags_col";

    // Create tag label for classification tag
    TagLabel classificationTag =
        new TagLabel()
            .withTagFQN(businessMetricsTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    // Create tag label for glossary term
    TagLabel glossaryTerm =
        new TagLabel()
            .withTagFQN(technicalTermsGlossaryTerm.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY);

    // Update column with tags
    UpdateColumn updateTags = new UpdateColumn().withTags(List.of(classificationTag, glossaryTerm));
    Column updatedTagsCol = updateColumnByFQN(tagsColFQN, updateTags, DASHBOARD_DATA_MODEL);

    // Verify tags were added
    assertEquals(2, updatedTagsCol.getTags().size());

    // Verify tags change appears in activity feed
    verifyColumnChangeEventInFeed(
        isolatedModel, "tags_col", List.of("tags"), Entity.DASHBOARD_DATA_MODEL);
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

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn, TABLE);
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

  private Column updateColumnByFQN(String columnFQN, UpdateColumn updateColumn, String entityType)
      throws IOException {
    WebTarget target =
        getResource(COLUMN_UPDATE_PATH + columnFQN).queryParam("entityType", entityType);
    return TestUtils.put(target, updateColumn, Column.class, OK, ADMIN_AUTH_HEADERS);
  }

  private Column updateColumnByFQN(String columnFQN, UpdateColumn updateColumn) throws IOException {
    return updateColumnByFQN(columnFQN, updateColumn, TABLE);
  }

  private void verifyColumnChangeEventInFeed(
      EntityInterface parentEntity,
      String columnName,
      List<String> expectedFields,
      String entityType) {

    String entityLink =
        String.format("<#E::%s::%s>", entityType, parentEntity.getFullyQualifiedName());

    FeedResourceTest feedResourceTest = new FeedResourceTest();

    AtomicReference<ResultList<Thread>> threadsRef = new AtomicReference<>();

    await()
        .pollInterval(2, TimeUnit.SECONDS)
        .atMost(90, TimeUnit.SECONDS)
        .until(
            () -> {
              // Poll for threads related to this entity
              ResultList<Thread> fetchedThreads =
                  feedResourceTest.listThreads(entityLink, null, ADMIN_AUTH_HEADERS);

              if (fetchedThreads == null || fetchedThreads.getData().isEmpty()) {
                return false;
              }

              // Check if any thread mentions our column
              boolean found =
                  fetchedThreads.getData().stream()
                      .anyMatch(
                          thread ->
                              thread.getMessage() != null
                                  && thread.getMessage().contains(columnName));

              if (found) {
                // Store the result only when we find a match
                threadsRef.set(fetchedThreads);
              }

              return found;
            });

    ResultList<Thread> threads = threadsRef.get();

    // Verify feed contains our column update
    assertNotNull(threads);
    assertFalse(threads.getData().isEmpty());

    Optional<Thread> columnUpdateThread =
        threads.getData().stream()
            .filter(thread -> thread.getMessage().contains(columnName))
            .findFirst();

    assertTrue(
        columnUpdateThread.isPresent(),
        "No activity feed entry found for column update: " + columnName);

    Thread thread = columnUpdateThread.get();

    // Verify the thread message mentions the expected fields
    boolean foundFieldReferences =
        expectedFields.stream()
            .allMatch(field -> thread.getMessage().toLowerCase().contains(field.toLowerCase()));

    assertTrue(
        foundFieldReferences,
        "Activity feed doesn't contain references to all expected fields: "
            + String.join(", ", expectedFields));
  }

  @Test
  void test_searchColumns_byColumnName() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    CreateTable createTable1 =
        new CreateTable()
            .withName("search_test_table1_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column().withName("order_id").withDataType(ColumnDataType.BIGINT),
                    new Column()
                        .withName("customer_name")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)));
    Table table1 = tableResourceTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);

    CreateTable createTable2 =
        new CreateTable()
            .withName("search_test_table2_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column().withName("order_id").withDataType(ColumnDataType.BIGINT),
                    new Column()
                        .withName("product_name")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)));
    Table table2 = tableResourceTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);

    WebTarget target = getResource("columns/search").queryParam("columnName", "order_id");
    GroupedColumnsResponse[] responseArray =
        TestUtils.get(target, GroupedColumnsResponse[].class, ADMIN_AUTH_HEADERS);

    assertNotNull(responseArray);
    List<GroupedColumnsResponse> response = Arrays.asList(responseArray);
    assertTrue(response.size() >= 1);

    GroupedColumnsResponse orderIdGroup =
        response.stream()
            .filter(g -> g.getColumnName().equals("order_id"))
            .findFirst()
            .orElseThrow();

    assertEquals("order_id", orderIdGroup.getColumnName());
    assertTrue(orderIdGroup.getTotalCount() >= 2);
    assertTrue(
        orderIdGroup.getOccurrences().stream()
            .anyMatch(o -> o.getEntityFQN().equals(table1.getFullyQualifiedName())));
    assertTrue(
        orderIdGroup.getOccurrences().stream()
            .anyMatch(o -> o.getEntityFQN().equals(table2.getFullyQualifiedName())));
  }

  @Test
  void test_searchColumns_withEntityTypeFilter() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    CreateTable createTable =
        new CreateTable()
            .withName("filter_test_table_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(new Column().withName("metric_value").withDataType(ColumnDataType.DOUBLE)));
    Table filterTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    CreateDashboardDataModel createDataModel =
        new CreateDashboardDataModel()
            .withName("filter_test_model_" + testId)
            .withService(dashboardDataModel.getService().getFullyQualifiedName())
            .withDataModelType(DataModelType.MetabaseDataModel)
            .withColumns(
                List.of(new Column().withName("metric_value").withDataType(ColumnDataType.DOUBLE)));
    DashboardDataModel filterDataModel =
        dataModelResourceTest.createEntity(createDataModel, ADMIN_AUTH_HEADERS);

    WebTarget targetTableOnly =
        getResource("columns/search")
            .queryParam("columnName", "metric_value")
            .queryParam("entityTypes", "table");
    GroupedColumnsResponse[] tableResponseArray =
        TestUtils.get(targetTableOnly, GroupedColumnsResponse[].class, ADMIN_AUTH_HEADERS);

    assertNotNull(tableResponseArray);
    List<GroupedColumnsResponse> tableResponse = Arrays.asList(tableResponseArray);
    GroupedColumnsResponse tableGroup =
        tableResponse.stream()
            .filter(g -> g.getColumnName().equals("metric_value"))
            .findFirst()
            .orElseThrow();

    assertTrue(
        tableGroup.getOccurrences().stream().allMatch(o -> o.getEntityType().equals("table")));
    assertTrue(
        tableGroup.getOccurrences().stream()
            .noneMatch(o -> o.getEntityType().equals("dashboardDataModel")));
  }

  @Test
  void test_bulkUpdateColumns_async() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    CreateTable createBulkTable =
        new CreateTable()
            .withName("bulk_update_table_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("col1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255),
                    new Column()
                        .withName("col2")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255),
                    new Column()
                        .withName("col3")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)));
    Table bulkTable = tableResourceTest.createEntity(createBulkTable, ADMIN_AUTH_HEADERS);

    TagLabel testTag =
        new TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    List<ColumnUpdate> columnUpdates =
        List.of(
            new ColumnUpdate()
                .withColumnFQN(bulkTable.getFullyQualifiedName() + ".col1")
                .withEntityType("table")
                .withDisplayName("Column 1")
                .withDescription("First column updated"),
            new ColumnUpdate()
                .withColumnFQN(bulkTable.getFullyQualifiedName() + ".col2")
                .withEntityType("table")
                .withDisplayName("Column 2")
                .withTags(List.of(testTag)),
            new ColumnUpdate()
                .withColumnFQN(bulkTable.getFullyQualifiedName() + ".col3")
                .withEntityType("table")
                .withDescription("Third column updated")
                .withTags(List.of(testTag)));

    BulkColumnUpdateRequest request =
        new BulkColumnUpdateRequest().withColumnUpdates(columnUpdates);

    WebTarget target = getResource("columns/bulk-update-async");
    org.openmetadata.service.util.CSVImportResponse asyncResponse =
        TestUtils.post(
            target,
            request,
            org.openmetadata.service.util.CSVImportResponse.class,
            OK.getStatusCode(),
            ADMIN_AUTH_HEADERS);

    assertNotNull(asyncResponse);
    assertNotNull(asyncResponse.getJobId());
    assertEquals("Bulk column update is in progress.", asyncResponse.getMessage());

    await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updatedTable =
                  tableResourceTest.getEntity(
                      bulkTable.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
              Column col1 =
                  updatedTable.getColumns().stream()
                      .filter(c -> c.getName().equals("col1"))
                      .findFirst()
                      .orElse(null);
              Column col2 =
                  updatedTable.getColumns().stream()
                      .filter(c -> c.getName().equals("col2"))
                      .findFirst()
                      .orElse(null);
              Column col3 =
                  updatedTable.getColumns().stream()
                      .filter(c -> c.getName().equals("col3"))
                      .findFirst()
                      .orElse(null);

              return col1 != null
                  && "Column 1".equals(col1.getDisplayName())
                  && "First column updated".equals(col1.getDescription())
                  && col2 != null
                  && "Column 2".equals(col2.getDisplayName())
                  && col2.getTags() != null
                  && col2.getTags().size() == 1
                  && col3 != null
                  && "Third column updated".equals(col3.getDescription())
                  && col3.getTags() != null
                  && col3.getTags().size() == 1;
            });
  }

  @Test
  void test_bulkUpdateColumns_partialFailure() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    CreateTable createPartialTable =
        new CreateTable()
            .withName("partial_fail_table_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("valid_col")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)));
    Table partialTable = tableResourceTest.createEntity(createPartialTable, ADMIN_AUTH_HEADERS);

    List<ColumnUpdate> columnUpdates =
        List.of(
            new ColumnUpdate()
                .withColumnFQN(partialTable.getFullyQualifiedName() + ".valid_col")
                .withEntityType("table")
                .withDisplayName("Valid Column"),
            new ColumnUpdate()
                .withColumnFQN(partialTable.getFullyQualifiedName() + ".invalid_col")
                .withEntityType("table")
                .withDisplayName("Invalid Column"));

    BulkColumnUpdateRequest request =
        new BulkColumnUpdateRequest().withColumnUpdates(columnUpdates);

    WebTarget target = getResource("columns/bulk-update-async");
    org.openmetadata.service.util.CSVImportResponse asyncResponse =
        TestUtils.post(
            target,
            request,
            org.openmetadata.service.util.CSVImportResponse.class,
            OK.getStatusCode(),
            ADMIN_AUTH_HEADERS);

    assertNotNull(asyncResponse);
    assertNotNull(asyncResponse.getJobId());

    await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updatedTable =
                  tableResourceTest.getEntity(partialTable.getId(), "columns", ADMIN_AUTH_HEADERS);
              Column validCol =
                  updatedTable.getColumns().stream()
                      .filter(c -> c.getName().equals("valid_col"))
                      .findFirst()
                      .orElse(null);

              return validCol != null && "Valid Column".equals(validCol.getDisplayName());
            });
  }

  @Test
  void test_searchColumns_allColumns() throws IOException {
    WebTarget target = getResource("columns/search");
    GroupedColumnsResponse[] responseArray =
        TestUtils.get(target, GroupedColumnsResponse[].class, ADMIN_AUTH_HEADERS);

    assertNotNull(responseArray);
    List<GroupedColumnsResponse> response = Arrays.asList(responseArray);
    assertTrue(response.size() > 0);

    for (GroupedColumnsResponse group : response) {
      assertNotNull(group.getColumnName());
      assertNotNull(group.getOccurrences());
      assertTrue(group.getTotalCount() > 0);
      assertEquals(group.getOccurrences().size(), group.getTotalCount());
    }
  }

  @Test
  void test_tableColumnCustomProperties_completeLifecycle() throws IOException {
    String testPropName = "testTableProp_" + UUID.randomUUID().toString().substring(0, 8);

    Type stringType = typeResourceTest.getEntityByName("string", "", ADMIN_AUTH_HEADERS);
    Type intType = typeResourceTest.getEntityByName("integer", "", ADMIN_AUTH_HEADERS);

    try {
      Type tableColumnType =
          typeResourceTest.getEntityByName(TABLE_COLUMN, "customProperties", ADMIN_AUTH_HEADERS);

      CustomProperty stringProperty =
          new CustomProperty()
              .withName(testPropName + "_string")
              .withDescription("Test string property for column")
              .withPropertyType(stringType.getEntityReference());

      CustomProperty intProperty =
          new CustomProperty()
              .withName(testPropName + "_int")
              .withDescription("Test integer property for column")
              .withPropertyType(intType.getEntityReference());

      typeResourceTest.addAndCheckCustomProperty(
          tableColumnType.getId(), stringProperty, OK, ADMIN_AUTH_HEADERS);
      typeResourceTest.addAndCheckCustomProperty(
          tableColumnType.getId(), intProperty, OK, ADMIN_AUTH_HEADERS);

      String columnFQN = table.getFullyQualifiedName() + ".name";
      UpdateColumn addValues = new UpdateColumn();
      Map<String, Object> extension = new HashMap<>();
      extension.put(testPropName + "_string", "test-value");
      extension.put(testPropName + "_int", 42);
      addValues.setExtension(extension);

      Column columnWithValues = updateColumnByFQN(columnFQN, addValues);
      if (columnWithValues.getExtension() != null) {
        @SuppressWarnings("unchecked")
        Map<String, Object> addedExt = (Map<String, Object>) columnWithValues.getExtension();
        assertEquals("test-value", addedExt.get(testPropName + "_string"));
        assertEquals(42, addedExt.get(testPropName + "_int"));
      }

      UpdateColumn updateValues = new UpdateColumn();
      Map<String, Object> updatedExtension = new HashMap<>();
      updatedExtension.put(testPropName + "_string", "updated-value");
      updatedExtension.put(testPropName + "_int", 100);
      updateValues.setExtension(updatedExtension);

      Column updatedColumn = updateColumnByFQN(columnFQN, updateValues);
      if (updatedColumn.getExtension() != null) {
        @SuppressWarnings("unchecked")
        Map<String, Object> updatedExt = (Map<String, Object>) updatedColumn.getExtension();
        assertEquals("updated-value", updatedExt.get(testPropName + "_string"));
        assertEquals(100, updatedExt.get(testPropName + "_int"));
      }

      Table persistedTable =
          tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
      Column nameColumn =
          persistedTable.getColumns().stream()
              .filter(c -> c.getName().equals("name"))
              .findFirst()
              .orElseThrow();
      if (nameColumn.getExtension() != null) {
        @SuppressWarnings("unchecked")
        Map<String, Object> persistedExt = (Map<String, Object>) nameColumn.getExtension();
        assertEquals("updated-value", persistedExt.get(testPropName + "_string"));
        assertEquals(100, persistedExt.get(testPropName + "_int"));
      }

      UpdateColumn removeValues = new UpdateColumn();
      removeValues.setExtension(new HashMap<>());
      Column columnWithoutValues = updateColumnByFQN(columnFQN, removeValues);

      if (columnWithoutValues.getExtension() != null) {
        @SuppressWarnings("unchecked")
        Map<String, Object> removedExt = (Map<String, Object>) columnWithoutValues.getExtension();
        assertFalse(removedExt.containsKey(testPropName + "_string"));
        assertFalse(removedExt.containsKey(testPropName + "_int"));
      }

    } finally {
      try {
        Type tableColumnType =
            typeResourceTest.getEntityByName(TABLE_COLUMN, "customProperties", ADMIN_AUTH_HEADERS);
        WebTarget target1 =
            getResource("metadata/types/" + tableColumnType.getId()).path(testPropName + "_string");
        TestUtils.delete(target1, ADMIN_AUTH_HEADERS);
        WebTarget target2 =
            getResource("metadata/types/" + tableColumnType.getId()).path(testPropName + "_int");
        TestUtils.delete(target2, ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        // Ignore cleanup errors
      }
    }
  }

  @Test
  void test_bulkUpdatePreview_searchBased() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    CreateTable createTable1 =
        new CreateTable()
            .withName("preview_test_table1_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("status_code")
                        .withDataType(ColumnDataType.INT)
                        .withDescription("Original description 1")));
    Table table1 = tableResourceTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);

    CreateTable createTable2 =
        new CreateTable()
            .withName("preview_test_table2_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("status_code")
                        .withDataType(ColumnDataType.INT)
                        .withDescription("Original description 2")
                        .withDisplayName("Status")));
    Table table2 = tableResourceTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);

    BulkColumnUpdateRequest previewRequest =
        new BulkColumnUpdateRequest()
            .withColumnName("status_code")
            .withDescription("Updated description for all status_code columns")
            .withDisplayName("HTTP Status Code");

    WebTarget previewTarget = getResource("columns/bulk-update-preview");
    BulkColumnUpdatePreview preview =
        TestUtils.post(
            previewTarget,
            previewRequest,
            BulkColumnUpdatePreview.class,
            OK.getStatusCode(),
            ADMIN_AUTH_HEADERS);

    assertNotNull(preview);
    assertEquals(2, preview.getTotalColumns());
    assertEquals(2, preview.getColumnPreviews().size());

    for (ColumnUpdatePreview columnPreview : preview.getColumnPreviews()) {
      assertTrue(columnPreview.getHasChanges());
      assertNotNull(columnPreview.getCurrentValues());
      assertNotNull(columnPreview.getNewValues());

      assertEquals("HTTP Status Code", columnPreview.getNewValues().getDisplayName());
      assertEquals(
          "Updated description for all status_code columns",
          columnPreview.getNewValues().getDescription());

      assertTrue(
          columnPreview.getCurrentValues().getDescription() != null
              && columnPreview
                  .getCurrentValues()
                  .getDescription()
                  .startsWith("Original description"));
    }
  }

  @Test
  void test_dashboardDataModelColumnCustomProperties_completeLifecycle() throws IOException {
    String stringPropName = "dashStringProp_" + UUID.randomUUID().toString().substring(0, 8);
    String intPropName = "dashIntProp_" + UUID.randomUUID().toString().substring(0, 8);

    try {
      createCustomPropertyForColumnEntity(
          DASHBOARD_DATA_MODEL_COLUMN, stringPropName, "string", "Dashboard string property");
      createCustomPropertyForColumnEntity(
          DASHBOARD_DATA_MODEL_COLUMN, intPropName, "integer", "Dashboard integer property");

      String columnFQN = dashboardDataModel.getFullyQualifiedName() + ".metric1";
      UpdateColumn addValues = new UpdateColumn();
      Map<String, Object> extension = new HashMap<>();
      extension.put(stringPropName, "dashboard-value");
      extension.put(intPropName, 999);
      addValues.setExtension(extension);

      Column columnWithValues = updateColumnByFQN(columnFQN, addValues, DASHBOARD_DATA_MODEL);
      assertNotNull(columnWithValues.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> addedExt = (Map<String, Object>) columnWithValues.getExtension();
      assertEquals("dashboard-value", addedExt.get(stringPropName));
      assertEquals(999, addedExt.get(intPropName));

      DashboardDataModel persistedModel =
          dataModelResourceTest.getEntity(
              dashboardDataModel.getId(), "columns", ADMIN_AUTH_HEADERS);
      Column metricColumn =
          persistedModel.getColumns().stream()
              .filter(c -> c.getName().equals("metric1"))
              .findFirst()
              .orElseThrow();
      assertNotNull(metricColumn.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> persistedExt = (Map<String, Object>) metricColumn.getExtension();
      assertEquals("dashboard-value", persistedExt.get(stringPropName));
      assertEquals(999, persistedExt.get(intPropName));

    } finally {
      deleteCustomPropertyForColumnEntity(DASHBOARD_DATA_MODEL_COLUMN, stringPropName);
      deleteCustomPropertyForColumnEntity(DASHBOARD_DATA_MODEL_COLUMN, intPropName);
    }
  }

  @Test
  void test_bulkUpdateSearchBased_propagation() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    // Create 3 tables with same column name "user_id"
    CreateTable createTable1 =
        new CreateTable()
            .withName("propagate_table1_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(new Column().withName("user_id").withDataType(ColumnDataType.BIGINT)));
    Table table1 = tableResourceTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);

    CreateTable createTable2 =
        new CreateTable()
            .withName("propagate_table2_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(new Column().withName("user_id").withDataType(ColumnDataType.BIGINT)));
    Table table2 = tableResourceTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);

    CreateTable createTable3 =
        new CreateTable()
            .withName("propagate_table3_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(new Column().withName("user_id").withDataType(ColumnDataType.BIGINT)));
    Table table3 = tableResourceTest.createEntity(createTable3, ADMIN_AUTH_HEADERS);

    TagLabel userTag =
        new TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    // Bulk update using search-based propagation
    BulkColumnUpdateRequest request =
        new BulkColumnUpdateRequest()
            .withColumnName("user_id")
            .withDisplayName("User Identifier")
            .withDescription("Unique identifier for the user")
            .withTags(List.of(userTag));

    WebTarget target = getResource("columns/bulk-update-async");
    org.openmetadata.service.util.CSVImportResponse asyncResponse =
        TestUtils.post(
            target,
            request,
            org.openmetadata.service.util.CSVImportResponse.class,
            OK.getStatusCode(),
            ADMIN_AUTH_HEADERS);

    assertNotNull(asyncResponse);
    assertNotNull(asyncResponse.getJobId());

    // Wait for async update to complete
    await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table t1 =
                  tableResourceTest.getEntity(table1.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
              Table t2 =
                  tableResourceTest.getEntity(table2.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
              Table t3 =
                  tableResourceTest.getEntity(table3.getId(), "columns,tags", ADMIN_AUTH_HEADERS);

              Column col1 =
                  t1.getColumns().stream()
                      .filter(c -> c.getName().equals("user_id"))
                      .findFirst()
                      .orElse(null);
              Column col2 =
                  t2.getColumns().stream()
                      .filter(c -> c.getName().equals("user_id"))
                      .findFirst()
                      .orElse(null);
              Column col3 =
                  t3.getColumns().stream()
                      .filter(c -> c.getName().equals("user_id"))
                      .findFirst()
                      .orElse(null);

              // All 3 columns should be updated with same metadata
              return col1 != null
                  && "User Identifier".equals(col1.getDisplayName())
                  && "Unique identifier for the user".equals(col1.getDescription())
                  && col1.getTags() != null
                  && col1.getTags().size() == 1
                  && col2 != null
                  && "User Identifier".equals(col2.getDisplayName())
                  && "Unique identifier for the user".equals(col2.getDescription())
                  && col2.getTags() != null
                  && col2.getTags().size() == 1
                  && col3 != null
                  && "User Identifier".equals(col3.getDisplayName())
                  && "Unique identifier for the user".equals(col3.getDescription())
                  && col3.getTags() != null
                  && col3.getTags().size() == 1;
            });
  }

  @Test
  void test_bulkUpdateSearchBased_withEntityTypeFilter() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    // Create table with "metric" column
    CreateTable createTable =
        new CreateTable()
            .withName("filter_table_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(new Column().withName("metric").withDataType(ColumnDataType.DOUBLE)));
    Table filterTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Create dashboard data model with "metric" column
    CreateDashboardDataModel createDataModel =
        new CreateDashboardDataModel()
            .withName("filter_model_" + testId)
            .withService(dashboardDataModel.getService().getFullyQualifiedName())
            .withDataModelType(DataModelType.MetabaseDataModel)
            .withColumns(
                List.of(new Column().withName("metric").withDataType(ColumnDataType.DOUBLE)));
    DashboardDataModel filterModel =
        dataModelResourceTest.createEntity(createDataModel, ADMIN_AUTH_HEADERS);

    // Update only table columns (filter by entityType)
    BulkColumnUpdateRequest request =
        new BulkColumnUpdateRequest()
            .withColumnName("metric")
            .withEntityTypes(List.of("table"))
            .withDescription("Table metric only");

    WebTarget target = getResource("columns/bulk-update-async");
    org.openmetadata.service.util.CSVImportResponse asyncResponse =
        TestUtils.post(
            target,
            request,
            org.openmetadata.service.util.CSVImportResponse.class,
            OK.getStatusCode(),
            ADMIN_AUTH_HEADERS);

    assertNotNull(asyncResponse);

    // Wait for async update
    await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table t =
                  tableResourceTest.getEntity(filterTable.getId(), "columns", ADMIN_AUTH_HEADERS);
              DashboardDataModel dm =
                  dataModelResourceTest.getEntity(
                      filterModel.getId(), "columns", ADMIN_AUTH_HEADERS);

              Column tableCol =
                  t.getColumns().stream()
                      .filter(c -> c.getName().equals("metric"))
                      .findFirst()
                      .orElse(null);
              Column modelCol =
                  dm.getColumns().stream()
                      .filter(c -> c.getName().equals("metric"))
                      .findFirst()
                      .orElse(null);

              // Table column should be updated, dashboard model column should NOT
              return tableCol != null
                  && "Table metric only".equals(tableCol.getDescription())
                  && modelCol != null
                  && modelCol.getDescription() == null;
            });
  }

  @Test
  void test_bulkUpdatePreview_showsDiff() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    TagLabel existingTag =
        new TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    // Create table with column that has existing metadata
    String uniqueColumnName = "user_contact_email_" + testId;
    CreateTable createTable =
        new CreateTable()
            .withName("diff_test_table_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName(uniqueColumnName)
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)
                        .withDisplayName("Email Address")
                        .withDescription("User's email address")
                        .withTags(List.of(existingTag))));
    Table diffTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    TagLabel newTag =
        new TagLabel()
            .withTagFQN(piiTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    // Preview update with different values
    BulkColumnUpdateRequest previewRequest =
        new BulkColumnUpdateRequest()
            .withColumnName(uniqueColumnName)
            .withDisplayName("Contact Email")
            .withDescription("Primary contact email")
            .withTags(List.of(newTag));

    WebTarget previewTarget = getResource("columns/bulk-update-preview");
    BulkColumnUpdatePreview preview =
        TestUtils.post(
            previewTarget,
            previewRequest,
            BulkColumnUpdatePreview.class,
            OK.getStatusCode(),
            ADMIN_AUTH_HEADERS);

    assertNotNull(preview);
    assertEquals(1, preview.getTotalColumns());
    assertEquals(1, preview.getColumnPreviews().size());

    ColumnUpdatePreview columnPreview = preview.getColumnPreviews().get(0);
    assertTrue(columnPreview.getHasChanges());

    // Verify current values
    assertEquals("Email Address", columnPreview.getCurrentValues().getDisplayName());
    assertEquals("User's email address", columnPreview.getCurrentValues().getDescription());
    assertEquals(1, columnPreview.getCurrentValues().getTags().size());
    assertEquals(
        personalDataTag.getFullyQualifiedName(),
        columnPreview.getCurrentValues().getTags().get(0).getTagFQN());

    // Verify new values
    assertEquals("Contact Email", columnPreview.getNewValues().getDisplayName());
    assertEquals("Primary contact email", columnPreview.getNewValues().getDescription());
    assertEquals(1, columnPreview.getNewValues().getTags().size());
    assertEquals(
        piiTag.getFullyQualifiedName(), columnPreview.getNewValues().getTags().get(0).getTagFQN());
  }

  @Test
  void test_exportCSV() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    // Create tables with same column name
    TagLabel exportTag =
        new TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    CreateTable createTable1 =
        new CreateTable()
            .withName("csv_export_table1_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("export_col")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)
                        .withDisplayName("Export Column")
                        .withDescription("Test export column")
                        .withTags(List.of(exportTag))));
    Table exportTable1 = tableResourceTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);

    CreateTable createTable2 =
        new CreateTable()
            .withName("csv_export_table2_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("export_col")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)));
    Table exportTable2 = tableResourceTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);

    // Export CSV
    WebTarget target = getResource("columns/export").queryParam("columnName", "export_col");
    String csv = TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);

    assertNotNull(csv);
    assertTrue(csv.contains("column.name*,column.displayName,column.description"));
    assertTrue(csv.contains("export_col"));
    assertTrue(csv.contains("Export Column"));
    assertTrue(csv.contains("Test export column"));
    assertTrue(csv.contains(personalDataTag.getFullyQualifiedName()));
  }

  @Test
  void test_importCSV_dryRun() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    // Create test table
    CreateTable createTable =
        new CreateTable()
            .withName("csv_import_table_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("import_col")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)));
    Table importTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Prepare CSV
    String csv =
        "column.name*,column.displayName,column.description,column.tags,column.glossaryTerms\n"
            + "import_col,Imported Column,Description from CSV,"
            + personalDataTag.getFullyQualifiedName()
            + ",";

    // Import with dry-run
    WebTarget target = getResource("columns/import").queryParam("dryRun", "true");
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
            .post(jakarta.ws.rs.client.Entity.entity(csv, MediaType.TEXT_PLAIN));
    org.openmetadata.schema.type.csv.CsvImportResult result =
        TestUtils.readResponse(
            response, org.openmetadata.schema.type.csv.CsvImportResult.class, OK.getStatusCode());

    assertNotNull(result);
    assertTrue(result.getDryRun());
    assertEquals(1, result.getNumberOfRowsProcessed());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(0, result.getNumberOfRowsFailed());

    // Verify column was NOT actually updated (dry-run)
    Table unchangedTable =
        tableResourceTest.getEntity(importTable.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column unchangedCol =
        unchangedTable.getColumns().stream()
            .filter(c -> c.getName().equals("import_col"))
            .findFirst()
            .orElse(null);

    assertNotNull(unchangedCol);
    assertNull(unchangedCol.getDisplayName());
    assertNull(unchangedCol.getDescription());
  }

  @Test
  void test_importCSV_actualImport() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    // Create 2 tables with same column name
    CreateTable createTable1 =
        new CreateTable()
            .withName("csv_import_table1_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("csv_import_col")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)));
    Table importTable1 = tableResourceTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);

    CreateTable createTable2 =
        new CreateTable()
            .withName("csv_import_table2_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("csv_import_col")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)));
    Table importTable2 = tableResourceTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);

    // Prepare CSV
    String csv =
        "column.name*,column.displayName,column.description,column.tags,column.glossaryTerms\n"
            + "csv_import_col,CSV Imported,Imported via CSV,"
            + piiTag.getFullyQualifiedName()
            + ",";

    // Import without dry-run
    WebTarget target = getResource("columns/import").queryParam("dryRun", "false");
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
            .post(jakarta.ws.rs.client.Entity.entity(csv, MediaType.TEXT_PLAIN));
    org.openmetadata.schema.type.csv.CsvImportResult result =
        TestUtils.readResponse(
            response, org.openmetadata.schema.type.csv.CsvImportResult.class, OK.getStatusCode());

    assertNotNull(result);
    assertFalse(result.getDryRun());
    assertEquals(1, result.getNumberOfRowsProcessed());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(0, result.getNumberOfRowsFailed());

    // Verify BOTH columns were updated (propagation)
    Table updatedTable1 =
        tableResourceTest.getEntity(importTable1.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column updatedCol1 =
        updatedTable1.getColumns().stream()
            .filter(c -> c.getName().equals("csv_import_col"))
            .findFirst()
            .orElse(null);

    assertNotNull(updatedCol1);
    assertEquals("CSV Imported", updatedCol1.getDisplayName());
    assertEquals("Imported via CSV", updatedCol1.getDescription());
    assertEquals(1, updatedCol1.getTags().size());

    Table updatedTable2 =
        tableResourceTest.getEntity(importTable2.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column updatedCol2 =
        updatedTable2.getColumns().stream()
            .filter(c -> c.getName().equals("csv_import_col"))
            .findFirst()
            .orElse(null);

    assertNotNull(updatedCol2);
    assertEquals("CSV Imported", updatedCol2.getDisplayName());
    assertEquals("Imported via CSV", updatedCol2.getDescription());
    assertEquals(1, updatedCol2.getTags().size());
  }

  @Test
  void test_importCSVAsync() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    // Create test table
    CreateTable createTable =
        new CreateTable()
            .withName("csv_async_table_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(new Column().withName("async_col").withDataType(ColumnDataType.BIGINT)));
    Table asyncTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Prepare CSV
    String csv =
        "column.name*,column.displayName,column.description,column.tags,column.glossaryTerms\n"
            + "async_col,Async Import,Async CSV import,,";

    // Import async
    WebTarget target = getResource("columns/import-async");
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
            .post(jakarta.ws.rs.client.Entity.entity(csv, MediaType.TEXT_PLAIN));
    org.openmetadata.service.util.CSVImportResponse asyncResponse =
        TestUtils.readResponse(
            response, org.openmetadata.service.util.CSVImportResponse.class, OK.getStatusCode());

    assertNotNull(asyncResponse);
    assertNotNull(asyncResponse.getJobId());
    assertEquals("CSV column import is in progress.", asyncResponse.getMessage());

    // Wait for async import to complete
    await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updated =
                  tableResourceTest.getEntity(asyncTable.getId(), "columns", ADMIN_AUTH_HEADERS);
              Column col =
                  updated.getColumns().stream()
                      .filter(c -> c.getName().equals("async_col"))
                      .findFirst()
                      .orElse(null);

              return col != null
                  && "Async Import".equals(col.getDisplayName())
                  && "Async CSV import".equals(col.getDescription());
            });
  }

  @Test
  void test_getColumnGrid_basic() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    CreateTable createTable1 =
        new CreateTable()
            .withName("grid_table1_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("grid_col1")
                        .withDataType(ColumnDataType.BIGINT)
                        .withDisplayName("Grid Column 1")
                        .withDescription("First grid column"),
                    new Column()
                        .withName("grid_col2")
                        .withDataType(ColumnDataType.STRING)
                        .withDisplayName("Grid Column 2")
                        .withDescription("Second grid column")));
    tableResourceTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);

    CreateTable createTable2 =
        new CreateTable()
            .withName("grid_table2_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("grid_col1")
                        .withDataType(ColumnDataType.BIGINT)
                        .withDisplayName("Grid Column 1")
                        .withDescription("First grid column"),
                    new Column()
                        .withName("grid_col3")
                        .withDataType(ColumnDataType.INT)
                        .withDisplayName("Grid Column 3")));
    tableResourceTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);

    await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              WebTarget target = getResource("columns/grid").queryParam("size", "100");
              Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
              if (response.getStatus() != OK.getStatusCode()) {
                return false;
              }
              ColumnGridResponse gridResponse =
                  TestUtils.readResponse(response, ColumnGridResponse.class, OK.getStatusCode());
              return gridResponse != null && gridResponse.getColumns().size() >= 2;
            });

    WebTarget target = getResource("columns/grid").queryParam("size", "100");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    ColumnGridResponse gridResponse =
        TestUtils.readResponse(response, ColumnGridResponse.class, OK.getStatusCode());

    assertNotNull(gridResponse);
    assertNotNull(gridResponse.getColumns());
    assertTrue(gridResponse.getTotalUniqueColumns() >= 2);

    Optional<ColumnGridItem> gridCol1 =
        gridResponse.getColumns().stream()
            .filter(item -> "grid_col1".equals(item.getColumnName()))
            .findFirst();
    assertTrue(gridCol1.isPresent());
    assertEquals(2, gridCol1.get().getTotalOccurrences());
    assertFalse(gridCol1.get().getHasVariations());
    assertEquals(1, gridCol1.get().getGroups().size());
  }

  @Test
  void test_getColumnGrid_withMetadataVariations() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    CreateTable createTable1 =
        new CreateTable()
            .withName("var_table1_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("varying_col")
                        .withDataType(ColumnDataType.BIGINT)
                        .withDisplayName("Display A")
                        .withDescription("Description A")
                        .withTags(
                            List.of(
                                new TagLabel()
                                    .withTagFQN(personalDataTag.getFullyQualifiedName())
                                    .withSource(TagLabel.TagSource.CLASSIFICATION)))));
    tableResourceTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);

    CreateTable createTable2 =
        new CreateTable()
            .withName("var_table2_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("varying_col")
                        .withDataType(ColumnDataType.BIGINT)
                        .withDisplayName("Display B")
                        .withDescription("Description B")
                        .withTags(
                            List.of(
                                new TagLabel()
                                    .withTagFQN(businessMetricsTag.getFullyQualifiedName())
                                    .withSource(TagLabel.TagSource.CLASSIFICATION)))));
    tableResourceTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);

    await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              WebTarget target =
                  getResource("columns/grid")
                      .queryParam("columnNamePattern", "varying_col")
                      .queryParam("hasConflicts", "true");
              Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
              if (response.getStatus() != OK.getStatusCode()) {
                return false;
              }
              ColumnGridResponse gridResponse =
                  TestUtils.readResponse(response, ColumnGridResponse.class, OK.getStatusCode());
              return gridResponse != null && !gridResponse.getColumns().isEmpty();
            });

    WebTarget target =
        getResource("columns/grid")
            .queryParam("columnNamePattern", "varying_col")
            .queryParam("hasConflicts", "true");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    ColumnGridResponse gridResponse =
        TestUtils.readResponse(response, ColumnGridResponse.class, OK.getStatusCode());

    assertNotNull(gridResponse);
    assertEquals(1, gridResponse.getColumns().size());

    ColumnGridItem item = gridResponse.getColumns().get(0);
    assertEquals("varying_col", item.getColumnName());
    assertEquals(2, item.getTotalOccurrences());
    assertTrue(item.getHasVariations());
    assertEquals(2, item.getGroups().size());
  }

  @Test
  void test_getColumnGrid_withPagination() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    CreateTable createTable =
        new CreateTable()
            .withName("pagination_table_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column().withName("pag_col1").withDataType(ColumnDataType.BIGINT),
                    new Column().withName("pag_col2").withDataType(ColumnDataType.STRING),
                    new Column().withName("pag_col3").withDataType(ColumnDataType.INT)));
    tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              WebTarget target = getResource("columns/grid").queryParam("size", "1");
              Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
              if (response.getStatus() != OK.getStatusCode()) {
                return false;
              }
              ColumnGridResponse gridResponse =
                  TestUtils.readResponse(response, ColumnGridResponse.class, OK.getStatusCode());
              return gridResponse != null && !gridResponse.getColumns().isEmpty();
            });

    WebTarget firstPageTarget = getResource("columns/grid").queryParam("size", "1");
    Response firstPageResponse = SecurityUtil.addHeaders(firstPageTarget, ADMIN_AUTH_HEADERS).get();
    ColumnGridResponse firstPage =
        TestUtils.readResponse(firstPageResponse, ColumnGridResponse.class, OK.getStatusCode());

    assertNotNull(firstPage);
    assertEquals(1, firstPage.getColumns().size());

    if (firstPage.getCursor() != null) {
      WebTarget secondPageTarget =
          getResource("columns/grid")
              .queryParam("size", "1")
              .queryParam("cursor", firstPage.getCursor());
      Response secondPageResponse =
          SecurityUtil.addHeaders(secondPageTarget, ADMIN_AUTH_HEADERS).get();
      ColumnGridResponse secondPage =
          TestUtils.readResponse(secondPageResponse, ColumnGridResponse.class, OK.getStatusCode());

      assertNotNull(secondPage);
      assertEquals(1, secondPage.getColumns().size());
      assertFalse(
          firstPage
              .getColumns()
              .get(0)
              .getColumnName()
              .equals(secondPage.getColumns().get(0).getColumnName()));
    }
  }

  @Test
  void test_getColumnGrid_withFilters() throws IOException {
    String testId = UUID.randomUUID().toString().replaceAll("[^A-Za-z0-9]", "");

    CreateTable createTable =
        new CreateTable()
            .withName("filter_table_" + testId)
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("filter_col")
                        .withDataType(ColumnDataType.BIGINT)
                        .withDescription("Has description"),
                    new Column().withName("empty_col").withDataType(ColumnDataType.STRING)));
    tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              WebTarget target =
                  getResource("columns/grid")
                      .queryParam("columnNamePattern", "filter")
                      .queryParam("entityTypes", "table");
              Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
              if (response.getStatus() != OK.getStatusCode()) {
                return false;
              }
              ColumnGridResponse gridResponse =
                  TestUtils.readResponse(response, ColumnGridResponse.class, OK.getStatusCode());
              return gridResponse != null && !gridResponse.getColumns().isEmpty();
            });

    WebTarget target =
        getResource("columns/grid")
            .queryParam("columnNamePattern", "filter")
            .queryParam("entityTypes", "table");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    ColumnGridResponse gridResponse =
        TestUtils.readResponse(response, ColumnGridResponse.class, OK.getStatusCode());

    assertNotNull(gridResponse);
    assertTrue(
        gridResponse.getColumns().stream()
            .anyMatch(item -> "filter_col".equals(item.getColumnName())));
  }

  @Test
  void test_tableColumnCustomProperties_validation() throws IOException {
    // Test validation scenarios for table column custom properties
    String validPropName = "validTableProp_" + UUID.randomUUID().toString().substring(0, 8);

    try {
      // 1. Test undefined custom property - should fail
      String columnFQN = table.getFullyQualifiedName() + ".name";
      UpdateColumn invalidUpdate = new UpdateColumn();
      Map<String, Object> invalidExtension = new HashMap<>();
      invalidExtension.put("undefinedProperty", "should-fail");
      invalidUpdate.setExtension(invalidExtension);

      assertResponse(
          () -> updateColumnByFQN(columnFQN, invalidUpdate),
          jakarta.ws.rs.core.Response.Status.BAD_REQUEST,
          "Unknown custom field undefinedProperty");

      // 2. Create valid custom property and test success
      createCustomPropertyForColumnEntity(
          TABLE_COLUMN, validPropName, "string", "Valid property for testing");

      UpdateColumn validUpdate = new UpdateColumn();
      Map<String, Object> validExtension = new HashMap<>();
      validExtension.put(validPropName, "valid-value");
      validUpdate.setExtension(validExtension);

      Column updatedColumn = updateColumnByFQN(columnFQN, validUpdate);
      assertNotNull(updatedColumn.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updatedColumn.getExtension();
      assertEquals("valid-value", resultExt.get(validPropName));

    } finally {
      deleteCustomPropertyForColumnEntity(TABLE_COLUMN, validPropName);
    }
  }

  @Test
  void test_dashboardDataModelColumnCustomProperties_validation() throws IOException {
    // Test validation scenarios for dashboard data model column custom properties
    String validPropName = "validDashProp_" + UUID.randomUUID().toString().substring(0, 8);

    try {
      // 1. Test undefined custom property - should fail
      String columnFQN = dashboardDataModel.getFullyQualifiedName() + ".dimension1";
      UpdateColumn invalidUpdate = new UpdateColumn();
      Map<String, Object> invalidExtension = new HashMap<>();
      invalidExtension.put("undefinedDashProperty", "should-fail");
      invalidUpdate.setExtension(invalidExtension);

      assertResponse(
          () -> updateColumnByFQN(columnFQN, invalidUpdate, DASHBOARD_DATA_MODEL),
          jakarta.ws.rs.core.Response.Status.BAD_REQUEST,
          "Unknown custom field undefinedDashProperty");

      // 2. Create valid custom property and test success
      createCustomPropertyForColumnEntity(
          DASHBOARD_DATA_MODEL_COLUMN, validPropName, "integer", "Valid dashboard property");

      UpdateColumn validUpdate = new UpdateColumn();
      Map<String, Object> validExtension = new HashMap<>();
      validExtension.put(validPropName, 123);
      validUpdate.setExtension(validExtension);

      Column updatedColumn = updateColumnByFQN(columnFQN, validUpdate, DASHBOARD_DATA_MODEL);
      assertNotNull(updatedColumn.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updatedColumn.getExtension();
      assertEquals(123, resultExt.get(validPropName));

    } finally {
      deleteCustomPropertyForColumnEntity(DASHBOARD_DATA_MODEL_COLUMN, validPropName);
    }
  }

  @Test
  void test_customProperties_crossEntityTypeIsolation() throws IOException {
    // Test that table column and dashboard data model column custom properties are isolated
    // This verifies that custom properties defined for tableColumn type don't affect
    // dashboardDataModelColumn type
    String uniquePropName = "isolationTest_" + UUID.randomUUID().toString().substring(0, 8);

    Type stringType = typeResourceTest.getEntityByName("string", "", ADMIN_AUTH_HEADERS);
    Type intType = typeResourceTest.getEntityByName("integer", "", ADMIN_AUTH_HEADERS);

    try {
      // Create custom property with same name but different types for each entity
      Type tableColumnType =
          typeResourceTest.getEntityByName(TABLE_COLUMN, "customProperties", ADMIN_AUTH_HEADERS);
      Type dashColumnType =
          typeResourceTest.getEntityByName(
              DASHBOARD_DATA_MODEL_COLUMN, "customProperties", ADMIN_AUTH_HEADERS);

      // Add string property to tableColumn
      CustomProperty tableProperty =
          new CustomProperty()
              .withName(uniquePropName)
              .withDescription("Table column property")
              .withPropertyType(stringType.getEntityReference());
      typeResourceTest.addAndCheckCustomProperty(
          tableColumnType.getId(), tableProperty, OK, ADMIN_AUTH_HEADERS);

      // Add integer property with same name to dashboardDataModelColumn
      CustomProperty dashProperty =
          new CustomProperty()
              .withName(uniquePropName)
              .withDescription("Dashboard column property")
              .withPropertyType(intType.getEntityReference());
      typeResourceTest.addAndCheckCustomProperty(
          dashColumnType.getId(), dashProperty, OK, ADMIN_AUTH_HEADERS);

      // Test 1: Table column accepts string value
      String tableColumnFQN = table.getFullyQualifiedName() + ".email";
      UpdateColumn tableUpdate = new UpdateColumn();
      Map<String, Object> tableExtension = new HashMap<>();
      tableExtension.put(uniquePropName, "table-string-value");
      tableUpdate.setExtension(tableExtension);

      Column updatedTableColumn = updateColumnByFQN(tableColumnFQN, tableUpdate);
      @SuppressWarnings("unchecked")
      Map<String, Object> tableExt = (Map<String, Object>) updatedTableColumn.getExtension();
      assertEquals("table-string-value", tableExt.get(uniquePropName));

      // Test 2: Dashboard column accepts integer value (same property name, different type)
      String dashColumnFQN = dashboardDataModel.getFullyQualifiedName() + ".dimension1";
      UpdateColumn dashUpdate = new UpdateColumn();
      Map<String, Object> dashExtension = new HashMap<>();
      dashExtension.put(uniquePropName, 456);
      dashUpdate.setExtension(dashExtension);

      Column updatedDashColumn = updateColumnByFQN(dashColumnFQN, dashUpdate, DASHBOARD_DATA_MODEL);
      @SuppressWarnings("unchecked")
      Map<String, Object> dashExt = (Map<String, Object>) updatedDashColumn.getExtension();
      assertEquals(456, dashExt.get(uniquePropName));

      // Verify both columns maintain their separate custom property values
      Table verifyTable = tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
      Column verifyTableColumn =
          verifyTable.getColumns().stream()
              .filter(c -> c.getName().equals("email"))
              .findFirst()
              .orElseThrow();
      if (verifyTableColumn.getExtension() != null) {
        @SuppressWarnings("unchecked")
        Map<String, Object> verifyTableExt = (Map<String, Object>) verifyTableColumn.getExtension();
        assertEquals("table-string-value", verifyTableExt.get(uniquePropName));
      }

      DashboardDataModel verifyDashModel =
          dataModelResourceTest.getEntity(
              dashboardDataModel.getId(), "columns", ADMIN_AUTH_HEADERS);
      Column verifyDashColumn =
          verifyDashModel.getColumns().stream()
              .filter(c -> c.getName().equals("dimension1"))
              .findFirst()
              .orElseThrow();
      if (verifyDashColumn.getExtension() != null) {
        @SuppressWarnings("unchecked")
        Map<String, Object> verifyDashExt = (Map<String, Object>) verifyDashColumn.getExtension();
        assertEquals(456, verifyDashExt.get(uniquePropName));
      }

    } finally {
      // Clean up
      try {
        Type tableColumnType =
            typeResourceTest.getEntityByName(TABLE_COLUMN, "customProperties", ADMIN_AUTH_HEADERS);
        WebTarget target1 =
            getResource("metadata/types/" + tableColumnType.getId()).path(uniquePropName);
        TestUtils.delete(target1, ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        // Ignore
      }
      try {
        Type dashColumnType =
            typeResourceTest.getEntityByName(
                DASHBOARD_DATA_MODEL_COLUMN, "customProperties", ADMIN_AUTH_HEADERS);
        WebTarget target2 =
            getResource("metadata/types/" + dashColumnType.getId()).path(uniquePropName);
        TestUtils.delete(target2, ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        // Ignore
      }
    }
  }

  @Test
  void test_customProperties_wrongEntityTypeError() throws IOException {
    // Test error message when trying to use custom property from wrong entity type
    String tableOnlyProp = "tableOnlyProp_" + UUID.randomUUID().toString().substring(0, 8);
    String dashOnlyProp = "dashOnlyProp_" + UUID.randomUUID().toString().substring(0, 8);

    try {
      // Create custom property only for tableColumn
      createCustomPropertyForColumnEntity(
          TABLE_COLUMN, tableOnlyProp, "string", "Table column only property");
      // Create custom property only for dashboardDataModelColumn
      createCustomPropertyForColumnEntity(
          DASHBOARD_DATA_MODEL_COLUMN, dashOnlyProp, "integer", "Dashboard column only property");

      // Test 1: Try to use table property on dashboard column - should fail with detailed error
      String dashColumnFQN = dashboardDataModel.getFullyQualifiedName() + ".metric1";
      UpdateColumn dashUpdate = new UpdateColumn();
      Map<String, Object> dashExtension = new HashMap<>();
      dashExtension.put(tableOnlyProp, "wrong-entity-type");
      dashUpdate.setExtension(dashExtension);

      assertResponse(
          () -> updateColumnByFQN(dashColumnFQN, dashUpdate, DASHBOARD_DATA_MODEL),
          jakarta.ws.rs.core.Response.Status.BAD_REQUEST,
          "Unknown custom field " + tableOnlyProp);

      // Test 2: Try to use dashboard property on table column - should fail
      String tableColumnFQN = table.getFullyQualifiedName() + ".id";
      UpdateColumn tableUpdate = new UpdateColumn();
      Map<String, Object> tableExtension = new HashMap<>();
      tableExtension.put(dashOnlyProp, 123);
      tableUpdate.setExtension(tableExtension);

      assertResponse(
          () -> updateColumnByFQN(tableColumnFQN, tableUpdate, TABLE),
          jakarta.ws.rs.core.Response.Status.BAD_REQUEST,
          "Unknown custom field " + dashOnlyProp);

    } finally {
      deleteCustomPropertyForColumnEntity(TABLE_COLUMN, tableOnlyProp);
      deleteCustomPropertyForColumnEntity(DASHBOARD_DATA_MODEL_COLUMN, dashOnlyProp);
    }
  }

  @Test
  void test_customProperties_validationWithInvalidProperty() throws IOException {
    // Test that custom property validation works correctly for both valid and invalid properties
    // This ensures the system validates custom properties properly
    String tempPropName = "cacheTest_" + UUID.randomUUID().toString().substring(0, 8);

    Type stringType = typeResourceTest.getEntityByName("string", "", ADMIN_AUTH_HEADERS);
    Type tableColumnType =
        typeResourceTest.getEntityByName(TABLE_COLUMN, "customProperties", ADMIN_AUTH_HEADERS);

    // Create custom property
    CustomProperty tempProperty =
        new CustomProperty()
            .withName(tempPropName)
            .withDescription("Temporary property for cache test")
            .withPropertyType(stringType.getEntityReference());

    typeResourceTest.addAndCheckCustomProperty(
        tableColumnType.getId(), tempProperty, OK, ADMIN_AUTH_HEADERS);

    String columnFQN = table.getFullyQualifiedName() + ".name";

    // Use the custom property
    UpdateColumn initialUpdate = new UpdateColumn();
    Map<String, Object> initialExtension = new HashMap<>();
    initialExtension.put(tempPropName, "cached-value");
    initialUpdate.setExtension(initialExtension);

    Column columnWithProp = updateColumnByFQN(columnFQN, initialUpdate);
    // Extension might be null on some backends
    if (columnWithProp.getExtension() != null) {
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) columnWithProp.getExtension();
      assertEquals("cached-value", resultExt.get(tempPropName));
    }

    // Try to delete the custom property from type definition (might fail)
    try {
      WebTarget deleteTarget =
          getResource("metadata/types/" + tableColumnType.getId()).path(tempPropName);
      TestUtils.delete(deleteTarget, ADMIN_AUTH_HEADERS);
    } catch (Exception e) {
      // Deletion might fail - just continue with validation test
    }

    // Test that invalid properties are properly rejected
    String invalidPropName = "nonExistent_" + UUID.randomUUID().toString().substring(0, 8);
    UpdateColumn invalidUpdate = new UpdateColumn();
    Map<String, Object> invalidExtension = new HashMap<>();
    invalidExtension.put(invalidPropName, "should-fail");
    invalidUpdate.setExtension(invalidExtension);

    assertResponse(
        () -> updateColumnByFQN(columnFQN, invalidUpdate),
        jakarta.ws.rs.core.Response.Status.BAD_REQUEST,
        "Unknown custom field " + invalidPropName);

    // Clean up the created property
    try {
      WebTarget cleanupTarget =
          getResource("metadata/types/" + tableColumnType.getId()).path(tempPropName);
      TestUtils.delete(cleanupTarget, ADMIN_AUTH_HEADERS);
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  @Test
  void test_updateColumn_entityType_validation() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".name";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Test Display Name");

    // Test invalid entity type
    assertResponse(
        () -> updateColumnByFQN(columnFQN, updateColumn, "invalidEntityType"),
        jakarta.ws.rs.core.Response.Status.BAD_REQUEST,
        "Unsupported entity type: invalidEntityType. Supported types are: table, dashboardDataModel");

    // Test null entity type
    assertResponse(
        () -> updateColumnByFQN(columnFQN, updateColumn, null),
        jakarta.ws.rs.core.Response.Status.BAD_REQUEST,
        "[query param entityType must not be null]");
  }

  @Test
  void test_nestedTableColumnCustomProperties() throws IOException {
    // Test custom properties on nested table columns (struct fields)
    // This verifies that custom properties work correctly for nested column structures
    String nestedPropName = "nestedTest_" + UUID.randomUUID().toString().substring(0, 8);
    Table nestedTable = null;

    Type stringType = typeResourceTest.getEntityByName("string", "", ADMIN_AUTH_HEADERS);
    Type tableColumnType =
        typeResourceTest.getEntityByName(TABLE_COLUMN, "customProperties", ADMIN_AUTH_HEADERS);

    try {
      // Create custom property for table columns
      CustomProperty nestedProperty =
          new CustomProperty()
              .withName(nestedPropName)
              .withDescription("Property for nested columns")
              .withPropertyType(stringType.getEntityReference());

      typeResourceTest.addAndCheckCustomProperty(
          tableColumnType.getId(), nestedProperty, OK, ADMIN_AUTH_HEADERS);

      // Create table with nested columns
      List<Column> nestedColumns =
          List.of(new Column().withName("nested_field").withDataType(ColumnDataType.STRING));
      List<Column> structColumns =
          List.of(
              new Column()
                  .withName("struct_column")
                  .withDataType(ColumnDataType.STRUCT)
                  .withChildren(nestedColumns));
      CreateTable createNestedTable =
          new CreateTable()
              .withName("nested_test_table_" + UUID.randomUUID().toString().substring(0, 8))
              .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
              .withColumns(structColumns);
      nestedTable = tableResourceTest.createEntity(createNestedTable, ADMIN_AUTH_HEADERS);

      // Update nested column with custom property
      String nestedColumnFQN = nestedTable.getFullyQualifiedName() + ".struct_column.nested_field";
      UpdateColumn updateNested = new UpdateColumn();
      Map<String, Object> nestedExtension = new HashMap<>();
      nestedExtension.put(nestedPropName, "nested-custom-value");
      updateNested.setExtension(nestedExtension);

      Column updatedNestedColumn = updateColumnByFQN(nestedColumnFQN, updateNested);
      if (updatedNestedColumn.getExtension() != null) {
        @SuppressWarnings("unchecked")
        Map<String, Object> nestedExt = (Map<String, Object>) updatedNestedColumn.getExtension();
        assertEquals("nested-custom-value", nestedExt.get(nestedPropName));
      }

      // Verify persistence in nested structure
      Table verifiedTable =
          tableResourceTest.getEntity(nestedTable.getId(), "columns", ADMIN_AUTH_HEADERS);
      assertNotNull(verifiedTable.getColumns());
      assertFalse(verifiedTable.getColumns().isEmpty());

      Column structColumn = verifiedTable.getColumns().get(0);
      // Nested structure might not have children populated in all backends
      if (structColumn.getChildren() != null && !structColumn.getChildren().isEmpty()) {
        Column nestedField = structColumn.getChildren().get(0);
        if (nestedField.getExtension() != null) {
          @SuppressWarnings("unchecked")
          Map<String, Object> persistedNestedExt = (Map<String, Object>) nestedField.getExtension();
          assertEquals("nested-custom-value", persistedNestedExt.get(nestedPropName));
        }
      }

    } finally {
      // Clean up
      try {
        WebTarget deleteTarget =
            getResource("metadata/types/" + tableColumnType.getId()).path(nestedPropName);
        TestUtils.delete(deleteTarget, ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        // Ignore cleanup errors
      }

      // Clean up test table
      if (nestedTable != null) {
        try {
          tableResourceTest.deleteEntity(nestedTable.getId(), ADMIN_AUTH_HEADERS);
        } catch (Exception e) {
          // Ignore
        }
      }
    }
  }

  // Helper methods for custom property management
  private void createCustomPropertyForColumnEntity(
      String entityType, String propertyName, String propertyType, String description)
      throws IOException {
    // Get the entity type (tableColumn or dashboardDataModelColumn)
    Type columnEntityType = getEntityTypeByName(entityType);

    // Create the custom property
    CustomProperty customProperty =
        new CustomProperty()
            .withName(propertyName)
            .withDescription(description)
            .withPropertyType(getPropertyTypeReference(propertyType));

    // Add the custom property to the entity type
    WebTarget target = getResource("metadata/types/" + columnEntityType.getId());
    TestUtils.put(target, customProperty, Type.class, OK, ADMIN_AUTH_HEADERS);
    LOG.info(
        "Created custom property '{}' for entity type '{}' with type '{}'",
        propertyName,
        entityType,
        propertyType);
  }

  private void deleteCustomPropertyForColumnEntity(String entityType, String propertyName) {
    try {
      // Get the current entity type to find the custom property
      Type columnEntityType = getEntityTypeByName(entityType);

      if (columnEntityType.getCustomProperties() != null) {
        CustomProperty propertyToDelete =
            columnEntityType.getCustomProperties().stream()
                .filter(prop -> prop.getName().equals(propertyName))
                .findFirst()
                .orElse(null);

        if (propertyToDelete != null) {
          // Use DELETE on the specific custom property
          WebTarget target =
              getResource("metadata/types/" + columnEntityType.getId()).path(propertyName);
          TestUtils.delete(target, ADMIN_AUTH_HEADERS);
          LOG.info("Deleted custom property '{}' for entity type '{}'", propertyName, entityType);
        }
      }
    } catch (IOException e) {
      LOG.warn(
          "Failed to delete custom property '{}' for entity type '{}': {}",
          propertyName,
          entityType,
          e.getMessage());
    }
  }

  private Type getEntityTypeByName(String entityTypeName) throws IOException {
    WebTarget target =
        getResource("metadata/types/name/" + entityTypeName)
            .queryParam("fields", "customProperties");
    return TestUtils.get(target, Type.class, ADMIN_AUTH_HEADERS);
  }

  private org.openmetadata.schema.type.EntityReference getPropertyTypeReference(String propertyType)
      throws IOException {
    // For built-in types like string, integer, boolean, we need to get them from the system
    // These are basic types, not entity types
    WebTarget target = getResource("metadata/types/name/" + propertyType.toLowerCase());
    Type typeEntity = TestUtils.get(target, Type.class, ADMIN_AUTH_HEADERS);
    return typeEntity.getEntityReference();
  }

}
