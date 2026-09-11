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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import jakarta.json.JsonPatch;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.FieldPathUtils.FieldPathComponents;

/**
 * Unit tests for FieldPathUtils.
 *
 * <p>Tests the field path parsing logic for various formats:
 * - Simple: "description"
 * - Column/Field: "columns::column_name::description"
 * - Dot notation: "columns.column_name.description"
 * - Nested with quotes: "messageSchema::\"parent.child\"::description"
 * - Array index: "columns[0].description"
 */
class FieldPathUtilsTest {

  @Test
  void testParseFieldPath_colonSeparator_simple() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns::customer_id::description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("customer_id", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_colonSeparator_noProperty() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns::customer_id");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("customer_id", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_colonSeparator_quotedFieldName() throws Exception {
    FieldPathComponents result =
        invokeParseFieldPath("messageSchema::\"level.somefield\"::description");

    assertNotNull(result);
    assertEquals("messageSchema", result.containerName());
    assertEquals("level.somefield", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_simple() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns.email.description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("email", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_noProperty() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns.email");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("email", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_arrayIndex() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns[0].description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("0", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_arrayIndex_nestedProperty() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("schemaFields[2].tags");

    assertNotNull(result);
    assertEquals("schemaFields", result.containerName());
    assertEquals("2", result.fieldName());
    assertEquals("tags", result.property());
  }

  @Test
  void testParseFieldPath_messageSchema() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("messageSchema::event_id::description");

    assertNotNull(result);
    assertEquals("messageSchema", result.containerName());
    assertEquals("event_id", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dataModel() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("dataModel::product_id::description");

    assertNotNull(result);
    assertEquals("dataModel", result.containerName());
    assertEquals("product_id", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_schemaFields() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("schemaFields::user_id::description");

    assertNotNull(result);
    assertEquals("schemaFields", result.containerName());
    assertEquals("user_id", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_responseSchema() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("responseSchema::status_code::description");

    assertNotNull(result);
    assertEquals("responseSchema", result.containerName());
    assertEquals("status_code", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_tasks() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("tasks::etl_task::description");

    assertNotNull(result);
    assertEquals("tasks", result.containerName());
    assertEquals("etl_task", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_charts() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("charts::revenue_chart::description");

    assertNotNull(result);
    assertEquals("charts", result.containerName());
    assertEquals("revenue_chart", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_fields() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("fields::title::description");

    assertNotNull(result);
    assertEquals("fields", result.containerName());
    assertEquals("title", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_null() throws Exception {
    FieldPathComponents result = invokeParseFieldPath(null);
    assertNull(result);
  }

  @Test
  void testParseFieldPath_empty() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("");
    assertNull(result);
  }

  @Test
  void testParseFieldPath_simpleString() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("description");
    assertNull(result);
  }

  @Test
  void testParseFieldPath_nestedChildrenPath() throws Exception {
    FieldPathComponents result =
        invokeParseFieldPath("columns::address::children::street::description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("address", result.fieldName());
    assertEquals("children", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_nestedDepth2() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns.profile.personal.description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("profile.personal", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_nestedDepth3() throws Exception {
    FieldPathComponents result =
        invokeParseFieldPath("columns.profile.personal.full_name.description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("profile.personal.full_name", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_nestedDepth3_quoted() throws Exception {
    FieldPathComponents result =
        invokeParseFieldPath("columns.\"profile.personal.full_name\".description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("profile.personal.full_name", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_nestedTags() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns.profile.contact.phone.tags");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("profile.contact.phone", result.fieldName());
    assertEquals("tags", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_threeSegments_propertyLast() throws Exception {
    // "columns.profile.personal" is ambiguous (nested column with implied description vs.
    // flat column + property). Property-last wins — this pins the pre-existing behavior for
    // three-segment paths; every real producer appends an explicit ".description"/".tags".
    FieldPathComponents result = invokeParseFieldPath("columns.profile.personal");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("profile", result.fieldName());
    assertEquals("personal", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_literalDottedName() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns.\"a.b\".description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("a.b", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_malformedEmptySegment() throws Exception {
    // The FQN parser rejects empty segments; parseFieldPath must return null (fail-loud
    // upstream at updateFieldDescription) instead of producing garbage components.
    FieldPathComponents result = invokeParseFieldPath("columns..description");

    assertNull(result);
  }

  @Test
  void testUpdateFieldDescription_nestedLeaf_updatesLeafOnly() {
    Table table = nestedTable();
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            table,
            repository,
            "admin",
            "columns.profile.personal.full_name.description",
            "Full name of the customer");

    assertTrue(updated);
    Column profile = table.getColumns().getFirst();
    Column personal = profile.getChildren().getFirst();
    Column fullName = personal.getChildren().getFirst();
    assertEquals("Full name of the customer", fullName.getDescription());
    assertEquals("Customer profile block", profile.getDescription());
    assertNull(personal.getDescription());
  }

  @Test
  void testUpdateFieldDescription_unresolvableNestedPath_failsLoudly() {
    Table table = nestedTable();
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            table, repository, "admin", "columns.profile.nonexistent.child.description", "text");

    assertFalse(updated);
    assertEquals("Customer profile block", table.getColumns().getFirst().getDescription());
    verifyNoInteractions(repository);
  }

  @Test
  void testGetFieldDescription_nestedLeaf() {
    Table table = nestedTable();

    Optional<String> description =
        FieldPathUtils.getFieldDescription(table, "columns.profile.personal.full_name.description");

    assertEquals(Optional.of("name"), description);
  }

  private Table nestedTable() {
    Column fullName = new Column().withName("full_name").withDescription("name");
    Column personal = new Column().withName("personal").withChildren(List.of(fullName));
    Column phone = new Column().withName("phone").withDescription("Phone");
    Column contact = new Column().withName("contact").withChildren(List.of(phone));
    Column profile =
        new Column()
            .withName("profile")
            .withDescription("Customer profile block")
            .withChildren(List.of(personal, contact));
    return new Table()
        .withId(UUID.randomUUID())
        .withName("customer_events")
        .withColumns(List.of(profile));
  }

  @Test
  void updateFieldDescription_tableColumn_updatesInMemoryAndPatches() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withColumns(new ArrayList<>(List.of(new Column().withName("id"))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            table, repository, "admin", "columns::id::description", "Order id");

    assertTrue(updated);
    assertEquals("Order id", table.getColumns().get(0).getDescription());
    verify(repository)
        .patch(isNull(), eq(table.getId()), eq("admin"), any(JsonPatch.class), isNull(), isNull());
  }

  @Test
  void updateFieldDescription_topicNestedSchemaField_quotedDottedName() {
    Topic topic =
        new Topic()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withMessageSchema(
                new MessageSchema()
                    .withSchemaFields(
                        List.of(
                            new Field()
                                .withName("customer")
                                .withChildren(List.of(new Field().withName("id"))))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            topic, repository, "admin", "messageSchema::\"customer.id\"::description", "Cust id");

    assertTrue(updated);
    assertEquals(
        "Cust id",
        topic.getMessageSchema().getSchemaFields().get(0).getChildren().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_containerDataModelColumn() {
    Container container =
        new Container()
            .withId(UUID.randomUUID())
            .withName("bucket")
            .withDataModel(
                new ContainerDataModel().withColumns(List.of(new Column().withName("payload"))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            container, repository, "admin", "dataModel::payload::description", "Payload col");

    assertTrue(updated);
    assertEquals("Payload col", container.getDataModel().getColumns().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_apiEndpointResponseSchemaField() {
    APIEndpoint endpoint =
        new APIEndpoint()
            .withId(UUID.randomUUID())
            .withName("getUser")
            .withResponseSchema(
                new APISchema().withSchemaFields(List.of(new Field().withName("userId"))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            endpoint, repository, "admin", "responseSchema::userId::description", "User id");

    assertTrue(updated);
    assertEquals("User id", endpoint.getResponseSchema().getSchemaFields().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_missingField_returnsFalseAndNeverPatches() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withColumns(List.of(new Column().withName("id")));
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            table, repository, "admin", "columns::nope::description", "x");

    assertFalse(updated);
    verifyNoInteractions(repository);
  }

  @Test
  void updateFieldDescription_unknownContainer_returnsFalse() {
    Pipeline pipeline = new Pipeline().withId(UUID.randomUUID()).withName("etl");
    EntityRepository<?> repository = mock(EntityRepository.class);

    // Pins today's gap: the if-chain does not know pipeline tasks. Task 10 deliberately
    // changes this expectation (see that task's step 4).
    boolean updated =
        FieldPathUtils.updateFieldDescription(
            pipeline, repository, "admin", "unknownContainer::t1::description", "x");

    assertFalse(updated);
    verifyNoInteractions(repository);
  }

  @Test
  void updateFieldDescription_emptyChildArray_returnsFalse() {
    Topic topic =
        new Topic()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withMessageSchema(new MessageSchema().withSchemaFields(List.of()));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertFalse(
        FieldPathUtils.updateFieldDescription(
            topic, repository, "admin", "messageSchema::id::description", "x"));
    verifyNoInteractions(repository);
  }

  @Test
  void findField_tableStructChild_dottedPath() {
    Table table =
        new Table()
            .withName("orders")
            .withColumns(
                List.of(
                    new Column()
                        .withName("profile")
                        .withChildren(List.of(new Column().withName("full_name")))));

    Optional<Object> found =
        FieldPathUtils.findField(table, "columns::profile.full_name::description");

    assertTrue(found.isPresent());
    assertEquals("full_name", ((Column) found.get()).getName());
  }

  @Test
  void updateFieldDescription_columnsContainerOnTable_worksToday() {
    // FROZEN, must never change. Task 10 makes "columns" a registry-resolved alias for the
    // entity's child container; for table the registry's container path IS literally "columns"
    // (ChildFieldResolver's TABLE spec), so this resolution must stay byte-identical.
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withColumns(new ArrayList<>(List.of(new Column().withName("id"))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertTrue(
        FieldPathUtils.updateFieldDescription(
            table, repository, "admin", "columns::id::description", "Primary key"));
    assertEquals("Primary key", table.getColumns().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_columnsContainerOnTopic_silentlyDoesNothingToday() {
    // CHARACTERIZATION OF A BUG, deliberately pinning the broken behavior so the fix is visible
    // as a diff. SuggestionTool builds every child suggestion's fieldPath as
    // "columns.<name>.description" regardless of entity type, and FieldPathUtils resolves
    // "columns" by calling getColumns(), which Topic does not have; handleNestedContainer then
    // matches only the literal names messageSchema / dataModel / requestSchema / responseSchema,
    // none of which is "columns". So an accepted suggestion on a topic schema field writes
    // nothing and reports nothing. Task 10 step 4 flips this test.
    Topic topic =
        new Topic()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withMessageSchema(
                new MessageSchema()
                    .withSchemaFields(
                        new ArrayList<>(List.of(new Field().withName("customer_id")))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertFalse(
        FieldPathUtils.updateFieldDescription(
            topic,
            repository,
            "admin",
            "columns::customer_id::description",
            "Customer identifier"));
    assertNull(topic.getMessageSchema().getSchemaFields().get(0).getDescription());
    verifyNoInteractions(repository);
  }

  private FieldPathComponents invokeParseFieldPath(String fieldPath) throws Exception {
    Method method = FieldPathUtils.class.getDeclaredMethod("parseFieldPath", String.class);
    method.setAccessible(true);
    return (FieldPathComponents) method.invoke(null, fieldPath);
  }
}
