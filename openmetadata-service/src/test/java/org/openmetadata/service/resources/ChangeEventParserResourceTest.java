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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.FeedUtils.getThreadWithMessage;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
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
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.State;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.formatter.decorators.FeedMessageDecorator;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.decorators.SlackMessageDecorator;
import org.openmetadata.service.resources.databases.TableResourceTest;

@Slf4j
@TestInstance(Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ChangeEventParserResourceTest extends OpenMetadataApplicationTest {
  private Table TABLE;

  public static final MessageDecorator<?> feedMessageFormatter = new FeedMessageDecorator();
  public static final MessageDecorator<?> slackMessageFormatter = new SlackMessageDecorator();

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test); // Initialize TableResourceTest for using helper methods
    TABLE = tableResourceTest.createEntity(test, 1);
  }

  @Test
  void testFormattedMessages() {
    TagLabel oldTag1 = new TagLabel();
    oldTag1.withTagFQN("tag1").withLabelType(LabelType.DERIVED).withState(State.CONFIRMED);

    TagLabel oldTag2 = new TagLabel();
    oldTag2.withTagFQN("tag2").withLabelType(LabelType.DERIVED).withState(State.CONFIRMED);

    ChangeDescription changeDescription = new ChangeDescription();
    // Simulate updating tags of an entity from tag1 -> tag2
    FieldChange addTag = new FieldChange();
    addTag.withName("tags").withNewValue(JsonUtils.pojoToJson(List.of(oldTag2)));
    FieldChange deleteTag = new FieldChange();
    deleteTag.withName("tags").withOldValue(JsonUtils.pojoToJson(List.of(oldTag1)));
    changeDescription
        .withFieldsAdded(List.of(addTag))
        .withFieldsDeleted(List.of(deleteTag))
        .withPreviousVersion(1.0);

    ChangeEvent changeEvent = getChangeEvent(EventType.ENTITY_UPDATED, changeDescription, 1.0, 1.1);

    List<Thread> threadWithMessages = getThreadWithMessage(feedMessageFormatter, changeEvent);
    assertEquals(1, threadWithMessages.size());

    TagLabel tag1 = new TagLabel();
    tag1.withTagFQN("tag1").withLabelType(LabelType.DERIVED).withState(State.CONFIRMED);

    TagLabel tag2 = new TagLabel();
    tag2.withTagFQN("tag2").withLabelType(LabelType.DERIVED).withState(State.CONFIRMED);

    addTag.withNewValue(JsonUtils.pojoToJson(List.of(tag2)));
    deleteTag.withOldValue(JsonUtils.pojoToJson(List.of(tag1)));

    List<Thread> updatedThreadWithMessages =
        getThreadWithMessage(feedMessageFormatter, changeEvent);
    assertEquals(1, updatedThreadWithMessages.size());

    // The entity links and values of both the messages should be the same
    assertEquals(
        threadWithMessages.get(0).getMessage(), updatedThreadWithMessages.get(0).getMessage());
  }

  private ChangeEvent getChangeEvent(
      EventType eventType,
      ChangeDescription changeDescription,
      Double previousVersion,
      Double newVersion) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(eventType)
        .withEntityId(TABLE.getId())
        .withEntityType(Entity.TABLE)
        .withDomains(
            nullOrEmpty(TABLE.getDomains())
                ? null
                : TABLE.getDomains().stream().map(EntityReference::getId).toList())
        .withEntityFullyQualifiedName(TABLE.getFullyQualifiedName())
        .withChangeDescription(changeDescription)
        .withPreviousVersion(previousVersion)
        .withCurrentVersion(newVersion)
        .withEntity(TABLE);
  }

  @Test
  void testEntityReferenceFormat() {
    ChangeDescription changeDescription = new ChangeDescription().withPreviousVersion(1.0);
    // Simulate adding owner to a table
    EntityReference entityReference = new EntityReference();
    entityReference.withId(UUID.randomUUID()).withName("user1").withDisplayName("User One");
    fieldAdded(changeDescription, FIELD_OWNERS, JsonUtils.pojoToJson(List.of(entityReference)));

    ChangeEvent changeEvent = getChangeEvent(EventType.ENTITY_UPDATED, changeDescription, 1.0, 1.1);

    List<Thread> threadWithMessages = getThreadWithMessage(feedMessageFormatter, changeEvent);
    assertEquals(1, threadWithMessages.size());

    assertEquals(
        "Added **owners**: <span data-diff='true' class=\"diff-added\">User One</span>",
        threadWithMessages.get(0).getMessage());
  }

  @Test
  void testUpdateOfString() {
    // Simulate a change of description in table
    ChangeDescription changeDescription = new ChangeDescription();
    fieldUpdated(changeDescription, "description", "old description", "new description");

    ChangeEvent changeEvent = getChangeEvent(EventType.ENTITY_UPDATED, changeDescription, 1.0, 1.1);
    List<Thread> threadMessages = getThreadWithMessage(feedMessageFormatter, changeEvent);
    assertEquals(1, threadMessages.size());

    assertEquals(
        "Updated **description**: <span data-diff='true' class=\"diff-removed\">old</span> "
            + "<span data-diff='true' class=\"diff-added\">new</span> description",
        threadMessages.get(0).getMessage());

    // test if it updates correctly with one add and one delete change
    changeDescription = new ChangeDescription().withPreviousVersion(1.0);
    fieldAdded(changeDescription, "description", "new description");
    fieldDeleted(changeDescription, "description", "old description");

    // now test if both the type of updates give the same message
    changeEvent = getChangeEvent(EventType.ENTITY_UPDATED, changeDescription, 1.0, 1.1);
    List<Thread> threadUpdatedMessages = getThreadWithMessage(feedMessageFormatter, changeEvent);
    assertEquals(1, threadUpdatedMessages.size());

    assertEquals(threadMessages.get(0).getMessage(), threadUpdatedMessages.get(0).getMessage());
    assertEquals(threadMessages.get(0).getAbout(), threadUpdatedMessages.get(0).getAbout());
  }

  @Test
  void testUpdateOfStringSlack() {
    ChangeDescription changeDescription = new ChangeDescription();
    // Simulate a change of description in table
    fieldUpdated(changeDescription, "description", "old description", "new description");

    ChangeEvent changeEvent = getChangeEvent(EventType.ENTITY_UPDATED, changeDescription, 1.0, 1.1);

    List<Thread> threadsWithMessages = getThreadWithMessage(slackMessageFormatter, changeEvent);
    assertEquals(1, threadsWithMessages.size());

    assertEquals(
        "Updated *description*: ~old~ *new* description", threadsWithMessages.get(0).getMessage());

    // test if it updates correctly with one add and one delete change
    changeDescription = new ChangeDescription().withPreviousVersion(1.0);
    fieldAdded(changeDescription, "description", "new description");
    fieldDeleted(changeDescription, "description", "old description");

    changeEvent = getChangeEvent(EventType.ENTITY_UPDATED, changeDescription, 1.0, 1.1);
    List<Thread> threadsWithUpdatedMessages =
        getThreadWithMessage(slackMessageFormatter, changeEvent);
    // now test if both the type of updates give the same message
    assertEquals(1, threadsWithUpdatedMessages.size());

    assertEquals(
        threadsWithMessages.get(0).getAbout(), threadsWithUpdatedMessages.get(0).getAbout());
    assertEquals(
        threadsWithMessages.get(0).getMessage(), threadsWithUpdatedMessages.get(0).getMessage());
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

    ChangeEvent changeEvent = getChangeEvent(EventType.ENTITY_UPDATED, changeDescription, 1.3, 1.4);

    List<Thread> threadWithMessages = getThreadWithMessage(feedMessageFormatter, changeEvent);
    assertEquals(1, threadWithMessages.size());

    assertEquals(
        "Updated **columns**: lo_order <span data-diff='true' class=\"diff-added\">priority</span>",
        threadWithMessages.get(0).getMessage());

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

    changeEvent = getChangeEvent(EventType.ENTITY_UPDATED, changeDescription, 1.3, 1.4);
    threadWithMessages = getThreadWithMessage(feedMessageFormatter, changeEvent);
    assertEquals(1, threadWithMessages.size());

    assertEquals("Updated **columns**: lo_orderpriority", threadWithMessages.get(0).getMessage());

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

    changeEvent = getChangeEvent(EventType.ENTITY_UPDATED, changeDescription, 1.3, 1.4);
    threadWithMessages = getThreadWithMessage(feedMessageFormatter, changeEvent);
    assertEquals(1, threadWithMessages.size());

    assertEquals(
        "Updated **columns**: lo_orderpriority <span data-diff='true' class=\"diff-added\">, newColumn</span>",
        threadWithMessages.get(0).getMessage());
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

    ChangeEvent changeEvent = getChangeEvent(EventType.ENTITY_UPDATED, changeDescription, 1.3, 1.4);
    List<Thread> threadWithMessages = getThreadWithMessage(slackMessageFormatter, changeEvent);
    assertEquals(1, threadWithMessages.size());

    assertEquals("Updated *columns*: lo_order *priority*", threadWithMessages.get(0).getMessage());

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

    changeEvent = getChangeEvent(EventType.ENTITY_UPDATED, changeDescription, 1.3, 1.4);
    threadWithMessages = getThreadWithMessage(slackMessageFormatter, changeEvent);
    assertEquals(1, threadWithMessages.size());

    assertEquals("Updated *columns*: lo_orderpriority", threadWithMessages.get(0).getMessage());

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

    changeEvent = getChangeEvent(EventType.ENTITY_UPDATED, changeDescription, 1.3, 1.4);
    threadWithMessages = getThreadWithMessage(slackMessageFormatter, changeEvent);
    assertEquals(1, threadWithMessages.size());

    assertEquals(
        "Updated *columns*: lo_orderpriority *, newColumn*",
        threadWithMessages.get(0).getMessage());
  }
}
