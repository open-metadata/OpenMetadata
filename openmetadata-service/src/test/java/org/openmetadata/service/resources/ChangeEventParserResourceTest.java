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

package org.openmetadata.service.resources;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.Entity.FIELD_OWNER;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;

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
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.State;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.ChangeEventParser;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
@TestInstance(Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ChangeEventParserResourceTest extends OpenMetadataApplicationTest {
  private Table TABLE;

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

    Map<EntityLink, String> messages =
        ChangeEventParser.getFormattedMessages(ChangeEventParser.PUBLISH_TO.FEED, changeDescription, TABLE);
    assertEquals(1, messages.size());

    TagLabel tag1 = new TagLabel();
    tag1.withTagFQN("tag1").withLabelType(LabelType.DERIVED).withState(State.CONFIRMED);

    TagLabel tag2 = new TagLabel();
    tag2.withTagFQN("tag2").withLabelType(LabelType.DERIVED).withState(State.CONFIRMED);

    addTag.withNewValue(JsonUtils.pojoToJson(List.of(tag2)));
    deleteTag.withOldValue(JsonUtils.pojoToJson(List.of(tag1)));

    Map<EntityLink, String> jsonMessages =
        ChangeEventParser.getFormattedMessages(ChangeEventParser.PUBLISH_TO.FEED, changeDescription, TABLE);
    assertEquals(1, jsonMessages.size());

    // The entity links and values of both the messages should be the same
    assertEquals(messages.values().iterator().next(), jsonMessages.values().iterator().next());
  }

  @Test
  void testEntityReferenceFormat() throws JsonProcessingException {
    ChangeDescription changeDescription = new ChangeDescription().withPreviousVersion(1.0);
    // Simulate adding owner to a table
    EntityReference entityReference = new EntityReference();
    entityReference.withId(UUID.randomUUID()).withName("user1").withDisplayName("User One");
    fieldAdded(changeDescription, FIELD_OWNER, JsonUtils.pojoToJson(entityReference));

    Map<EntityLink, String> messages =
        ChangeEventParser.getFormattedMessages(ChangeEventParser.PUBLISH_TO.FEED, changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals("Added **owner**: **User One**", messages.values().iterator().next());
  }

  @Test
  void testUpdateOfString() {
    // Simulate a change of description in table
    ChangeDescription changeDescription = new ChangeDescription();
    fieldUpdated(changeDescription, "description", "old description", "new description");

    Map<EntityLink, String> messages =
        ChangeEventParser.getFormattedMessages(ChangeEventParser.PUBLISH_TO.FEED, changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals(
        "Updated **description** : <span class=\"diff-removed\">old</span> "
            + "<span class=\"diff-added\">new</span> description",
        messages.values().iterator().next());

    // test if it updates correctly with one add and one delete change
    changeDescription = new ChangeDescription().withPreviousVersion(1.0);
    fieldAdded(changeDescription, "description", "new description");
    fieldDeleted(changeDescription, "description", "old description");

    // now test if both the type of updates give the same message
    Map<EntityLink, String> updatedMessages =
        ChangeEventParser.getFormattedMessages(ChangeEventParser.PUBLISH_TO.FEED, changeDescription, TABLE);
    assertEquals(1, updatedMessages.size());

    assertEquals(messages.keySet().iterator().next(), updatedMessages.keySet().iterator().next());
    assertEquals(messages.values().iterator().next(), updatedMessages.values().iterator().next());
  }

  @Test
  void testUpdateOfStringSlack() {
    ChangeDescription changeDescription = new ChangeDescription();
    // Simulate a change of description in table
    fieldUpdated(changeDescription, "description", "old description", "new description");

    Map<EntityLink, String> messages =
        ChangeEventParser.getFormattedMessages(ChangeEventParser.PUBLISH_TO.SLACK, changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals("Updated *description* : ~old~ *new* description", messages.values().iterator().next());

    // test if it updates correctly with one add and one delete change
    changeDescription = new ChangeDescription().withPreviousVersion(1.0);
    fieldAdded(changeDescription, "description", "new description");
    fieldDeleted(changeDescription, "description", "old description");

    // now test if both the type of updates give the same message
    Map<EntityLink, String> updatedMessages =
        ChangeEventParser.getFormattedMessages(ChangeEventParser.PUBLISH_TO.SLACK, changeDescription, TABLE);
    assertEquals(1, updatedMessages.size());

    assertEquals(messages.keySet().iterator().next(), updatedMessages.keySet().iterator().next());
    assertEquals(messages.values().iterator().next(), updatedMessages.values().iterator().next());
  }

  @Test
  void testMajorSchemaChange() {
    ChangeDescription changeDescription = new ChangeDescription().withPreviousVersion(1.3);
    // Simulate a change of column name in table
    fieldAdded(
        changeDescription,
        "columns",
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\",\"constraint\":\"NOT_NULL\"}]");

    fieldDeleted(
        changeDescription,
        "columns",
        "[{\"name\":\"lo_order\",\"displayName\":\"lo_order\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_order\",\"constraint\":\"NOT_NULL\"}]");

    Map<EntityLink, String> messages =
        ChangeEventParser.getFormattedMessages(ChangeEventParser.PUBLISH_TO.FEED, changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals(
        "Updated **columns.lo_orderpriority**: <br/> name: \"lo_order <span class=\"diff-added\">priority</span> \" <br/> displayName: \"lo_order <span class=\"diff-added\">priority</span> \" <br/> fullyQualifiedName: \"local_mysql.sample_db.lineorder.lo_order <span class=\"diff-added\">priority</span> \"",
        messages.values().iterator().next());

    // Simulate a change of datatype change in column
    changeDescription = new ChangeDescription().withPreviousVersion(1.3);
    fieldAdded(
        changeDescription,
        "columns",
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\",\"constraint\":\"NOT_NULL\"}]");
    fieldDeleted(
        changeDescription,
        "columns",
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"BLOB\",\"dataLength\":1,\"dataTypeDisplay\":\"blob\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\",\"tags\":[],\"constraint\":\"NOT_NULL\"}]");

    messages = ChangeEventParser.getFormattedMessages(ChangeEventParser.PUBLISH_TO.FEED, changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals(
        "Updated **columns.lo_orderpriority**: <br/> dataType: \" <span class=\"diff-removed\">BLOB</span> <span class=\"diff-added\">INT</span> \" <br/> dataTypeDisplay: \" <span class=\"diff-removed\">blob</span> <span class=\"diff-added\">int</span> \"",
        messages.values().iterator().next());

    // Simulate multiple changes to columns
    changeDescription = new ChangeDescription().withPreviousVersion(1.4);
    fieldAdded(
        changeDescription,
        "columns",
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\"},{\"name\":\"newColumn\",\"displayName\":\"newColumn\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.newColumn\"}]");
    fieldDeleted(
        changeDescription,
        "columns",
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"BLOB\",\"dataLength\":1,\"dataTypeDisplay\":\"blob\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\"}]");

    messages = ChangeEventParser.getFormattedMessages(ChangeEventParser.PUBLISH_TO.FEED, changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals(
        "Updated **columns** : lo_orderpriority <span class=\"diff-added\">, newColumn</span>",
        messages.values().iterator().next());
  }

  @Test
  void testMajorSchemaChangeSlack() {
    ChangeDescription changeDescription = new ChangeDescription().withPreviousVersion(1.3);
    // Simulate a change of column name in table
    fieldAdded(
        changeDescription,
        "columns",
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\",\"constraint\":\"NOT_NULL\"}]");

    fieldDeleted(
        changeDescription,
        "columns",
        "[{\"name\":\"lo_order\",\"displayName\":\"lo_order\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_order\",\"constraint\":\"NOT_NULL\"}]");

    Map<EntityLink, String> messages =
        ChangeEventParser.getFormattedMessages(ChangeEventParser.PUBLISH_TO.SLACK, changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals(
        "Updated *columns.lo_orderpriority*:\n"
            + "name: \"lo_order *priority* \"\n"
            + "displayName: \"lo_order *priority* \"\n"
            + "fullyQualifiedName: \"local_mysql.sample_db.lineorder.lo_order *priority* \"",
        messages.values().iterator().next());

    // Simulate a change of datatype change in column
    changeDescription = new ChangeDescription().withPreviousVersion(1.3);
    fieldAdded(
        changeDescription,
        "columns",
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\",\"constraint\":\"NOT_NULL\"}]");
    fieldDeleted(
        changeDescription,
        "columns",
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"BLOB\",\"dataLength\":1,\"dataTypeDisplay\":\"blob\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\",\"tags\":[],\"constraint\":\"NOT_NULL\"}]");

    messages = ChangeEventParser.getFormattedMessages(ChangeEventParser.PUBLISH_TO.SLACK, changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals(
        "Updated *columns.lo_orderpriority*:\n"
            + "dataType: \" ~BLOB~ *INT* \"\n"
            + "dataTypeDisplay: \" ~blob~ *int* \"",
        messages.values().iterator().next());

    // Simulate multiple changes to columns
    changeDescription = new ChangeDescription().withPreviousVersion(1.4);
    fieldAdded(
        changeDescription,
        "columns",
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\"},{\"name\":\"newColumn\",\"displayName\":\"newColumn\",\"dataType\":\"INT\",\"dataLength\":1,\"dataTypeDisplay\":\"int\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.newColumn\"}]");
    fieldDeleted(
        changeDescription,
        "columns",
        "[{\"name\":\"lo_orderpriority\",\"displayName\":\"lo_orderpriority\",\"dataType\":\"BLOB\",\"dataLength\":1,\"dataTypeDisplay\":\"blob\",\"fullyQualifiedName\":\"local_mysql.sample_db.lineorder.lo_orderpriority\"}]");

    messages = ChangeEventParser.getFormattedMessages(ChangeEventParser.PUBLISH_TO.SLACK, changeDescription, TABLE);
    assertEquals(1, messages.size());

    assertEquals("Updated *columns* : lo_orderpriority *, newColumn*", messages.values().iterator().next());
  }
}
