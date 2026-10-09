/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.it.tests.ChangeRequestITSupport.*;

import java.time.Duration;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.DecisionType;
import org.openmetadata.schema.governance.changeRequest.DeliveryStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.ChangeRequestRecoveryScheduler;
import org.openmetadata.service.governance.approval.ChangeRequestService;

@ExtendWith(TestNamespaceExtension.class)
class ChangeRequestLifecycleIT {
  private Glossary gated(TestNamespace ns) {
    Glossary glossary =
        gatedGlossaryOwnedBy(ns, "dn", SharedEntities.get().USER2.getEntityReference());
    deployHookWorkflow(ns, "\"description\"", "", filterScopedTo(glossary.getFullyQualifiedName()));
    return glossary;
  }

  private ChangeRequest stage(Glossary glossary) {
    patchAs(
        SdkClients.user2Client(),
        glossary.getId(),
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"staged\"}]");
    return onlyPendingRequest(glossary.getId());
  }

  @Test
  void softDeletingTheEntityCancelsItsRequests(TestNamespace ns) {
    Glossary glossary = gated(ns);
    ChangeRequest request = stage(glossary);
    SdkClients.adminClient().glossaries().delete(glossary.getId().toString());
    assertEquals(
        ChangeRequestStatus.CANCELLED, ChangeRequestService.get(request.getId()).getStatus());
  }

  @Test
  void deletingTheHookWorkflowCancelsItsRequests(TestNamespace ns) {
    Glossary glossary = gated(ns);
    ChangeRequest request = stage(glossary);
    UUID workflowId = request.getWorkflowDefinitionId();
    SdkClients.adminClient().workflowDefinitions().delete(workflowId.toString());
    assertEquals(
        ChangeRequestStatus.CANCELLED, ChangeRequestService.get(request.getId()).getStatus());
  }

  @Test
  void undeliveredRequestIsRedeliveredByTheScanner(TestNamespace ns) {
    Glossary glossary = gated(ns);
    ChangeRequest request = stage(glossary);
    // Each pass re-arms the request and scans; a pass can fail while parallel tests tear their hook
    // workflows down (the signal fans out to all of them), which is what redelivery is for.
    Awaitility.await("scanner redelivers the request")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              Entity.getCollectionDAO().changeRequestDAO().markDeliveryDue(request.getId(), 0L);
              ChangeRequestRecoveryScheduler.runOnce();
              return ChangeRequestService.get(request.getId()).getDeliveryStatus()
                  == DeliveryStatus.DELIVERED;
            });
  }

  @Test
  void approvedButUnappliedRequestIsAppliedByTheScanner(TestNamespace ns) {
    Glossary glossary = gated(ns);
    ChangeRequest request = stage(glossary);
    var revision = ChangeRequestService.activeRevision(request);
    Entity.getCollectionDAO()
        .approvalDecisionDAO()
        .insert(
            new ApprovalDecision()
                .withId(UUID.randomUUID())
                .withChangeRequestId(request.getId())
                .withRevisionId(revision.getId())
                .withRevisionNumber(1)
                .withDigest(revision.getDigest())
                .withDecision(DecisionType.APPROVE)
                .withDecidedBy(SharedEntities.get().USER1.getName())
                .withDecidedAt(System.currentTimeMillis()));
    ChangeRequest approved =
        ChangeRequestService.get(request.getId()).withStatus(ChangeRequestStatus.APPROVED);
    Entity.getCollectionDAO().changeRequestDAO().update(approved.withActiveRevision(null));
    Entity.getCollectionDAO().changeRequestDAO().backdate(request.getId(), 0L);
    ChangeRequestRecoveryScheduler.runOnce();
    Awaitility.await("scanner applied")
        .atMost(Duration.ofSeconds(30))
        .until(
            () ->
                ChangeRequestService.get(request.getId()).getStatus()
                    == ChangeRequestStatus.APPLIED);
    assertEquals("staged", descriptionOf(glossary.getId()));
  }
}
