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

package org.openmetadata.service.alerting.audience;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerting.matching.AlertsRuleEvaluator;

/**
 * Resolves the owners of an entity, users and teams, as recipients. Fetching an entity with the
 * "owners" field resolves inherited ownership, which test cases rely on. A conversation or a task
 * has no owners of its own: its owners are its creator, unless a bot, and the owners of the entity
 * it is about.
 */
public class OwnerRecipientResolver implements RecipientResolutionStrategy {
  private static final String TASK_FIELDS = "about,createdBy";

  private final UserRecipientResolver users;
  private final TeamRecipientResolver teams;

  public OwnerRecipientResolver(UserRecipientResolver users, TeamRecipientResolver teams) {
    this.users = users;
    this.teams = teams;
  }

  @Override
  public Recipients resolve(
      ChangeEvent event,
      SubscriptionAction action,
      SubscriptionDestination destination,
      AddressDirectory directory) {
    String what = "the " + event.getEntityType() + " of event " + event.getId();
    return switch (typeOf(event.getEntityType())) {
      case Entity.CONVERSATION -> Recipients.from(
          Lookup.of(what, () -> AlertsRuleEvaluator.getConversation(event)),
          conversation ->
              ofActivity(conversation.getCreatedBy(), conversation.getEntityRef(), directory));
      case Entity.TASK -> Recipients.from(
          Lookup.of(what, () -> AlertsRuleEvaluator.getTask(event)),
          task -> ofActivity(task.getCreatedBy(), task.getAbout(), directory));
      default -> Recipients.from(
          Lookup.of(what, () -> AlertsRuleEvaluator.getEntity(event)),
          entity -> of(entity, directory));
    };
  }

  @Override
  public Recipients resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination,
      AddressDirectory directory) {
    String what = entityType + " " + entityId;
    return switch (typeOf(entityType)) {
      case Entity.CONVERSATION -> Recipients.from(
          Lookup.of(what, () -> Entity.getConversationRepository().getEventPayload(entityId)),
          conversation ->
              ofActivity(conversation.getCreatedBy(), conversation.getEntityRef(), directory));
      case Entity.TASK -> Recipients.from(
          Lookup.of(
              what,
              () ->
                  Entity.<Task>getEntity(Entity.TASK, entityId, TASK_FIELDS, Include.NON_DELETED)),
          task -> ofActivity(task.getCreatedBy(), task.getAbout(), directory));
      default -> Recipients.from(stored(entityType, entityId), entity -> of(entity, directory));
    };
  }

  private Recipients ofActivity(
      EntityReference creator, EntityReference subject, AddressDirectory directory) {
    Recipients ofCreator =
        creator == null
            ? Recipients.none()
            : users.resolvePeople(List.of(creator.getId()), directory);
    Recipients ofSubject =
        subject == null
            ? Recipients.none()
            : Recipients.from(
                stored(subject.getType(), subject.getId()), entity -> of(entity, directory));
    return ofCreator.and(ofSubject);
  }

  private Recipients of(EntityInterface<?> entity, AddressDirectory directory) {
    return Principals.of(entity.getOwners(), users, teams, directory);
  }

  private static Lookup<EntityInterface<?>> stored(String entityType, UUID entityId) {
    return Lookup.of(
        entityType + " " + entityId,
        () -> Entity.getEntity(entityType, entityId, "owners", Include.NON_DELETED));
  }

  private static String typeOf(String entityType) {
    return entityType == null ? "" : entityType.toLowerCase(Locale.ROOT);
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.OWNERS;
  }
}
