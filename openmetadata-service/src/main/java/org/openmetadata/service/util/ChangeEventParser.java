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

package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.Entity.FIELD_OWNER;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.INGESTION_PIPELINE;
import static org.openmetadata.service.Entity.KPI;
import static org.openmetadata.service.Entity.TEST_CASE;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import javax.json.JsonArray;
import javax.json.JsonObject;
import javax.json.JsonValue;
import javax.json.JsonValue.ValueType;
import javax.json.stream.JsonParsingException;
import org.apache.commons.lang.StringUtils;
import org.bitbucket.cowwoc.diffmatchpatch.DiffMatchPatch;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.dataInsight.type.KpiResult;
import org.openmetadata.schema.dataInsight.type.KpiTarget;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.ChangeEventConfig;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.emailAlert.EmailMessage;
import org.openmetadata.service.events.subscription.gchat.GChatMessage;
import org.openmetadata.service.events.subscription.msteams.TeamsMessage;
import org.openmetadata.service.events.subscription.slack.SlackAttachment;
import org.openmetadata.service.events.subscription.slack.SlackMessage;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

public final class ChangeEventParser {
  public static final String FEED_ADD_MARKER = "<!add>";
  public static final String FEED_REMOVE_MARKER = "<!remove>";
  public static final String FEED_BOLD = "**%s**";
  public static final String SLACK_BOLD = "*%s*";
  public static final String FEED_SPAN_ADD = "<span class=\"diff-added\">";
  public static final String FEED_SPAN_REMOVE = "<span class=\"diff-removed\">";
  public static final String FEED_SPAN_CLOSE = "</span>";
  public static final String FEED_LINE_BREAK = " <br/> ";
  public static final String SLACK_LINE_BREAK = "\n";

  private ChangeEventParser() {}

  public enum ChangeType {
    UPDATE,
    ADD,
    DELETE
  }

  public enum PublishTo {
    FEED,
    SLACK,
    TEAMS,
    GCHAT,
    EMAIL
  }

  public static String getBold(PublishTo publishTo) {
    switch (publishTo) {
      case FEED:
      case TEAMS:
        // TEAMS and FEED bold formatting is same
        return FEED_BOLD;
      case SLACK:
        return SLACK_BOLD;
      case GCHAT:
      case EMAIL:
        return "<b>%s</b>";
      default:
        return "INVALID";
    }
  }

  public static String getLineBreak(PublishTo publishTo) {
    switch (publishTo) {
      case FEED:
      case TEAMS:
      case GCHAT:
      case EMAIL:
        // TEAMS, GCHAT, FEED linebreak formatting are same
        return FEED_LINE_BREAK;
      case SLACK:
        return SLACK_LINE_BREAK;
      default:
        return "INVALID";
    }
  }

  public static String getAddMarker(PublishTo publishTo) {
    switch (publishTo) {
      case FEED:
        return FEED_SPAN_ADD;
      case TEAMS:
        return "**";
      case SLACK:
        return "*";
      case GCHAT:
      case EMAIL:
        return "<b>";
      default:
        return "INVALID";
    }
  }

  public static String getAddMarkerClose(PublishTo publishTo) {
    switch (publishTo) {
      case FEED:
        return FEED_SPAN_CLOSE;
      case TEAMS:
        return "** ";
      case SLACK:
        return "*";
      case GCHAT:
      case EMAIL:
        return "</b>";
      default:
        return "INVALID";
    }
  }

  public static String getRemoveMarker(PublishTo publishTo) {
    switch (publishTo) {
      case FEED:
        return FEED_SPAN_REMOVE;
      case TEAMS:
        return "~~";
      case SLACK:
        return "~";
      case GCHAT:
      case EMAIL:
        return "<s>";
      default:
        return "INVALID";
    }
  }

  public static String getRemoveMarkerClose(PublishTo publishTo) {
    switch (publishTo) {
      case FEED:
        return FEED_SPAN_CLOSE;
      case TEAMS:
        return "~~ ";
      case SLACK:
        return "~";
      case GCHAT:
      case EMAIL:
        return "</s>";
      default:
        return "INVALID";
    }
  }

