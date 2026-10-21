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

package org.openmetadata.service.events;

import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.service.Entity.DATA_CONTRACT_RESULT;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;

import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.feed.ConversationReply;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class ChangeEvents {

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
    if (responseContext.getEntity() instanceof EntityInterface<?> entityInterface) {
      return createChangeEventForEntity(updateBy, eventType, entityInterface);
    }

    if (responseContext.getEntity() instanceof Conversation conversation) {
      return Entity.getConversationRepository().buildChangeEvent(updateBy, eventType, conversation);
    }

    if (responseContext.getEntity() instanceof ConversationReply reply) {
      return Entity.getConversationRepository().buildChangeEvent(updateBy, eventType, reply);
    }

    // if the response entity is an EntityTimeseriesInterface, then create a ChangeEvent from it
    if (responseContext.getEntity() instanceof EntityTimeSeriesInterface entityTimeSeries) {
      return createChangeEventForEntity(updateBy, eventType, entityTimeSeries);
    }

    LOG.debug("Unknown event type in Change Event :  {}", eventType.value());
    return null;
  }

  public static ChangeEvent createChangeEventForEntity(
      String updateBy, EventType eventType, EntityInterface<?> entityInterface) {
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
      String updateBy, EventType eventType, String entityType, EntityInterface<?> entityInterface) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(eventType)
        .withEntityId(entityInterface.getId())
        .withEntityType(entityType)
        .withDomains(
            entityInterface.getDomains() == null
                ? null
                : entityInterface.getDomains().stream().map(EntityReference::getId).toList())
        .withUserName(updateBy)
        .withImpersonatedBy(entityInterface.getImpersonatedBy())
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
      // Load TestCase with all fields including relationships
      TestCase testCase =
          Entity.getEntityByName(TEST_CASE, testCaseResult.getTestCaseFQN(), "*", Include.ALL);
      // Populate inherited fields (owners, tags, domains) for notification templates
      TestCaseRepository testCaseRepository =
          (TestCaseRepository) Entity.getEntityRepository(TEST_CASE);
      testCaseRepository.setInheritedFields(
          testCase, new EntityUtil.Fields(testCaseRepository.getAllowedFields()));
      // Load failedRowsSample
      try {
        TableData failedRowsSample = testCaseRepository.getSampleData(testCase, false);
        testCase.setFailedRowsSample(failedRowsSample);
      } catch (Exception e) {
        LOG.info("Failed to load failedRowsSample: {}", e.getMessage());
      }
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
    if (entityTimeSeries instanceof DataContractResult) {
      DataContractResult result =
          JsonUtils.readOrConvertValue(entityTimeSeries, DataContractResult.class);
      // Don't create ChangeEvent for intermediate "Running" status
      // Final notification will be sent when DQ validation completes
      if (result.getContractExecutionStatus() == ContractExecutionStatus.Running) {
        return null;
      }
      return getDataContractResultEvent(result, updateBy, eventType);
    }
    return null;
  }

  public static ChangeEvent getDataContractResultEvent(
      DataContractResult result, String updateBy, EventType eventType) {
    DataContract contract =
        Entity.getEntityByName(Entity.DATA_CONTRACT, result.getDataContractFQN(), "*", Include.ALL);

    // Populate the entity reference with complete information (including fullyQualifiedName)
    if (contract.getEntity() != null) {
      EntityReference fullEntityRef =
          Entity.getEntityReferenceById(
              contract.getEntity().getType(), contract.getEntity().getId(), Include.NON_DELETED);
      contract.setEntity(fullEntityRef);
    }

    ChangeEvent changeEvent =
        getChangeEvent(updateBy, eventType, contract.getEntityReference().getType(), contract);

    return changeEvent
        .withChangeDescription(
            new ChangeDescription()
                .withFieldsUpdated(
                    List.of(new FieldChange().withName(DATA_CONTRACT_RESULT).withNewValue(result))))
        .withEntity(contract)
        .withEntityFullyQualifiedName(contract.getFullyQualifiedName());
  }
}
