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

package org.openmetadata.service.resources.dqtests;

import java.util.List;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.TestCaseResourceContext;

/**
 * The permissions a test-case write is checked against under {@code AuthorizationLogic.ANY}, shared
 * by {@code PUT /v1/dataQuality/testCases} and the ODCS contract import so the two cannot drift
 * (ADR:2026-10-30-a-test-case-write-is-authorized-as-a-create-or-an-update).
 */
public final class TestCaseWriteAuthRequests {
  private TestCaseWriteAuthRequests() {}

  /**
   * Creating needs CreateTests on the table or Create on the test case, checked against the request:
   * a context built by name would look up a test case that does not exist yet.
   */
  public static List<AuthRequest> forCreate(TestCase testCase) {
    return List.of(
        new AuthRequest(
            new OperationContext(Entity.TABLE, MetadataOperation.CREATE_TESTS),
            tableContext(testCase)),
        new AuthRequest(
            new OperationContext(Entity.TEST_CASE, MetadataOperation.CREATE),
            new CreateResourceContext<>(Entity.TEST_CASE, testCase)));
  }

  /**
   * Updating needs EditTests on the table, or Create or EditAll on the stored test case, which
   * {@code testCase} must name by its stored FQN.
   */
  public static List<AuthRequest> forUpdate(TestCase testCase) {
    ResourceContextInterface testCaseContext =
        TestCaseResourceContext.builder().name(testCase.getFullyQualifiedName()).build();
    return List.of(
        new AuthRequest(
            new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS),
            tableContext(testCase)),
        new AuthRequest(
            new OperationContext(Entity.TEST_CASE, MetadataOperation.CREATE), testCaseContext),
        new AuthRequest(
            new OperationContext(Entity.TEST_CASE, MetadataOperation.EDIT_ALL), testCaseContext));
  }

  private static ResourceContextInterface tableContext(TestCase testCase) {
    return TestCaseResourceContext.builder()
        .entityLink(EntityLink.parse(testCase.getEntityLink()))
        .build();
  }
}