  public static String getEntityUrl(PublishTo publishTo, ChangeEvent event) {
    String fqn;
    String entityType;
    EntityInterface entity = (EntityInterface) event.getEntity();
    if (entity instanceof TestCase) {
      fqn = ((TestCase) entity).getTestSuite().getFullyQualifiedName();
      entityType = "test-suites";
    } else {
      fqn = event.getEntityFullyQualifiedName();
      entityType = event.getEntityType();
    }
    if (publishTo == PublishTo.SLACK || publishTo == PublishTo.GCHAT) {
      return String.format(
          "<%s/%s/%s|%s>",
          ChangeEventConfig.getInstance().getOmUri(), entityType, fqn.trim().replaceAll(" ", "%20"), fqn.trim());
    } else if (publishTo == PublishTo.TEAMS) {
      return String.format("[%s](/%s/%s)", fqn.trim(), ChangeEventConfig.getInstance().getOmUri(), entityType);
    } else if (publishTo == PublishTo.EMAIL) {
      return String.format(
          "<a href = '%s/%s/%s'>%s</a>",
          ChangeEventConfig.getInstance().getOmUri(), entityType, fqn.trim(), fqn.trim());
    }
    //    }
    return "";
  }

  public static SlackMessage buildSlackMessage(ChangeEvent event) {
    SlackMessage slackMessage = new SlackMessage();
    slackMessage.setUsername(event.getUserName());
    if (event.getEntity() != null) {
      String eventType;
      if (event.getEntity() instanceof TestCase) {
        eventType = "testSuite";
      } else {
        eventType = event.getEntityType();
      }
      String headerTxt;
      String headerText;
      if (eventType.equals(Entity.QUERY)) {
        headerTxt = "%s posted on " + eventType;
        headerText = String.format(headerTxt, event.getUserName());
      } else {
        headerTxt = "%s posted on " + eventType + " %s";
        headerText = String.format(headerTxt, event.getUserName(), getEntityUrl(PublishTo.SLACK, event));
      }
      slackMessage.setText(headerText);
    }
    Map<EntityLink, String> messages =
        getFormattedMessages(PublishTo.SLACK, event.getChangeDescription(), (EntityInterface) event.getEntity());
    List<SlackAttachment> attachmentList = new ArrayList<>();
    for (Entry<EntityLink, String> entry : messages.entrySet()) {
      SlackAttachment attachment = new SlackAttachment();
      List<String> mark = new ArrayList<>();
      mark.add("text");
      attachment.setMarkdownIn(mark);
      attachment.setText(entry.getValue());
      attachmentList.add(attachment);
    }
    slackMessage.setAttachments(attachmentList.toArray(new SlackAttachment[0]));
    return slackMessage;
  }

  public static EmailMessage buildEmailMessage(ChangeEvent event) {
    EmailMessage emailMessage = new EmailMessage();
    emailMessage.setUserName(event.getUserName());
    if (event.getEntity() != null) {
      emailMessage.setUpdatedBy(event.getUserName());
      if (event.getEntityType().equals(Entity.QUERY)) {
        emailMessage.setEntityUrl(Entity.QUERY);
      } else {
        emailMessage.setEntityUrl(getEntityUrl(PublishTo.EMAIL, event));
      }
    }
    Map<EntityLink, String> messages =
        getFormattedMessages(PublishTo.EMAIL, event.getChangeDescription(), (EntityInterface) event.getEntity());
    List<String> changeMessage = new ArrayList<>();
    for (Entry<EntityLink, String> entry : messages.entrySet()) {
      changeMessage.add(entry.getValue());
    }
    emailMessage.setChangeMessage(changeMessage);
    return emailMessage;
  }

