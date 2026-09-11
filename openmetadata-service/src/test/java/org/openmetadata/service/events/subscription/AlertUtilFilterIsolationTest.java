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

package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.events.ArgumentsInput.Effect;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * #31331: filtering runs over a whole batch whose offset is committed either way, so an event whose
 * filters cannot be evaluated must be dropped on its own. Before this, it took every other event in
 * the batch with it — undelivered, unretried and unrecorded.
 */
class AlertUtilFilterIsolationTest {

  private static final UUID DELIVERABLE_ID = UUID.randomUUID();
  private static final UUID POISON_ID = UUID.randomUUID();
  private static final String DOMAIN_FQN = "Finance";

  @Test
  void getFilteredEvents_oneUnevaluableEvent_keepsTheRestOfTheBatch() {
    ChangeEvent deliverable =
        event(Entity.TABLE, DELIVERABLE_ID, new Table().withId(DELIVERABLE_ID));
    ChangeEvent poison = event(Entity.DOMAIN, POISON_ID, new Domain().withId(POISON_ID));
    List<ChangeEvent> excluded = new ArrayList<>();

    Map<ChangeEvent, Set<UUID>> filtered;
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stubStore(entityMock);
      filtered =
          AlertUtil.getFilteredEvents(
              subscriptionMatchingDomain(),
              batchOf(deliverable, poison),
              null,
              (failedEvent, error) -> excluded.add(failedEvent));
    }

    assertEquals(Set.of(deliverable), filtered.keySet());
    assertEquals(List.of(poison), excluded);
  }

  @Test
  void isChangeEventAllowed_unevaluableEvent_returnsFalseInsteadOfThrowing() {
    ChangeEvent poison = event(Entity.DOMAIN, POISON_ID, new Domain().withId(POISON_ID));
    List<ChangeEvent> excluded = new ArrayList<>();

    boolean allowed;
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stubStore(entityMock);
      allowed =
          AlertUtil.isChangeEventAllowed(
              poison,
              subscriptionMatchingDomain().getFilteringRules(),
              null,
              (failedEvent, error) -> excluded.add(failedEvent));
    }

    assertFalse(allowed);
    assertEquals(List.of(poison), excluded);
  }

  @Test
  void getFilteredEvents_handlerItselfThrows_stillKeepsTheRestOfTheBatch() {
    ChangeEvent deliverable =
        event(Entity.TABLE, DELIVERABLE_ID, new Table().withId(DELIVERABLE_ID));
    ChangeEvent poison = event(Entity.DOMAIN, POISON_ID, new Domain().withId(POISON_ID));

    Map<ChangeEvent, Set<UUID>> filtered;
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stubStore(entityMock);
      filtered =
          AlertUtil.getFilteredEvents(
              subscriptionMatchingDomain(),
              batchOf(deliverable, poison),
              null,
              (failedEvent, error) -> {
                throw new IllegalStateException("dead-letter write failed");
              });
    }

    assertEquals(Set.of(deliverable), filtered.keySet());
  }

  @Test
  void getFilteredEvents_withoutAHandler_stillIsolatesTheFailure() {
    ChangeEvent deliverable =
        event(Entity.TABLE, DELIVERABLE_ID, new Table().withId(DELIVERABLE_ID));
    ChangeEvent poison = event(Entity.DOMAIN, POISON_ID, new Domain().withId(POISON_ID));

    Map<ChangeEvent, Set<UUID>> filtered;
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stubStore(entityMock);
      filtered =
          AlertUtil.getFilteredEvents(
              subscriptionMatchingDomain(), batchOf(deliverable, poison), null);
    }

    assertTrue(filtered.containsKey(deliverable));
    assertFalse(filtered.containsKey(poison));
  }

  /** The deliverable event resolves its domain; the poison one fails the way a matcher bug does. */
  private static void stubStore(MockedStatic<Entity> entityMock) {
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
    when(repository.isSupportsDomains()).thenReturn(true);
    entityMock.when(() -> Entity.getEntityClassFromType(Entity.TABLE)).thenReturn(Table.class);
    entityMock.when(() -> Entity.getEntityClassFromType(Entity.DOMAIN)).thenReturn(Domain.class);
    entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
    entityMock.when(() -> Entity.getEntityRepository(Entity.DOMAIN)).thenReturn(repository);
    entityMock
        .when(
            () ->
                Entity.getEntityOrNull(
                    eq(Entity.TABLE),
                    eq(DELIVERABLE_ID),
                    eq(Entity.FIELD_DOMAINS),
                    any(RelationIncludes.class)))
        .thenReturn(
            new Table()
                .withId(DELIVERABLE_ID)
                .withDomains(List.of(new EntityReference().withFullyQualifiedName(DOMAIN_FQN))));
    entityMock
        .when(
            () ->
                Entity.getEntityOrNull(
                    eq(Entity.DOMAIN),
                    eq(POISON_ID),
                    eq(Entity.FIELD_DOMAINS),
                    any(RelationIncludes.class)))
        .thenThrow(new IllegalArgumentException("Invalid field name domains"));
  }

  private static EventSubscription subscriptionMatchingDomain() {
    return new EventSubscription()
        .withId(UUID.randomUUID())
        .withName("domain-alert")
        .withAlertType(AlertType.NOTIFICATION)
        .withFilteringRules(
            new FilteringRules()
                .withResources(List.of("all"))
                .withRules(
                    List.of(
                        new EventFilterRule()
                            .withName("filterByDomain")
                            .withEffect(Effect.INCLUDE)
                            .withCondition("matchAnyDomain({'" + DOMAIN_FQN + "'})")))
                .withActions(List.of()));
  }

  private static Map<ChangeEvent, Set<UUID>> batchOf(ChangeEvent... events) {
    Map<ChangeEvent, Set<UUID>> batch = new HashMap<>();
    for (ChangeEvent event : events) {
      batch.put(event, Set.of(UUID.randomUUID()));
    }
    return batch;
  }

  private static ChangeEvent event(String entityType, UUID entityId, EntityInterface entity) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(entityId)
        .withEntity(entity);
  }
}
