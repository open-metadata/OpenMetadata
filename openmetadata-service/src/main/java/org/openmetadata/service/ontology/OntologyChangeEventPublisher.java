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

package org.openmetadata.service.ontology;

import java.time.Clock;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/** Publishes coarse-grained ontology workflow events in addition to entity CRUD events. */
@Slf4j
public final class OntologyChangeEventPublisher {
  private final ChangeEventStore store;
  private final Clock clock;

  public OntologyChangeEventPublisher() {
    this(event -> Entity.getCollectionDAO().changeEventDAO().insert(event), Clock.systemUTC());
  }

  OntologyChangeEventPublisher(final ChangeEventStore store, final Clock clock) {
    this.store = Objects.requireNonNull(store);
    this.clock = Objects.requireNonNull(clock);
  }

  public void publish(
      final EventType eventType, final EntityInterface entity, final String userName) {
    final String entityType = entityType(eventType);
    final ChangeEvent event = event(eventType, entityType, entity, userName);
    try {
      store.insert(JsonUtils.pojoToMaskedJson(event));
    } catch (JdbiException exception) {
      LOG.error(
          "Failed to publish ontology event {} for {} {}",
          eventType,
          entityType,
          entity.getId(),
          exception);
    }
  }

  private ChangeEvent event(
      final EventType eventType,
      final String entityType,
      final EntityInterface entity,
      final String userName) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(eventType)
        .withEntityType(entityType)
        .withEntityId(entity.getId())
        .withEntityFullyQualifiedName(entity.getFullyQualifiedName())
        .withPreviousVersion(entity.getVersion())
        .withCurrentVersion(entity.getVersion())
        .withUserName(userName)
        .withTimestamp(clock.millis())
        .withEntity(entity);
  }

  private static String entityType(final EventType eventType) {
    return switch (eventType) {
      case ONTOLOGY_IMPORTED -> Entity.GLOSSARY;
      case ONTOLOGY_RELATIONSHIP_TYPE_UPDATED -> Entity.RELATIONSHIP_TYPE;
      case ONTOLOGY_CHANGE_SET_APPLIED -> Entity.ONTOLOGY_CHANGE_SET;
      default -> throw new IllegalArgumentException(
          "Unsupported ontology event type: " + eventType);
    };
  }

  @FunctionalInterface
  interface ChangeEventStore {
    void insert(String eventJson);
  }
}