  public static TeamsMessage buildTeamsMessage(ChangeEvent event) {
    TeamsMessage teamsMessage = new TeamsMessage();
    teamsMessage.setSummary("Change Event From OMD");
    TeamsMessage.Section teamsSections = new TeamsMessage.Section();
    if (event.getEntity() != null) {
      String headerTxt = "%s posted on " + event.getEntityType() + " %s";
      String headerText = String.format(headerTxt, event.getUserName(), getEntityUrl(PublishTo.TEAMS, event));
      teamsSections.setActivityTitle(headerText);
    }
    Map<EntityLink, String> messages =
        getFormattedMessages(PublishTo.TEAMS, event.getChangeDescription(), (EntityInterface) event.getEntity());
    List<TeamsMessage.Section> attachmentList = new ArrayList<>();
    for (Entry<EntityLink, String> entry : messages.entrySet()) {
      TeamsMessage.Section section = new TeamsMessage.Section();
      section.setActivityTitle(teamsSections.getActivityTitle());
      section.setActivityText(entry.getValue());
      attachmentList.add(section);
    }
    teamsMessage.setSections(attachmentList);
    return teamsMessage;
  }

  public static GChatMessage buildGChatMessage(ChangeEvent event) {
    GChatMessage gChatMessage = new GChatMessage();
    GChatMessage.CardsV2 cardsV2 = new GChatMessage.CardsV2();
    GChatMessage.Card card = new GChatMessage.Card();
    GChatMessage.Section section = new GChatMessage.Section();
    if (event.getEntity() != null) {
      String headerTemplate = "%s posted on %s %s";
      String headerText =
          String.format(
              headerTemplate, event.getUserName(), event.getEntityType(), getEntityUrl(PublishTo.GCHAT, event));
      gChatMessage.setText(headerText);
      GChatMessage.CardHeader cardHeader = new GChatMessage.CardHeader();
      String cardHeaderText =
          String.format(
              headerTemplate,
              event.getUserName(),
              event.getEntityType(),
              ((EntityInterface) event.getEntity()).getName());
      cardHeader.setTitle(cardHeaderText);
      card.setHeader(cardHeader);
    }
    Map<EntityLink, String> messages =
        getFormattedMessages(PublishTo.GCHAT, event.getChangeDescription(), (EntityInterface) event.getEntity());
    List<GChatMessage.Widget> widgets = new ArrayList<>();
    for (Entry<EntityLink, String> entry : messages.entrySet()) {
      GChatMessage.Widget widget = new GChatMessage.Widget();
      widget.setTextParagraph(new GChatMessage.TextParagraph(entry.getValue()));
      widgets.add(widget);
    }
    section.setWidgets(widgets);
    card.setSections(List.of(section));
    cardsV2.setCard(card);
    gChatMessage.setCardsV2(List.of(cardsV2));
    return gChatMessage;
  }

  public static Map<EntityLink, String> getFormattedMessages(
      PublishTo publishTo, ChangeDescription changeDescription, EntityInterface entity) {
    // Store a map of entityLink -> message
    Map<EntityLink, String> messages;

    List<FieldChange> fieldsUpdated = changeDescription.getFieldsUpdated();
    messages = getFormattedMessagesForAllFieldChange(publishTo, entity, fieldsUpdated, ChangeType.UPDATE);

    // fieldsAdded and fieldsDeleted need special handling since
    // there is a possibility to merge them as one update message.
    List<FieldChange> fieldsAdded = changeDescription.getFieldsAdded();
    List<FieldChange> fieldsDeleted = changeDescription.getFieldsDeleted();
    messages.putAll(mergeAdditionsDeletion(publishTo, entity, fieldsAdded, fieldsDeleted));

    return messages;
  }

