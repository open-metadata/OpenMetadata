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

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.TestCaseResourceContext;

class TestCaseResolutionStatusAuthRequestsTest {

  @Test
  void edit_auth_requests_accept_edit_status_on_test_case() {
    ResourceContextInterface context = TestCaseResourceContext.builder().build();
    List<AuthRequest> requests =
        TestCaseResolutionStatusResource.buildEditAuthRequests(context, context);

    List<MetadataOperation> testCaseOperations = new ArrayList<>();
    for (AuthRequest request : requests) {
      if (Entity.TEST_CASE.equals(request.operationContext().getResource())) {
        testCaseOperations.addAll(request.operationContext().getOperations(context));
      }
    }

    assertTrue(
        testCaseOperations.contains(MetadataOperation.EDIT_STATUS),
        "EditStatus on testCase must authorize incident writes");
  }
}
