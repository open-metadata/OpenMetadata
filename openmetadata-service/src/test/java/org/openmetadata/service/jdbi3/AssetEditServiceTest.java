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

import static org.junit.jupiter.api.Assertions.assertEquals;

import jakarta.ws.rs.core.Response.Status;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.service.governance.approval.ApprovalGate;

class AssetEditServiceTest {

  @Test
  void theAssetsHeldForApprovalAreNotAmongTheSucceededOnes() {
    EntityReference applied = asset();
    BulkOperationResult result =
        new BulkOperationResult()
            .withSuccessRequest(
                List.of(new BulkResponse().withRequest(applied), held(asset()), noAsset()));

    assertEquals(List.of(applied), AssetEditService.succeededAssets(result));
  }

  @Test
  void combinedResultsCountTheItemsOfBothAndLeaveOutTheNothingToValidateItem() {
    EntityReference heldAsset = asset();
    EntityReference appliedAsset = asset();
    EntityReference refusedAsset = asset();
    BulkOperationResult heldFirst =
        new BulkOperationResult()
            .withDryRun(false)
            .withSuccessRequest(List.of(held(heldAsset)))
            .withNumberOfRowsPendingApproval(1);
    BulkOperationResult rest =
        new BulkOperationResult()
            .withSuccessRequest(List.of(new BulkResponse().withRequest(appliedAsset), noAsset()))
            .withFailedRequest(
                List.of(new BulkResponse().withRequest(refusedAsset).withMessage("denied")))
            .withNumberOfRowsPendingApproval(0);

    BulkOperationResult combined = AssetEditService.combine(heldFirst, rest);

    assertEquals(
        List.of(heldAsset, appliedAsset),
        combined.getSuccessRequest().stream().map(BulkResponse::getRequest).toList());
    assertEquals(
        List.of(refusedAsset),
        combined.getFailedRequest().stream().map(BulkResponse::getRequest).toList());
    assertEquals(3, combined.getNumberOfRowsProcessed());
    assertEquals(2, combined.getNumberOfRowsPassed());
    assertEquals(1, combined.getNumberOfRowsFailed());
    assertEquals(1, combined.getNumberOfRowsPendingApproval());
    assertEquals(ApiStatus.PARTIAL_SUCCESS, combined.getStatus());
    assertEquals(false, combined.getDryRun());
  }

  @Test
  void everyAssetHeldBeforeAnEmptyJobIsStillASuccess() {
    BulkOperationResult heldFirst =
        new BulkOperationResult()
            .withSuccessRequest(List.of(held(asset())))
            .withNumberOfRowsPendingApproval(1);
    BulkOperationResult emptyJob =
        new BulkOperationResult()
            .withStatus(ApiStatus.SUCCESS)
            .withSuccessRequest(List.of(noAsset()));

    BulkOperationResult combined = AssetEditService.combine(heldFirst, emptyJob);

    assertEquals(1, combined.getSuccessRequest().size());
    assertEquals(1, combined.getNumberOfRowsPendingApproval());
    assertEquals(ApiStatus.SUCCESS, combined.getStatus());
  }

  private static BulkResponse held(EntityReference asset) {
    return new BulkResponse()
        .withRequest(asset)
        .withStatus(Status.OK.getStatusCode())
        .withMessage(ApprovalGate.pendingMessage(UUID.randomUUID()));
  }

  private static BulkResponse noAsset() {
    return new BulkResponse().withMessage(AssetEditService.NOTHING_TO_VALIDATE);
  }

  private static EntityReference asset() {
    return new EntityReference().withId(UUID.randomUUID()).withType("table");
  }
}
