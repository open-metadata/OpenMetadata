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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
    BulkOperationResult result = result(List.of(held(), held()));

    Response response = ApprovalGate.bulkResponse(result, false);

    assertEquals(Response.Status.ACCEPTED.getStatusCode(), response.getStatus());
    assertEquals("2", pendingCount(response));
  }

  @Test
  void partlyHeldAnswersOkWithTheCount() {
    BulkOperationResult result = result(List.of(new BulkResponse().withRequest(asset()), held()));

    Response response = ApprovalGate.bulkResponse(result, false);

    assertEquals(OK, response.getStatus());
    assertEquals("1", pendingCount(response));
  }

  @Test
  void dryRunAnswersOkWithoutTheCount() {
    BulkOperationResult result = result(List.of(heldInDryRun()));

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
  void aHeldItemNamesItsChangeRequestAndIsToldApartFromAnAppliedOne() {
    UUID changeRequestId = UUID.randomUUID();

    assertEquals(
        "Pending approval: change request " + changeRequestId,
        ApprovalGate.pendingMessage(changeRequestId));
    assertEquals("Pending approval", ApprovalGate.pendingMessage(null));
    assertTrue(ApprovalGate.isPending(held()));
    assertTrue(ApprovalGate.isPending(heldInDryRun()));
    assertFalse(ApprovalGate.isPending(new BulkResponse().withRequest(asset())));
  }

  // As AssetEditService reports them: a held item passes and also counts as pending approval.
  private static BulkOperationResult result(List<BulkResponse> passed) {
    int pending = (int) passed.stream().filter(ApprovalGate::isPending).count();
    return emptyResult()
        .withSuccessRequest(passed)
        .withNumberOfRowsProcessed(passed.size())
        .withNumberOfRowsPassed(passed.size())
        .withNumberOfRowsPendingApproval(pending);
  }

  private static BulkOperationResult emptyResult() {
    return new BulkOperationResult().withStatus(ApiStatus.SUCCESS);
  }

  private static BulkResponse held() {
    return new BulkResponse()
        .withRequest(asset())
        .withStatus(OK)
        .withMessage(ApprovalGate.pendingMessage(UUID.randomUUID()));
  }

  private static BulkResponse heldInDryRun() {
    return new BulkResponse()
        .withRequest(asset())
        .withStatus(OK)
        .withMessage(ApprovalGate.pendingMessage(null));
  }

  private static EntityReference asset() {
    return new EntityReference().withId(UUID.randomUUID()).withType("table");
  }

  private static String pendingCount(Response response) {
    Object value = response.getHeaders().getFirst(RestUtil.PENDING_CHANGE_COUNT_HEADER);
    return value == null ? null : value.toString();
  }
}
