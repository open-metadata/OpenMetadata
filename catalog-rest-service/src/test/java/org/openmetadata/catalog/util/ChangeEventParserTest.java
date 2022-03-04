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

package org.openmetadata.catalog.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestInstance.Lifecycle;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.LabelType;
import org.openmetadata.catalog.type.TagLabel.State;

@Slf4j
@TestInstance(Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ChangeEventParserTest extends CatalogApplicationTest {

  Object TABLE;

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test); // Initialize TableResourceTest for using helper methods
    TABLE = tableResourceTest.createEntity(test, 1);
  }

  @Test
  void testFormattedMessages() throws JsonProcessingException {
    ChangeDescription changeDescription = new ChangeDescription();
    // Simulate updating tags of an entity from tag1 -> tag2
    FieldChange addTag = new FieldChange();
    addTag.withName("tags").withNewValue("tag2");
    FieldChange deleteTag = new FieldChange();
    deleteTag.withName("tags").withOldValue("tag1");
    changeDescription.withFieldsAdded(List.of(addTag)).withFieldsDeleted(List.of(deleteTag)).withPreviousVersion(1.0);

    Map<EntityLink, String> messages = ChangeEventParser.getFormattedMessages(changeDescription, TABLE);
    assertEquals(1, messages.size());

    TagLabel tag1 = new TagLabel();
    tag1.withTagFQN("tag1").withLabelType(LabelType.DERIVED).withState(State.CONFIRMED);

    TagLabel tag2 = new TagLabel();
    tag2.withTagFQN("tag2").withLabelType(LabelType.DERIVED).withState(State.CONFIRMED);

    addTag.withNewValue(JsonUtils.pojoToJson(List.of(tag2)));
    deleteTag.withOldValue(JsonUtils.pojoToJson(List.of(tag1)));

    Map<EntityLink, String> jsonMessages = ChangeEventParser.getFormattedMessages(changeDescription, TABLE);
    assertEquals(1, jsonMessages.size());

    // The entity links and values of both the messages should be the same
    assertEquals(messages.values().iterator().next(), jsonMessages.values().iterator().next());
  }

  @Test
  void testEntityReferenceFormat() throws JsonProcessingException {
    ChangeDescription changeDescription = new ChangeDescription();
    // Simulate adding owner to a table
    EntityReference entityReference = new EntityReference();
    entityReference.withId(UUID.randomUUID()).withName("user1").withDisplayName("User One");
    FieldChange addOwner = new FieldChange();
    addOwner.withName("owner").withNewValue(JsonUtils.pojoToJson(entityReference));

    changeDescription.withFieldsAdded(List.of(addOwner)).withPreviousVersion(1.0);

    Map<EntityLink, String> messages = ChangeEventParser.getFormattedMessages(changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals("Added **owner**: `User One`", messages.values().iterator().next());
  }

  @Test
  void testUpdateOfString() {
    ChangeDescription changeDescription = new ChangeDescription();
    // Simulate a change of description in table
    FieldChange updateDescription = new FieldChange();
    updateDescription.withName("description").withNewValue("new description").withOldValue("old description");

    changeDescription.withFieldsUpdated(List.of(updateDescription)).withPreviousVersion(1.0);

    Map<EntityLink, String> messages = ChangeEventParser.getFormattedMessages(changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals(
        "Updated **description** : <span class=\"diff-removed\">old</span>"
            + "<span class=\"diff-added\">new</span> description",
        messages.values().iterator().next());

    // test if it updates correctly with one add and one delete change
    changeDescription = new ChangeDescription();
    FieldChange addDescription = new FieldChange();
    FieldChange deleteDescription = new FieldChange();
    addDescription.withName("description").withNewValue("new description");
    deleteDescription.withName("description").withOldValue("old description");
    changeDescription
        .withFieldsAdded(List.of(addDescription))
        .withFieldsDeleted(List.of(deleteDescription))
        .withPreviousVersion(1.0);

    // now test if both the type of updates give the same message
    Map<EntityLink, String> updatedMessages = ChangeEventParser.getFormattedMessages(changeDescription, TABLE);
    assertEquals(1, updatedMessages.size());

    assertEquals(messages.keySet().iterator().next(), updatedMessages.keySet().iterator().next());
    assertEquals(messages.values().iterator().next(), updatedMessages.values().iterator().next());
  }

  @Test
  void testMajorSchemaChange() {
    ChangeDescription changeDescription = new ChangeDescription();
    // Simulate a change of column name in table
    FieldChange addColumn = new FieldChange();
    addColumn
        .withName("columns")
        .withNewValue(
            "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\",\"constraint\":\"NOT_NULL\"}]");

    FieldChange deleteColumn = new FieldChange();
    deleteColumn
        .withName("columns")
        .withOldValue(
            "[{\"name\":\"lo_order\",\"displayName\":\"lo_order\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_order\",\"constraint\":\"NOT_NULL\"}]");

    changeDescription
        .withFieldsAdded(List.of(addColumn))
        .withFieldsDeleted(List.of(deleteColumn))
        .withPreviousVersion(1.3);

    Map<EntityLink, String> messages = ChangeEventParser.getFormattedMessages(changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals(
        "Updated **columns.lo_orderpriority** : <br/> name: <span class=\"diff-removed\">\"lo_order\"</span><span class=\"diff-added\">\"lo_orderpriority\"</span> <br/> displayName: <span class=\"diff-removed\">\"lo_order\"</span><span class=\"diff-added\">\"lo_orderpriority\"</span> <br/> fullyQualifiedName: \"local_mysql.sample_db.lineorder.<span class=\"diff-removed\">lo_order\"</span><span class=\"diff-added\">lo_orderpriority\"</span>",
        messages.values().iterator().next());

    // Simulate a change of datatype change in column
    addColumn.withNewValue(
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\",\"constraint\":\"NOT_NULL\"}]");
    deleteColumn.withOldValue(
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"BLOB\",\"dataLength\":1,\"dataTypeDisplay\":\"blob\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\",\"tags\":[],\"constraint\":\"NOT_NULL\"}]");

    changeDescription
        .withFieldsAdded(List.of(addColumn))
        .withFieldsDeleted(List.of(deleteColumn))
        .withPreviousVersion(1.3);

    messages = ChangeEventParser.getFormattedMessages(changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals(
        "Updated **columns.lo_orderpriority** : <br/> dataType: <span class=\"diff-removed\">\"BLOB\"</span><span class=\"diff-added\">\"INT\"</span> <br/> dataTypeDisplay: <span class=\"diff-removed\">\"blob\"</span><span class=\"diff-added\">\"int\"</span>",
        messages.values().iterator().next());

    // Simulate multiple changes to columns
    addColumn.withNewValue(
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\"},{\"name\":\"newColumn\",\"displayName\":\"newColumn\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.newColumn\"}]");
    deleteColumn.withOldValue(
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"BLOB\",\"dataLength\":1,\"dataTypeDisplay\":\"blob\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\"}]");

    changeDescription
        .withFieldsAdded(List.of(addColumn))
        .withFieldsDeleted(List.of(deleteColumn))
        .withPreviousVersion(1.4);

    messages = ChangeEventParser.getFormattedMessages(changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals(
        "Updated **columns** : lo_orderpriority<span class=\"diff-added\">, newColumn</span>",
        messages.values().iterator().next());
  }
}
