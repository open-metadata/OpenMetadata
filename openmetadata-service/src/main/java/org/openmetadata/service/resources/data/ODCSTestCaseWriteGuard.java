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
import org.openmetadata.service.resources.dqtests.TestCaseWriteAuthRequests;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;

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
    List<AuthRequest> requests;
    if (overwritesExisting) {
      requests = TestCaseWriteAuthRequests.forUpdate(testCase);
    } else {
      limits.enforceLimits(
          securityContext,
          new CreateResourceContext<>(Entity.TEST_CASE, testCase),
          new OperationContext(Entity.TEST_CASE, MetadataOperation.CREATE_TESTS));
      requests = TestCaseWriteAuthRequests.forCreate(testCase);
    }
    authorizer.authorizeRequests(securityContext, requests, AuthorizationLogic.ANY);
  }
}
