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

package org.openmetadata.service.notifications.recipients.downstream.impl;

import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.notifications.recipients.downstream.EntityLineageResolver;

public class ConversationLineageResolver implements EntityLineageResolver {
  @Override
  public Set<EntityReference> resolveTraversalEntities(ChangeEvent changeEvent) {
    return parent(AlertsRuleEvaluator.getConversation(changeEvent));
  }

  @Override
  public Set<EntityReference> resolveTraversalEntities(UUID entityId, String entityType) {
    return parent(Entity.getConversationRepository().getEventPayload(entityId));
  }

  private Set<EntityReference> parent(Conversation conversation) {
    EntityReference entityReference = conversation == null ? null : conversation.getEntityRef();
    return entityReference == null ? Set.of() : Set.of(entityReference);
  }

  @Override
  public String getEntityType() {
    return Entity.CONVERSATION;
  }
}
