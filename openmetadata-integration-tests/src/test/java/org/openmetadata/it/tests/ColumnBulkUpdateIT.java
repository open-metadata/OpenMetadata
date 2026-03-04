package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Integration tests for Column bulk update API.
 *
 * <p>Tests the /columns/bulk-update-async endpoint to verify that bulk updates correctly apply
 * displayName, description, tags, and glossary terms to columns across multiple tables.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ColumnBulkUpdateIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

  // ===================================================================
  // BASIC BULK UPDATE TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_withTags(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    String sharedColumnName = "user_email";
    Table table1 = createTestTable(ns, schema, "bulk_tags_table1", sharedColumnName);
    Table table2 = createTestTable(ns, schema, "bulk_tags_table2", sharedColumnName);

    assertNotNull(table1.getId());
    assertNotNull(table2.getId());

    String displayName = "User Email Address";
    String description = "The email address of the user";
    String tagFqn = "PII.Sensitive";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s.%s",
                  "entityType": "table",
                  "displayName": "%s",
                  "description": "%s",
                  "tags": [
                    {
                      "tagFQN": "%s",
                      "source": "Classification",
                      "labelType": "Manual",
                      "state": "Confirmed"
                    }
                  ]
                },
                {
                  "columnFQN": "%s.%s",
                  "entityType": "table",
                  "displayName": "%s",
                  "description": "%s",
                  "tags": [
                    {
                      "tagFQN": "%s",
                      "source": "Classification",
                      "labelType": "Manual",
                      "state": "Confirmed"
                    }
                  ]
                }
              ]
            }
            """,
            table1.getFullyQualifiedName(),
            sharedColumnName,
            displayName,
            description,
            tagFqn,
            table2.getFullyQualifiedName(),
            sharedColumnName,
            displayName,
            description,
            tagFqn);

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);

    assertEquals(200, response.statusCode(), "Bulk update should return 200");

    JsonNode responseJson = OBJECT_MAPPER.readTree(response.body());
    assertNotNull(responseJson.get("jobId"), "Response should contain jobId");

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updatedTable1 = getTableWithColumns(table1.getId().toString());
              Column col1 =
                  updatedTable1.getColumns().stream()
                      .filter(c -> c.getName().equals(sharedColumnName))
                      .findFirst()
                      .orElse(null);

              if (col1 == null) {
                return false;
              }

              if (!displayName.equals(col1.getDisplayName())) {
                return false;
              }

              if (!description.equals(col1.getDescription())) {
                return false;
              }

              if (col1.getTags() == null || col1.getTags().isEmpty()) {
                return false;
              }

              if (!col1.getTags().stream().anyMatch(t -> tagFqn.equals(t.getTagFQN()))) {
                return false;
              }

              Table updatedTable2 = getTableWithColumns(table2.getId().toString());
              Column col2 =
                  updatedTable2.getColumns().stream()
                      .filter(c -> c.getName().equals(sharedColumnName))
                      .findFirst()
                      .orElse(null);

              if (col2 == null) {
                return false;
              }

              if (!displayName.equals(col2.getDisplayName())) {
                return false;
              }

              if (!description.equals(col2.getDescription())) {
                return false;
              }

              if (col2.getTags() == null || col2.getTags().isEmpty()) {
                return false;
              }

              return col2.getTags().stream().anyMatch(t -> tagFqn.equals(t.getTagFQN()));
            });

    Table updatedTable2 = getTableWithColumns(table2.getId().toString());
    Column col2 =
        updatedTable2.getColumns().stream()
            .filter(c -> c.getName().equals(sharedColumnName))
            .findFirst()
            .orElseThrow();

    assertEquals(displayName, col2.getDisplayName(), "Table2 column should have displayName");
    assertEquals(description, col2.getDescription(), "Table2 column should have description");
    assertNotNull(col2.getTags(), "Table2 column should have tags");
    assertTrue(
        col2.getTags().stream().anyMatch(t -> tagFqn.equals(t.getTagFQN())),
        "Table2 column should have the PII.Sensitive tag");
  }

  @Test
  void test_bulkUpdateColumns_displayNameAndDescription(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    String columnName = "customer_id";
    Table table = createTestTable(ns, schema, "bulk_desc_table", columnName);
    assertNotNull(table.getId());

    String displayName = "Customer Identifier";
    String description = "Unique identifier for customers";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s.%s",
                  "entityType": "table",
                  "displayName": "%s",
                  "description": "%s"
                }
              ]
            }
            """,
            table.getFullyQualifiedName(), columnName, displayName, description);

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);

    assertEquals(200, response.statusCode(), "Bulk update should return 200");

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updatedTable = getTableWithColumns(table.getId().toString());
              Column col =
                  updatedTable.getColumns().stream()
                      .filter(c -> c.getName().equals(columnName))
                      .findFirst()
                      .orElse(null);

              return col != null
                  && displayName.equals(col.getDisplayName())
                  && description.equals(col.getDescription());
            });
  }

  @Test
  void test_bulkUpdateColumns_multipleColumnsInSameTable(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix("multi_col_table"));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("col1").withDataType(ColumnDataType.VARCHAR).withDataLength(100),
            new Column().withName("col2").withDataType(ColumnDataType.INT),
            new Column().withName("col3").withDataType(ColumnDataType.TIMESTAMP)));

    Table table = SdkClients.adminClient().tables().create(tableRequest);
    assertNotNull(table.getId());

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s.col1",
                  "entityType": "table",
                  "displayName": "Column One",
                  "description": "First column"
                },
                {
                  "columnFQN": "%s.col2",
                  "entityType": "table",
                  "displayName": "Column Two",
                  "description": "Second column"
                },
                {
                  "columnFQN": "%s.col3",
                  "entityType": "table",
                  "displayName": "Column Three",
                  "description": "Third column"
                }
              ]
            }
            """,
            table.getFullyQualifiedName(),
            table.getFullyQualifiedName(),
            table.getFullyQualifiedName());

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(200, response.statusCode());

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updatedTable = getTableWithColumns(table.getId().toString());

              Column c1 =
                  updatedTable.getColumns().stream()
                      .filter(c -> c.getName().equals("col1"))
                      .findFirst()
                      .orElse(null);
              Column c2 =
                  updatedTable.getColumns().stream()
                      .filter(c -> c.getName().equals("col2"))
                      .findFirst()
                      .orElse(null);
              Column c3 =
                  updatedTable.getColumns().stream()
                      .filter(c -> c.getName().equals("col3"))
                      .findFirst()
                      .orElse(null);

              return c1 != null
                  && "Column One".equals(c1.getDisplayName())
                  && c2 != null
                  && "Column Two".equals(c2.getDisplayName())
                  && c3 != null
                  && "Column Three".equals(c3.getDisplayName());
            });
  }

  // ===================================================================
  // GLOSSARY TERMS TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_withGlossaryTerms(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    GlossaryTerm customerDataTerm =
        createGlossaryAndTerm(client, ns, "BulkGlossaryA", "CustomerDataBulk");
    GlossaryTerm personalInfoTerm =
        createGlossaryAndTerm(client, ns, "BulkGlossaryB", "PersonalInfoBulk");

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    String columnName = "contact_email";
    Table table1 = createTestTable(ns, schema, "glossary_bulk_table1", columnName);
    Table table2 = createTestTable(ns, schema, "glossary_bulk_table2", columnName);

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s.%s",
                  "entityType": "table",
                  "displayName": "Contact Email",
                  "tags": [
                    {
                      "tagFQN": "%s",
                      "source": "Glossary",
                      "labelType": "Manual",
                      "state": "Confirmed"
                    }
                  ]
                },
                {
                  "columnFQN": "%s.%s",
                  "entityType": "table",
                  "displayName": "Contact Email",
                  "tags": [
                    {
                      "tagFQN": "%s",
                      "source": "Glossary",
                      "labelType": "Manual",
                      "state": "Confirmed"
                    }
                  ]
                }
              ]
            }
            """,
            table1.getFullyQualifiedName(),
            columnName,
            customerDataTerm.getFullyQualifiedName(),
            table2.getFullyQualifiedName(),
            columnName,
            personalInfoTerm.getFullyQualifiedName());

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(200, response.statusCode(), "Bulk update with glossary terms should return 200");

    JsonNode responseJson = OBJECT_MAPPER.readTree(response.body());
    assertNotNull(responseJson.get("jobId"), "Response should contain jobId");

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updatedTable1 = getTableWithColumns(table1.getId().toString());
              Column col1 =
                  updatedTable1.getColumns().stream()
                      .filter(c -> c.getName().equals(columnName))
                      .findFirst()
                      .orElse(null);

              if (col1 == null || col1.getTags() == null || col1.getTags().isEmpty()) {
                return false;
              }

              return col1.getTags().stream()
                  .anyMatch(
                      t ->
                          t.getTagFQN().equals(customerDataTerm.getFullyQualifiedName())
                              && t.getSource() == TagLabel.TagSource.GLOSSARY);
            });

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updatedTable2 = getTableWithColumns(table2.getId().toString());
              Column col2 =
                  updatedTable2.getColumns().stream()
                      .filter(c -> c.getName().equals(columnName))
                      .findFirst()
                      .orElse(null);

              if (col2 == null || col2.getTags() == null || col2.getTags().isEmpty()) {
                return false;
              }

              return col2.getTags().stream()
                  .anyMatch(
                      t ->
                          t.getTagFQN().equals(personalInfoTerm.getFullyQualifiedName())
                              && t.getSource() == TagLabel.TagSource.GLOSSARY);
            });
  }

  @Test
  void test_bulkUpdateColumns_mixedTagsAndGlossaryTerms(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Tag piiTag = createClassificationAndTag(client, ns, "BulkPIIClass", "SensitiveBulk");
    GlossaryTerm contactTerm =
        createGlossaryAndTerm(client, ns, "BulkMixedGlossary", "ContactBulk");

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    String columnName = "phone_number";
    Table table = createTestTable(ns, schema, "mixed_tags_table", columnName);

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s.%s",
                  "entityType": "table",
                  "displayName": "Phone Number",
                  "description": "User phone number - PII",
                  "tags": [
                    {
                      "tagFQN": "%s",
                      "source": "Classification",
                      "labelType": "Manual",
                      "state": "Confirmed"
                    },
                    {
                      "tagFQN": "%s",
                      "source": "Glossary",
                      "labelType": "Manual",
                      "state": "Confirmed"
                    }
                  ]
                }
              ]
            }
            """,
            table.getFullyQualifiedName(),
            columnName,
            piiTag.getFullyQualifiedName(),
            contactTerm.getFullyQualifiedName());

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(200, response.statusCode());

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updatedTable = getTableWithColumns(table.getId().toString());
              Column col =
                  updatedTable.getColumns().stream()
                      .filter(c -> c.getName().equals(columnName))
                      .findFirst()
                      .orElse(null);

              if (col == null
                  || col.getTags() == null
                  || col.getTags().size() < 2
                  || col.getDisplayName() == null) {
                return false;
              }

              boolean hasClassificationTag =
                  col.getTags().stream()
                      .anyMatch(t -> t.getSource() == TagLabel.TagSource.CLASSIFICATION);
              boolean hasGlossaryTag =
                  col.getTags().stream()
                      .anyMatch(t -> t.getSource() == TagLabel.TagSource.GLOSSARY);

              return hasClassificationTag && hasGlossaryTag;
            });

    Table updatedTable = getTableWithColumns(table.getId().toString());
    Column col =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals(columnName))
            .findFirst()
            .orElseThrow();

    assertEquals("Phone Number", col.getDisplayName());
    assertEquals("User phone number - PII", col.getDescription());
    assertEquals(
        2, col.getTags().size(), "Column should have both classification and glossary tags");
  }

  // ===================================================================
  // NESTED COLUMN TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_nestedStructColumns(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<Column> innerColumns =
        List.of(
            new Column().withName("first_name").withDataType(ColumnDataType.STRING),
            new Column().withName("last_name").withDataType(ColumnDataType.STRING));

    List<Column> columns =
        List.of(
            new Column()
                .withName("user_info")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(innerColumns));

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix("nested_struct_table"));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(columns);

    Table table = SdkClients.adminClient().tables().create(tableRequest);
    assertNotNull(table.getId());

    String nestedColumnFQN = table.getFullyQualifiedName() + ".user_info.first_name";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "displayName": "First Name",
                  "description": "User's first name"
                }
              ]
            }
            """,
            nestedColumnFQN);

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(200, response.statusCode(), "Bulk update on nested column should return 200");

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updatedTable = getTableWithColumns(table.getId().toString());
              Column userInfo =
                  updatedTable.getColumns().stream()
                      .filter(c -> c.getName().equals("user_info"))
                      .findFirst()
                      .orElse(null);

              if (userInfo == null || userInfo.getChildren() == null) {
                return false;
              }

              Column firstName =
                  userInfo.getChildren().stream()
                      .filter(c -> c.getName().equals("first_name"))
                      .findFirst()
                      .orElse(null);

              return firstName != null
                  && "First Name".equals(firstName.getDisplayName())
                  && "User's first name".equals(firstName.getDescription());
            });
  }

  @Test
  void test_bulkUpdateColumns_deeplyNestedColumns(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<Column> level3Columns =
        List.of(new Column().withName("street").withDataType(ColumnDataType.STRING));

    List<Column> level2Columns =
        List.of(
            new Column()
                .withName("address")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(level3Columns));

    List<Column> level1Columns =
        List.of(
            new Column()
                .withName("contact")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(level2Columns));

    List<Column> columns =
        List.of(
            new Column()
                .withName("customer")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(level1Columns));

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix("deep_nested_table"));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(columns);

    Table table = SdkClients.adminClient().tables().create(tableRequest);
    assertNotNull(table.getId());

    String deepNestedColumnFQN = table.getFullyQualifiedName() + ".customer.contact.address.street";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "displayName": "Street Address",
                  "description": "Customer's street address"
                }
              ]
            }
            """,
            deepNestedColumnFQN);

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(
        200, response.statusCode(), "Bulk update on deeply nested column should return 200");

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updatedTable = getTableWithColumns(table.getId().toString());
              Column customer =
                  updatedTable.getColumns().stream()
                      .filter(c -> c.getName().equals("customer"))
                      .findFirst()
                      .orElse(null);

              if (customer == null || customer.getChildren() == null) {
                return false;
              }

              Column contact =
                  customer.getChildren().stream()
                      .filter(c -> c.getName().equals("contact"))
                      .findFirst()
                      .orElse(null);

              if (contact == null || contact.getChildren() == null) {
                return false;
              }

              Column address =
                  contact.getChildren().stream()
                      .filter(c -> c.getName().equals("address"))
                      .findFirst()
                      .orElse(null);

              if (address == null || address.getChildren() == null) {
                return false;
              }

              Column street =
                  address.getChildren().stream()
                      .filter(c -> c.getName().equals("street"))
                      .findFirst()
                      .orElse(null);

              return street != null
                  && "Street Address".equals(street.getDisplayName())
                  && "Customer's street address".equals(street.getDescription());
            });
  }

  @Test
  void test_bulkUpdateColumns_multipleNestedColumns(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<Column> innerColumns =
        List.of(
            new Column().withName("email").withDataType(ColumnDataType.STRING),
            new Column().withName("phone").withDataType(ColumnDataType.STRING));

    List<Column> columns =
        List.of(
            new Column()
                .withName("contact_info")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(innerColumns));

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix("multi_nested_table"));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(columns);

    Table table = SdkClients.adminClient().tables().create(tableRequest);

    String emailFQN = table.getFullyQualifiedName() + ".contact_info.email";
    String phoneFQN = table.getFullyQualifiedName() + ".contact_info.phone";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "displayName": "Email Address",
                  "description": "Contact email"
                },
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "displayName": "Phone Number",
                  "description": "Contact phone"
                }
              ]
            }
            """,
            emailFQN, phoneFQN);

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(200, response.statusCode());

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updatedTable = getTableWithColumns(table.getId().toString());
              Column contactInfo =
                  updatedTable.getColumns().stream()
                      .filter(c -> c.getName().equals("contact_info"))
                      .findFirst()
                      .orElse(null);

              if (contactInfo == null || contactInfo.getChildren() == null) {
                return false;
              }

              Column email =
                  contactInfo.getChildren().stream()
                      .filter(c -> c.getName().equals("email"))
                      .findFirst()
                      .orElse(null);

              Column phone =
                  contactInfo.getChildren().stream()
                      .filter(c -> c.getName().equals("phone"))
                      .findFirst()
                      .orElse(null);

              return email != null
                  && "Email Address".equals(email.getDisplayName())
                  && phone != null
                  && "Phone Number".equals(phone.getDisplayName());
            });
  }

  // ===================================================================
  // DASHBOARD DATA MODEL COLUMN TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_dashboardDataModelColumn(TestNamespace ns) throws Exception {
    DashboardDataModel dataModel = createTestDashboardDataModel(ns);
    assertNotNull(dataModel.getId());

    String columnFQN = dataModel.getFullyQualifiedName() + ".metric1";
    String displayName = "Revenue Metric";
    String description = "Total revenue metric for analysis";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "dashboardDataModel",
                  "displayName": "%s",
                  "description": "%s"
                }
              ]
            }
            """,
            columnFQN, displayName, description);

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(
        200, response.statusCode(), "Bulk update on dashboard data model column should return 200");

    JsonNode responseJson = OBJECT_MAPPER.readTree(response.body());
    assertNotNull(responseJson.get("jobId"), "Response should contain jobId");

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              DashboardDataModel updated =
                  getDashboardDataModelWithColumns(dataModel.getId().toString());
              Column col =
                  updated.getColumns().stream()
                      .filter(c -> c.getName().equals("metric1"))
                      .findFirst()
                      .orElse(null);

              return col != null
                  && displayName.equals(col.getDisplayName())
                  && description.equals(col.getDescription());
            });
  }

  @Test
  void test_bulkUpdateColumns_dashboardDataModelWithTags(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Tag businessTag = createClassificationAndTag(client, ns, "BusinessMetrics", "RevenueTag");

    DashboardDataModel dataModel = createTestDashboardDataModel(ns);
    String columnFQN = dataModel.getFullyQualifiedName() + ".dimension1";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "dashboardDataModel",
                  "displayName": "Customer Dimension",
                  "tags": [
                    {
                      "tagFQN": "%s",
                      "source": "Classification",
                      "labelType": "Manual",
                      "state": "Confirmed"
                    }
                  ]
                }
              ]
            }
            """,
            columnFQN, businessTag.getFullyQualifiedName());

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(200, response.statusCode());

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              DashboardDataModel updated =
                  getDashboardDataModelWithColumns(dataModel.getId().toString());
              Column col =
                  updated.getColumns().stream()
                      .filter(c -> c.getName().equals("dimension1"))
                      .findFirst()
                      .orElse(null);

              return col != null
                  && col.getTags() != null
                  && col.getTags().stream()
                      .anyMatch(t -> t.getTagFQN().equals(businessTag.getFullyQualifiedName()));
            });
  }

  // ===================================================================
  // TAG/METADATA REMOVAL TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_removeExistingTags(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Tag initialTag = createClassificationAndTag(client, ns, "RemovalTestClass", "InitialTag");

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = createTestTable(ns, schema, "tag_removal_table", "test_col");

    String columnFQN = table.getFullyQualifiedName() + ".test_col";
    String addTagRequest =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "tags": [
                    {
                      "tagFQN": "%s",
                      "source": "Classification",
                      "labelType": "Manual",
                      "state": "Confirmed"
                    }
                  ]
                }
              ]
            }
            """,
            columnFQN, initialTag.getFullyQualifiedName());

    callBulkUpdateAsync(addTagRequest);

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updated = getTableWithColumns(table.getId().toString());
              Column col =
                  updated.getColumns().stream()
                      .filter(c -> c.getName().equals("test_col"))
                      .findFirst()
                      .orElse(null);
              return col != null && col.getTags() != null && !col.getTags().isEmpty();
            });

    String removeTagRequest =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "tags": []
                }
              ]
            }
            """,
            columnFQN);

    HttpResponse<String> response = callBulkUpdateAsync(removeTagRequest);
    assertEquals(200, response.statusCode());

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updated = getTableWithColumns(table.getId().toString());
              Column col =
                  updated.getColumns().stream()
                      .filter(c -> c.getName().equals("test_col"))
                      .findFirst()
                      .orElse(null);
              return col != null && (col.getTags() == null || col.getTags().isEmpty());
            });
  }

  @Test
  void test_bulkUpdateColumns_clearDescription(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = createTestTable(ns, schema, "clear_desc_table", "test_col");

    String columnFQN = table.getFullyQualifiedName() + ".test_col";

    String addDescRequest =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "description": "Initial description"
                }
              ]
            }
            """,
            columnFQN);

    callBulkUpdateAsync(addDescRequest);

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updated = getTableWithColumns(table.getId().toString());
              Column col =
                  updated.getColumns().stream()
                      .filter(c -> c.getName().equals("test_col"))
                      .findFirst()
                      .orElse(null);
              return col != null && "Initial description".equals(col.getDescription());
            });

    String clearDescRequest =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "description": ""
                }
              ]
            }
            """,
            columnFQN);

    HttpResponse<String> response = callBulkUpdateAsync(clearDescRequest);
    assertEquals(200, response.statusCode());

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updated = getTableWithColumns(table.getId().toString());
              Column col =
                  updated.getColumns().stream()
                      .filter(c -> c.getName().equals("test_col"))
                      .findFirst()
                      .orElse(null);
              return col != null
                  && (col.getDescription() == null || col.getDescription().isEmpty());
            });
  }

  // ===================================================================
  // TAG REPLACEMENT BEHAVIOR TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_tagReplacesExisting(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Tag tag1 = createClassificationAndTag(client, ns, "ReplaceClass1", "Tag1");
    Tag tag2 = createClassificationAndTag(client, ns, "ReplaceClass2", "Tag2");

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = createTestTable(ns, schema, "tag_replace_table", "test_col");

    String columnFQN = table.getFullyQualifiedName() + ".test_col";

    String addTag1Request =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "tags": [
                    {
                      "tagFQN": "%s",
                      "source": "Classification",
                      "labelType": "Manual",
                      "state": "Confirmed"
                    }
                  ]
                }
              ]
            }
            """,
            columnFQN, tag1.getFullyQualifiedName());

    callBulkUpdateAsync(addTag1Request);

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updated = getTableWithColumns(table.getId().toString());
              Column col =
                  updated.getColumns().stream()
                      .filter(c -> c.getName().equals("test_col"))
                      .findFirst()
                      .orElse(null);
              return col != null
                  && col.getTags() != null
                  && col.getTags().stream()
                      .anyMatch(t -> t.getTagFQN().equals(tag1.getFullyQualifiedName()));
            });

    String replaceTagRequest =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "tags": [
                    {
                      "tagFQN": "%s",
                      "source": "Classification",
                      "labelType": "Manual",
                      "state": "Confirmed"
                    }
                  ]
                }
              ]
            }
            """,
            columnFQN, tag2.getFullyQualifiedName());

    HttpResponse<String> response = callBulkUpdateAsync(replaceTagRequest);
    assertEquals(200, response.statusCode());

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updated = getTableWithColumns(table.getId().toString());
              Column col =
                  updated.getColumns().stream()
                      .filter(c -> c.getName().equals("test_col"))
                      .findFirst()
                      .orElse(null);
              if (col == null || col.getTags() == null) {
                return false;
              }
              boolean hasTag2 =
                  col.getTags().stream()
                      .anyMatch(t -> t.getTagFQN().equals(tag2.getFullyQualifiedName()));
              boolean hasTag1 =
                  col.getTags().stream()
                      .anyMatch(t -> t.getTagFQN().equals(tag1.getFullyQualifiedName()));
              return hasTag2 && !hasTag1;
            });
  }

  // ===================================================================
  // VALIDATION TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_nonExistentTagFQN(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = createTestTable(ns, schema, "nonexistent_tag_table", "test_col");

    String columnFQN = table.getFullyQualifiedName() + ".test_col";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "tags": [
                    {
                      "tagFQN": "NonExistent.FakeTag",
                      "source": "Classification",
                      "labelType": "Manual",
                      "state": "Confirmed"
                    }
                  ]
                }
              ]
            }
            """,
            columnFQN);

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);

    assertEquals(200, response.statusCode(), "Async API accepts the request");

    JsonNode responseJson = OBJECT_MAPPER.readTree(response.body());
    assertNotNull(responseJson.get("jobId"), "Response should contain jobId for async processing");
  }

  @Test
  void test_bulkUpdateColumns_nonExistentGlossaryTermFQN(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = createTestTable(ns, schema, "nonexistent_glossary_table", "test_col");

    String columnFQN = table.getFullyQualifiedName() + ".test_col";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "tags": [
                    {
                      "tagFQN": "NonExistentGlossary.FakeTerm",
                      "source": "Glossary",
                      "labelType": "Manual",
                      "state": "Confirmed"
                    }
                  ]
                }
              ]
            }
            """,
            columnFQN);

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(200, response.statusCode(), "Async API accepts the request");
  }

  // ===================================================================
  // LARGE BATCH UPDATE TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_largeBatch(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<Column> manyColumns = new ArrayList<>();
    for (int i = 0; i < 50; i++) {
      manyColumns.add(
          new Column()
              .withName("col_" + i)
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(100));
    }

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix("large_batch_table"));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(manyColumns);

    Table table = SdkClients.adminClient().tables().create(tableRequest);
    assertNotNull(table.getId());

    StringBuilder updatesJson = new StringBuilder();
    updatesJson.append("{\"columnUpdates\": [");
    for (int i = 0; i < 50; i++) {
      if (i > 0) {
        updatesJson.append(",");
      }
      updatesJson.append(
          String.format(
              """
              {
                "columnFQN": "%s.col_%d",
                "entityType": "table",
                "displayName": "Column %d",
                "description": "Description for column %d"
              }
              """,
              table.getFullyQualifiedName(), i, i, i));
    }
    updatesJson.append("]}");

    HttpResponse<String> response = callBulkUpdateAsync(updatesJson.toString());
    assertEquals(200, response.statusCode(), "Large batch update should return 200");

    JsonNode responseJson = OBJECT_MAPPER.readTree(response.body());
    assertNotNull(responseJson.get("jobId"), "Response should contain jobId");

    Awaitility.await()
        .pollInterval(2, TimeUnit.SECONDS)
        .atMost(60, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updated = getTableWithColumns(table.getId().toString());
              long updatedCount =
                  updated.getColumns().stream()
                      .filter(
                          c ->
                              c.getDisplayName() != null && c.getDisplayName().startsWith("Column"))
                      .count();
              return updatedCount >= 25;
            });
  }

  // ===================================================================
  // CROSS-ENTITY UPDATE TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_acrossDifferentServices(TestNamespace ns) throws Exception {
    DatabaseService service1 = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema1 = DatabaseSchemaTestFactory.createSimple(ns, service1);
    Table table1 = createTestTable(ns, schema1, "service1_table", "shared_col");

    DatabaseService service2 = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema2 = DatabaseSchemaTestFactory.createSimple(ns, service2);
    Table table2 = createTestTable(ns, schema2, "service2_table", "shared_col");

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s.shared_col",
                  "entityType": "table",
                  "displayName": "Shared Column Service 1",
                  "description": "From service 1"
                },
                {
                  "columnFQN": "%s.shared_col",
                  "entityType": "table",
                  "displayName": "Shared Column Service 2",
                  "description": "From service 2"
                }
              ]
            }
            """,
            table1.getFullyQualifiedName(), table2.getFullyQualifiedName());

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(200, response.statusCode());

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updated1 = getTableWithColumns(table1.getId().toString());
              Table updated2 = getTableWithColumns(table2.getId().toString());

              Column col1 =
                  updated1.getColumns().stream()
                      .filter(c -> c.getName().equals("shared_col"))
                      .findFirst()
                      .orElse(null);
              Column col2 =
                  updated2.getColumns().stream()
                      .filter(c -> c.getName().equals("shared_col"))
                      .findFirst()
                      .orElse(null);

              return col1 != null
                  && "Shared Column Service 1".equals(col1.getDisplayName())
                  && col2 != null
                  && "Shared Column Service 2".equals(col2.getDisplayName());
            });
  }

  // ===================================================================
  // CONCURRENT/DUPLICATE UPDATE TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_duplicateColumnInRequest(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = createTestTable(ns, schema, "duplicate_col_table", "test_col");

    String columnFQN = table.getFullyQualifiedName() + ".test_col";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "displayName": "First Update",
                  "description": "First description"
                },
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "displayName": "Second Update",
                  "description": "Second description"
                }
              ]
            }
            """,
            columnFQN, columnFQN);

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(200, response.statusCode(), "Request with duplicate FQN should be accepted");

    JsonNode responseJson = OBJECT_MAPPER.readTree(response.body());
    assertNotNull(responseJson.get("jobId"), "Response should contain jobId");
  }

  // ===================================================================
  // SPECIAL CHARACTERS TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_specialCharactersInDescription(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = createTestTable(ns, schema, "special_chars_table", "test_col");

    String columnFQN = table.getFullyQualifiedName() + ".test_col";
    String specialDescription =
        "Description with <b>HTML</b> tags, \"quotes\", and special chars: é, ñ, 日本語";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "displayName": "Special Column™",
                  "description": "%s"
                }
              ]
            }
            """,
            columnFQN, specialDescription.replace("\"", "\\\""));

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(200, response.statusCode());

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updated = getTableWithColumns(table.getId().toString());
              Column col =
                  updated.getColumns().stream()
                      .filter(c -> c.getName().equals("test_col"))
                      .findFirst()
                      .orElse(null);
              return col != null && col.getDisplayName() != null;
            });
  }

  @Test
  void test_bulkUpdateColumns_unicodeDisplayName(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = createTestTable(ns, schema, "unicode_table", "test_col");

    String columnFQN = table.getFullyQualifiedName() + ".test_col";
    String unicodeDisplayName = "客户数据 (Customer Data)";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "displayName": "%s",
                  "description": "Column with unicode display name"
                }
              ]
            }
            """,
            columnFQN, unicodeDisplayName);

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(200, response.statusCode());

    Awaitility.await()
        .pollInterval(1, TimeUnit.SECONDS)
        .atMost(30, TimeUnit.SECONDS)
        .until(
            () -> {
              Table updated = getTableWithColumns(table.getId().toString());
              Column col =
                  updated.getColumns().stream()
                      .filter(c -> c.getName().equals("test_col"))
                      .findFirst()
                      .orElse(null);
              return col != null && unicodeDisplayName.equals(col.getDisplayName());
            });
  }

  // ===================================================================
  // JOB STATUS VERIFICATION TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_verifyJobIdReturned(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = createTestTable(ns, schema, "job_status_table", "test_col");

    String columnFQN = table.getFullyQualifiedName() + ".test_col";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "displayName": "Job Test Column"
                }
              ]
            }
            """,
            columnFQN);

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);
    assertEquals(200, response.statusCode());

    JsonNode responseJson = OBJECT_MAPPER.readTree(response.body());
    assertNotNull(responseJson.get("jobId"), "Response must contain jobId");

    String jobId = responseJson.get("jobId").asText();
    assertFalse(jobId.isEmpty(), "jobId should not be empty");
  }

  // ===================================================================
  // PERMISSION TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_withDataConsumerToken(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = createTestTable(ns, schema, "permission_table", "test_col");

    String columnFQN = table.getFullyQualifiedName() + ".test_col";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "displayName": "Permission Test"
                }
              ]
            }
            """,
            columnFQN);

    String dataConsumerToken =
        JwtAuthProvider.tokenFor(
            "data-consumer@open-metadata.org",
            "data-consumer@open-metadata.org",
            new String[] {"DataConsumer"},
            3600);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/columns/bulk-update-async"))
            .header("Authorization", "Bearer " + dataConsumerToken)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertTrue(
        response.statusCode() == 200 || response.statusCode() == 403,
        "DataConsumer should either succeed or get forbidden based on permissions");
  }

  @Test
  void test_bulkUpdateColumns_withoutAuthToken(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = createTestTable(ns, schema, "no_auth_table", "test_col");

    String columnFQN = table.getFullyQualifiedName() + ".test_col";

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s",
                  "entityType": "table",
                  "displayName": "No Auth Test"
                }
              ]
            }
            """,
            columnFQN);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/columns/bulk-update-async"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertEquals(401, response.statusCode(), "Request without auth should return 401 Unauthorized");
  }

  // ===================================================================
  // ERROR HANDLING TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_emptyRequest_acceptedByAsyncAPI(TestNamespace ns) throws Exception {
    String requestBody = "{}";

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);

    assertEquals(
        200, response.statusCode(), "Async API accepts empty request (processes asynchronously)");

    JsonNode responseJson = OBJECT_MAPPER.readTree(response.body());
    assertNotNull(responseJson.get("jobId"), "Response should contain jobId");
  }

  @Test
  void test_bulkUpdateColumns_emptyColumnUpdates_acceptedByAsyncAPI(TestNamespace ns)
      throws Exception {
    String requestBody =
        """
            {
              "columnUpdates": []
            }
            """;

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);

    assertEquals(
        200,
        response.statusCode(),
        "Async API accepts empty columnUpdates (processes asynchronously)");

    JsonNode responseJson = OBJECT_MAPPER.readTree(response.body());
    assertNotNull(responseJson.get("jobId"), "Response should contain jobId");
  }

  @Test
  void test_bulkUpdateColumns_invalidColumnFQN(TestNamespace ns) throws Exception {
    String requestBody =
        """
            {
              "columnUpdates": [
                {
                  "columnFQN": "nonexistent.service.database.schema.table.column",
                  "entityType": "table",
                  "displayName": "Should Fail"
                }
              ]
            }
            """;

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);

    assertEquals(200, response.statusCode(), "Async API should accept the request");

    JsonNode responseJson = OBJECT_MAPPER.readTree(response.body());
    assertNotNull(responseJson.get("jobId"), "Response should still contain jobId");
  }

  @Test
  void test_bulkUpdateColumns_missingEntityType(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Table table = createTestTable(ns, schema, "missing_entity_type_table", "test_col");

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s.test_col",
                  "displayName": "Test Column"
                }
              ]
            }
            """,
            table.getFullyQualifiedName());

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);

    assertTrue(
        response.statusCode() == 200 || response.statusCode() == 400,
        "Request should either succeed with default entity type or fail validation");
  }

  @Test
  void test_bulkUpdateColumns_invalidEntityType(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Table table = createTestTable(ns, schema, "invalid_entity_type_table", "test_col");

    String requestBody =
        String.format(
            """
            {
              "columnUpdates": [
                {
                  "columnFQN": "%s.test_col",
                  "entityType": "invalidType",
                  "displayName": "Test Column"
                }
              ]
            }
            """,
            table.getFullyQualifiedName());

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);

    assertEquals(200, response.statusCode(), "Async API should accept the request");
  }

  // ===================================================================
  // SEARCH-BASED BULK UPDATE TESTS
  // ===================================================================

  @Test
  void test_bulkUpdateColumns_searchBased(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    String sharedColumnName = "status_code";

    createTestTable(ns, schema, "search_table1", sharedColumnName);
    createTestTable(ns, schema, "search_table2", sharedColumnName);
    createTestTable(ns, schema, "search_table3", sharedColumnName);

    String displayName = "HTTP Status Code";
    String description = "Standard HTTP response status code";

    String requestBody =
        String.format(
            """
            {
              "columnName": "%s",
              "displayName": "%s",
              "description": "%s"
            }
            """,
            sharedColumnName, displayName, description);

    HttpResponse<String> response = callBulkUpdateAsync(requestBody);

    assertEquals(200, response.statusCode(), "Search-based bulk update should return 200");

    JsonNode responseJson = OBJECT_MAPPER.readTree(response.body());
    assertNotNull(responseJson.get("jobId"), "Response should contain jobId");
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private Table createTestTable(
      TestNamespace ns, DatabaseSchema schema, String baseName, String columnName) {
    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column()
                .withName(columnName)
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private DashboardDataModel createTestDashboardDataModel(TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createLooker(ns);

    List<Column> columns =
        Arrays.asList(
            new Column().withName("metric1").withDataType(ColumnDataType.BIGINT),
            new Column()
                .withName("dimension1")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(256));

    CreateDashboardDataModel request =
        new CreateDashboardDataModel()
            .withName(ns.prefix("testDataModel"))
            .withDescription("Test data model for bulk column operations")
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    return SdkClients.adminClient().dashboardDataModels().create(request);
  }

  private GlossaryTerm createGlossaryAndTerm(
      OpenMetadataClient client, TestNamespace ns, String glossaryName, String termName) {
    Glossary glossary = createGlossary(client, ns, glossaryName);
    return createGlossaryTerm(client, glossary, ns, termName);
  }

  private Glossary createGlossary(
      OpenMetadataClient client, TestNamespace ns, String glossaryName) {
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName(ns.prefix(glossaryName))
            .withDescription("Test glossary for " + glossaryName);
    return client.glossaries().create(createGlossary);
  }

  private GlossaryTerm createGlossaryTerm(
      OpenMetadataClient client, Glossary glossary, TestNamespace ns, String termName) {
    CreateGlossaryTerm createGlossaryTerm =
        new CreateGlossaryTerm()
            .withName(ns.prefix(termName))
            .withDescription("Test term: " + termName)
            .withGlossary(glossary.getFullyQualifiedName());
    return client.glossaryTerms().create(createGlossaryTerm);
  }

  private Tag createClassificationAndTag(
      OpenMetadataClient client, TestNamespace ns, String classificationName, String tagName) {
    Classification classification = createClassification(client, ns, classificationName);
    return createTag(client, classification, ns, tagName);
  }

  private Classification createClassification(
      OpenMetadataClient client, TestNamespace ns, String classificationName) {
    CreateClassification createClassification =
        new CreateClassification()
            .withName(ns.prefix(classificationName))
            .withDescription("Test classification for " + classificationName);
    return client.classifications().create(createClassification);
  }

  private Tag createTag(
      OpenMetadataClient client, Classification classification, TestNamespace ns, String tagName) {
    CreateTag createTag =
        new CreateTag()
            .withName(ns.prefix(tagName))
            .withDescription("Test tag: " + tagName)
            .withClassification(classification.getFullyQualifiedName());
    return client.tags().create(createTag);
  }

  private HttpResponse<String> callBulkUpdateAsync(String requestBody) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/columns/bulk-update-async"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private Table getTableWithColumns(String tableId) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl() + "/v1/tables/" + tableId + "?fields=columns,tags"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    return OBJECT_MAPPER.readValue(response.body(), Table.class);
  }

  private DashboardDataModel getDashboardDataModelWithColumns(String dataModelId) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl()
                        + "/v1/dashboard/datamodels/"
                        + dataModelId
                        + "?fields=columns,tags"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    return OBJECT_MAPPER.readValue(response.body(), DashboardDataModel.class);
  }
}
