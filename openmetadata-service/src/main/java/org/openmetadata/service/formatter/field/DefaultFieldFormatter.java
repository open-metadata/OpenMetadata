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

package org.openmetadata.service.formatter.field;

import static java.lang.String.format;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.formatter.util.FormatterUtil.getEntityLinkForFieldName;

import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import jakarta.json.JsonValue;
import jakarta.json.stream.JsonParsingException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.apache.commons.lang.StringUtils;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FormatterUtil;
import org.openmetadata.service.resources.feeds.MessageParser;

public class DefaultFieldFormatter implements FieldFormatter {
  protected final Thread thread;
  protected String fieldChangeName;
  protected final FieldChange fieldChange;
  protected final String fieldOldValue;
  protected final String fieldNewValue;
  protected final MessageDecorator<?> messageDecorator;

  public DefaultFieldFormatter(
      MessageDecorator<?> messageDecorator, Thread thread, FieldChange fieldChange) {
    this.messageDecorator = messageDecorator;
    this.fieldChangeName = getFieldNameChange(fieldChange.getName(), thread);
    this.fieldOldValue = getFieldValue(fieldChange.getOldValue());
    this.fieldNewValue = getFieldValue(fieldChange.getNewValue());
    this.thread = thread;
    this.fieldChange = fieldChange;
  }

  @Override
  public String getFieldChangeName() {
    return fieldChangeName;
  }

  @Override
  public String getFieldOldValue() {
    return fieldOldValue;
  }

  @Override
  public String getFieldNewValue() {
    return fieldNewValue;
  }

  @Override
  public String getFormattedMessage(FormatterUtil.CHANGE_TYPE changeType) {
    String message = "";
    switch (changeType) {
      case ADD -> message = formatAddedField();
      case UPDATE -> message = formatUpdatedField();
      case DELETE -> message = formatDeletedField();
    }
    return message;
  }

  @Override
  public MessageDecorator<?> getMessageDecorator() {
    return messageDecorator;
  }

  @Override
  public MessageParser.EntityLink getEntityLink() {
    return MessageParser.EntityLink.parse(thread.getAbout());
  }

  public String formatAddedField() {
    String message =
        this.messageDecorator.httpAddMarker()
            + this.fieldNewValue
            + this.messageDecorator.httpAddMarker();
    message =
        String.format(
            ("Added " + this.messageDecorator.getBold() + ": %s"), this.fieldChangeName, message);
    String spanAdd = this.messageDecorator.getAddMarker();
    String spanAddClose = this.messageDecorator.getAddMarkerClose();
    if (message != null) {
      message =
          this.messageDecorator.replaceMarkers(
              message, this.messageDecorator.httpAddMarker(), spanAdd, spanAddClose);
    }
    return message;
  }

  public String formatUpdatedField() {
    String message = this.messageDecorator.getPlaintextDiff(this.fieldOldValue, this.fieldNewValue);
    message = String.format("Updated %s: %s", this.messageDecorator.getBold(), message);
    return String.format(message, this.fieldChangeName);
  }

  public String formatDeletedField() {
    String message =
        this.messageDecorator.httpRemoveMarker()
            + this.fieldOldValue
            + this.messageDecorator.httpRemoveMarker();
    message =
        String.format(
            ("Deleted " + this.messageDecorator.getBold() + ": %s"), this.fieldChangeName, message);
    String spanRemove = this.messageDecorator.getRemoveMarker();
    String spanRemoveClose = this.messageDecorator.getRemoveMarkerClose();
    if (message != null) {
      message =
          this.messageDecorator.replaceMarkers(
              message, this.messageDecorator.httpRemoveMarker(), spanRemove, spanRemoveClose);
    }
    return message;
  }

  public static void populateThreadFeedInfo(
      Thread thread,
      String threadMessage,
      Thread.CardStyle cardStyle,
      Thread.FieldOperation operation,
      FeedInfo feedInfo) {
    thread.withMessage(threadMessage);
    thread.withCardStyle(cardStyle);
    thread.withFieldOperation(operation);
    thread.withFeedInfo(feedInfo);
  }

  public static String getFieldValue(Object fieldValue) {
    if (nullOrEmpty(fieldValue)) {
      return StringUtils.EMPTY;
    }
    try {
      JsonValue json = JsonUtils.readJson(fieldValue.toString());
      if (json.getValueType() == JsonValue.ValueType.ARRAY) {
        JsonArray jsonArray = json.asJsonArray();
        List<String> labels = new ArrayList<>();
        for (JsonValue item : jsonArray) {
          if (item.getValueType() == JsonValue.ValueType.OBJECT) {
            Set<String> keys = item.asJsonObject().keySet();
            if (keys.contains("tagFQN")) {
              labels.add(item.asJsonObject().getString("tagFQN"));
            } else if (keys.contains(FIELD_DISPLAY_NAME)) {
              // Entity Reference will have a displayName
              labels.add(item.asJsonObject().getString(FIELD_DISPLAY_NAME));
            } else if (keys.contains(FIELD_NAME)) {
              // Glossary term references has only "name" field
              labels.add(item.asJsonObject().getString(FIELD_NAME));
            } else if (keys.contains("constraintType")) {
              labels.add(item.asJsonObject().getString("constraintType"));
            }
          } else if (item.getValueType() == JsonValue.ValueType.STRING) {
            // The string might be enclosed with double quotes
            // Check if string has double quotes and strip trailing whitespaces
            String label = item.toString().replaceAll("^\"|\"$", "");
            labels.add(label.strip());
          }
        }
        return String.join(", ", labels);
      } else if (json.getValueType() == JsonValue.ValueType.OBJECT) {
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

  public static String getFieldNameChange(String fieldChangeName, Thread thread) {
    MessageParser.EntityLink link = getEntityLinkForFieldName(fieldChangeName, thread);
    String arrayFieldName = link.getArrayFieldName();
    String arrayFieldValue = link.getArrayFieldValue();
    String updatedField = fieldChangeName;
    if (arrayFieldValue != null) {
      updatedField = format("%s.%s", arrayFieldName, arrayFieldValue);
    } else if (arrayFieldName != null) {
      if (arrayFieldName.equals(FIELD_EXTENSION)) {
        return arrayFieldName;
      } else {
        updatedField = format("%s.%s", fieldChangeName, arrayFieldName);
      }
    }
    return updatedField;
  }
}
