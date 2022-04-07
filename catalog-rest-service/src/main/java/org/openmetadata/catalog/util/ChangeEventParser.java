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
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;

public final class ChangeEventParser {

  private ChangeEventParser() {}

  private enum CHANGE_TYPE {
    UPDATE,
    ADD,
    DELETE
  }

  public static Map<EntityLink, String> getFormattedMessages(ChangeDescription changeDescription, Object entity) {
    // Store a map of entityLink -> message
    Map<EntityLink, String> messages;

    List<FieldChange> fieldsUpdated = changeDescription.getFieldsUpdated();
    messages = getFormattedMessages(entity, fieldsUpdated, CHANGE_TYPE.UPDATE);

    // fieldsAdded and fieldsDeleted need special handling since
    // there is a possibility to merge them as one update message.
    List<FieldChange> fieldsAdded = changeDescription.getFieldsAdded();
    List<FieldChange> fieldsDeleted = changeDescription.getFieldsDeleted();
    messages.putAll(getFormattedMessages(entity, fieldsAdded, fieldsDeleted));

    return messages;
  }

  private static Map<EntityLink, String> getFormattedMessages(
      Object entity, List<FieldChange> fields, CHANGE_TYPE changeType) {
    Map<EntityLink, String> messages = new HashMap<>();

    for (var field : fields) {
      // if field name has dots, then it is an array field
      String fieldName = field.getName();

      String newFieldValue = getFieldValue(field.getNewValue());
      String oldFieldValue = getFieldValue(field.getOldValue());
      EntityLink link = getEntityLink(fieldName, entity);
      if (!fieldName.equals("failureDetails")) {
        String message = getFormattedMessage(link, changeType, fieldName, oldFieldValue, newFieldValue);
        messages.put(link, message);
      }
    }
    return messages;
  }

