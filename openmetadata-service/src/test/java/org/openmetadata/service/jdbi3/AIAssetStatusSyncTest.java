/*
 *  Copyright 2026 Collate.
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpGovernanceMetadata;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.type.EntityStatus;

class AIAssetStatusSyncTest {

  @Test
  void forwardSync_mirrorsApprovalEntityStatusToRegistrationStatus() {
    AIApplication approved = new AIApplication().withEntityStatus(EntityStatus.APPROVED);
    AIAssetStatusSync.sync(approved);
    assertEquals(
        GovernanceMetadata.RegistrationStatus.APPROVED,
        approved.getGovernanceMetadata().getRegistrationStatus());

    AIApplication inReview = new AIApplication().withEntityStatus(EntityStatus.IN_REVIEW);
    AIAssetStatusSync.sync(inReview);
    assertEquals(
        GovernanceMetadata.RegistrationStatus.PENDING_APPROVAL,
        inReview.getGovernanceMetadata().getRegistrationStatus());
  }

  @Test
  void forwardSync_stampsApproverFromUpdatedByOnApproval() {
    AIApplication approved =
        new AIApplication().withEntityStatus(EntityStatus.APPROVED).withUpdatedBy("risk-council");
    AIAssetStatusSync.sync(approved);
    assertEquals("risk-council", approved.getGovernanceMetadata().getApprovedBy());
    assertNotNull(approved.getGovernanceMetadata().getApprovedAt());
  }

  @Test
  void forwardSync_preservesExistingApprover() {
    AIApplication approved =
        new AIApplication()
            .withEntityStatus(EntityStatus.APPROVED)
            .withUpdatedBy("governance-bot")
            .withGovernanceMetadata(
                new GovernanceMetadata().withApprovedBy("alice").withApprovedAt(123L));
    AIAssetStatusSync.sync(approved);
    assertEquals("alice", approved.getGovernanceMetadata().getApprovedBy());
    assertEquals(123L, approved.getGovernanceMetadata().getApprovedAt());
  }

  @Test
  void sync_leavesDraftAndDeprecatedUntouched() {
    AIApplication draft = new AIApplication().withEntityStatus(EntityStatus.DRAFT);
    AIAssetStatusSync.sync(draft);
    assertNull(draft.getGovernanceMetadata());
    assertEquals(EntityStatus.DRAFT, draft.getEntityStatus());

    AIApplication deprecated =
        new AIApplication()
            .withEntityStatus(EntityStatus.DEPRECATED)
            .withGovernanceMetadata(
                new GovernanceMetadata()
                    .withRegistrationStatus(GovernanceMetadata.RegistrationStatus.APPROVED));
    AIAssetStatusSync.sync(deprecated);
    assertEquals(EntityStatus.DEPRECATED, deprecated.getEntityStatus());
    assertEquals(
        GovernanceMetadata.RegistrationStatus.APPROVED,
        deprecated.getGovernanceMetadata().getRegistrationStatus());
  }

  @Test
  void reverseSync_derivesEntityStatusFromRegistrationWhenUnset() {
    AIApplication pending =
        new AIApplication()
            .withGovernanceMetadata(
                new GovernanceMetadata()
                    .withRegistrationStatus(
                        GovernanceMetadata.RegistrationStatus.PENDING_APPROVAL));
    AIAssetStatusSync.sync(pending);
    assertEquals(EntityStatus.IN_REVIEW, pending.getEntityStatus());
  }

  @Test
  void sync_leavesShadowAndRegisteredAssetsUntouched() {
    AIApplication shadow =
        new AIApplication()
            .withGovernanceMetadata(
                new GovernanceMetadata()
                    .withRegistrationStatus(GovernanceMetadata.RegistrationStatus.UNREGISTERED));
    EntityStatus before = shadow.getEntityStatus();
    AIAssetStatusSync.sync(shadow);
    // Shadow AI is not pushed into the approval flow: entityStatus is left at its
    // default and the Unregistered registration status is preserved.
    assertEquals(before, shadow.getEntityStatus());
    assertEquals(
        GovernanceMetadata.RegistrationStatus.UNREGISTERED,
        shadow.getGovernanceMetadata().getRegistrationStatus());
  }

  @Test
  void mcpServer_forwardSyncMirrorsRejected() {
    McpServer rejected = new McpServer().withEntityStatus(EntityStatus.REJECTED);
    AIAssetStatusSync.sync(rejected);
    assertEquals(
        McpGovernanceMetadata.RegistrationStatus.REJECTED,
        rejected.getGovernanceMetadata().getRegistrationStatus());
  }

  @Test
  void llmModel_forwardAndReverseSync() {
    LLMModel rejected = new LLMModel().withEntityStatus(EntityStatus.REJECTED);
    AIAssetStatusSync.sync(rejected);
    assertEquals(LLMModel.GovernanceStatus.REJECTED, rejected.getGovernanceStatus());

    LLMModel pendingReview =
        new LLMModel().withGovernanceStatus(LLMModel.GovernanceStatus.PENDING_REVIEW);
    AIAssetStatusSync.sync(pendingReview);
    assertEquals(EntityStatus.IN_REVIEW, pendingReview.getEntityStatus());
  }
}
