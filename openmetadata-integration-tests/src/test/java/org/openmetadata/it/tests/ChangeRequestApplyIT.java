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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.changeRequest.ChangeApplication;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.ChangeApplyService;
import org.openmetadata.service.governance.approval.ChangeRequestService;

@ExtendWith(TestNamespaceExtension.class)
class ChangeRequestApplyIT {
  private Glossary gatedOn(TestNamespace ns, String include) {
    Glossary glossary =
        gatedGlossaryOwnedBy(ns, "dn", SharedEntities.get().USER2.getEntityReference());
    deployHookWorkflow(ns, include, "", filterScopedTo(glossary.getFullyQualifiedName()));
    return glossary;
  }

  private ChangeRequest awaitStatus(UUID requestId, ChangeRequestStatus status) {
    Awaitility.await("change request %s reaches %s".formatted(requestId, status))
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(() -> ChangeRequestService.get(requestId).getStatus() == status);
    return ChangeRequestService.get(requestId);
  }

  private ChangeRequest stageThenApprove(
      Glossary glossary, String opsJson, Runnable beforeApproval) {
    patchAs(SdkClients.user2Client(), glossary.getId(), opsJson);
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    ChangeRequest request = onlyPendingRequest(glossary.getId());
    beforeApproval.run();
    resolveAs(
        SdkClients.user1Client(),
        task,
        "approve",
        TaskResolutionType.Approved,
        request.getActiveRevisionNumber());
    return request;
  }

  private static String replace(String path, String value) {
    return "[{\"op\":\"replace\",\"path\":\"/%s\",\"value\":\"%s\"}]".formatted(path, value);
  }

  @Test
  void approvedChangeIsPublishedAsRequester(TestNamespace ns) {
    Glossary glossary = gatedOn(ns, "\"description\"");
    ChangeRequest request =
        stageThenApprove(glossary, replace("description", "approved text"), () -> {});
    awaitStatus(request.getId(), ChangeRequestStatus.APPLIED);
    ChangeApplication application =
        Entity.getCollectionDAO().changeApplicationDAO().findByRequest(request.getId());
    assertNotNull(application);
    Glossary published =
        SdkClients.adminClient()
            .glossaries()
            .getVersion(glossary.getId(), application.getResultingEntityVersion());
    assertEquals("approved text", published.getDescription());
    assertEquals(SharedEntities.get().USER2.getName(), published.getUpdatedBy());
    assertTrue(published.getVersion() > glossary.getVersion());
    assertEquals("approved text", descriptionOf(glossary.getId()));
  }

  @Test
  void rejectedChangeIsNeverPublished(TestNamespace ns) {
    Glossary glossary = gatedOn(ns, "\"description\"");
    patchAs(SdkClients.user2Client(), glossary.getId(), replace("description", "rejected text"));
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    ChangeRequest request = onlyPendingRequest(glossary.getId());
    resolveAs(SdkClients.user1Client(), task, "reject", TaskResolutionType.Rejected, 1);
    awaitStatus(request.getId(), ChangeRequestStatus.REJECTED);
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
  }

  @Test
  void approvalAfterGatedBaseMovedConflictsWithoutOverwrite(TestNamespace ns) {
    Glossary glossary = gatedOn(ns, "\"description\"");
    ChangeRequest request =
        stageThenApprove(
            glossary,
            replace("description", "stale proposal"),
            () ->
                patchAs(
                    SdkClients.botClient(),
                    glossary.getId(),
                    replace("description", "newer by bot")));
    ChangeRequest conflicted = awaitStatus(request.getId(), ChangeRequestStatus.CONFLICTED);
    assertEquals("newer by bot", descriptionOf(glossary.getId()));
    assertEquals("description", conflicted.getConflicts().get(0).getField());
  }

  @Test
  void nonGatedDriftIsDroppedAndGatedPartApplies(TestNamespace ns) {
    Glossary glossary = gatedOn(ns, "\"description\"");
    String mixed =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"gated part\"},"
            + "{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"carried part\"}]";
    ChangeRequest request =
        stageThenApprove(
            glossary,
            mixed,
            () ->
                patchAs(
                    SdkClients.user2Client(),
                    glossary.getId(),
                    replace("displayName", "newer dn")));
    awaitStatus(request.getId(), ChangeRequestStatus.APPLIED);
    assertEquals("gated part", descriptionOf(glossary.getId()));
    assertEquals("newer dn", displayNameOf(glossary.getId()));
    ChangeApplication application =
        Entity.getCollectionDAO().changeApplicationDAO().findByRequest(request.getId());
    assertEquals("displayName", application.getDroppedOps().get(0).getField());
  }

