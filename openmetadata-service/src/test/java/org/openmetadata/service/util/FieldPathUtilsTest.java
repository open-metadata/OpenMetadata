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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.MessageSchema;

class FieldPathUtilsTest {

  @Test
  void setDescription_nestedPath_writesTheChildNotItsParent() {
    // #36615: a nested column's description was written onto its parent column.
    Table table = nestedTable();

    assertTrue(FieldPathUtils.setDescription(table, path("profile", "personal"), "Personal"));

    Column profile = table.getColumns().getFirst();
    assertEquals("Personal", profile.getChildren().getFirst().getDescription());
    assertEquals("Customer profile block", profile.getDescription());
  }

  @Test
  void getDescription_readsTheNestedLeaf() {
    assertEquals(
        Optional.of("name"),
        FieldPathUtils.getDescription(nestedTable(), path("profile", "personal", "full_name")));
  }

  @Test
  void locate_nameWithADot_isOneName() {
    Column dotted = new Column().withName("a.b");
    Table table = new Table().withName("t").withColumns(List.of(dotted));

    assertSame(dotted, FieldPathUtils.locate(table, path("a.b")).orElseThrow());
    assertTrue(FieldPathUtils.locate(table, path("a", "b")).isEmpty());
  }

  @Test
  void locate_entityLevel_isTheEntity() {
    Table table = nestedTable();

    assertSame(
        table,
        FieldPathUtils.locate(table, EntityFieldPath.entityLevel(FieldProperty.TAGS))
            .orElseThrow());
  }

  @Test
  void setDescription_entityLevel_writesTheEntity() {
    Table table = nestedTable();

    assertTrue(
        FieldPathUtils.setDescription(
            table, EntityFieldPath.entityLevel(FieldProperty.DESCRIPTION), "Customers"));

    assertEquals("Customers", table.getDescription());
  }

  @Test
  void setDescription_missingField_changesNothing() {
    Table table = nestedTable();

    assertFalse(FieldPathUtils.setDescription(table, path("profile", "nonexistent"), "x"));
    assertEquals("Customer profile block", table.getColumns().getFirst().getDescription());
  }

  @Test
  void locate_doesNotReachAFieldByItsOwnNameAlone() {
    assertTrue(FieldPathUtils.locate(nestedTable(), path("full_name")).isEmpty());
  }

  @Test
  void locate_twoSiblingsWithTheSameName_areRefused() {
    Table table =
        new Table()
            .withName("t")
            .withColumns(List.of(new Column().withName("id"), new Column().withName("id")));

    assertTrue(FieldPathUtils.locate(table, path("id")).isEmpty());
  }

  @Test
  void locate_topicSchemaField() {
    Field userId = new Field().withName("user_id");
    Topic topic =
        new Topic().withMessageSchema(new MessageSchema().withSchemaFields(List.of(userId)));
    EntityFieldPath path =
        new EntityFieldPath(
            "messageSchema.schemaFields", List.of("user_id"), FieldProperty.DESCRIPTION);

    assertSame(userId, FieldPathUtils.locate(topic, path).orElseThrow());
  }

  @Test
  void locate_apiEndpointSchemasAreSeparate() {
    Field request = new Field().withName("shared");
    Field response = new Field().withName("shared");
    APIEndpoint endpoint =
        new APIEndpoint()
            .withRequestSchema(new APISchema().withSchemaFields(List.of(request)))
            .withResponseSchema(new APISchema().withSchemaFields(List.of(response)));

    assertSame(
        response,
        FieldPathUtils.locate(endpoint, fieldIn("responseSchema.schemaFields", "shared"))
            .orElseThrow());
    assertSame(
        request,
        FieldPathUtils.locate(endpoint, fieldIn("requestSchema.schemaFields", "shared"))
            .orElseThrow());
  }

  @Test
  void supports_matchesWhatTheFieldCarries() {
    Column column = new Column().withName("id");

    assertTrue(FieldPathUtils.supports(column, FieldProperty.DESCRIPTION));
    assertTrue(FieldPathUtils.supports(column, FieldProperty.TAGS));
    assertFalse(FieldPathUtils.supports(new Object(), FieldProperty.DESCRIPTION));
  }

  @Test
  void getDescription_fieldWithoutOne_isEmpty() {
    assertTrue(FieldPathUtils.getDescription(nestedTable(), path("profile", "personal")).isEmpty());
  }

  private static EntityFieldPath path(String... names) {
    return new EntityFieldPath("columns", List.of(names), FieldProperty.DESCRIPTION);
  }

  private static EntityFieldPath fieldIn(String container, String name) {
    return new EntityFieldPath(container, List.of(name), FieldProperty.DESCRIPTION);
  }

  private static Table nestedTable() {
    Column fullName = new Column().withName("full_name").withDescription("name");
    Column personal = new Column().withName("personal").withChildren(List.of(fullName));
    Column profile =
        new Column()
            .withName("profile")
            .withDescription("Customer profile block")
            .withChildren(List.of(personal));
    return new Table().withName("customer_events").withColumns(List.of(profile));
  }
}