  private static String getFieldValue(Object fieldValue) {
    if (fieldValue != null && !fieldValue.toString().isEmpty()) {
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
              } else if (keys.contains("displayName")) {
                // Entity Reference will have a displayName
                labels.add(item.asJsonObject().getString("displayName"));
              } else if (keys.contains("name")) {
                // Glossary term references have only "name" field
                labels.add(item.asJsonObject().getString("name"));
              }
            } else if (item.getValueType() == ValueType.STRING) {
              // The string might be enclosed with double quotes
              // Check if has double quotes and strip trailing whitespaces
              String label = item.toString().replaceAll("(?:^\\\")|(?:\\\"$)", "");
              labels.add(label.strip());
            }
          }
          return String.join(", ", labels);
        } else if (json.getValueType() == ValueType.OBJECT) {
          JsonObject jsonObject = json.asJsonObject();
          // Entity Reference will have a displayName
          Set<String> keys = jsonObject.asJsonObject().keySet();
          if (keys.contains("displayName")) {
            return jsonObject.asJsonObject().getString("displayName");
          } else if (keys.contains("name")) {
            return jsonObject.asJsonObject().getString("name");
          }
        }
      } catch (JsonParsingException ex) {
        // If unable to parse json, just return the string
      }
      return fieldValue.toString();
    }
    return StringUtils.EMPTY;
  }

  /**
   * Tries to merge additions and deletions into updates and returns a map of formatted messages.
   *
   * @param entity Entity object.
   * @param addedFields Fields that were added as part of the change event.
   * @param deletedFields Fields that were deleted as part of the change event.
   * @return A map of entity link -> formatted message.
   */
  private static Map<EntityLink, String> getFormattedMessages(
      Object entity, List<FieldChange> addedFields, List<FieldChange> deletedFields) {
    // Major schema version changes such as renaming a column from colA to colB
    // will be recorded as "Removed column colA" and "Added column colB"
    // This method will try to detect such changes and combine those events into one update.

    Map<EntityLink, String> messages = new HashMap<>();

    // if there is only added fields or only deleted fields, we cannot merge
    if (addedFields.isEmpty() || deletedFields.isEmpty()) {
      if (!addedFields.isEmpty()) {
        messages = getFormattedMessages(entity, addedFields, CHANGE_TYPE.ADD);
      } else if (!deletedFields.isEmpty()) {
        messages = getFormattedMessages(entity, deletedFields, CHANGE_TYPE.DELETE);
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
            getFormattedMessage(
                link, CHANGE_TYPE.UPDATE, fieldName, field.getOldValue(), addedField.get().getNewValue());
        messages.put(link, message);
        // Remove the field from addedFields list to avoid double processing
        addedFields = addedFields.stream().filter(f -> !f.equals(addedField.get())).collect(Collectors.toList());
      } else {
        // process the deleted field
        messages.putAll(getFormattedMessages(entity, Collections.singletonList(field), CHANGE_TYPE.DELETE));
      }
    }
    // process the remaining added fields
    if (!addedFields.isEmpty()) {
      messages.putAll(getFormattedMessages(entity, addedFields, CHANGE_TYPE.ADD));
    }
    return messages;
  }

  private static EntityLink getEntityLink(String fieldName, Object entity) {
    EntityReference entityReference = Entity.getEntityReference(entity);
    String entityType = entityReference.getType();
    String entityFQN = entityReference.getName();
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

  private static String getFormattedMessage(
      EntityLink link, CHANGE_TYPE changeType, String fieldName, Object oldFieldValue, Object newFieldValue) {
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
        if (fieldValue != null && !fieldValue.isEmpty()) {
          message = String.format("Added **%s**: `%s`", updatedField, fieldValue);
        }
        break;
      case UPDATE:
        message = getUpdateMessage(updatedField, oldFieldValue, newFieldValue);
        break;
      case DELETE:
        message = String.format("Deleted **%s**", updatedField);
        break;
      default:
        break;
    }
    return message;
  }

  private static String getPlainTextUpdateMessage(String updatedField, String oldValue, String newValue) {
    // Get diff of old value and new value
    String diff = getPlaintextDiff(oldValue, newValue);
    return diff == null || diff.isEmpty()
        ? StringUtils.EMPTY
        : String.format("Updated **%s** : %s", updatedField, diff);
  }

  private static String getObjectUpdateMessage(String updatedField, JsonObject oldJson, JsonObject newJson) {
    List<String> labels = new ArrayList<>();
    Set<String> keys = newJson.keySet();
    // check if each key's value is the same
    for (var key : keys) {
      if (!newJson.get(key).equals(oldJson.get(key))) {
        labels.add(
            String.format("%s: %s", key, getPlaintextDiff(oldJson.get(key).toString(), newJson.get(key).toString())));
      }
    }
    String updates = String.join(" <br/> ", labels);
    // Include name of the field if the json contains "name" key
    if (newJson.containsKey("name")) {
      updatedField = String.format("%s.%s", updatedField, newJson.getString("name"));
    }
    return String.format("Updated **%s** : <br/> %s", updatedField, updates);
  }

  private static String getUpdateMessage(String updatedField, Object oldValue, Object newValue) {
    // New value should not be null in any case for an update
    if (newValue == null) {
      return StringUtils.EMPTY;
    }

    if (oldValue == null || oldValue.toString().isEmpty()) {
      return String.format("Updated **%s** to %s", updatedField, getFieldValue(newValue));
    } else if (updatedField.contains("tags") || updatedField.contains("owner")) {
      return getPlainTextUpdateMessage(updatedField, getFieldValue(oldValue), getFieldValue(newValue));
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
              return getObjectUpdateMessage(updatedField, oldJsonItem, newJsonItem);
            } else {
              return getPlainTextUpdateMessage(updatedField, newItem.toString(), oldItem.toString());
            }
          } else {
            return getPlainTextUpdateMessage(updatedField, getFieldValue(oldValue), getFieldValue(newValue));
          }
        } else if (newJson.getValueType() == ValueType.OBJECT) {
          JsonObject newJsonObject = newJson.asJsonObject();
          JsonObject oldJsonObject = oldJson.asJsonObject();
          return getObjectUpdateMessage(updatedField, oldJsonObject, newJsonObject);
        }
      } catch (JsonParsingException ex) {
        // update is of type String
        // ignore this exception and process update message for plain text
      }
    }
    return getPlainTextUpdateMessage(updatedField, oldValue.toString(), newValue.toString());
  }

  private static String getPlaintextDiff(String oldValue, String newValue) {
    // create a configured DiffRowGenerator
    String addMarker = "<!add>";
    String removeMarker = "<!remove>";
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

    // merge rows by \n for new line
    String diff = null;
    for (var row : rows) {
      if (diff == null) {
        diff = row.getOldLine();
      } else {
        diff = String.format("%s\n%s", diff, row.getOldLine());
      }
    }

    // The additions and removals will be wrapped by <!add> and <!remove> tags
    // Replace them with html tags to render nicely in the UI
    // Example: This is a test <!remove>sentence<!remove><!add>line<!add>
    // This is a test <span class="diff-removed">sentence</span><span class="diff-added">line</span>
    String spanAdd = "<span class=\"diff-added\">";
    String spanRemove = "<span class=\"diff-removed\">";
    String spanClose = "</span>";
    if (diff != null) {
      diff = replaceWithHtml(diff, addMarker, spanAdd, spanClose);
      diff = replaceWithHtml(diff, removeMarker, spanRemove, spanClose);
    }
    return diff;
  }

  private static String replaceWithHtml(String diff, String marker, String openTag, String closeTag) {
    int index = 0;
    while (diff.contains(marker)) {
      String replacement = index % 2 == 0 ? openTag : closeTag;
      diff = diff.replaceFirst(marker, replacement);
      index++;
    }
    return diff;
  }
}
