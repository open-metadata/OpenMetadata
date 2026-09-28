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

package org.openmetadata.service.resources.data;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.datacontract.odcs.ODCSTestCaseMaterializer;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.TestCaseResourceContext;

/**
 * Importing an ODCS contract may create or update test cases, so it has to pass the same checks as
 * {@code POST} and {@code PUT /v1/dataQuality/testCases}: without them, permission to import a data
 * contract would be enough to run arbitrary SQL checks against the table.
 */
final class ODCSTestCaseWriteGuard implements ODCSTestCaseMaterializer.WriteGuard {
  private final Authorizer authorizer;
  private final Limits limits;
  private final SecurityContext securityContext;

  ODCSTestCaseWriteGuard(Authorizer authorizer, Limits limits, SecurityContext securityContext) {
    this.authorizer = authorizer;
    this.limits = limits;
    this.securityContext = securityContext;
  }

  @Override
  public void authorize(TestCase testCase, boolean overwritesExisting) {
    ResourceContextInterface tableContext =
        TestCaseResourceContext.builder()
            .entityLink(EntityLink.parse(testCase.getEntityLink()))
            .build();
    List<AuthRequest> requests =
        overwritesExisting
            ? updateRequests(testCase, tableContext)
            : createRequests(testCase, tableContext);
    authorizer.authorizeRequests(securityContext, requests, AuthorizationLogic.ANY);
  }

  private List<AuthRequest> createRequests(
      TestCase testCase, ResourceContextInterface tableContext) {
    CreateResourceContext<TestCase> testCaseContext =
        new CreateResourceContext<>(Entity.TEST_CASE, testCase);
    limits.enforceLimits(
        securityContext,
        testCaseContext,
        new OperationContext(Entity.TEST_CASE, MetadataOperation.CREATE_TESTS));
    return List.of(
        new AuthRequest(
            new OperationContext(Entity.TABLE, MetadataOperation.CREATE_TESTS), tableContext),
        new AuthRequest(
            new OperationContext(Entity.TEST_CASE, MetadataOperation.CREATE), testCaseContext));
  }

  private static List<AuthRequest> updateRequests(
      TestCase testCase, ResourceContextInterface tableContext) {
    ResourceContextInterface testCaseContext =
        TestCaseResourceContext.builder().name(testCase.getFullyQualifiedName()).build();
    return List.of(
        new AuthRequest(
            new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TESTS), tableContext),
        new AuthRequest(
            new OperationContext(Entity.TEST_CASE, MetadataOperation.CREATE), testCaseContext),
        new AuthRequest(
            new OperationContext(Entity.TEST_CASE, MetadataOperation.EDIT_ALL), testCaseContext));
  }
}
