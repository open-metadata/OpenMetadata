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

import static org.openmetadata.catalog.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.catalog.Entity.FIELD_NAME;
import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.github.difflib.text.DiffRow;
import com.github.difflib.text.DiffRowGenerator;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import javax.json.JsonArray;
import javax.json.JsonObject;
import javax.json.JsonValue;
import javax.json.JsonValue.ValueType;
import javax.json.stream.JsonParsingException;
import org.apache.commons.lang.StringUtils;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.EntityInterface;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.catalog.slack.SlackAttachment;
import org.openmetadata.catalog.slack.SlackMessage;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;

public final class ChangeEventParser {
  public static final String FEED_ADD_MARKER = "<!add>";
  public static final String FEED_REMOVE_MARKER = "<!remove>";
  public static final String SLACK_STRIKE_MARKER = "~%s~ ";
  public static final String FEED_BOLD = "**%s**";
  public static final String SLACK_BOLD = "*%s* ";
  public static final String FEED_SPAN_ADD = "<span class=\"diff-added\">";
  public static final String FEED_SPAN_REMOVE = "<span class=\"diff-removed\">";
  public static final String FEED_SPAN_CLOSE = "</span>";
  public static final String FEED_LINE_BREAK = " <br/> ";
  public static final String SLACK_LINE_BREAK = "\n";

  private ChangeEventParser() {}

  private enum CHANGE_TYPE {
    UPDATE,
    ADD,
    DELETE
  }

  public enum PUBLISH_TO {
    FEED,
    SLACK
  }

  public static SlackMessage buildSlackMessage(ChangeEvent event, String omdurl) {
    SlackMessage slackMessage = new SlackMessage();
    slackMessage.setUsername(event.getUserName());
    if (event.getEntity() != null) {
      String headerTxt = "%s posted on " + event.getEntityType() + " %s";
      String headerText = String.format(headerTxt, event.getUserName(), omdurl);
      slackMessage.setText(headerText);
    }
    Map<EntityLink, String> messages =
        getFormattedMessages(PUBLISH_TO.SLACK, event.getChangeDescription(), (EntityInterface) event.getEntity());
    List<SlackAttachment> attachmentList = new ArrayList<>();
    for (var entryset : messages.entrySet()) {
      SlackAttachment attachment = new SlackAttachment();
      List<String> mark = new ArrayList<>();
      mark.add("text");
      attachment.setMarkdownIn(mark);
      attachment.setText(entryset.getValue());
      attachmentList.add(attachment);
    }
    slackMessage.setAttachments(attachmentList.toArray(new SlackAttachment[0]));
    return slackMessage;
  }

  public static Map<EntityLink, String> getFormattedMessages(
      PUBLISH_TO publishTo, ChangeDescription changeDescription, EntityInterface entity) {
    // Store a map of entityLink -> message
    Map<EntityLink, String> messages;

    List<FieldChange> fieldsUpdated = changeDescription.getFieldsUpdated();
    messages = getFormattedMessagesForAllFieldChange(publishTo, entity, fieldsUpdated, CHANGE_TYPE.UPDATE);

    // fieldsAdded and fieldsDeleted need special handling since
    // there is a possibility to merge them as one update message.
    List<FieldChange> fieldsAdded = changeDescription.getFieldsAdded();
    List<FieldChange> fieldsDeleted = changeDescription.getFieldsDeleted();
    messages.putAll(mergeAddtionsDeletion(publishTo, entity, fieldsAdded, fieldsDeleted));

    return messages;
  }

  private static Map<EntityLink, String> getFormattedMessagesForAllFieldChange(
      PUBLISH_TO publishTo, EntityInterface entity, List<FieldChange> fields, CHANGE_TYPE changeType) {
    Map<EntityLink, String> messages = new HashMap<>();

    for (var field : fields) {
      // if field name has dots, then it is an array field
      String fieldName = field.getName();

      String newFieldValue = getFieldValue(field.getNewValue());
      String oldFieldValue = getFieldValue(field.getOldValue());
      EntityLink link = getEntityLink(fieldName, entity);
      if (!fieldName.equals("failureDetails")) {
        String message = createMessageForField(publishTo, link, changeType, fieldName, oldFieldValue, newFieldValue);
        messages.put(link, message);
      }
    }
    return messages;
  }