  private static Map<EntityLink, String> getFormattedMessagesForAllFieldChange(
      PublishTo publishTo, EntityInterface entity, List<FieldChange> fields, ChangeType changeType) {
    Map<EntityLink, String> messages = new HashMap<>();

    for (FieldChange field : fields) {
      // if field name has dots, then it is an array field
      String fieldName = field.getName();
      String newFieldValue;
      String oldFieldValue;
      EntityLink link = getEntityLink(fieldName, entity);
      if (entity.getEntityReference().getType().equals(Entity.QUERY) && fieldName.equals("queryUsedIn")) {
        String message =
            handleQueryUsage(field.getNewValue(), field.getOldValue(), entity, publishTo, changeType, link);
        messages.put(link, message);
        return messages;
      } else {
        newFieldValue = getFieldValue(field.getNewValue());
        oldFieldValue = getFieldValue(field.getOldValue());
      }
      if (link.getEntityType().equals(TEST_CASE) && link.getFieldName().equals("testCaseResult")) {
        String message = handleTestCaseResult(publishTo, entity, field.getNewValue());
        messages.put(link, message);
      } else if (link.getEntityType().equals(KPI) && link.getFieldName().equals("kpiResult")) {
        String message = handleKpiResult(publishTo, entity, field.getNewValue());
        messages.put(link, message);
      } else if (link.getEntityType().equals(INGESTION_PIPELINE) && link.getFieldName().equals("pipelineStatus")) {
        String message = handleIngestionPipelineResult(publishTo, entity, field.getNewValue());
        messages.put(link, message);
      } else if (!fieldName.equals("failureDetails")) {
        String message = createMessageForField(publishTo, link, changeType, fieldName, oldFieldValue, newFieldValue);
        messages.put(link, message);
      }
    }
    return messages;
  }

  public static String getFieldValue(Object fieldValue) {
    if (CommonUtil.nullOrEmpty(fieldValue)) {
      return StringUtils.EMPTY;
    }
    try {
      JsonValue json = JsonUtils.readJson(fieldValue.toString());
      if (json.getValueType() == ValueType.ARRAY) {
        JsonArray jsonArray = json.asJsonArray();
        List<String> labels = new ArrayList<>();
        for (JsonValue item : jsonArray) {
          if (item.getValueType() == ValueType.OBJECT) {
            Set<String> keys = item.asJsonObject().keySet();
            if (keys.contains("tagFQN")) {
              labels.add(item.asJsonObject().getString("tagFQN"));
            } else if (keys.contains(FIELD_DISPLAY_NAME)) {
              // Entity Reference will have a displayName
              labels.add(item.asJsonObject().getString(FIELD_DISPLAY_NAME));
            } else if (keys.contains(FIELD_NAME)) {
              // Glossary term references have only "name" field
              labels.add(item.asJsonObject().getString(FIELD_NAME));
            } else if (keys.contains("constraintType")) {
              labels.add(item.asJsonObject().getString("constraintType"));
            }
          } else if (item.getValueType() == ValueType.STRING) {
            // The string might be enclosed with double quotes
            // Check if string has double quotes and strip trailing whitespaces
            String label = item.toString().replaceAll("^\"|\"$", "");
            labels.add(label.strip());
          }
        }
        return String.join(", ", labels);
      } else if (json.getValueType() == ValueType.OBJECT) {
        JsonObject jsonObject = json.asJsonObject();
        // Entity Reference will have a displayName
        Set<String> keys = jsonObject.asJsonObject().keySet();
        if (keys.contains(FIELD_DISPLAY_NAME)) {
          return jsonObject.asJsonObject().getString(FIELD_DISPLAY_NAME);
        } else if (keys.contains(FIELD_NAME)) {
          return jsonObject.asJsonObject().getString(FIELD_NAME);
        }
      }
    } catch (JsonParsingException ex) {
      // If unable to parse json, just return the string
    }
    return fieldValue.toString();
  }

  private static String handleQueryUsage(
      Object newValue,
      Object oldValue,
      EntityInterface entity,
      PublishTo publishTo,
      ChangeType changeType,
      EntityLink link) {
    String fieldName = "queryUsage";
    String newVal = getFieldValueForQuery(newValue, entity, publishTo);
    String oldVal = getFieldValueForQuery(oldValue, entity, publishTo);
    return createMessageForField(publishTo, link, changeType, fieldName, oldVal, newVal);
  }

