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

import static org.openmetadata.service.events.subscription.AlertsRuleEvaluator.getEntity;
import static org.openmetadata.service.formatter.util.FormatterUtil.getFormattedMessages;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.EntityInfo;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public final class FeedUtils {
  private FeedUtils() {}

  public static List<Thread> getThreadWithMessage(
      MessageDecorator<?> messageDecorator, ChangeEvent changeEvent) {
    if (changeEvent == null || changeEvent.getEntity() == null) {
      return Collections.emptyList(); // Response has no entity to produce change event from
    }

    // Change Event is of Thread or Data Assets
    if (changeEvent.getEntityType().equals(Entity.THREAD)) {
      // Thread type create from FeedRepository
      return Collections.emptyList();
    } else if (Entity.getEntityList().contains(changeEvent.getEntityType())) {
      return populateMessageForDataAssets(messageDecorator, changeEvent);
    } else {
      LOG.error(
          "Invalid Entity Type: {}, Currently Change Events are expected as Thread or Data Assets",
          changeEvent.getEntityType());
      return Collections.emptyList();
    }
  }

  private static List<Thread> populateMessageForDataAssets(
      MessageDecorator<?> messageDecorator, ChangeEvent changeEvent) {
    String message;
    EntityInterface entityInterface = getEntity(changeEvent);
    MessageParser.EntityLink about =
        new MessageParser.EntityLink(
            changeEvent.getEntityType(), entityInterface.getFullyQualifiedName(), null, null, null);
    Thread thread =
        getThread(
            messageDecorator,
            entityInterface,
            about.getLinkString(),
            changeEvent.getEntityType(),
            changeEvent.getUserName());
    // In Case EventType is not valid
    return switch (changeEvent.getEventType()) {
      case ENTITY_CREATED -> {
        message =
            String.format(
                "Created **%s**: `%s`",
                changeEvent.getEntityType(), entityInterface.getFullyQualifiedName());
        // Populate Entity details
        addEntityInfoToThread(thread, Thread.CardStyle.ENTITY_CREATED, message, entityInterface);
        yield List.of(thread.withMessage(message));
      }
      case ENTITY_UPDATED -> getFormattedMessages(
          messageDecorator, thread, changeEvent.getChangeDescription());
      case ENTITY_SOFT_DELETED -> {
        message =
            String.format(
                "Soft deleted **%s**: `%s`",
                changeEvent.getEntityType(), entityInterface.getFullyQualifiedName());
        addEntityInfoToThread(
            thread, Thread.CardStyle.ENTITY_SOFT_DELETED, message, entityInterface);
        yield List.of(thread.withMessage(message));
      }
      case ENTITY_DELETED -> {
        message =
            String.format(
                "Permanently Deleted **%s**: `%s`",
                changeEvent.getEntityType(), entityInterface.getFullyQualifiedName());
        addEntityInfoToThread(thread, Thread.CardStyle.ENTITY_DELETED, message, entityInterface);
        yield List.of(thread.withMessage(message));
      }
      case LOGICAL_TEST_CASE_ADDED -> {
        message =
            String.format(
                "Added Logical Test Cases to **%s**: `%s`",
                changeEvent.getEntityType(), entityInterface.getFullyQualifiedName());
        addEntityInfoToThread(
            thread, Thread.CardStyle.LOGICAL_TEST_CASE_ADDED, message, entityInterface);
        yield List.of(thread.withMessage(message));
      }
      default -> {
        if (changeEvent.getChangeDescription() == null) {
          yield Collections.emptyList();
        }
        yield getFormattedMessages(messageDecorator, thread, changeEvent.getChangeDescription());
      }
    };
  }

  private static void addEntityInfoToThread(
      Thread thread, Thread.CardStyle cardStyle, String message, EntityInterface entityInterface) {
    thread.withMessage(message);
    thread.withCardStyle(cardStyle);
    thread.withFieldOperation(Thread.FieldOperation.NONE);
    thread.withFeedInfo(
        new FeedInfo()
            .withFieldName(null)
            .withHeaderMessage(message)
            .withEntitySpecificInfo(new EntityInfo().withEntity(entityInterface)));
  }

  public static Thread getThread(
      MessageDecorator<?> decorator,
      EntityInterface entityInterface,
      String linkString,
      String entityType,
      String loggedInUserName) {
    return new Thread()
        .withId(UUID.randomUUID())
        .withThreadTs(System.currentTimeMillis())
        .withCreatedBy(loggedInUserName)
        .withAbout(linkString)
        .withEntityRef(entityInterface.getEntityReference())
        .withReactions(Collections.emptyList())
        .withUpdatedBy(loggedInUserName)
        .withUpdatedAt(System.currentTimeMillis())
        .withGeneratedBy(Thread.GeneratedBy.SYSTEM)
        .withEntityUrlLink(decorator.buildEntityUrl(entityType, entityInterface))
        .withDomains(entityInterface.getDomains());
  }
}