  private static String getFieldValue(Object fieldValue) {
    if (fieldValue == null || fieldValue.toString().isEmpty()) {
      return StringUtils.EMPTY;
    }

    try {
      // Check if field value is a json string
      JsonValue json = JsonUtils.readJson(fieldValue.toString());
      if (json.getValueType() == ValueType.ARRAY) {
        JsonArray jsonArray = json.asJsonArray();
        List<String> labels = new ArrayList<>();
        for (var item : jsonArray) {
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

  /** Tries to merge additions and deletions into updates and returns a map of formatted messages. */
  private static Map<EntityLink, String> mergeAddtionsDeletion(
      PUBLISH_TO publishTo, EntityInterface entity, List<FieldChange> addedFields, List<FieldChange> deletedFields) {
    // Major schema version changes such as renaming a column from colA to colB
    // will be recorded as "Removed column colA" and "Added column colB"
    // This method will try to detect such changes and combine those events into one update.

    Map<EntityLink, String> messages = new HashMap<>();

    // if there is only added fields or only deleted fields, we cannot merge
    if (addedFields.isEmpty() || deletedFields.isEmpty()) {
      if (!addedFields.isEmpty()) {
        messages = getFormattedMessagesForAllFieldChange(publishTo, entity, addedFields, CHANGE_TYPE.ADD);
      } else if (!deletedFields.isEmpty()) {
        messages = getFormattedMessagesForAllFieldChange(publishTo, entity, deletedFields, CHANGE_TYPE.DELETE);
      }
      return messages;
    }
    for (var field : deletedFields) {
      Optional<FieldChange> addedField =
          addedFields.stream().filter(f -> f.getName().equals(field.getName())).findAny();
      if (addedField.isPresent()) {
        String fieldName = field.getName();
        EntityLink link = getEntityLink(fieldName, entity);
        // convert the added field and deleted field into one update message
        String message =
            createMessageForField(
                publishTo, link, CHANGE_TYPE.UPDATE, fieldName, field.getOldValue(), addedField.get().getNewValue());
        messages.put(link, message);
        // Remove the field from addedFields list to avoid double processing
        addedFields = addedFields.stream().filter(f -> !f.equals(addedField.get())).collect(Collectors.toList());
      } else {
        // process the deleted field
        messages.putAll(
            getFormattedMessagesForAllFieldChange(
                publishTo, entity, Collections.singletonList(field), CHANGE_TYPE.DELETE));
      }
    }
    // process the remaining added fields
    if (!addedFields.isEmpty()) {
      messages.putAll(getFormattedMessagesForAllFieldChange(publishTo, entity, addedFields, CHANGE_TYPE.ADD));
    }
    return messages;
  }

  private static EntityLink getEntityLink(String fieldName, EntityInterface entity) {
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
      PUBLISH_TO publishTo,
      EntityLink link,
      CHANGE_TYPE changeType,
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
              String.format(
                  ("Followed " + (publishTo == PUBLISH_TO.FEED ? FEED_BOLD : SLACK_BOLD) + " `%s`"),
                  link.getEntityType(),
                  link.getEntityFQN());
        } else if (fieldValue != null && !fieldValue.isEmpty()) {
          message =
              String.format(
                  ("Added " + (publishTo == PUBLISH_TO.FEED ? FEED_BOLD : SLACK_BOLD) + ": `%s`"),
                  updatedField,
                  fieldValue);
        }
        break;
      case UPDATE:
        message = getUpdateMessage(publishTo, updatedField, oldFieldValue, newFieldValue);
        break;
      case DELETE:
        if (Entity.FIELD_FOLLOWERS.equals(updatedField)) {
          message = String.format("Unfollowed %s `%s`", link.getEntityType(), link.getEntityFQN());
        } else {
          message = String.format(("Deleted " + (publishTo == PUBLISH_TO.FEED ? FEED_BOLD : SLACK_BOLD)), updatedField);
        }
        break;
      default:
        break;
    }
    return message;
  }

  private static String getPlainTextUpdateMessage(
      PUBLISH_TO publishTo, String updatedField, String oldValue, String newValue) {
    // Get diff of old value and new value
    String diff = getPlaintextDiff(publishTo, oldValue, newValue);
    return nullOrEmpty(diff)
        ? StringUtils.EMPTY
        : String.format(
            "Updated " + (publishTo == PUBLISH_TO.FEED ? FEED_BOLD : SLACK_BOLD) + ": %s", updatedField, diff);
  }

  private static String getObjectUpdateMessage(
      PUBLISH_TO publishTo, String updatedField, JsonObject oldJson, JsonObject newJson) {
    List<String> labels = new ArrayList<>();
    Set<String> keys = newJson.keySet();
    // check if each key's value is the same
    for (var key : keys) {
      if (!newJson.get(key).equals(oldJson.get(key))) {
        labels.add(
            String.format(
                "%s: %s", key, getPlaintextDiff(publishTo, oldJson.get(key).toString(), newJson.get(key).toString())));
      }
    }
    String updates = String.join((publishTo == PUBLISH_TO.FEED ? FEED_LINE_BREAK : SLACK_LINE_BREAK), labels);
    // Include name of the field if the json contains "name" key
    if (newJson.containsKey("name")) {
      updatedField = String.format("%s.%s", updatedField, newJson.getString("name"));
    }
    return String.format(
        "Updated "
            + (publishTo == PUBLISH_TO.FEED ? FEED_BOLD : SLACK_BOLD)
            + ":"
            + (publishTo == PUBLISH_TO.FEED ? FEED_LINE_BREAK : SLACK_LINE_BREAK)
            + "%s",
        updatedField,
        updates);
  }

  private static String getUpdateMessage(PUBLISH_TO publishTo, String updatedField, Object oldValue, Object newValue) {
    // New value should not be null in any case for an update
    if (newValue == null) {
      return StringUtils.EMPTY;
    }

    if (oldValue == null || oldValue.toString().isEmpty()) {
      return String.format(
          "Updated " + (publishTo == PUBLISH_TO.FEED ? FEED_BOLD : SLACK_BOLD) + " to %s",
          updatedField,
          getFieldValue(newValue));
    } else if (updatedField.contains("tags") || updatedField.contains(FIELD_OWNER)) {
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

  public static String getPlaintextDiff(PUBLISH_TO publishTo, String oldValue, String newValue) {
    // create a configured DiffRowGenerator
    String addMarker = FEED_ADD_MARKER;
    String removeMarker = FEED_REMOVE_MARKER;

    DiffRowGenerator generator =
        DiffRowGenerator.create()
            .showInlineDiffs(true)
            .mergeOriginalRevised(true)
            .inlineDiffByWord(true)
            .oldTag(f -> removeMarker) // introduce a tag to mark removals
            .newTag(f -> addMarker) // introduce a tag to mark new additions
            .build();
    // compute the differences
    List<DiffRow> rows = generator.generateDiffRows(List.of(oldValue), List.of(newValue));

    // merge rows by %n for new line
    String diff = null;
    for (var row : rows) {
      if (diff == null) {
        diff = row.getOldLine();
      } else {
        diff = String.format("%s%n%s", diff, row.getOldLine());
      }
    }

    // The additions and removals will be wrapped by <!add> and <!remove> tags
    // Replace them with html tags to render nicely in the UI
    // Example: This is a test <!remove>sentence<!remove><!add>line<!add>
    // This is a test <span class="diff-removed">sentence</span><span class="diff-added">line</span>
    String spanAdd;
    String spanAddClose;
    String spanRemove;
    String spanRemoveClose;
    if (publishTo == PUBLISH_TO.FEED) {
      spanAdd = FEED_SPAN_ADD;
      spanAddClose = FEED_SPAN_CLOSE;
      spanRemove = FEED_SPAN_REMOVE;
      spanRemoveClose = FEED_SPAN_CLOSE;
    } else {
      spanAdd = "*";
      spanAddClose = "* ";
      spanRemove = "~";
      spanRemoveClose = "~ ";
    }
    if (diff != null) {
      diff = replaceMarkers(diff, addMarker, spanAdd, spanAddClose);
      diff = replaceMarkers(diff, removeMarker, spanRemove, spanRemoveClose);
    }
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
}
