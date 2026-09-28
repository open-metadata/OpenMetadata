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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.ChangeRequestITSupport.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.DecisionType;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.sdk.exceptions.ConflictException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.service.governance.approval.ApprovalDecisionService;

@ExtendWith(TestNamespaceExtension.class)
class ChangeRequestDecisionIT {
  private static final String INCLUDE_DESCRIPTION = "\"description\"";

  private Glossary gated(TestNamespace ns) {
    Glossary glossary =
        gatedGlossaryOwnedBy(ns, "dn", SharedEntities.get().USER2.getEntityReference());
    deployHookWorkflow(
        ns, INCLUDE_DESCRIPTION, "", filterScopedTo(glossary.getFullyQualifiedName()));
    return glossary;
  }

  private void stageAsUser2(Glossary glossary, String value) {
    patchAs(
        SdkClients.user2Client(),
        glossary.getId(),
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"%s\"}]".formatted(value));
  }

  @Test
  void taskIsLinkedToTheRequest(TestNamespace ns) {
    Glossary glossary = gated(ns);
    stageAsUser2(glossary, "v1");
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    assertEquals(task.getId(), onlyPendingRequest(glossary.getId()).getTaskId());
    assertTrue(taskPayloadJson(task.getId()).contains("\"changeRequestRevision\":1"));
  }

  @Test
  void reviewerDecisionIsRecordedForTheActiveRevision(TestNamespace ns) {
    Glossary glossary = gated(ns);
    stageAsUser2(glossary, "v1");
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    ChangeRequest request = onlyPendingRequest(glossary.getId());
    resolveAs(SdkClients.user1Client(), task, "reject", TaskResolutionType.Rejected, 1);
    List<ApprovalDecision> decisions =
        ApprovalDecisionService.decisions(request.getActiveRevisionId());
    assertEquals(1, decisions.size());
    assertEquals(DecisionType.REJECT, decisions.get(0).getDecision());
    assertEquals(SharedEntities.get().USER1.getName(), decisions.get(0).getDecidedBy());
  }

  @Test
  void adminCannotApproveOwnChangeRequest(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    deployHookWorkflow(
        ns, INCLUDE_DESCRIPTION, "", filterScopedTo(glossary.getFullyQualifiedName()));
    patchDescription(glossary.getId(), "admin's own change");
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    ForbiddenException error =
        assertThrows(
            ForbiddenException.class,
            () ->
                resolveAs(
                    SdkClients.adminClient(), task, "approve", TaskResolutionType.Approved, 1));
    assertTrue(error.getMessage().contains("your own change request"));
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
  }

  @Test
  void impersonatedApprovalIsRefused(TestNamespace ns) {
    Glossary glossary = gated(ns);
    stageAsUser2(glossary, "v1");
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    User botUser = createBotUser(ns, "rev");
    createBot(ns.prefix("rev_bot"), botUser, true);
    var asReviewer =
        impersonationClient(generateBotToken(botUser), SharedEntities.get().USER1.getName());
    assertThrows(
        ForbiddenException.class,
        () -> resolveAs(asReviewer, task, "approve", TaskResolutionType.Approved, 1));
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
  }

  @Test
  void decisionOnSupersededRevisionIsRejected(TestNamespace ns) {
    Glossary glossary = gated(ns);
    stageAsUser2(glossary, "v1");
    Task first = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    stageAsUser2(glossary, "v2");
    Task second = awaitNewOpenApprovalTask(glossary.getFullyQualifiedName(), first.getId());
    ConflictException error =
        assertThrows(
            ConflictException.class,
            () ->
                resolveAs(
                    SdkClients.user1Client(), second, "approve", TaskResolutionType.Approved, 1));
    assertTrue(error.getMessage().contains("active revision is 2"));
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
    assertNotEquals(
        TaskEntityStatus.Open,
        SdkClients.adminClient().tasks().get(first.getId().toString()).getStatus());
  }

  @Test
  void omittedRevisionIsTakenFromTheReviewTask(TestNamespace ns) {
    Glossary glossary = gated(ns);
    stageAsUser2(glossary, "v1");
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    ChangeRequest request = onlyPendingRequest(glossary.getId());
    resolveAs(SdkClients.user1Client(), task, "reject", TaskResolutionType.Rejected, null);
    List<ApprovalDecision> decisions =
        ApprovalDecisionService.decisions(request.getActiveRevisionId());
    assertEquals(1, decisions.get(0).getRevisionNumber());
  }
}
