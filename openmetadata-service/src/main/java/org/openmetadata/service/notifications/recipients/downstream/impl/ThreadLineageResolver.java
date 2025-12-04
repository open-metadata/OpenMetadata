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

package org.openmetadata.service.notifications.recipients.downstream.impl;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.notifications.recipients.downstream.EntityLineageResolver;

/**
 * Resolves Thread to its referenced entity for lineage traversal.
 *
 * Thread entities (Task, Conversation, Announcement) reference data entities through their
 * entityRef property. This resolver extracts the referenced entity. The referenced entity
 * may itself have a parent (e.g., TestCase → Table), which will be recursively resolved
 * by LineageBasedDownstreamHandler.
 *
 * Examples:
 * - A Task thread on a table → returns Table reference
 * - An Announcement thread on a TestCase → returns TestCase reference (recursively resolved to Table)
 * - A Conversation thread on a column → returns Column reference
 */
@Slf4j
public class ThreadLineageResolver implements EntityLineageResolver {

  @Override
  public Set<EntityReference> resolveTraversalEntities(ChangeEvent changeEvent) {
    Thread thread = null;

    try {
      if (changeEvent.getEntity() != null) {
        thread = AlertsRuleEvaluator.getThread(changeEvent);
      }
    } catch (Exception e) {
      LOG.warn("Failed to deserialize Thread from ChangeEvent payload", e);
    }

    return extractParentFromThread(thread, changeEvent.getEntityId());
  }

  @Override
  public Set<EntityReference> resolveTraversalEntities(UUID entityId, String entityType) {
    Thread thread = null;

    try {
      thread = Entity.getFeedRepository().get(entityId);
    } catch (Exception e) {
      LOG.warn("Failed to resolve referenced entity for Thread {}", entityId, e);
    }

    return extractParentFromThread(thread, entityId);
  }

  private Set<EntityReference> extractParentFromThread(Thread thread, UUID entityId) {
    Set<EntityReference> parents = new HashSet<>();

    if (thread == null) {
      return parents;
    }

    EntityReference parentRef = thread.getEntityRef();
    if (parentRef != null) {
      LOG.debug(
          "Resolved THREAD {} to referenced entity {} {}",
          entityId,
          parentRef.getType(),
          parentRef.getId());
      parents.add(parentRef);
    }

    return parents;
  }

  @Override
  public String getEntityType() {
    return Entity.THREAD;
  }
}
