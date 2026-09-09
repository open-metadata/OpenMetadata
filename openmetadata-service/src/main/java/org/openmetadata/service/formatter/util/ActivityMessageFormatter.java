/*
 *  Copyright 2026 Collate
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

import static org.openmetadata.service.events.subscription.AlertsRuleEvaluator.getEntity;
import static org.openmetadata.service.formatter.util.FormatterUtil.getFormattedMessages;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.EntityInfo;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public final class ActivityMessageFormatter {
  private ActivityMessageFormatter() {}

  public static List<FormattedMessage> format(
      MessageDecorator<?> messageDecorator, ChangeEvent changeEvent) {
    if (changeEvent == null || changeEvent.getEntity() == null) {
      return Collections.emptyList();
    }

    if (Entity.getEntityList().contains(changeEvent.getEntityType())) {
      return formatEntityChange(messageDecorator, changeEvent);
    }

    LOG.error("Invalid entity type {} for an activity notification", changeEvent.getEntityType());
    return Collections.emptyList();
  }

  private static List<FormattedMessage> formatEntityChange(
      MessageDecorator<?> messageDecorator, ChangeEvent changeEvent) {
    String message;
    EntityInterface entity = getEntity(changeEvent);
    MessageParser.EntityLink about =
        new MessageParser.EntityLink(
            changeEvent.getEntityType(), entity.getFullyQualifiedName(), null, null, null);
    FormattedMessage formattedMessage =
        createMessage(
            messageDecorator,
            entity,
            about.getLinkString(),
            changeEvent.getEntityType(),
            changeEvent.getUserName());

    return switch (changeEvent.getEventType()) {
      case ENTITY_CREATED -> {
        message =
            String.format(
                "Created **%s**: `%s`",
                changeEvent.getEntityType(), entity.getFullyQualifiedName());
        addEntityInfo(formattedMessage, FormattedMessage.CardStyle.ENTITY_CREATED, message, entity);
        yield List.of(formattedMessage.withMessage(message));
      }
      case ENTITY_UPDATED -> getFormattedMessages(
          messageDecorator, formattedMessage, changeEvent.getChangeDescription());
      case ENTITY_SOFT_DELETED -> {
        message =
            String.format(
                "Soft deleted **%s**: `%s`",
                changeEvent.getEntityType(), entity.getFullyQualifiedName());
        addEntityInfo(
            formattedMessage, FormattedMessage.CardStyle.ENTITY_SOFT_DELETED, message, entity);
        yield List.of(formattedMessage.withMessage(message));
      }
      case ENTITY_DELETED -> {
        message =
            String.format(
                "Permanently Deleted **%s**: `%s`",
                changeEvent.getEntityType(), entity.getFullyQualifiedName());
        addEntityInfo(formattedMessage, FormattedMessage.CardStyle.ENTITY_DELETED, message, entity);
        yield List.of(formattedMessage.withMessage(message));
      }
      case LOGICAL_TEST_CASE_ADDED -> {
        message =
            String.format(
                "Added Logical Test Cases to **%s**: `%s`",
                changeEvent.getEntityType(), entity.getFullyQualifiedName());
        addEntityInfo(
            formattedMessage, FormattedMessage.CardStyle.LOGICAL_TEST_CASE_ADDED, message, entity);
        yield List.of(formattedMessage.withMessage(message));
      }
      default -> {
        if (changeEvent.getChangeDescription() == null) {
          yield Collections.emptyList();
        }
        yield getFormattedMessages(
            messageDecorator, formattedMessage, changeEvent.getChangeDescription());
      }
    };
  }

  private static void addEntityInfo(
      FormattedMessage formattedMessage,
      FormattedMessage.CardStyle cardStyle,
      String message,
      EntityInterface entity) {
    formattedMessage
        .withMessage(message)
        .withCardStyle(cardStyle)
        .withFieldOperation(FormattedMessage.FieldOperation.NONE)
        .withFeedInfo(
            new FeedInfo()
                .withFieldName(null)
                .withHeaderMessage(message)
                .withEntitySpecificInfo(new EntityInfo().withEntity(entity)));
  }

  private static FormattedMessage createMessage(
      MessageDecorator<?> decorator,
      EntityInterface entity,
      String linkString,
      String entityType,
      String updatedBy) {
    return new FormattedMessage()
        .withId(UUID.randomUUID())
        .withAbout(linkString)
        .withEntityRef(entity.getEntityReference())
        .withUpdatedBy(updatedBy)
        .withUpdatedAt(System.currentTimeMillis())
        .withEntityUrlLink(decorator.buildEntityUrl(entityType, entity))
        .withDomains(
            entity.getDomains() == null
                ? null
                : entity.getDomains().stream().map(EntityReference::getId).toList());
  }
}