  private static String getFieldValueForQuery(Object fieldValue, EntityInterface entity, PublishTo publishTo) {
    Query query = (Query) entity;
    StringBuilder field = new StringBuilder();
    @SuppressWarnings("unchecked")
    List<EntityReference> queryUsedIn = (List<EntityReference>) fieldValue;
    field.append("for ").append("'").append(query.getQuery()).append("'").append(", ").append(getLineBreak(publishTo));
    field.append("Query Used in :- ");
    int i = 1;
    for (EntityReference queryUsage : queryUsedIn) {
      field.append(getQueryUsageUrl(publishTo, queryUsage.getFullyQualifiedName(), queryUsage.getType()));
      if (i < queryUsedIn.size()) {
        field.append(", ");
      }
      i++;
    }
    return field.toString();
  }

  private static String getQueryUsageUrl(PublishTo publishTo, String fqn, String entityType) {
    if (publishTo == PublishTo.SLACK || publishTo == PublishTo.GCHAT) {
      return String.format(
          "<%s/%s/%s|%s>",
          ChangeEventConfig.getInstance().getOmUri(), entityType, fqn.trim().replaceAll(" ", "%20"), fqn.trim());
    } else if (publishTo == PublishTo.TEAMS) {
      return String.format("[%s](/%s/%s)", fqn, ChangeEventConfig.getInstance().getOmUri(), entityType);
    } else if (publishTo == PublishTo.EMAIL) {
      return String.format(
          "<a href = '%s/%s/%s'>%s</a>",
          ChangeEventConfig.getInstance().getOmUri(), entityType, fqn.trim(), fqn.trim());
    }
    return String.format("[%s](/%s/%s)", fqn, entityType, fqn.trim());
  }

  /** Tries to merge additions and deletions into updates and returns a map of formatted messages. */
  private static Map<EntityLink, String> mergeAdditionsDeletion(
      PublishTo publishTo, EntityInterface entity, List<FieldChange> addedFields, List<FieldChange> deletedFields) {
    // Major schema version changes such as renaming a column from colA to colB
    // will be recorded as "Removed column colA" and "Added column colB"
    // This method will try to detect such changes and combine those events into one update.

    Map<EntityLink, String> messages = new HashMap<>();

    // if there is only added fields or only deleted fields, we cannot merge
    if (addedFields.isEmpty() || deletedFields.isEmpty()) {
      if (!addedFields.isEmpty()) {
        messages = getFormattedMessagesForAllFieldChange(publishTo, entity, addedFields, ChangeType.ADD);
      } else if (!deletedFields.isEmpty()) {
        messages = getFormattedMessagesForAllFieldChange(publishTo, entity, deletedFields, ChangeType.DELETE);
      }
      return messages;
    }
    for (FieldChange field : deletedFields) {
      Optional<FieldChange> addedField =
          addedFields.stream().filter(f -> f.getName().equals(field.getName())).findAny();
      if (addedField.isPresent()) {
        String fieldName = field.getName();
        EntityLink link = getEntityLink(fieldName, entity);
        // convert the added field and deleted field into one update message
        String message =
            createMessageForField(
                publishTo, link, ChangeType.UPDATE, fieldName, field.getOldValue(), addedField.get().getNewValue());
        messages.put(link, message);
        // Remove the field from addedFields list to avoid double processing
        addedFields = addedFields.stream().filter(f -> !f.equals(addedField.get())).collect(Collectors.toList());
      } else {
        // process the deleted field
        messages.putAll(
            getFormattedMessagesForAllFieldChange(
                publishTo, entity, Collections.singletonList(field), ChangeType.DELETE));
      }
    }
    // process the remaining added fields
    if (!addedFields.isEmpty()) {
      messages.putAll(getFormattedMessagesForAllFieldChange(publishTo, entity, addedFields, ChangeType.ADD));
    }
    return messages;
  }

