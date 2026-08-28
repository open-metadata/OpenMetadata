/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.events.lifecycle.handlers;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventHandler;
import org.openmetadata.service.jdbi3.AnnouncementRepository;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Handler that syncs domains for dependent entities when their target entity's domains change.
 * Ensures tasks, announcements, and conversations remain in the same domains as the entity they're
 * associated with, maintaining domain-based data isolation policies.
 */
@Slf4j
public class DomainSyncHandler implements EntityLifecycleEventHandler {

  private static final String DOMAINS_FIELD = "domains";

  private static final Set<String> SKIP_ENTITY_TYPES = Set.of(Entity.TASK, Entity.DOMAIN);

  @Override
  public boolean shouldProcess(EventType eventType, ChangeDescription changeDescription) {
    return eventType == EventType.ENTITY_UPDATED
        && changeDescription != null
        && hasDomainsChange(changeDescription);
  }

  @Override
  public void onEntityUpdated(
      EntityInterface entity, ChangeDescription changeDescription, SubjectContext subjectContext) {
    if (entity == null || changeDescription == null) {
      return;
    }

    if (!hasDomainsChange(changeDescription)) {
      return;
    }

    String entityType = entity.getEntityReference().getType();

    // Skip entities that shouldn't trigger domain sync
    if (SKIP_ENTITY_TYPES.contains(entityType)) {
      return;
    }

    UUID entityId = entity.getId();
    List<EntityReference> effectiveDomains =
        entity.getDomains() == null ? Collections.emptyList() : List.copyOf(entity.getDomains());

    LOG.debug(
        "Domains change detected for {} {}, syncing related entities to domains {}",
        entityType,
        entityId,
        effectiveDomains != null && !effectiveDomains.isEmpty()
            ? effectiveDomains.stream().map(EntityReference::getFullyQualifiedName).toList()
            : "null");

    syncTaskDomains(entityId, entityType, effectiveDomains);
    syncAnnouncementDomains(entityId, entityType, effectiveDomains);
    syncConversationDomains(entityId, entityType, effectiveDomains);
  }

  private void syncTaskDomains(UUID entityId, String entityType, List<EntityReference> newDomains) {
    try {
      TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
      taskRepository.syncTaskDomainsForEntity(entityId, entityType, newDomains);
    } catch (Exception e) {
      LOG.error(
          "Failed to sync task domains for entity {} {}: {}", entityType, entityId, e.getMessage());
    }
  }

  private void syncAnnouncementDomains(
      UUID entityId, String entityType, List<EntityReference> newDomains) {
    try {
      AnnouncementRepository announcementRepository =
          (AnnouncementRepository) Entity.getEntityRepository(Entity.ANNOUNCEMENT);
      announcementRepository.syncAnnouncementDomainsForEntity(entityId, entityType, newDomains);
    } catch (Exception e) {
      LOG.error(
          "Failed to sync announcement domains for entity {} {}: {}",
          entityType,
          entityId,
          e.getMessage());
    }
  }

  private void syncConversationDomains(
      UUID entityId, String entityType, List<EntityReference> newDomains) {
    try {
      Entity.getConversationRepository().syncDomainsForEntity(entityId, entityType, newDomains);
    } catch (Exception e) {
      LOG.error(
          "Failed to sync conversation domains for entity {} {}: {}",
          entityType,
          entityId,
          e.getMessage());
    }
  }

  private boolean hasDomainsChange(ChangeDescription changeDescription) {
    return containsDomainsChange(changeDescription.getFieldsAdded())
        || containsDomainsChange(changeDescription.getFieldsUpdated())
        || containsDomainsChange(changeDescription.getFieldsDeleted());
  }

  private boolean containsDomainsChange(List<FieldChange> changes) {
    return changes != null
        && changes.stream().anyMatch(change -> DOMAINS_FIELD.equals(change.getName()));
  }

  @Override
  public String getHandlerName() {
    return "DomainSyncHandler";
  }

  @Override
  public int getPriority() {
    return 50;
  }

  @Override
  public boolean isAsync() {
    return true;
  }
}
