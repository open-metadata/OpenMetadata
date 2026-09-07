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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.AuthRequest;

class TaskRepositoryIncidentAuthRequestsTest {

  private static final String TABLE_LINK = "<#E::table::svc.db.schema.orders>";

  @Test
  void incident_fallback_requests_accept_edit_status_on_test_case() {
    List<MetadataOperation> testCaseOperations = testCaseOperations(incidentRequests());

    assertTrue(
        testCaseOperations.contains(MetadataOperation.EDIT_STATUS),
        "EditStatus on testCase must authorize the task incident fallback");
  }

  @Test
  void incident_fallback_requests_keep_legacy_test_case_edit_grants() {
    List<MetadataOperation> testCaseOperations = testCaseOperations(incidentRequests());

    assertTrue(
        testCaseOperations.contains(MetadataOperation.EDIT_TESTS)
            && testCaseOperations.contains(MetadataOperation.EDIT_ALL),
        "EditTests/EditAll on testCase must keep authorizing the task incident fallback");
  }

  @Test
  void incident_fallback_requests_keep_grants_on_the_entity_under_test() {
    List<MetadataOperation> tableOperations = new ArrayList<>();
    for (AuthRequest request : incidentRequests()) {
      if (Entity.TABLE.equals(request.operationContext().getResource())) {
        tableOperations.addAll(request.operationContext().getOperations(request.resourceContext()));
      }
    }

    assertTrue(
        tableOperations.contains(MetadataOperation.EDIT_TESTS)
            && tableOperations.contains(MetadataOperation.EDIT_ALL),
        "EditTests/EditAll on the entity under test must keep authorizing the incident fallback");
  }

  private static List<AuthRequest> incidentRequests() {
    TestCase testCase =
        new TestCase()
            .withFullyQualifiedName("svc.db.schema.orders.column_values_to_be_not_null")
            .withEntityLink(TABLE_LINK);
    return TaskRepository.buildIncidentEditRequests(testCase);
  }

  private static List<MetadataOperation> testCaseOperations(List<AuthRequest> requests) {
    List<MetadataOperation> operations = new ArrayList<>();
    for (AuthRequest request : requests) {
      if (Entity.TEST_CASE.equals(request.operationContext().getResource())) {
        operations.addAll(request.operationContext().getOperations(request.resourceContext()));
      }
    }
    return operations;
  }
}
