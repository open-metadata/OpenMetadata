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
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.notifications.recipients.downstream.EntityLineageResolver;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Resolves TestCase to its parent entity for lineage traversal.
 *
 * TestCases are metadata assertions about data entities (e.g., tables). They don't participate
 * in lineage themselves but rather describe properties of their parent entities. To resolve
 * recipients from downstream entities, we must traverse the parent's lineage, not the test
 * case's own lineage.
 */
@Slf4j
public class TestCaseLineageResolver implements EntityLineageResolver {

  @Override
  public Set<EntityReference> resolveTraversalEntities(ChangeEvent changeEvent) {
    TestCase testCase = null;

    try {
      if (changeEvent.getEntity() != null) {
        testCase = (TestCase) AlertsRuleEvaluator.getEntity(changeEvent);
      }
    } catch (Exception e) {
      LOG.warn("Failed to deserialize TestCase from ChangeEvent payload", e);
    }

    return extractParentFromTestCase(testCase, changeEvent.getEntityId());
  }

  @Override
  public Set<EntityReference> resolveTraversalEntities(UUID entityId, String entityType) {
    TestCase testCase = null;

    try {
      EntityInterface entity =
          Entity.getEntity(Entity.TEST_CASE, entityId, "owners", Include.NON_DELETED);

      if (entity instanceof TestCase tc) {
        testCase = tc;
      }
    } catch (Exception e) {
      LOG.warn("Failed to resolve parent for TestCase {}", entityId, e);
    }

    return extractParentFromTestCase(testCase, entityId);
  }

  private Set<EntityReference> extractParentFromTestCase(TestCase testCase, UUID entityId) {
    Set<EntityReference> parents = new HashSet<>();

    if (testCase == null) {
      return parents;
    }

    try {
      MessageParser.EntityLink parentLink =
          MessageParser.EntityLink.parse(testCase.getEntityLink());
      EntityInterface parentEntity = Entity.getEntity(parentLink, "owners", Include.NON_DELETED);

      if (parentEntity != null) {
        parents.add(
            new EntityReference()
                .withId(parentEntity.getId())
                .withType(parentLink.getEntityType())
                .withName(parentEntity.getName())
                .withFullyQualifiedName(parentEntity.getFullyQualifiedName()));
      }
    } catch (Exception e) {
      LOG.warn("Failed to extract parent from TestCase {}", entityId, e);
    }

    return parents;
  }

  @Override
  public String getEntityType() {
    return Entity.TEST_CASE;
  }
}