  @Test
  void unrelatedChangeSurvivesApply(TestNamespace ns) {
    Glossary glossary = gatedOn(ns, "\"description\"");
    ChangeRequest request =
        stageThenApprove(
            glossary,
            replace("description", "approved"),
            () ->
                patchAs(
                    SdkClients.user2Client(),
                    glossary.getId(),
                    replace("displayName", "independent")));
    awaitStatus(request.getId(), ChangeRequestStatus.APPLIED);
    assertEquals("approved", descriptionOf(glossary.getId()));
    assertEquals("independent", displayNameOf(glossary.getId()));
  }

  @Test
  void ownerRenameDoesNotConflict(TestNamespace ns) {
    Glossary glossary = gatedOn(ns, "\"owners\"");
    var user3 = SharedEntities.get().USER3;
    String addOwner =
        "[{\"op\":\"add\",\"path\":\"/owners/-\",\"value\":{\"id\":\"%s\",\"type\":\"user\"}}]"
            .formatted(user3.getId());
    ChangeRequest request =
        stageThenApprove(
            glossary,
            addOwner,
            () ->
                SdkClients.adminClient()
                    .users()
                    .patch(
                        user3.getId().toString(),
                        org.openmetadata.schema.utils.JsonUtils.readTree(
                            "[{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"%s\"}]"
                                .formatted(ns.shortPrefix("renamed")))));
    awaitStatus(request.getId(), ChangeRequestStatus.APPLIED);
    assertTrue(
        SdkClients.adminClient()
            .glossaries()
            .get(glossary.getId().toString(), "owners")
            .getOwners()
            .stream()
            .anyMatch(owner -> owner.getId().equals(user3.getId())));
  }

  @Test
  void cumulativeRevisionAppliesMergedOps(TestNamespace ns) {
    Glossary glossary = gatedOn(ns, "\"description\",\"displayName\"");
    patchAs(SdkClients.user2Client(), glossary.getId(), replace("description", "rev1 description"));
    Task first = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    patchAs(SdkClients.user2Client(), glossary.getId(), replace("displayName", "rev2 name"));
    Task second = awaitNewOpenApprovalTask(glossary.getFullyQualifiedName(), first.getId());
    ChangeRequest request = onlyPendingRequest(glossary.getId());
    resolveAs(SdkClients.user1Client(), second, "approve", TaskResolutionType.Approved, 2);
    awaitStatus(request.getId(), ChangeRequestStatus.APPLIED);
    assertEquals("rev1 description", descriptionOf(glossary.getId()));
    assertEquals("rev2 name", displayNameOf(glossary.getId()));
  }

  @Test
  void reapplyIsIdempotent(TestNamespace ns) {
    Glossary glossary = gatedOn(ns, "\"description\"");
    ChangeRequest request = stageThenApprove(glossary, replace("description", "once"), () -> {});
    awaitStatus(request.getId(), ChangeRequestStatus.APPLIED);
    Double version = fetch(glossary.getId()).getVersion();
    ChangeApplyService.apply(request.getId());
    assertEquals(version, fetch(glossary.getId()).getVersion());
  }

  @Test
  void reviewerSeesTheRevisionOpsInTheTaskPayload(TestNamespace ns) {
    Glossary glossary = gatedOn(ns, "\"description\"");
    patchAs(
        SdkClients.user2Client(), glossary.getId(), replace("description", "visible to reviewer"));
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    Awaitility.await("revision ops in task payload")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () ->
                taskPayloadJson(task.getId()).contains("proposedChanges")
                    && taskPayloadJson(task.getId()).contains("visible to reviewer"));
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
  }

  @Test
  void changeWithNoEligibleReviewerIsNeverAutoApplied(TestNamespace ns) {
    var user2 = SharedEntities.get().USER2.getEntityReference();
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            SdkClients.adminClient()
                .glossaries()
                .create(
                    new org.openmetadata.schema.api.data.CreateGlossary()
                        .withName(ns.shortPrefix("selfrev"))
                        .withDescription(PUBLISHED)
                        .withOwners(java.util.List.of(user2))
                        .withReviewers(java.util.List.of(user2))));
    deployHookWorkflow(ns, "\"description\"", "", filterScopedTo(glossary.getFullyQualifiedName()));
    patchAs(SdkClients.user2Client(), glossary.getId(), replace("description", "self-reviewed"));
    ChangeRequest request = onlyPendingRequest(glossary.getId());
    Awaitility.await("request flagged for attention")
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () ->
                ChangeRequestService.get(request.getId()).getDeliveryStatus()
                    == org.openmetadata
                        .schema
                        .governance
                        .changeRequest
                        .DeliveryStatus
                        .ATTENTION_REQUIRED);
    assertEquals(
        ChangeRequestStatus.PENDING, ChangeRequestService.get(request.getId()).getStatus());
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
  }
}
