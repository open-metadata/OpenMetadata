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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.Entity.THREAD;
import static org.openmetadata.service.formatter.factory.ParserFactory.getFieldParserObject;
import static org.openmetadata.service.formatter.field.DefaultFieldFormatter.getFieldNameChange;

import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.factory.ParserFactory;
import org.openmetadata.service.formatter.field.DefaultFieldFormatter;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class FormatterUtil {

  public static MessageParser.EntityLink getEntityLinkForFieldName(
      String fieldName, Thread thread) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(thread.getAbout());
    String entityType = thread.getEntityRef().getType();
    String entityFQN = entityLink.getEntityFQN();
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
        // Extension is not a subfield
        if (fieldNameParts[0].equals(FIELD_EXTENSION)) {
          arrayFieldName = fieldNameParts[0];
        } else {
          arrayFieldName = fieldNameParts[1];
        }
      }
    }

    return new MessageParser.EntityLink(
        entityType, entityFQN, fieldName, arrayFieldName, arrayFieldValue);
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
              // Extension Parsing is different from entity fields
              if (tokens[0].equals(FIELD_EXTENSION)) {
                fields.add(FIELD_EXTENSION);
              } else {
                fields.add(tokens[tokens.length - 1]);
              }
            } else {
              fields.add(fieldName);
            }
          });
    }
    return fields;
  }

  public static String transformMessage(
      MessageDecorator<?> messageFormatter,
      Thread thread,
      FieldChange fieldChange,
      CHANGE_TYPE changeType) {
    MessageParser.EntityLink link = getEntityLinkForFieldName(fieldChange.getName(), thread);
    String arrayFieldValue = link.getArrayFieldValue();
    String updateField = getFieldNameChange(fieldChange.getName(), thread);
    DefaultFieldFormatter fieldSpecificFormatter;
    if (nullOrEmpty(arrayFieldValue)) {
      fieldSpecificFormatter =
          getFieldParserObject(messageFormatter, thread, fieldChange, updateField);
    } else {
      fieldSpecificFormatter =
          getFieldParserObject(messageFormatter, thread, fieldChange, arrayFieldValue);
    }
    return fieldSpecificFormatter.getFormattedMessage(changeType);
  }

  public enum CHANGE_TYPE {
    ADD,
    UPDATE,
    DELETE
  }

  public static List<Thread> getFormattedMessages(
      MessageDecorator<?> messageFormatter, Thread thread, ChangeDescription changeDescription) {
    // Store a map of entityLink -> message
    List<FieldChange> fieldsUpdated = changeDescription.getFieldsUpdated();
    List<Thread> messages =
        getFormattedMessagesForAllFieldChange(
            messageFormatter, thread, fieldsUpdated, CHANGE_TYPE.UPDATE);

    // fieldsAdded and fieldsDeleted need special handling since
    // there is a possibility to merge them as one update message.
    List<FieldChange> fieldsAdded = changeDescription.getFieldsAdded();
    List<FieldChange> fieldsDeleted = changeDescription.getFieldsDeleted();
    if (fieldsAdded.isEmpty() || fieldsDeleted.isEmpty()) {
      if (!fieldsAdded.isEmpty()) {
        messages.addAll(
            getFormattedMessagesForAllFieldChange(
                messageFormatter, thread, fieldsAdded, CHANGE_TYPE.ADD));
      } else if (!fieldsDeleted.isEmpty()) {
        messages.addAll(
            getFormattedMessagesForAllFieldChange(
                messageFormatter, thread, fieldsDeleted, CHANGE_TYPE.DELETE));
      }
      return messages;
    }
    for (FieldChange field : fieldsDeleted) {
      Optional<FieldChange> addedField =
          fieldsAdded.stream().filter(f -> f.getName().equals(field.getName())).findAny();
      if (addedField.isPresent()) {
        String fieldName = field.getName();
        MessageParser.EntityLink link = FormatterUtil.getEntityLinkForFieldName(fieldName, thread);
        // convert the added field and deleted field into one update message
        Thread tempThread = JsonUtils.deepCopy(thread, Thread.class);
        String message =
            ParserFactory.getEntityParser(link.getEntityType())
                .format(
                    messageFormatter,
                    tempThread,
                    new FieldChange()
                        .withName(fieldName)
                        .withOldValue(field.getOldValue())
                        .withNewValue(addedField.get().getNewValue()),
                    CHANGE_TYPE.UPDATE);
        tempThread.withMessage(message);
        messages.add(tempThread);
        // Remove the field from addedFields list to avoid double processing
        fieldsAdded = fieldsAdded.stream().filter(f -> !f.equals(addedField.get())).toList();
      } else {
        // process the deleted field
        messages.addAll(
            getFormattedMessagesForAllFieldChange(
                messageFormatter, thread, Collections.singletonList(field), CHANGE_TYPE.DELETE));
      }
    }
    // process the remaining added fields
    if (!fieldsAdded.isEmpty()) {
      messages.addAll(
          getFormattedMessagesForAllFieldChange(
              messageFormatter, thread, fieldsAdded, CHANGE_TYPE.ADD));
    }
    return messages;
  }

  public static List<Thread> getFormattedMessagesForAllFieldChange(
      MessageDecorator<?> messageFormatter,
      Thread thread,
      List<FieldChange> fields,
      CHANGE_TYPE changeType) {
    List<Thread> threads = new ArrayList<>();
    for (FieldChange field : fields) {
      Thread tempEntity = JsonUtils.deepCopy(thread, Thread.class).withId(UUID.randomUUID());
      // We are creating multiple thread on the same entity based on different messages
      String message =
          ParserFactory.getEntityParser(thread.getEntityRef().getType())
              .format(messageFormatter, tempEntity, field, changeType);
      tempEntity.withMessage(message);
      threads.add(tempEntity);
    }
    return threads;
  }

  public static Optional<ChangeEvent> getChangeEventFromResponseContext(
      ContainerResponseContext responseContext, String updateBy) {
    Optional<EventType> eventType = getEventTypeFromResponse(responseContext);
    if (eventType.isEmpty() || !responseContext.hasEntity()) {
      return Optional.empty();
    }

    return Optional.ofNullable(extractChangeEvent(responseContext, updateBy, eventType.get()));
  }

  private static ChangeEvent extractChangeEvent(
      ContainerResponseContext responseContext, String updateBy, EventType eventType) {
    // If the response entity is a ChangeEvent, then return it as is , example in case of
    // ENTITY_FIELDS_CHANGED
    if (responseContext.getEntity() instanceof ChangeEvent fieldChangedChangeEvent) {
      return fieldChangedChangeEvent;
    }

    // If the response entity is an EntityInterface, then create a ChangeEvent from it
    if (responseContext.getEntity() instanceof EntityInterface entityInterface) {
      return createChangeEventForEntity(updateBy, eventType, entityInterface);
    }

    // If the response entity is a Thread, then create a ChangeEvent from it
    if (responseContext.getEntity() instanceof Thread thread) {
      return createChangeEventForThread(updateBy, eventType, thread);
    }

    // if the response entity is an EntityTimeseriesInterface, then create a ChangeEvent from it
    if (responseContext.getEntity() instanceof EntityTimeSeriesInterface entityTimeSeries) {
      return createChangeEventForEntity(updateBy, eventType, entityTimeSeries);
    }

    LOG.debug("Unknown event type in Change Event :  {}", eventType.value());
    return null;
  }

  public static ChangeEvent createChangeEventForEntity(
      String updateBy, EventType eventType, EntityInterface entityInterface) {
    return getChangeEvent(
            updateBy, eventType, entityInterface.getEntityReference().getType(), entityInterface)
        .withPreviousVersion(
            entityInterface.getChangeDescription() != null
                ? entityInterface.getChangeDescription().getPreviousVersion()
                : entityInterface.getVersion())
        .withEntity(entityInterface)
        .withEntityFullyQualifiedName(entityInterface.getEntityReference().getFullyQualifiedName());
  }

  private static ChangeEvent createChangeEventForEntity(
      String updateBy, EventType eventType, EntityTimeSeriesInterface entityTimeSeries) {
    return getChangeEventForEntityTimeSeries(
        updateBy, eventType, entityTimeSeries.getEntityReference().getType(), entityTimeSeries);
  }

  private static ChangeEvent createChangeEventForThread(
      String updateBy, EventType eventType, Thread threadEntity) {
    return getChangeEventForThread(updateBy, eventType, THREAD, threadEntity)
        .withEntity(threadEntity);
  }

  private static Optional<EventType> getEventTypeFromResponse(
      ContainerResponseContext responseContext) {
    String changeType = responseContext.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER);
    if (changeType != null) {
      return Optional.of(EventType.fromValue(changeType));
    } else if (responseContext.getStatus() == Response.Status.CREATED.getStatusCode()) {
      return Optional.of(ENTITY_CREATED);
    }
    return Optional.empty();
  }

  private static ChangeEvent getChangeEvent(
      String updateBy, EventType eventType, String entityType, EntityInterface entityInterface) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(eventType)
        .withEntityId(entityInterface.getId())
        .withEntityType(entityType)
        .withDomain(
            nullOrEmpty(entityInterface.getDomain()) ? null : entityInterface.getDomain().getId())
        .withUserName(updateBy)
        .withTimestamp(entityInterface.getUpdatedAt())
        .withChangeDescription(entityInterface.getChangeDescription())
        .withCurrentVersion(entityInterface.getVersion());
  }

  private static ChangeEvent getChangeEventForEntityTimeSeries(
      String updateBy,
      EventType eventType,
      String entityType,
      EntityTimeSeriesInterface entityTimeSeries) {
    if (entityTimeSeries instanceof TestCaseResult) {
      eventType =
          EventType
              .ENTITY_UPDATED; // workaround as adding a test case result is sent as a POST request
      TestCaseResult testCaseResult =
          JsonUtils.readOrConvertValue(entityTimeSeries, TestCaseResult.class);
      TestCase testCase =
          Entity.getEntityByName(
              TEST_CASE,
              testCaseResult.getTestCaseFQN(),
              TEST_CASE_RESULT + ",testSuites",
              Include.ALL);
      ChangeEvent changeEvent =
          getChangeEvent(
              updateBy,
              eventType,
              testCase.getEntityReference().getType(),
              testCase.withUpdatedAt(testCaseResult.getTimestamp()));
      return changeEvent
          .withChangeDescription(
              new ChangeDescription()
                  .withFieldsUpdated(
                      List.of(
                          new FieldChange()
                              .withName(TEST_CASE_RESULT)
                              .withNewValue(testCase.getTestCaseResult()))))
          .withEntity(testCase)
          .withEntityFullyQualifiedName(testCase.getFullyQualifiedName());
    }
    return null;
  }

  private static ChangeEvent getChangeEventForThread(
      String updateBy, EventType eventType, String entityType, Thread thread) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(eventType)
        .withEntityId(thread.getId())
        .withDomain(thread.getDomain())
        .withEntityType(entityType)
        .withUserName(updateBy)
        .withTimestamp(thread.getUpdatedAt());
  }
}
