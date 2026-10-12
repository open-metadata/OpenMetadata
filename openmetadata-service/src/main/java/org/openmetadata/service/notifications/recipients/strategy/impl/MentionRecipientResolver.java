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

package org.openmetadata.service.notifications.recipients.strategy.impl;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.notifications.recipients.Lookup;
import org.openmetadata.service.notifications.recipients.Recipients;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Resolves the users and teams mentioned in a conversation's latest message, an announcement's
 * description, or a task's latest comment. A mentioned user or team that cannot be found is
 * skipped, and the others are still mentioned.
 */
@Slf4j
public class MentionRecipientResolver implements RecipientResolutionStrategy {
  private static final String PRINCIPAL_FIELDS = "id,profile,email";

  @Override
  public Recipients resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination) {
    String what = "the " + event.getEntityType() + " of event " + event.getId();
    return switch (typeOf(event.getEntityType())) {
      case Entity.CONVERSATION -> Recipients.from(
          Lookup.of(what, () -> AlertsRuleEvaluator.getConversation(event)),
          conversation -> inConversation(conversation, destination));
      case Entity.ANNOUNCEMENT -> Recipients.from(
          Lookup.of(what, () -> (Announcement) AlertsRuleEvaluator.getEntity(event)),
          announcement -> inText(announcement.getDescription(), destination));
      case Entity.TASK -> Recipients.from(
          Lookup.of(what, () -> AlertsRuleEvaluator.getTask(event)),
          task -> inTask(task, destination));
      default -> unsupported(event.getEntityType());
    };
  }

  @Override
  public Recipients resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination) {
    String what = entityType + " " + entityId;
    return switch (typeOf(entityType)) {
      case Entity.CONVERSATION -> Recipients.from(
          Lookup.of(what, () -> Entity.getConversationRepository().getEventPayload(entityId)),
          conversation -> inConversation(conversation, destination));
      case Entity.ANNOUNCEMENT -> Recipients.from(
          Lookup.of(
              what,
              () ->
                  Entity.<Announcement>getEntity(
                      Entity.ANNOUNCEMENT, entityId, "description", Include.NON_DELETED)),
          announcement -> inText(announcement.getDescription(), destination));
      case Entity.TASK -> Recipients.from(
          Lookup.of(
              what,
              () -> Entity.<Task>getEntity(Entity.TASK, entityId, "comments", Include.NON_DELETED)),
          task -> inTask(task, destination));
      default -> unsupported(entityType);
    };
  }

  private static Recipients inConversation(
      Conversation conversation, SubscriptionDestination destination) {
    String latest =
        nullOrEmpty(conversation.getReplies())
            ? conversation.getMessage()
            : conversation.getReplies().getLast().getMessage();
    return inText(latest, destination);
  }

  // The same mentions the filter matches (AlertsRuleEvaluator.getTaskMentions): the latest
  // comment's only, so earlier comments are not notified again on every new one.
  private static Recipients inTask(Task task, SubscriptionDestination destination) {
    return ofLinks(AlertsRuleEvaluator.getTaskMentions(task), destination);
  }

  private static Recipients inText(String text, SubscriptionDestination destination) {
    return text == null
        ? Recipients.none()
        : ofLinks(MessageParser.getEntityLinks(text), destination);
  }

  private static Recipients ofLinks(
      List<MessageParser.EntityLink> links, SubscriptionDestination destination) {
    return links.stream().map(link -> ofLink(link, destination)).collect(Recipients.combined());
  }

  private static Recipients ofLink(
      MessageParser.EntityLink link, SubscriptionDestination destination) {
    String what = "mentioned " + link.getEntityType() + " " + link.getEntityFQN();
    Lookup<Recipient> mentioned =
        switch (typeOf(link.getEntityType())) {
          case Entity.USER -> Lookup.of(
              what,
              () ->
                  Recipient.fromUser(
                      Entity.<User>getEntity(link, PRINCIPAL_FIELDS, Include.NON_DELETED),
                      destination));
          case Entity.TEAM -> Lookup.of(
              what,
              () ->
                  Recipient.fromTeam(
                      Entity.<Team>getEntity(link, PRINCIPAL_FIELDS, Include.NON_DELETED),
                      destination));
          default -> new Lookup.Absent<>();
        };
    return Recipients.from(mentioned, Recipients::of);
  }

  private static String typeOf(String entityType) {
    return entityType == null ? "" : entityType.toLowerCase(Locale.ROOT);
  }

  private static Recipients unsupported(String entityType) {
    LOG.warn("Mentions asked for an entity that has none: {}", entityType);
    return Recipients.none();
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.MENTIONS;
  }
}
