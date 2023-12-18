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

package org.openmetadata.service.formatter.util;

import static java.lang.String.format;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_RESTORED;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.formatter.factory.ParserFactory.getFieldParserObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import javax.json.JsonArray;
import javax.json.JsonObject;
import javax.json.JsonValue;
import javax.json.stream.JsonParsingException;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.core.Response;
import org.apache.commons.lang.StringUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.factory.ParserFactory;
import org.openmetadata.service.formatter.field.DefaultFieldFormatter;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

public class FormatterUtil {

  public static MessageParser.EntityLink getEntityLink(String fieldName, EntityInterface entity) {
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

    return new MessageParser.EntityLink(
        entityType, entityFQN, fieldName, arrayFieldName, arrayFieldValue);
  }

  public static String getFieldValue(Object fieldValue) {
    if (CommonUtil.nullOrEmpty(fieldValue)) {
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
              // Glossary term references have only "name" field
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

  ////// used in alerts rule evaluator///
  public static Set<String> getUpdatedField(ChangeEvent event) {
    Set<String> fields = new HashSet<>();
    ChangeDescription description = event.getChangeDescription();
    if (description != null) {
      List<FieldChange> fieldChanges = new ArrayList<>();
      fieldChanges.addAll(description.getFieldsAdded());
      fieldChanges.addAll(description.getFieldsUpdated());
      fieldChanges.addAll(description.getFieldsDeleted());
      fieldChanges.forEach(
          field -> {
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

  public static String transformMessage(
      MessageDecorator<?> messageFormatter,
      FieldChange fieldChange,
      EntityInterface entity,
      CHANGE_TYPE changeType) {
    MessageParser.EntityLink link = getEntityLink(fieldChange.getName(), entity);
    String arrayFieldName = link.getArrayFieldName();
    String arrayFieldValue = link.getArrayFieldValue();

    String message;
    String updatedField = fieldChange.getName();
    if (arrayFieldValue != null) {
      updatedField = format("%s.%s", arrayFieldName, arrayFieldValue);
    } else if (arrayFieldName != null) {
      updatedField = format("%s.%s", fieldChange.getName(), arrayFieldName);
    }

    String oldField = getFieldValue(fieldChange.getOldValue());
    String newField = getFieldValue(fieldChange.getNewValue());
    DefaultFieldFormatter fieldSpecificFormatter;
    if (CommonUtil.nullOrEmpty(arrayFieldValue)) {
      fieldSpecificFormatter =
          getFieldParserObject(messageFormatter, oldField, newField, updatedField, link);
    } else {
      fieldSpecificFormatter =
          getFieldParserObject(messageFormatter, oldField, newField, arrayFieldValue, link);
    }
    message = fieldSpecificFormatter.getFormattedMessage(changeType);
    return message;
  }

  public enum CHANGE_TYPE {
    ADD,
    UPDATE,
    DELETE
  }

  public static Map<MessageParser.EntityLink, String> getFormattedMessages(
      MessageDecorator<?> messageFormatter,
      ChangeDescription changeDescription,
      EntityInterface entity) {
    // Store a map of entityLink -> message
    List<FieldChange> fieldsUpdated = changeDescription.getFieldsUpdated();
    Map<MessageParser.EntityLink, String> messages =
        getFormattedMessagesForAllFieldChange(
            messageFormatter, entity, fieldsUpdated, CHANGE_TYPE.UPDATE);

    // fieldsAdded and fieldsDeleted need special handling since
    // there is a possibility to merge them as one update message.
    List<FieldChange> fieldsAdded = changeDescription.getFieldsAdded();
    List<FieldChange> fieldsDeleted = changeDescription.getFieldsDeleted();
    if (fieldsAdded.isEmpty() || fieldsDeleted.isEmpty()) {
      if (!fieldsAdded.isEmpty()) {
        messages =
            getFormattedMessagesForAllFieldChange(
                messageFormatter, entity, fieldsAdded, CHANGE_TYPE.ADD);
      } else if (!fieldsDeleted.isEmpty()) {
        messages =
            getFormattedMessagesForAllFieldChange(
                messageFormatter, entity, fieldsDeleted, CHANGE_TYPE.DELETE);
      }
      return messages;
    }
    for (FieldChange field : fieldsDeleted) {
      Optional<FieldChange> addedField =
          fieldsAdded.stream().filter(f -> f.getName().equals(field.getName())).findAny();
      if (addedField.isPresent()) {
        String fieldName = field.getName();
        MessageParser.EntityLink link = FormatterUtil.getEntityLink(fieldName, entity);
        // convert the added field and deleted field into one update message
        String message =
            ParserFactory.getEntityParser(link.getEntityType())
                .format(
                    messageFormatter,
                    new FieldChange()
                        .withName(fieldName)
                        .withOldValue(field.getOldValue())
                        .withNewValue(addedField.get().getNewValue()),
                    entity,
                    CHANGE_TYPE.UPDATE);
        messages.put(link, message);
        // Remove the field from addedFields list to avoid double processing
        fieldsAdded =
            fieldsAdded.stream()
                .filter(f -> !f.equals(addedField.get()))
                .collect(Collectors.toList());
      } else {
        // process the deleted field
        messages.putAll(
            getFormattedMessagesForAllFieldChange(
                messageFormatter, entity, Collections.singletonList(field), CHANGE_TYPE.DELETE));
      }
    }
    // process the remaining added fields
    if (!fieldsAdded.isEmpty()) {
      messages.putAll(
          getFormattedMessagesForAllFieldChange(
              messageFormatter, entity, fieldsAdded, CHANGE_TYPE.ADD));
    }
    return messages;
  }

  private static Map<MessageParser.EntityLink, String> getFormattedMessagesForAllFieldChange(
      MessageDecorator<?> messageFormatter,
      EntityInterface entity,
      List<FieldChange> fields,
      CHANGE_TYPE changeType) {
    Map<MessageParser.EntityLink, String> messages = new HashMap<>();
    for (FieldChange field : fields) {
      MessageParser.EntityLink link = FormatterUtil.getEntityLink(field.getName(), entity);
      String message =
          ParserFactory.getEntityParser(link.getEntityType())
              .format(messageFormatter, field, entity, changeType);
      messages.put(link, message);
    }
    return messages;
  }

  public static ChangeEvent getChangeEventFromResponseContext(
      ContainerResponseContext responseContext, String updateBy, String method) {
    // GET operations don't produce change events , Response has no entity to produce change event
    // from
    if (method.equals("GET") || responseContext.getEntity() == null) {
      return null;
    }

    int responseCode = responseContext.getStatus();
    String changeType = responseContext.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER);
    ChangeEvent changeEvent = null;

    // Entity field was updated by PUT .../entities/{id}/fieldName - Example PUT
    // ../tables/{id}/followera
    if (changeType != null && changeType.equals(RestUtil.ENTITY_FIELDS_CHANGED)) {
      changeEvent = (ChangeEvent) responseContext.getEntity();
    } else if (responseContext.getEntity() != null
        && responseContext.getEntity() instanceof EntityInterface) {
      EntityInterface entityInterface = (EntityInterface) responseContext.getEntity();
      EntityReference entityReference = entityInterface.getEntityReference();
      String entityType = entityReference.getType();
      String entityFQN = entityReference.getFullyQualifiedName();
      EventType eventType = changeType != null ? EventType.fromValue(changeType) : null;

      // Entity was created by either POST .../entities or PUT .../entities
      if (responseCode == Response.Status.CREATED.getStatusCode()
          && !RestUtil.ENTITY_FIELDS_CHANGED.equals(changeType)
          && !responseContext.getEntity().getClass().equals(Thread.class)) {
        changeEvent =
            getChangeEvent(updateBy, EventType.ENTITY_CREATED, entityType, entityInterface)
                .withEntity(entityInterface)
                .withEntityFullyQualifiedName(entityFQN);
      } else if (changeType != null
          && changeType.equals(
              RestUtil.LOGICAL_TEST_CASES_ADDED)) { // Handles Bulk Add test cases to a logical test
        // suite
        changeEvent =
            getChangeEvent(updateBy, EventType.ENTITY_UPDATED, entityType, entityInterface)
                .withEntity(entityInterface)
                .withEntityFullyQualifiedName(entityFQN);
      } else if ((changeType != null
              && !RestUtil.ENTITY_NO_CHANGE.equals(
                  changeType)) // PUT or PATCH operation didn't result in any change
          && (changeType.equals(RestUtil.ENTITY_UPDATED)
              || changeType.equals(RestUtil.ENTITY_SOFT_DELETED))) {
        changeEvent =
            getChangeEvent(updateBy, eventType, entityType, entityInterface)
                .withPreviousVersion(entityInterface.getChangeDescription().getPreviousVersion())
                .withEntity(entityInterface)
                .withEntityFullyQualifiedName(entityFQN);
      } else if (changeType != null
          && changeType.equals(
              RestUtil.ENTITY_RESTORED)) { // Entity was restored by PUT ../entities/{id}/restore
        changeEvent =
            getChangeEvent(updateBy, ENTITY_RESTORED, entityType, entityInterface)
                .withPreviousVersion(entityInterface.getVersion())
                .withEntity(entityInterface)
                .withEntityFullyQualifiedName(entityFQN);
      } else if (changeType != null
          && changeType.equals(RestUtil.ENTITY_DELETED)) { // Entity was hard deleted by DELETE
        // ../entities/{id}?hardDelete=true
        changeEvent =
            getChangeEvent(updateBy, ENTITY_DELETED, entityType, entityInterface)
                .withPreviousVersion(entityInterface.getVersion())
                .withEntity(entityInterface)
                .withEntityFullyQualifiedName(entityFQN);
      }
    }
    return changeEvent;
  }

  private static ChangeEvent getChangeEvent(
      String updateBy, EventType eventType, String entityType, EntityInterface entityInterface) {
    return new ChangeEvent()
        .withEventType(eventType)
        .withEntityId(entityInterface.getId())
        .withEntityType(entityType)
        .withUserName(updateBy)
        .withTimestamp(entityInterface.getUpdatedAt())
        .withChangeDescription(entityInterface.getChangeDescription())
        .withCurrentVersion(entityInterface.getVersion());
  }
}
