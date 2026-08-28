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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
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

  private FieldPathComponents invokeParseFieldPath(String fieldPath) throws Exception {
    Method method = FieldPathUtils.class.getDeclaredMethod("parseFieldPath", String.class);
    method.setAccessible(true);
    return (FieldPathComponents) method.invoke(null, fieldPath);
  }
}
