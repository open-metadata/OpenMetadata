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

package org.openmetadata.service.governance.approval;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.service.util.RestUtil;

class ApprovalGateBulkResponseTest {
  private static final int OK = Response.Status.OK.getStatusCode();

  @Test
  void everyAssetHeldAnswersAcceptedWithTheCount() {
    BulkOperationResult result = ApprovalGate.withHeld(emptyResult(), List.of(held(), held()));

    Response response = ApprovalGate.bulkResponse(result, false);

    assertEquals(Response.Status.ACCEPTED.getStatusCode(), response.getStatus());
    assertEquals("2", pendingCount(response));
  }

  @Test
  void partlyHeldAnswersOkWithTheCount() {
    BulkOperationResult applied =
        emptyResult()
            .withSuccessRequest(List.of(new BulkResponse().withRequest(asset()).withStatus(OK)))
            .withNumberOfRowsPassed(1);
    BulkOperationResult result = ApprovalGate.withHeld(applied, List.of(held()));

    Response response = ApprovalGate.bulkResponse(result, false);

    assertEquals(OK, response.getStatus());
    assertEquals("1", pendingCount(response));
  }

  @Test
  void dryRunAnswersOkWithoutTheCount() {
    BulkOperationResult result = ApprovalGate.withHeld(emptyResult(), List.of(held()));

    Response response = ApprovalGate.bulkResponse(result, true);

    assertEquals(OK, response.getStatus());
    assertNull(pendingCount(response));
  }

  @Test
  void nothingHeldAnswersOkWithoutTheCount() {
    Response response = ApprovalGate.bulkResponse(emptyResult(), false);

    assertEquals(OK, response.getStatus());
    assertNull(pendingCount(response));
  }

  @Test
  void submittedCountIgnoresAssetsThatCouldNotBeSubmitted() {
    BulkResponse rejected =
        new BulkResponse()
            .withRequest(asset())
            .withStatus(Response.Status.CONFLICT.getStatusCode());

    assertEquals(1, ApprovalGate.submittedCount(List.of(held(), rejected), false));
    assertEquals(0, ApprovalGate.submittedCount(List.of(held()), true));
  }

  private static BulkOperationResult emptyResult() {
    return new BulkOperationResult().withStatus(ApiStatus.SUCCESS);
  }

  private static BulkResponse held() {
    return new BulkResponse().withRequest(asset()).withStatus(OK);
  }

  private static EntityReference asset() {
    return new EntityReference().withId(UUID.randomUUID()).withType("table");
  }

  private static String pendingCount(Response response) {
    Object value = response.getHeaders().getFirst(RestUtil.PENDING_CHANGE_COUNT_HEADER);
    return value == null ? null : value.toString();
  }
}
