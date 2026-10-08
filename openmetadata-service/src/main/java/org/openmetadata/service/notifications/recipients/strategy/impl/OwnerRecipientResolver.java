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

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.notifications.recipients.Lookup;
import org.openmetadata.service.notifications.recipients.Recipients;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;

/**
 * Resolves the owners of an entity, users and teams, as recipients. Fetching an entity with the
 * "owners" field resolves inherited ownership, which test cases rely on. For a conversation, its
 * creator and the owners of the entity it is about.
 */
public class OwnerRecipientResolver implements RecipientResolutionStrategy {

  private final UserRecipientResolver users;
  private final TeamRecipientResolver teams;

  public OwnerRecipientResolver(UserRecipientResolver users, TeamRecipientResolver teams) {
    this.users = users;
    this.teams = teams;
  }

  @Override
  public Recipients resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination) {
    return Entity.CONVERSATION.equalsIgnoreCase(event.getEntityType())
        ? Recipients.from(
            Lookup.of(
                "the conversation of event " + event.getId(),
                () -> AlertsRuleEvaluator.getConversation(event)),
            conversation -> ofConversation(conversation, destination))
        : Recipients.from(
            Lookup.of(
                "the entity of event " + event.getId(), () -> AlertsRuleEvaluator.getEntity(event)),
            entity -> of(entity, destination));
  }

  @Override
  public Recipients resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination) {
    return Entity.CONVERSATION.equalsIgnoreCase(entityType)
        ? Recipients.from(
            Lookup.of(
                "conversation " + entityId,
                () -> Entity.getConversationRepository().getEventPayload(entityId)),
            conversation -> ofConversation(conversation, destination))
        : Recipients.from(stored(entityType, entityId), entity -> of(entity, destination));
  }

  private Recipients ofConversation(
      Conversation conversation, SubscriptionDestination destination) {
    EntityReference creator = conversation.getCreatedBy();
    Recipients ofCreator =
        creator == null
            ? Recipients.none()
            : Principals.of(List.of(creator), users, teams, destination);
    return ofCreator.and(ofSubject(conversation, destination));
  }

  private Recipients ofSubject(Conversation conversation, SubscriptionDestination destination) {
    EntityReference subject = conversation.getEntityRef();
    return subject == null
        ? Recipients.none()
        : Recipients.from(
            stored(subject.getType(), subject.getId()), entity -> of(entity, destination));
  }

  private Recipients of(EntityInterface entity, SubscriptionDestination destination) {
    return Principals.of(entity.getOwners(), users, teams, destination);
  }

  private static Lookup<EntityInterface> stored(String entityType, UUID entityId) {
    return Lookup.of(
        entityType + " " + entityId,
        () -> Entity.getEntity(entityType, entityId, "owners", Include.NON_DELETED));
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.OWNERS;
  }
}
