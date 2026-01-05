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
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.notifications.recipients.downstream.EntityLineageResolver;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Resolves failed test cases from a TestSuite to their parent entities for lineage traversal.
 *
 * When a TestSuite execution completes, only FAILED tests trigger downstream notifications
 * to alert stakeholders of dependent data entities affected by quality issues.
 *
 * This resolver:
 * 1. Fetches the TestSuite with summary field to access testCaseResultSummary
 * 2. Filters to FAILED tests only
 * 3. Extracts parent entity from each failed test case
 * 4. Returns Set of parent entity references for lineage traversal
 *
 * Efficiency: testCaseResultSummary is populated by TestSuiteRepository via grouping
 * latest results by testCaseFQN, avoiding N+1 queries on individual test cases.
 */
@Slf4j
public class TestSuiteLineageResolver implements EntityLineageResolver {

  @Override
  public Set<EntityReference> resolveTraversalEntities(ChangeEvent changeEvent) {
    TestSuite testSuite = null;

    try {
      if (changeEvent.getEntity() != null) {
        testSuite = (TestSuite) AlertsRuleEvaluator.getEntity(changeEvent);
      }
    } catch (Exception e) {
      LOG.warn("Failed to deserialize TestSuite from ChangeEvent payload", e);
    }

    return extractParentEntitiesFromTestSuite(testSuite);
  }

  @Override
  public Set<EntityReference> resolveTraversalEntities(UUID entityId, String entityType) {
    TestSuite testSuite = null;

    try {
      // Fetch TestSuite with summary field to get testCaseResultSummary
      testSuite = Entity.getEntity(Entity.TEST_SUITE, entityId, "summary", Include.NON_DELETED);
    } catch (Exception e) {
      LOG.warn("Failed to resolve parent entities for TestSuite {}", entityId, e);
    }

    return extractParentEntitiesFromTestSuite(testSuite);
  }

  private Set<EntityReference> extractParentEntitiesFromTestSuite(TestSuite testSuite) {
    Set<EntityReference> parentEntities = new HashSet<>();

    if (testSuite == null) {
      return parentEntities;
    }

    try {
      // Get test case result summaries (populated by TestSuiteRepository when entity is fetched)
      List<ResultSummary> testCaseResults = testSuite.getTestCaseResultSummary();

      // Process only FAILED test cases
      if (testCaseResults != null && !testCaseResults.isEmpty()) {
        for (ResultSummary result : testCaseResults) {
          if (result.getStatus() == TestCaseStatus.Failed) {
            Set<EntityReference> parentRef = extractParentFromTestCaseResult(result);
            parentEntities.addAll(parentRef);
          }
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to extract parent entities from TestSuite", e);
    }

    return parentEntities;
  }

  /**
   * Extracts the parent entity reference from a test case result.
   *
   * The result contains the test case FQN. We fetch the TestCase entity to get
   * its entityLink property, which points to the entity being tested (table, column, etc).
   */
  private Set<EntityReference> extractParentFromTestCaseResult(ResultSummary result) {
    Set<EntityReference> parentRef = new HashSet<>();

    try {
      String testCaseFQN = result.getTestCaseName();

      if (testCaseFQN == null || testCaseFQN.isEmpty()) {
        LOG.debug("Test case result has no FQN");
        return parentRef;
      }

      // Fetch the TestCase entity to get its parent (via entityLink)
      TestCase testCase =
          Entity.getEntityByName(Entity.TEST_CASE, testCaseFQN, "", Include.NON_DELETED);

      if (testCase == null) {
        LOG.debug("TestCase {} not found for result", testCaseFQN);
        return parentRef;
      }

      // Extract the entity link (parent entity reference)
      String entityLink = testCase.getEntityLink();
      if (entityLink == null || entityLink.isEmpty()) {
        LOG.debug("TestCase {} has no entity link", testCaseFQN);
        return parentRef;
      }

      // Parse the entity link to get entity type and FQN
      MessageParser.EntityLink parsedLink = MessageParser.EntityLink.parse(entityLink);
      String parentType = parsedLink.getEntityType();

      if (parentType == null) {
        LOG.debug("Failed to parse entity link for TestCase {}", testCaseFQN);
        return parentRef;
      }

      // Fetch the parent entity
      EntityInterface parentEntity = Entity.getEntity(parsedLink, "", Include.NON_DELETED);

      if (parentEntity != null) {
        EntityReference parentEntityRef =
            new EntityReference()
                .withId(parentEntity.getId())
                .withType(parentType)
                .withName(parentEntity.getName())
                .withFullyQualifiedName(parentEntity.getFullyQualifiedName());

        parentRef.add(parentEntityRef);

        LOG.debug(
            "Resolved failed TestCase {} to parent entity {} {}",
            testCaseFQN,
            parentType,
            parentEntity.getId());
      } else {
        LOG.debug("Parent entity {} not found for TestCase {}", parentType, testCaseFQN);
      }

    } catch (Exception e) {
      LOG.warn("Failed to extract parent from test case result: {}", result.getTestCaseName(), e);
    }

    return parentRef;
  }

  @Override
  public String getEntityType() {
    return Entity.TEST_SUITE;
  }
}