  public static EntityLink getEntityLink(String fieldName, EntityInterface entity) {
    EntityReference entityReference = entity.getEntityReference();
    String entityType = entityReference.getType();
    String entityFQN = entityReference.getFullyQualifiedName();
    String arrayFieldName = null;
    String arrayFieldValue = null;

    if (fieldName.contains(".")) {
      String[] fieldNameParts = FullyQualifiedName.split(fieldName);
      // For array type, it should have 3 parts. ex: columns.comment.description
      fieldName = fieldNameParts[0];
      if (fieldNameParts.length == 3) {
        arrayFieldName = fieldNameParts[1];
        arrayFieldValue = fieldNameParts[2];
      } else if (fieldNameParts.length == 2) {
        arrayFieldName = fieldNameParts[1];
      }
    }

    return new EntityLink(entityType, entityFQN, fieldName, arrayFieldName, arrayFieldValue);
  }

  private static String createMessageForField(
      PublishTo publishTo,
      EntityLink link,
      ChangeType changeType,
      String fieldName,
      Object oldFieldValue,
      Object newFieldValue) {
    String arrayFieldName = link.getArrayFieldName();
    String arrayFieldValue = link.getArrayFieldValue();

    String message = null;
    String updatedField = fieldName;
    if (arrayFieldValue != null) {
      updatedField = String.format("%s.%s", arrayFieldName, arrayFieldValue);
    } else if (arrayFieldName != null) {
      updatedField = String.format("%s.%s", fieldName, arrayFieldName);
    }

    switch (changeType) {
      case ADD:
        String fieldValue = getFieldValue(newFieldValue);
        if (Entity.FIELD_FOLLOWERS.equals(updatedField)) {
          message =
              String.format(("Followed " + getBold(publishTo) + " `%s`"), link.getEntityType(), link.getEntityFQN());
        } else if (fieldValue != null && !fieldValue.isEmpty()) {
          message =
              String.format(
                  ("Added " + getBold(publishTo) + ": " + getBold(publishTo)), updatedField, fieldValue.trim());
        }
        break;
      case UPDATE:
        message = getUpdateMessage(publishTo, updatedField, oldFieldValue, newFieldValue);
        break;
      case DELETE:
        if (Entity.FIELD_FOLLOWERS.equals(updatedField)) {
          message = String.format("Unfollowed %s `%s`", link.getEntityType(), link.getEntityFQN());
        } else {
          message =
              String.format(
                  ("Deleted " + getBold(publishTo) + ": `%s`"), updatedField, getFieldValue(oldFieldValue).trim());
        }
        break;
      default:
        break;
    }
    return message;
  }

  private static String getPlainTextUpdateMessage(
      PublishTo publishTo, String updatedField, String oldValue, String newValue) {
    // Get diff of old value and new value
    String diff = getPlaintextDiff(publishTo, oldValue, newValue);
    if (nullOrEmpty(diff)) {
      return StringUtils.EMPTY;
    } else {
      String field = String.format("Updated %s: %s", getBold(publishTo), diff);
      return String.format(field, updatedField);
    }
  }

  private static String getObjectUpdateMessage(
      PublishTo publishTo, String updatedField, JsonObject oldJson, JsonObject newJson) {
    List<String> labels = new ArrayList<>();
    Set<String> keys = newJson.keySet();
    // check if each key's value is the same
    for (String key : keys) {
      if (!newJson.get(key).equals(oldJson.get(key))) {
        labels.add(
            String.format(
                "%s: %s", key, getPlaintextDiff(publishTo, oldJson.get(key).toString(), newJson.get(key).toString())));
      }
    }
    String updates = String.join(getLineBreak(publishTo), labels);
    // Include name of the field if the json contains "name" key
    if (newJson.containsKey("name")) {
      updatedField = String.format("%s.%s", updatedField, newJson.getString("name"));
    }
    String format = String.format("Updated %s:%s%s", getBold(publishTo), getLineBreak(publishTo), updates);
    return String.format(format, updatedField);
  }

