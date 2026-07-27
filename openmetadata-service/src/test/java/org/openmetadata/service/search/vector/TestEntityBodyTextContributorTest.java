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
package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class TestEntityBodyTextContributorTest {

  @Test
  void testCaseBodyTextIncludesDefinitionAssetParamsAndStatus() {
    TestCase testCase =
        new TestCase()
            .withId(UUID.randomUUID())
            .withName("customers_email_not_null")
            .withDescription("Ensure email is populated")
            .withEntityFQN("snowflake.sales.public.customers")
            .withTestDefinition(
                new EntityReference()
                    .withName("columnValuesToBeNotNull")
                    .withType(Entity.TEST_DEFINITION))
            .withParameterValues(
                List.of(new TestCaseParameterValue().withName("columnName").withValue("email")))
            .withTestCaseResult(new TestCaseResult().withTestCaseStatus(TestCaseStatus.Failed));

    String body = TestCaseBodyTextContributor.extractBodyText(testCase);

    assertTrue(body.contains("Ensure email is populated"), "description should be present");
    assertTrue(body.contains("columnValuesToBeNotNull"), "test definition should be present");
    assertTrue(
        body.contains("snowflake.sales.public.customers"), "tested asset FQN should be present");
    assertTrue(body.contains("columnName=email"), "parameter values should be present");
    assertTrue(body.contains("Failed"), "latest status should be present");
  }

  @Test
  void testSuiteBodyTextIncludesDescriptionAndLinkedAsset() {
    TestSuite testSuite =
        new TestSuite()
            .withId(UUID.randomUUID())
            .withName("customers_suite")
            .withDescription("Quality checks for customers")
            .withBasicEntityReference(
                new EntityReference()
                    .withName("customers")
                    .withFullyQualifiedName("snowflake.sales.public.customers")
                    .withType(Entity.TABLE));

    String body = TestSuiteBodyTextContributor.extractBodyText(testSuite);

    assertTrue(body.contains("Quality checks for customers"), "description should be present");
    assertTrue(
        body.contains("snowflake.sales.public.customers"), "linked asset FQN should be present");
  }

  @Test
  void extractorsReturnNullForWrongEntityType() {
    // Wrong-type input must fall back to the default extractor (null signals fallback).
    assertNull(TestCaseBodyTextContributor.extractBodyText(new TestSuite()));
    assertNull(TestSuiteBodyTextContributor.extractBodyText(new TestCase()));
  }
}
