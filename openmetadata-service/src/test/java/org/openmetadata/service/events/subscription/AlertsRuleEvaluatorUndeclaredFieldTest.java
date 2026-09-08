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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * #31331: a matcher must not re-read a field the change-event entity's schema does not declare.
 * {@code domain} has no {@code domains} and {@code user} has no {@code owners}, so the read raises
 * {@code IllegalArgumentException} out of the matcher and discards the whole batch. The store stubs
 * below throw exactly what production throws for those types, so removing the guard fails the test.
 */
class AlertsRuleEvaluatorUndeclaredFieldTest {

  private static final UUID ENTITY_ID = UUID.randomUUID();
  private static final String DOMAIN_FQN = "Finance";

  @Test
  void matchAnyDomain_entityTypeWithoutDomains_returnsFalseInsteadOfThrowing() {
    EntityRepository<EntityInterface> repository = repositoryDeclaring(true, false);
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entityMock.when(() -> Entity.getEntityClassFromType(Entity.DOMAIN)).thenReturn(Domain.class);
      entityMock.when(() -> Entity.getEntityRepository(Entity.DOMAIN)).thenReturn(repository);
      rejectUndeclaredRead(entityMock, Entity.DOMAIN, Entity.FIELD_DOMAINS);

      AlertsRuleEvaluator evaluator =
          new AlertsRuleEvaluator(event(Entity.DOMAIN, new Domain().withId(ENTITY_ID)));

      assertFalse(evaluator.matchAnyDomain(List.of(DOMAIN_FQN)));
    }
  }

  @Test
  void matchAnyOwnerName_entityTypeWithoutOwners_returnsFalseInsteadOfThrowing() {
    EntityRepository<EntityInterface> repository = repositoryDeclaring(false, true);
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entityMock.when(() -> Entity.getEntityClassFromType(Entity.USER)).thenReturn(User.class);
      entityMock.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(repository);
      rejectUndeclaredRead(entityMock, Entity.USER, Entity.FIELD_OWNERS);

      AlertsRuleEvaluator evaluator =
          new AlertsRuleEvaluator(event(Entity.USER, new User().withId(ENTITY_ID)));

      assertFalse(evaluator.matchAnyOwnerName(List.of("admin")));
    }
  }

  @Test
  void matchAnyDomain_entityTypeDeclaringDomains_stillResolvesThemFromTheStore() {
    EntityRepository<EntityInterface> repository = repositoryDeclaring(true, true);
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entityMock.when(() -> Entity.getEntityClassFromType(Entity.TABLE)).thenReturn(Table.class);
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
      entityMock
          .when(
              () ->
                  Entity.getEntityOrNull(
                      eq(Entity.TABLE),
                      eq(ENTITY_ID),
                      eq(Entity.FIELD_DOMAINS),
                      any(RelationIncludes.class)))
          .thenReturn(
              new Table()
                  .withId(ENTITY_ID)
                  .withDomains(List.of(new EntityReference().withFullyQualifiedName(DOMAIN_FQN))));

      AlertsRuleEvaluator evaluator =
          new AlertsRuleEvaluator(event(Entity.TABLE, new Table().withId(ENTITY_ID)));

      assertTrue(evaluator.matchAnyDomain(List.of(DOMAIN_FQN)));
    }
  }

  @Test
  void feedScopedMatchers_subjectTypeWithoutRegisteredRepository_returnFalse() {
    AlertsRuleEvaluator evaluator = evaluatorForThreadAbout("notAnEntityType");

    assertFalse(evaluator.matchAnyDomain(List.of(DOMAIN_FQN)));
    assertFalse(evaluator.matchAnyOwnerName(List.of("admin")));
  }

  /** Mirrors what {@code EntityRepository.getFields} raises for a field the schema omits. */
  private static void rejectUndeclaredRead(
      MockedStatic<Entity> entityMock, String entityType, String field) {
    entityMock
        .when(
            () ->
                Entity.getEntityOrNull(
                    eq(entityType), any(UUID.class), eq(field), any(RelationIncludes.class)))
        .thenThrow(new IllegalArgumentException("Invalid field name " + field));
  }

  private static EntityRepository<EntityInterface> repositoryDeclaring(
      boolean owners, boolean domains) {
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
    when(repository.isSupportsOwners()).thenReturn(owners);
    when(repository.isSupportsDomains()).thenReturn(domains);
    return repository;
  }

  private static ChangeEvent event(String entityType, EntityInterface entity) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(ENTITY_ID)
        .withEntity(entity);
  }

  private static AlertsRuleEvaluator evaluatorForThreadAbout(String subjectType) {
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Conversation)
            .withEntityRef(
                new EntityReference()
                    .withId(UUID.randomUUID())
                    .withType(subjectType)
                    .withFullyQualifiedName("someParent"));
    return new AlertsRuleEvaluator(
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEventType(EventType.THREAD_CREATED)
            .withEntityType(Entity.THREAD)
            .withEntity(thread));
  }
}