  private static String getUpdateMessage(PublishTo publishTo, String updatedField, Object oldValue, Object newValue) {
    // New value should not be null in any case for an update
    if (newValue == null) {
      return StringUtils.EMPTY;
    }

    if (nullOrEmpty(oldValue)) {
      String format = String.format("Updated %s to %s", getBold(publishTo), getFieldValue(newValue));
      return String.format(format, updatedField);
    } else if (updatedField.contains(FIELD_TAGS) || updatedField.contains(FIELD_OWNER)) {
      return getPlainTextUpdateMessage(publishTo, updatedField, getFieldValue(oldValue), getFieldValue(newValue));
    }
    // if old value is not empty, and is of type array or object, the updates can be across multiple keys
    // Example: [{name: "col1", dataType: "varchar", dataLength: "20"}]

    if (!newValue.toString().isEmpty()) {
      try {
        // Check if field value is a json string
        JsonValue newJson = JsonUtils.readJson(newValue.toString());
        JsonValue oldJson = JsonUtils.readJson(oldValue.toString());
        if (newJson.getValueType() == ValueType.ARRAY) {
          JsonArray newJsonArray = newJson.asJsonArray();
          JsonArray oldJsonArray = oldJson.asJsonArray();
          if (newJsonArray.size() == 1 && oldJsonArray.size() == 1) {
            // if there is only one item in the array, it can be safely considered as an update
            JsonValue newItem = newJsonArray.get(0);
            JsonValue oldItem = oldJsonArray.get(0);
            if (newItem.getValueType() == ValueType.OBJECT) {
              JsonObject newJsonItem = newItem.asJsonObject();
              JsonObject oldJsonItem = oldItem.asJsonObject();
              return getObjectUpdateMessage(publishTo, updatedField, oldJsonItem, newJsonItem);
            } else {
              return getPlainTextUpdateMessage(publishTo, updatedField, newItem.toString(), oldItem.toString());
            }
          } else {
            return getPlainTextUpdateMessage(publishTo, updatedField, getFieldValue(oldValue), getFieldValue(newValue));
          }
        } else if (newJson.getValueType() == ValueType.OBJECT) {
          JsonObject newJsonObject = newJson.asJsonObject();
          JsonObject oldJsonObject = oldJson.asJsonObject();
          return getObjectUpdateMessage(publishTo, updatedField, oldJsonObject, newJsonObject);
        }
      } catch (JsonParsingException ex) {
        // update is of type String
        // ignore this exception and process update message for plain text
      }
    }
    return getPlainTextUpdateMessage(publishTo, updatedField, oldValue.toString(), newValue.toString());
  }

  public static String handleTestCaseResult(PublishTo publishTo, EntityInterface entity, Object newValue) {
    String testCaseName = entity.getName();
    TestCaseResult result = (TestCaseResult) newValue;
    TestCase testCaseEntity = (TestCase) entity;
    if (result != null) {
      String format =
          String.format(
              "Test Case status for %s against table/column %s is %s in test suite %s",
              getBold(publishTo),
              EntityLink.parse(testCaseEntity.getEntityLink()).getEntityFQN(),
              getBold(publishTo),
              testCaseEntity.getTestSuite().getName());
      return String.format(format, testCaseName, result.getTestCaseStatus());
    } else {
      String format =
          String.format(
              "Test Case %s is updated in %s/%s",
              getBold(publishTo),
              EntityLink.parse(testCaseEntity.getEntityLink()).getEntityFQN(),
              testCaseEntity.getTestSuite().getName());
      return String.format(format, testCaseName);
    }
  }

  public static String handleIngestionPipelineResult(PublishTo publishTo, EntityInterface entity, Object newValue) {
    String ingestionPipelineName = entity.getName();
    PipelineStatus status = (PipelineStatus) newValue;
    if (status != null) {
      String date = new SimpleDateFormat("dd/MM/yyyy HH:mm:ss").format(new Date(status.getEndDate()));
      String format = String.format("Ingestion Pipeline %s %s at %s", getBold(publishTo), getBold(publishTo), date);
      return String.format(format, ingestionPipelineName, status.getPipelineState());
    } else {
      String format = String.format("Ingestion Pipeline %s is updated", getBold(publishTo));
      return String.format(format, ingestionPipelineName);
    }
  }

