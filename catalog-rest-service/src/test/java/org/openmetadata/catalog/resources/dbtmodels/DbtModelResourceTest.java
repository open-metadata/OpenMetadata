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

package org.openmetadata.catalog.resources.dbtmodels;

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateDatabase;
import org.openmetadata.catalog.api.data.CreateDbtModel;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.DbtModel;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.DbtModelRepository.DbtModelEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.databases.DatabaseResourceTest;
import org.openmetadata.catalog.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.catalog.resources.tags.TagResourceTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.ColumnConstraint;
import org.openmetadata.catalog.type.ColumnDataType;
import org.openmetadata.catalog.type.DbtNodeType;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static java.util.Collections.singletonList;
import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.type.ColumnDataType.ARRAY;
import static org.openmetadata.catalog.type.ColumnDataType.BIGINT;
import static org.openmetadata.catalog.type.ColumnDataType.BINARY;
import static org.openmetadata.catalog.type.ColumnDataType.CHAR;
import static org.openmetadata.catalog.type.ColumnDataType.FLOAT;
import static org.openmetadata.catalog.type.ColumnDataType.INT;
import static org.openmetadata.catalog.type.ColumnDataType.STRUCT;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.UpdateType;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MAJOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.userAuthHeaders;


@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class DbtModelResourceTest extends EntityResourceTest<DbtModel> {
  public static Database DATABASE;

  public static final List<Column> COLUMNS = Arrays.asList(
          getColumn("c1", BIGINT, USER_ADDRESS_TAG_LABEL),
          getColumn("c2", ColumnDataType.VARCHAR, USER_ADDRESS_TAG_LABEL).withDataLength(10),
          getColumn("c3", BIGINT, USER_BANK_ACCOUNT_TAG_LABEL));


  public DbtModelResourceTest() {
    super(Entity.DBTMODEL, DbtModel.class, DbtModelResource.DbtModelList.class,
        "dbtmodels", DbtModelResource.FIELDS, true, true, true);
  }

  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    EntityResourceTest.setup(test);
    DatabaseResourceTest databaseResourceTest = new DatabaseResourceTest();
    CreateDatabase create = databaseResourceTest.create(test).withService(SNOWFLAKE_REFERENCE);
    DATABASE = databaseResourceTest.createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  public void post_DbtModelInvalidArrayColumn_400(TestInfo test) {
    // No arrayDataType passed for array
    List<Column> columns = singletonList(getColumn("c1", ARRAY, "array<int>", null));
    CreateDbtModel create = create(test).withColumns(columns);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "For column data type array, arrayDataType must not be null");

    // No dataTypeDisplay passed for array
    columns.get(0).withArrayDataType(INT).withDataTypeDisplay(null);
    exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST,
            "For column data type array, dataTypeDisplay must be of type array<arrayDataType>");
  }

  @Test
  public void post_duplicateColumnName_400(TestInfo test) {
    // Duplicate column names c1
    String repeatedColumnName = "c1";
    List<Column> columns = Arrays.asList(getColumn(repeatedColumnName, ARRAY, "array<int>", null),
            getColumn(repeatedColumnName, INT, null));
    CreateDbtModel create = create(test).withColumns(columns);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, String.format("Column name %s is repeated", repeatedColumnName));
  }

  @Test
  public void post_validDbtModels_200_OK(TestInfo test) throws IOException {
    // Create DbtModel with different optional fields
    // Optional field description
    CreateDbtModel create = create(test).withDescription("description");
    createAndCheckEntity(create, adminAuthHeaders());

    // Optional fields nodeType
    create.withName(getEntityName(test, 1)).withDbtNodeType(DbtNodeType.Model);
    DbtModel dbtModel = createAndCheckEntity(create, adminAuthHeaders());

    // check the FQN
    Database db = new DatabaseResourceTest().getEntity(dbtModel.getDatabase().getId(), null, adminAuthHeaders());
    String expectedFQN = db.getFullyQualifiedName()+"."+dbtModel.getName();
    assertEquals(expectedFQN, expectedFQN);
  }

  private static Column getColumn(String name, ColumnDataType columnDataType, TagLabel tag) {
    return getColumn(name, columnDataType, null, tag);
  }

  private static Column getColumn(String name, ColumnDataType columnDataType, String dataTypeDisplay, TagLabel tag) {
    List<TagLabel> tags = tag == null ? new ArrayList<>() : singletonList(tag);
    return new Column().withName(name).withDataType(columnDataType).withDescription(name)
            .withDataTypeDisplay(dataTypeDisplay).withTags(tags);
  }

  @Test
  public void post_put_patch_complexColumnTypes(TestInfo test) throws IOException {
    Column c1 = getColumn("c1", ARRAY, "array<int>", USER_ADDRESS_TAG_LABEL).withArrayDataType(INT);
    Column c2_a = getColumn("a", INT, USER_ADDRESS_TAG_LABEL);
    Column c2_b = getColumn("b", CHAR, USER_ADDRESS_TAG_LABEL);
    Column c2_c_d = getColumn("d", INT, USER_ADDRESS_TAG_LABEL);
    Column c2_c = getColumn("c", STRUCT, "struct<int: d>>", USER_ADDRESS_TAG_LABEL)
            .withChildren(new ArrayList<>(singletonList(c2_c_d)));
    String viewDefinition1 = "select * from dim_customer";
    String viewDefinition2 = "select * from raw_customer";

    // Column struct<a: int, b:char, c: struct<int: d>>>
    Column c2 = getColumn("c2", STRUCT, "struct<a: int, b:string, c: struct<int: d>>",
            USER_BANK_ACCOUNT_TAG_LABEL) .withChildren(new ArrayList<>(Arrays.asList(c2_a, c2_b, c2_c)));

    // Test POST operation can create complex types
    // c1 array<int>
    // c2 struct<a: int, b:string, c: struct<int:d>>
    //   c2.a int
    //   c2.b char
    //   c2.c struct<int: d>>
    //     c2.c.d int
    CreateDbtModel create1 = create(test, 1).withColumns(Arrays.asList(c1, c2))
        .withViewDefinition(viewDefinition1);
    DbtModel dbtModel1 = createAndCheckEntity(create1, adminAuthHeaders());

    // Test PUT operation - put operation to create
    CreateDbtModel create2 = create(test, 2).withColumns(Arrays.asList(c1, c2))
        .withName("put_complexColumnType").withViewDefinition(viewDefinition2);
    DbtModel dbtModel2 = updateAndCheckEntity(create2, CREATED, adminAuthHeaders(), UpdateType.CREATED, null);
    assertEquals(viewDefinition2, dbtModel2.getViewDefinition());
    // Test PUT operation again without any change
    ChangeDescription change = getChangeDescription(dbtModel2.getVersion());
    updateAndCheckEntity(create2, Status.OK, adminAuthHeaders(), NO_CHANGE, change);
    //
    // Update the complex columns
    //
    // c1 from array<int> to array<char> - Data type change means old c1 deleted, and new c1 added
    change = getChangeDescription(dbtModel2.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("columns").withOldValue(List.of(c1)));
    Column c1_new = getColumn("c1", ARRAY, "array<int>", USER_ADDRESS_TAG_LABEL)
            .withArrayDataType(CHAR);
    change.getFieldsAdded().add(new FieldChange().withName("columns").withNewValue(List.of(c1_new)));

    // c2 from
    // struct<a:int, b:char, c:struct<d:int>>>
    // to
    // struct<-----, b:char, c:struct<d:int, e:char>, f:char>
    c2_b.withTags(List.of(USER_ADDRESS_TAG_LABEL, USER_BANK_ACCOUNT_TAG_LABEL)); // Add new tag to c2.b tag
    change.getFieldsAdded().add(new FieldChange().withName("columns.c2.b.tags")
            .withNewValue(List.of(USER_BANK_ACCOUNT_TAG_LABEL)));

    Column c2_c_e = getColumn("e", INT,USER_ADDRESS_TAG_LABEL);
    c2_c.getChildren().add(c2_c_e); // Add c2.c.e
    change.getFieldsAdded().add(new FieldChange().withName("columns.c2.c")
            .withNewValue(List.of(c2_c_e)));

    change.getFieldsDeleted().add(new FieldChange().withName("columns.c2")
            .withOldValue(List.of(c2.getChildren().get(0))));
    c2.getChildren().remove(0); // Remove c2.a from struct

    Column c2_f = getColumn("f", CHAR, USER_ADDRESS_TAG_LABEL);
    c2.getChildren().add(c2_f); // Add c2.f
    create2 = create2.withColumns(Arrays.asList(c1_new, c2));
    change.getFieldsAdded().add(new FieldChange().withName("columns.c2").withNewValue(List.of(c2_f)));

    // Update the columns with PUT operation and validate update
    // c1 array<int>                                   --> c1 array<chart
    // c2 struct<a: int, b:string, c: struct<int:d>>   --> c2 struct<b:char, c:struct<d:int, e:char>, f:char>
    //   c2.a int                                      --> DELETED
    //   c2.b char                                     --> SAME
    //   c2.c struct<int: d>>
    //     c2.c.d int
    updateAndCheckEntity(create2.withName("put_complexColumnType"), Status.OK,
            adminAuthHeaders(), MAJOR_UPDATE, change);

    //
    // Patch operations on DbtModel1 created by POST operation. Columns can't be added or deleted. Only tags and
    // description can be changed
    //
    String dbtModelJson = JsonUtils.pojoToJson(dbtModel1);
    c1 = dbtModel1.getColumns().get(0);
    c1.withTags(singletonList(USER_BANK_ACCOUNT_TAG_LABEL)); // c1 tag changed

    c2 = dbtModel1.getColumns().get(1);
    c2.withTags(Arrays.asList(USER_ADDRESS_TAG_LABEL, USER_BANK_ACCOUNT_TAG_LABEL)); // c2 new tag added

    c2_a = c2.getChildren().get(0);
    c2_a.withTags(singletonList(USER_BANK_ACCOUNT_TAG_LABEL)); // c2.a tag changed

    c2_b = c2.getChildren().get(1);
    c2_b.withTags(new ArrayList<>()); // c2.b tag removed

    c2_c = c2.getChildren().get(2);
    c2_c.withTags(new ArrayList<>()); // c2.c tag removed

    c2_c_d = c2_c.getChildren().get(0);
    c2_c_d.setTags(singletonList(USER_BANK_ACCOUNT_TAG_LABEL)); // c2.c.d new tag added
    dbtModel1 = patchEntity(dbtModel1.getId(), dbtModelJson, dbtModel1, adminAuthHeaders());
    assertColumns(Arrays.asList(c1, c2), dbtModel1.getColumns());
    assertEquals(viewDefinition1, dbtModel1.getViewDefinition());
    String dbtModelJson1 = JsonUtils.pojoToJson(dbtModel1);
    LOG.info(dbtModelJson1);
  }

  @Test
  public void post_DbtModelWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_DbtModelWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_DbtModelWithInvalidDatabase_404(TestInfo test) {
    CreateDbtModel create = create(test).withDatabase(NON_EXISTENT_ENTITY);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.DATABASE, NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_DbtModel_as_non_admin_401(TestInfo test) {
    CreateDbtModel create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createEntity(create,
            authHeaders("test@open-metadata.org")));
      assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void put_columnConstraintUpdate_200(TestInfo test) throws IOException {
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn("c1", INT, null).withConstraint(ColumnConstraint.NULL));
    columns.add(getColumn("c2", INT, null).withConstraint(ColumnConstraint.UNIQUE));
    CreateDbtModel request = create(test).withColumns(columns);
    DbtModel dbtModel = createAndCheckEntity(request, adminAuthHeaders());

    // Change the the column constraints and expect minor version change
    ChangeDescription change = getChangeDescription(dbtModel.getVersion());
    request.getColumns().get(0).withConstraint(ColumnConstraint.NOT_NULL);
    change.getFieldsUpdated().add(new FieldChange().withName("columns.c1.constraint")
            .withOldValue(ColumnConstraint.NULL).withNewValue(ColumnConstraint.NOT_NULL));

    request.getColumns().get(1).withConstraint(ColumnConstraint.PRIMARY_KEY);
    change.getFieldsUpdated().add(new FieldChange().withName("columns.c2.constraint")
                    .withOldValue(ColumnConstraint.UNIQUE).withNewValue(ColumnConstraint.PRIMARY_KEY));

    DbtModel updatedDbtModel = updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);

    // Remove column constraints and expect minor version change
    change = getChangeDescription(updatedDbtModel.getVersion());
    request.getColumns().get(0).withConstraint(null);
    change.getFieldsDeleted().add(new FieldChange().withName("columns.c1.constraint")
            .withOldValue(ColumnConstraint.NOT_NULL));

    request.getColumns().get(1).withConstraint(null);
    change.getFieldsDeleted().add(new FieldChange().withName("columns.c2.constraint")
            .withOldValue(ColumnConstraint.PRIMARY_KEY));
    updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void put_updateColumns_200(TestInfo test) throws IOException {
    int tagCategoryUsageCount = getTagCategoryUsageCount("user", userAuthHeaders());
    int addressTagUsageCount = getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), userAuthHeaders());
    int bankTagUsageCount = getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders());

    //
    // Create a DbtModel with column c1, type BIGINT, description c1 and tag USER_ADDRESS_TAB_LABEL
    //
    List<TagLabel> tags = new ArrayList<>();
    tags.add(USER_ADDRESS_TAG_LABEL);
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn("c1", BIGINT, null).withTags(tags));

    CreateDbtModel request = create(test).withColumns(columns);
    DbtModel dbtModel = createAndCheckEntity(request, adminAuthHeaders());
    columns.get(0).setFullyQualifiedName(dbtModel.getFullyQualifiedName() + ".c1");

    // Ensure tag category and tag usage counts are updated
    assertEquals(tagCategoryUsageCount + 1, getTagCategoryUsageCount("user", userAuthHeaders()));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(),
            authHeaders("test@open-metadata.org")));
    assertEquals(bankTagUsageCount, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders()));

    //
    // Update the c1 tags to  USER_ADDRESS_TAB_LABEL, USER_BANK_ACCOUNT_TAG_LABEL (newly added)
    // Ensure description and previous tag is carried forward during update
    //
    tags.add(USER_BANK_ACCOUNT_TAG_LABEL);
    List<Column> updatedColumns = new ArrayList<>();
    updatedColumns.add(getColumn("c1", BIGINT, null).withTags(tags));
    ChangeDescription change = getChangeDescription(dbtModel.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("columns.c1.tags")
            .withNewValue(List.of(USER_BANK_ACCOUNT_TAG_LABEL)));
    dbtModel = updateAndCheckEntity(request.withColumns(updatedColumns), OK, adminAuthHeaders(), MINOR_UPDATE,
            change);

    // Ensure tag usage counts are updated
    assertEquals(tagCategoryUsageCount + 2, getTagCategoryUsageCount("user", userAuthHeaders()));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), userAuthHeaders()));
    assertEquals(bankTagUsageCount + 1, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders()));

    //
    // Add a new column using PUT
    //
    change = getChangeDescription(dbtModel.getVersion());
    Column c2 = getColumn("c2", BINARY, null).withOrdinalPosition(2).withDataLength(10).withTags(tags);
    updatedColumns.add(c2);
    change.getFieldsAdded().add(new FieldChange().withName("columns").withNewValue(List.of(c2)));
    dbtModel = updateAndCheckEntity(request.withColumns(updatedColumns), OK, adminAuthHeaders(), MINOR_UPDATE,
            change);

    // Ensure tag usage counts are updated - column c2 added both address and bank tags
    assertEquals(tagCategoryUsageCount + 4, getTagCategoryUsageCount("user", userAuthHeaders()));
    assertEquals(addressTagUsageCount + 2, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), userAuthHeaders()));
    assertEquals(bankTagUsageCount + 2, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders()));

    //
    // Remove a column c2 and make sure it is deleted by PUT
    //
    change = getChangeDescription(dbtModel.getVersion());
    updatedColumns.remove(1);
    change.getFieldsDeleted().add(new FieldChange().withName("columns").withOldValue(List.of(c2)));
    dbtModel = updateAndCheckEntity(request.withColumns(updatedColumns), OK, adminAuthHeaders(), MAJOR_UPDATE,
            change);
    assertEquals(1, dbtModel.getColumns().size());

    // Ensure tag usage counts are updated to reflect removal of column c2
    assertEquals(tagCategoryUsageCount + 2, getTagCategoryUsageCount("user", userAuthHeaders()));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), userAuthHeaders()));
    assertEquals(bankTagUsageCount + 1, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders()));
  }


  @Test
  public void put_viewDefinition_200(TestInfo test) throws IOException {
    CreateDbtModel createDbtModel = create(test);
    createDbtModel.setDbtNodeType(DbtNodeType.Model);
    String query = "sales_vw\n" +
            "create view sales_vw as\n" +
            "select * from public.sales\n" +
            "union all\n" +
            "select * from spectrum.sales\n" +
            "with no schema binding;\n";
    createDbtModel.setViewDefinition(query);
    DbtModel dbtModel = createAndCheckEntity(createDbtModel, adminAuthHeaders());
    dbtModel = getEntity(dbtModel.getId(), "viewDefinition", adminAuthHeaders());
    LOG.info("dbtModel view definition {}", dbtModel.getViewDefinition());
    assertEquals(dbtModel.getViewDefinition(), query);
  }

  @Test
  @Order(1) // Run this test first as other DbtModels created in other tests will interfere with listing
  public void get_DbtModelListWithDifferentFields_200_OK(TestInfo test) throws IOException {
    CreateDbtModel create = create(test, 1).withDescription("description").withOwner(USER_OWNER1)
            .withTags(singletonList(USER_ADDRESS_TAG_LABEL));
    createAndCheckEntity(create, adminAuthHeaders());
    CreateDbtModel create1 = create(test, 2).withDescription("description").withOwner(USER_OWNER1);
    createAndCheckEntity(create1, adminAuthHeaders());

    ResultList<DbtModel> dbtModelList = listEntities(null, adminAuthHeaders()); // List DbtModels
    assertEquals(2, dbtModelList.getData().size());
    assertFields(dbtModelList.getData(), null);

    // List DbtModels with databaseFQN as filter
    Map<String, String> queryParams = new HashMap<>() {{
      put("database", DATABASE.getFullyQualifiedName());
    }};
    ResultList<DbtModel> dbtModelList1 = listEntities(queryParams, adminAuthHeaders());
    assertEquals(dbtModelList.getData().size(), dbtModelList1.getData().size());
    assertFields(dbtModelList1.getData(), null);

    // GET .../DbtModels?fields=columns
    final String fields = "columns";
    queryParams = new HashMap<>() {{
      put("fields", fields);
    }};
    dbtModelList = listEntities(queryParams, adminAuthHeaders());
    assertEquals(2, dbtModelList.getData().size());
    assertFields(dbtModelList.getData(), fields);

    // List DbtModels with databaseFQN as filter
    queryParams = new HashMap<>() {{
      put("fields", fields);
      put("database", DATABASE.getFullyQualifiedName());
    }};
    dbtModelList1 = listEntities(queryParams, adminAuthHeaders());
    assertEquals(dbtModelList.getData().size(), dbtModelList1.getData().size());
    assertFields(dbtModelList1.getData(), fields);

    // GET .../DbtModels?fields=owner,service
    final String fields1 = "owner,database";
    queryParams = new HashMap<>() {{
      put("fields", fields1);
    }};
    dbtModelList = listEntities(queryParams, adminAuthHeaders());
    assertEquals(2, dbtModelList.getData().size());
    assertFields(dbtModelList.getData(), fields1);
    for (DbtModel dbtModel : dbtModelList.getData()) {
      assertEquals(dbtModel.getOwner().getId(), USER_OWNER1.getId());
      assertEquals(dbtModel.getOwner().getType(), USER_OWNER1.getType());
      assertEquals(dbtModel.getDatabase().getId(), DATABASE.getId());
      assertEquals(dbtModel.getDatabase().getName(), DATABASE.getFullyQualifiedName());
    }

    // List DbtModels with databaseFQN as filter
    queryParams = new HashMap<>() {{
      put("fields", fields1);
      put("database", DATABASE.getFullyQualifiedName());
    }};
    dbtModelList1 = listEntities(queryParams, adminAuthHeaders());
    assertEquals(dbtModelList.getData().size(), dbtModelList1.getData().size());
    assertFields(dbtModelList1.getData(), fields1);
  }

  @Test
  public void delete_DbtModel_200_ok(TestInfo test) throws HttpResponseException {
    DbtModel dbtModel = createEntity(create(test), adminAuthHeaders());
    deleteEntity(dbtModel.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_DbtModel_as_non_admin_401(TestInfo test) throws HttpResponseException {
    DbtModel dbtModel = createEntity(create(test), adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteEntity(dbtModel.getId(), authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  /**
   * @see EntityResourceTest#patch_entityAttributes_200_ok(TestInfo) for other patch related tests
   * for patching display, description, owner, and tags
   */
  @Test
  public void patch_DbtModelAttributes_200_ok(TestInfo test) throws IOException {
    String viewDefinition = "select * from raw_customer";
    // Create DbtModel without nodeType
    DbtModel dbtModel = createEntity(create(test).withViewDefinition(viewDefinition).withDescription("description1"),
        adminAuthHeaders());


    // Add description,
    //
    String originalJson = JsonUtils.pojoToJson(dbtModel);
    ChangeDescription change = getChangeDescription(dbtModel.getVersion());

    dbtModel.withDbtNodeType(DbtNodeType.Model).withDescription("description2");
    change.getFieldsAdded().add(new FieldChange().withName("dbtNodeType").withNewValue(DbtNodeType.Model.value()));
    change.getFieldsUpdated().add(new FieldChange().withName("description").withNewValue("description2")
        .withOldValue("description1"));


    DbtModel dbtModel1 = patchEntityAndCheck(dbtModel, originalJson, adminAuthHeaders(), MINOR_UPDATE, change);

    assertEquals(dbtModel1.getViewDefinition(),  viewDefinition);
    // Remove nodeType, description
    originalJson = JsonUtils.pojoToJson(dbtModel1);
    change = getChangeDescription(dbtModel1.getVersion());

    dbtModel1.withDbtNodeType(null);

    change.getFieldsDeleted().add(new FieldChange().withName("dbtNodeType").withOldValue(DbtNodeType.Model.value()));
    patchEntityAndCheck(dbtModel1, originalJson, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void patch_DbtModelColumns_200_ok(TestInfo test) throws IOException {
    // Create DbtModel with the following columns
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn("c1", INT, USER_ADDRESS_TAG_LABEL).withDescription(null));
    columns.add(getColumn("c2", BIGINT, USER_ADDRESS_TAG_LABEL));
    columns.add(getColumn("c3", FLOAT, USER_BANK_ACCOUNT_TAG_LABEL));

    DbtModel dbtModel = createEntity(create(test).withColumns(columns), adminAuthHeaders());

    // Update the column tags and description
    ChangeDescription change = getChangeDescription(dbtModel.getVersion());
    columns.get(0).withDescription("new0") // Set new description
            .withTags(List.of(USER_ADDRESS_TAG_LABEL, USER_BANK_ACCOUNT_TAG_LABEL));
    change.getFieldsAdded().add(new FieldChange().withName("columns.c1.description")
            .withNewValue("new0")); // Column c1 has new description
    change.getFieldsAdded().add(new FieldChange().withName("columns.c1.tags")
            .withNewValue(List.of(USER_BANK_ACCOUNT_TAG_LABEL))); //  Column c1 got new tags

    columns.get(1).withDescription("new1") // Change description
            .withTags(List.of(USER_ADDRESS_TAG_LABEL));// No change in tags
    change.getFieldsUpdated().add(new FieldChange().withName("columns.c2.description").withNewValue("new1")
            .withOldValue("c2")); // Column c2 description changed

    columns.get(2).withTags(new ArrayList<>()); // Remove tag
    change.getFieldsDeleted().add(new FieldChange().withName("columns.c3.tags")
            .withOldValue(List.of(USER_BANK_ACCOUNT_TAG_LABEL))); // Column c3 tags were removed

    String originalJson = JsonUtils.pojoToJson(dbtModel);
    dbtModel.setColumns(columns);
    dbtModel = patchEntityAndCheck(dbtModel, originalJson, adminAuthHeaders(), MINOR_UPDATE, change);
    assertColumns(columns, dbtModel.getColumns());
  }

  void assertFields(List<DbtModel> dbtModelList, String fieldsParam) {
    dbtModelList.forEach(t -> assertFields(t, fieldsParam));
  }

  void assertFields(DbtModel dbtModel, String fieldsParam) {
    Fields fields = new Fields(DbtModelResource.FIELD_LIST, fieldsParam);

    if (fields.contains("owner")) {
      assertNotNull(dbtModel.getOwner());
    } else {
      assertNull(dbtModel.getOwner());
    }
    if (fields.contains("columns")) {
      assertNotNull(dbtModel.getColumns());
      if (fields.contains("tags")) {
        dbtModel.getColumns().forEach(column -> assertNotNull(column.getTags()));
      } else {
        dbtModel.getColumns().forEach(column -> assertNull(column.getTags()));
      }
    } else {
      assertNotNull(dbtModel.getColumns());
    }

    if (fields.contains("database")) {
      assertNotNull(dbtModel.getDatabase());
    } else {
      assertNull(dbtModel.getDatabase());
    }
    if (fields.contains("tags")) {
      assertNotNull(dbtModel.getTags());
    } else {
      assertNull(dbtModel.getTags());
    }
  }

  /** Validate returned fields GET .../DbtModels/{id}?fields="..." or GET .../DbtModels/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(DbtModel dbtModel, boolean byName) throws HttpResponseException {
    // GET .../DbtModels/{id}
    dbtModel = byName ? getEntityByName(dbtModel.getFullyQualifiedName(), null, adminAuthHeaders()) :
            getEntity(dbtModel.getId(), null, adminAuthHeaders());
    assertFields(dbtModel, null);

    // GET .../DbtModels/{id}?fields=columns
    String fields = "columns";
    dbtModel = byName ? getEntityByName(dbtModel.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getEntity(dbtModel.getId(), fields, adminAuthHeaders());
    assertFields(dbtModel, fields);

    // GET .../DbtModels/{id}?fields=columns,usageSummary,owner,database,tags
    fields = "columns,owner,database,tags";
    dbtModel = byName ? getEntityByName(dbtModel.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getEntity(dbtModel.getId(), fields, adminAuthHeaders());
    assertEquals(dbtModel.getOwner().getId(), USER_OWNER1.getId());
    assertEquals(dbtModel.getOwner().getType(), USER_OWNER1.getType());
    assertEquals(dbtModel.getDatabase().getId(), DATABASE.getId());
    assertEquals(dbtModel.getDatabase().getName(), DATABASE.getFullyQualifiedName());
  }


  private static void assertColumn(Column expectedColumn, Column actualColumn) throws HttpResponseException {
    assertNotNull(actualColumn.getFullyQualifiedName());
    assertEquals(expectedColumn.getName(), actualColumn.getName());
    assertEquals(expectedColumn.getDescription(), actualColumn.getDescription());
    assertEquals(expectedColumn.getDataType(), actualColumn.getDataType());
    assertEquals(expectedColumn.getArrayDataType(), actualColumn.getArrayDataType());
    assertEquals(expectedColumn.getConstraint(), actualColumn.getConstraint());
    if (expectedColumn.getDataTypeDisplay() != null) {
      assertEquals(expectedColumn.getDataTypeDisplay().toLowerCase(Locale.ROOT), actualColumn.getDataTypeDisplay());
    }
    TestUtils.validateTags(expectedColumn.getTags(), actualColumn.getTags());

    // Check the nested columns
    assertColumns(expectedColumn.getChildren(), actualColumn.getChildren());
  }

  private static void assertColumns(List<Column> expectedColumns, List<Column> actualColumns)
          throws HttpResponseException {
    if (expectedColumns == null && actualColumns == null) {
      return;
    }
    // Sort columns by name
    assertNotNull(expectedColumns);
    assertEquals(expectedColumns.size(), actualColumns.size());
    for (int i = 0; i < expectedColumns.size(); i++) {
      assertColumn(expectedColumns.get(i), actualColumns.get(i));
    }
  }

  private CreateDbtModel create(TestInfo test) {
    return create(getEntityName(test));
  }

  private CreateDbtModel create(TestInfo test, int index) {
    return create(getEntityName(test, index));
  }

  private CreateDbtModel create(String entityName) {
    return new CreateDbtModel().withName(entityName).withDatabase(DATABASE.getId()).withColumns(COLUMNS);
  }

  /**
   * A method variant to be called form other tests to create a DbtModel without depending on Database, DatabaseService
   * set up in the {@code setup()} method
   */
  public DbtModel createEntity(TestInfo test, int index) throws IOException {
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    DatabaseService service = new DatabaseServiceResourceTest().createEntity(databaseServiceResourceTest.create(test),
            adminAuthHeaders());
    EntityReference serviceRef =
            new EntityReference().withName(service.getName()).withId(service.getId()).withType(Entity.DATABASE_SERVICE);
    DatabaseResourceTest databaseResourceTest = new DatabaseResourceTest();
    Database database = databaseResourceTest.createAndCheckEntity(databaseResourceTest.create(test).withService(serviceRef),
            adminAuthHeaders());
    CreateDbtModel create = new CreateDbtModel().withName(getEntityName(test, index))
            .withDatabase(database.getId()).withColumns(COLUMNS);
    return createEntity(create, adminAuthHeaders());
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name).withDescription(description).withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(DbtModel createdEntity, Object request, Map<String, String> authHeaders)
          throws HttpResponseException {
    CreateDbtModel createRequest = (CreateDbtModel) request;
    validateCommonEntityFields(getEntityInterface(createdEntity), createRequest.getDescription(),
            TestUtils.getPrincipal(authHeaders), createRequest.getOwner());

    // Entity specific validation
    assertEquals(createRequest.getDbtNodeType(), createdEntity.getDbtNodeType());
    assertColumns(createRequest.getColumns(), createdEntity.getColumns());
    validateDatabase(createRequest.getDatabase(), createdEntity.getDatabase());
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReference(createdEntity.getFollowers());
  }

  @Override
  public void validateUpdatedEntity(DbtModel updated, Object request, Map<String, String> authHeaders)
          throws HttpResponseException {
    validateCreatedEntity(updated, request, authHeaders);
  }

  @Override
  public void compareEntities(DbtModel expected, DbtModel patched, Map<String, String> authHeaders)
          throws HttpResponseException {
    validateCommonEntityFields(getEntityInterface(patched), expected.getDescription(),
            TestUtils.getPrincipal(authHeaders), expected.getOwner());

    // Entity specific validation
    assertEquals(expected.getDbtNodeType(), patched.getDbtNodeType());
    assertColumns(expected.getColumns(), patched.getColumns());
    validateDatabase(expected.getDatabase().getId(), patched.getDatabase());
    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.validateEntityReference(expected.getFollowers());
  }

  private static int getTagUsageCount(String tagFQN, Map<String, String> authHeaders) throws HttpResponseException {
    return TagResourceTest.getTag(tagFQN, "usageCount", authHeaders).getUsageCount();
  }

  private static int getTagCategoryUsageCount(String name, Map<String, String> authHeaders)
          throws HttpResponseException {
    return TagResourceTest.getCategory(name, "usageCount", authHeaders).getUsageCount();
  }

  @Override
  public DbtModelEntityInterface getEntityInterface(DbtModel entity) {
    return new DbtModelEntityInterface(entity);
  }

  private void validateDatabase(UUID expectedDatabaseId, EntityReference database) {
    TestUtils.validateEntityReference(database);
    assertEquals(expectedDatabaseId, database.getId());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.startsWith("columns") && fieldName.endsWith("constraint")) {
      ColumnConstraint expectedConstraint = (ColumnConstraint) expected;
      ColumnConstraint actualConstraint = ColumnConstraint.fromValue((String) actual);
      assertEquals(expectedConstraint, actualConstraint);
    } else if (fieldName.contains("columns") && !fieldName.endsWith("tags") && !fieldName.endsWith("description")) {
      List<Column> expectedRefs = (List<Column>) expected;
      List<Column> actualRefs = JsonUtils.readObjects(actual.toString(), Column.class);
      assertColumns(expectedRefs, actualRefs);
    } else if (fieldName.endsWith("nodeType")) {
      DbtNodeType expectedDbtModelType = (DbtNodeType) expected;
      DbtNodeType actualDbtModelType = DbtNodeType.fromValue(actual.toString());
      assertEquals(expectedDbtModelType, actualDbtModelType);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
