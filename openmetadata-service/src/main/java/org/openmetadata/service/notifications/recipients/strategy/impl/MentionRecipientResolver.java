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

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Resolves mentioned users/teams from thread content.
 *
 * This resolver extracts entity links and post authors from thread messages and comments,
 * converting them to recipients with appropriate contact information.
 */
@Slf4j
public class MentionRecipientResolver implements RecipientResolutionStrategy {

  public MentionRecipientResolver() {}

  @Override
  public Set<Recipient> resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination) {
    try {
      if (Entity.THREAD.equalsIgnoreCase(event.getEntityType())) {
        Thread thread = AlertsRuleEvaluator.getThread(event);
        return thread == null ? Collections.emptySet() : resolveMentions(thread, destination);
      }

      if (Entity.ANNOUNCEMENT.equalsIgnoreCase(event.getEntityType())) {
        Announcement announcement = (Announcement) AlertsRuleEvaluator.getEntity(event);
        return announcement == null
            ? Collections.emptySet()
            : resolveAnnouncementMentions(announcement, destination);
      }

      LOG.warn(
          "MentionRecipientResolver called with unsupported entity type: {}",
          event.getEntityType());
      return Collections.emptySet();

    } catch (Exception e) {
      LOG.error("Failed to resolve mentions for entity {}", event.getEntityId(), e);
      return Collections.emptySet();
    }
  }

  @Override
  public Set<Recipient> resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination) {
    try {
      if (Entity.THREAD.equalsIgnoreCase(entityType)) {
        Thread thread = Entity.getFeedRepository().get(entityId);
        return thread == null ? Collections.emptySet() : resolveMentions(thread, destination);
      }

      if (Entity.ANNOUNCEMENT.equalsIgnoreCase(entityType)) {
        Announcement announcement =
            Entity.getEntity(Entity.ANNOUNCEMENT, entityId, "description", Include.NON_DELETED);
        return announcement == null
            ? Collections.emptySet()
            : resolveAnnouncementMentions(announcement, destination);
      }

      LOG.warn("MentionRecipientResolver called with unsupported entity type: {}", entityType);
      return Collections.emptySet();

    } catch (Exception e) {
      LOG.error("Failed to resolve mentions for entity {}", entityId, e);
      return Collections.emptySet();
    }
  }

  private Set<Recipient> resolveMentions(Thread thread, SubscriptionDestination destination) {

    Set<Recipient> recipients = new HashSet<>();
    SubscriptionDestination.SubscriptionType notificationType = destination.getType();

    if (thread.getType() != null
        && thread.getType() == ThreadType.Announcement
        && thread.getAnnouncement() != null) {
      recipients.addAll(
          resolveAnnouncementMentions(thread.getAnnouncement().getDescription(), destination));
    }

    // Extract entity links from task suggestion
    if (thread.getType() != null && thread.getType() == ThreadType.Task) {
      if (thread.getTask() != null && thread.getTask().getSuggestion() != null) {
        List<MessageParser.EntityLink> taskEntityLinks =
            MessageParser.getEntityLinks(thread.getTask().getSuggestion());
        recipients.addAll(resolveEntityLinks(taskEntityLinks, notificationType));
      }
    }

    // Extract entity links from thread message (<#E::{entityType}::{entityFQN}>)
    if (thread.getMessage() != null) {
      List<MessageParser.EntityLink> entityLinks =
          MessageParser.getEntityLinks(thread.getMessage());
      recipients.addAll(resolveEntityLinks(entityLinks, notificationType));
    }

    // Extract entity links and post authors from all posts
    if (thread.getPosts() != null) {
      for (Post post : thread.getPosts()) {
        try {
          // Add post author as recipient
          if (post.getFrom() != null) {
            User postAuthor =
                Entity.getEntityByName(
                    Entity.USER, post.getFrom(), "id,profile,email", Include.NON_DELETED);
            if (postAuthor != null) {
              recipients.add(Recipient.fromUser(postAuthor, notificationType));
            }
          }
        } catch (Exception e) {
          LOG.warn("Failed to resolve post author: {}", post.getFrom(), e);
        }

        // Extract entity links from post message
        if (post.getMessage() != null) {
          List<MessageParser.EntityLink> postEntityLinks =
              MessageParser.getEntityLinks(post.getMessage());
          recipients.addAll(resolveEntityLinks(postEntityLinks, notificationType));
        }
      }
    }

    return recipients;
  }

  private Set<Recipient> resolveAnnouncementMentions(
      Announcement announcement, SubscriptionDestination destination) {
    return resolveAnnouncementMentions(announcement.getDescription(), destination);
  }

  private Set<Recipient> resolveAnnouncementMentions(
      String description, SubscriptionDestination destination) {
    if (description == null) {
      return Collections.emptySet();
    }

    return resolveEntityLinks(MessageParser.getEntityLinks(description), destination.getType());
  }

  private Set<Recipient> resolveEntityLinks(
      List<MessageParser.EntityLink> entityLinks,
      SubscriptionDestination.SubscriptionType notificationType) {

    Set<Recipient> recipients = new HashSet<>();

    for (MessageParser.EntityLink link : entityLinks) {
      try {
        if (Entity.USER.equalsIgnoreCase(link.getEntityType())) {
          User user = Entity.getEntity(link, "id,profile,email", Include.NON_DELETED);
          if (user != null) {
            recipients.add(Recipient.fromUser(user, notificationType));
          }
        } else if (Entity.TEAM.equalsIgnoreCase(link.getEntityType())) {
          Team team = Entity.getEntity(link, "id,profile,email", Include.NON_DELETED);
          if (team != null) {
            recipients.add(Recipient.fromTeam(team, notificationType));
          }
        }
      } catch (Exception e) {
        LOG.warn("Failed to resolve entity link: {}", link.getEntityFQN(), e);
      }
    }

    return recipients;
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.MENTIONS;
  }
}