  public static String handleKpiResult(PublishTo publishTo, EntityInterface entity, Object newValue) {
    String kpiName = entity.getName();
    KpiResult result = (KpiResult) newValue;
    if (result != null) {
      String format =
          String.format(
              "Added Results for %s. Target Name : %s , Current Value: %s, Target Met: %s",
              getBold(publishTo), getBold(publishTo), getBold(publishTo), getBold(publishTo));
      KpiTarget target = result.getTargetResult().get(0);
      return String.format(format, kpiName, target.getName(), target.getValue(), target.getTargetMet());
    } else {
      String format = String.format("KpiResult %s is updated.", getBold(publishTo));
      return String.format(format, kpiName);
    }
  }

  public static String getPlaintextDiff(PublishTo publishTo, String oldValue, String newValue) {
    // create a configured DiffRowGenerator
    String addMarker = FEED_ADD_MARKER;
    String removeMarker = FEED_REMOVE_MARKER;

    DiffMatchPatch dmp = new DiffMatchPatch();
    LinkedList<DiffMatchPatch.Diff> diffs = dmp.diffMain(oldValue, newValue);
    dmp.diffCleanupSemantic(diffs);
    StringBuilder outputStr = new StringBuilder();
    for (DiffMatchPatch.Diff d : diffs) {
      if (DiffMatchPatch.Operation.EQUAL.equals(d.operation)) {
        // merging equal values of both string
        outputStr.append(d.text.trim()).append(" ");
      } else if (DiffMatchPatch.Operation.INSERT.equals(d.operation)) {
        // merging added values with addMarker before and after of new values added
        outputStr.append(addMarker).append(d.text.trim()).append(addMarker).append(" ");
      } else {
        // merging deleted values with removeMarker before and after of old value removed ..
        outputStr.append(removeMarker).append(d.text.trim()).append(removeMarker).append(" ");
      }
    }
    String diff = outputStr.toString().trim();
    // The additions and removals will be wrapped by <!add> and <!remove> tags
    // Replace them with html tags to render nicely in the UI
    // Example: This is a test <!remove>sentence<!remove><!add>line<!add>
    // This is a test <span class="diff-removed">sentence</span><span class="diff-added">line</span>
    String spanAdd = getAddMarker(publishTo);
    String spanAddClose = getAddMarkerClose(publishTo);
    String spanRemove = getRemoveMarker(publishTo);
    String spanRemoveClose = getRemoveMarkerClose(publishTo);
    diff = replaceMarkers(diff, addMarker, spanAdd, spanAddClose);
    diff = replaceMarkers(diff, removeMarker, spanRemove, spanRemoveClose);
    return diff;
  }

  private static String replaceMarkers(String diff, String marker, String openTag, String closeTag) {
    int index = 0;
    while (diff.contains(marker)) {
      String replacement = index % 2 == 0 ? openTag : closeTag;
      diff = diff.replaceFirst(marker, replacement);
      index++;
    }
    return diff;
  }

  public static Set<String> getUpdatedField(ChangeEvent event) {
    Set<String> fields = new HashSet<>();
    ChangeDescription description = event.getChangeDescription();
    if (description != null) {
      List<FieldChange> fieldChanges = new ArrayList<>();
      fieldChanges.addAll(description.getFieldsAdded());
      fieldChanges.addAll(description.getFieldsUpdated());
      fieldChanges.addAll(description.getFieldsDeleted());
      fieldChanges.forEach(
          (field) -> {
            String fieldName = field.getName();
            if (fieldName.contains(".")) {
              String[] tokens = fieldName.split("\\.");
              fields.add(tokens[tokens.length - 1]);
            } else {
              fields.add(fieldName);
            }
          });
    }
    return fields;
  }
}
