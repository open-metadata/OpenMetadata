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
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * A test-suite-domain alert on a test-case event must resolve the suites from the store. The
 * serialized change event does not carry relationship fields, so the suites on the payload have no
 * domains to match against — reading them from the payload silently never fires.
 */
class AlertsRuleEvaluatorTestSuiteDomainTest {

  private static final UUID TEST_CASE_ID = UUID.randomUUID();
  private static final String DOMAIN_FQN = "Finance";

  private TestCase payloadWithoutSuiteDomains() {
    // What actually arrives on the wire: the suite reference survives, its domains do not.
    return new TestCase()
        .withId(TEST_CASE_ID)
        .withName("column_values_to_be_unique")
        .withTestSuites(
            List.of(
                new TestSuite()
                    .withName("suite")
                    .withFullyQualifiedName("suite")
                    .withDomains(null)));
  }

  private TestCase storedWithSuiteDomains() {
    return new TestCase()
        .withId(TEST_CASE_ID)
        .withTestSuites(
            List.of(
                new TestSuite()
                    .withName("suite")
                    .withFullyQualifiedName("suite")
                    .withDomains(
                        List.of(new EntityReference().withFullyQualifiedName(DOMAIN_FQN)))));
  }

  private ChangeEvent testCaseEvent(TestCase payload) {
    return new ChangeEvent()
        .withEntityType(Entity.TEST_CASE)
        .withEntityId(TEST_CASE_ID)
        .withEntity(payload);
  }

  @Test
  void matchesDomainCarriedOnlyByTheStoredTestSuite() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entityMock
          .when(() -> Entity.getEntityClassFromType(Entity.TEST_CASE))
          .thenReturn(TestCase.class);
      // The test case itself carries no domains...
      entityMock
          .when(
              () ->
                  Entity.getEntityOrNull(
                      eq(Entity.TEST_CASE),
                      eq(TEST_CASE_ID),
                      eq(Entity.FIELD_DOMAINS),
                      any(RelationIncludes.class)))
          .thenReturn(new TestCase().withId(TEST_CASE_ID).withDomains(null));
      // ...but its suite does, once re-read with the suites+domains field set.
      entityMock
          .when(
              () ->
                  Entity.getEntityOrNull(
                      eq(Entity.TEST_CASE),
                      eq(TEST_CASE_ID),
                      contains(Entity.FIELD_TEST_SUITES),
                      any(RelationIncludes.class)))
          .thenReturn(storedWithSuiteDomains());

      AlertsRuleEvaluator evaluator =
          new AlertsRuleEvaluator(testCaseEvent(payloadWithoutSuiteDomains()));

      assertTrue(evaluator.matchAnyDomain(List.of(DOMAIN_FQN)));
    }
  }

  @Test
  void doesNotMatchWhenNeitherTestCaseNorSuiteCarriesTheDomain() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entityMock
          .when(() -> Entity.getEntityClassFromType(Entity.TEST_CASE))
          .thenReturn(TestCase.class);
      entityMock
          .when(
              () ->
                  Entity.getEntityOrNull(
                      eq(Entity.TEST_CASE), eq(TEST_CASE_ID), any(), any(RelationIncludes.class)))
          .thenReturn(new TestCase().withId(TEST_CASE_ID));

      AlertsRuleEvaluator evaluator =
          new AlertsRuleEvaluator(testCaseEvent(payloadWithoutSuiteDomains()));

      assertFalse(evaluator.matchAnyDomain(List.of("Marketing")));
    }
  }
}
