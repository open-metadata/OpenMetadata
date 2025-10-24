/*
 *  Copyright 2022 Collate
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
package org.openmetadata.service.monitoring;

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventHandler;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public class EventMonitorHandler implements EntityLifecycleEventHandler {

  private final EventMonitor eventMonitor;

  public EventMonitorHandler(EventMonitor eventMonitor) {
    this.eventMonitor = eventMonitor;
  }

  @Override
  public void onEntityCreated(EntityInterface entity, SubjectContext subjectContext) {
    if (Entity.INGESTION_PIPELINE.equals(entity.getEntityReference().getType())) {
      ChangeEvent changeEvent = createChangeEvent(entity, EventType.ENTITY_CREATED);
      eventMonitor.pushMetric(changeEvent);
    }
  }

  @Override
  public void onEntityUpdated(
      EntityInterface entity, ChangeDescription changeDescription, SubjectContext subjectContext) {
    if (Entity.INGESTION_PIPELINE.equals(entity.getEntityReference().getType())) {
      ChangeEvent changeEvent = createChangeEvent(entity, EventType.ENTITY_UPDATED);
      changeEvent.setChangeDescription(changeDescription);
      eventMonitor.pushMetric(changeEvent);
    }
  }

  @Override
  public void onEntityDeleted(EntityInterface entity, SubjectContext subjectContext) {
    if (Entity.INGESTION_PIPELINE.equals(entity.getEntityReference().getType())) {
      ChangeEvent changeEvent = createChangeEvent(entity, EventType.ENTITY_DELETED);
      eventMonitor.pushMetric(changeEvent);
    }
  }

  @Override
  public void onEntitySoftDeletedOrRestored(
      EntityInterface entity, boolean isDeleted, SubjectContext subjectContext) {
    if (Entity.INGESTION_PIPELINE.equals(entity.getEntityReference().getType())) {
      EventType eventType = isDeleted ? EventType.ENTITY_SOFT_DELETED : EventType.ENTITY_RESTORED;
      ChangeEvent changeEvent = createChangeEvent(entity, eventType);
      eventMonitor.pushMetric(changeEvent);
    }
  }

  @Override
  public String getHandlerName() {
    return "EventMonitorHandler";
  }

  @Override
  public int getPriority() {
    return 1000; // Lower priority, run after other handlers
  }

  @Override
  public boolean isAsync() {
    return true; // Run asynchronously to avoid blocking main operations
  }

  @Override
  public Set<String> getSupportedEntityTypes() {
    return Set.of(Entity.INGESTION_PIPELINE);
  }

  private ChangeEvent createChangeEvent(EntityInterface entity, EventType eventType) {
    return new ChangeEvent()
        .withEventType(eventType)
        .withEntityType(entity.getEntityReference().getType())
        .withEntityId(entity.getId())
        .withEntityFullyQualifiedName(entity.getFullyQualifiedName())
        .withUserName(entity.getUpdatedBy())
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(entity.getVersion())
        .withEntity(entity);
  }

  public void shutdown() {
    eventMonitor.close();
    LOG.info("Event Monitor Handler shutdown completed");
  }
}