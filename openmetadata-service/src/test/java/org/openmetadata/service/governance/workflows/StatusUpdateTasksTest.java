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

package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.LifecycleApproverGroup;
import org.openmetadata.schema.governance.workflows.LifecycleTransitionApproval;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.service.Entity;

class StatusUpdateTasksTest {
  private static final EntityReference ANA = user("ana");
  private static final EntityReference BEN = user("ben");
  private static final EntityReference CARA = user("cara");
  private static final EntityReference FINANCE_TEAM =
      new EntityReference().withId(UUID.randomUUID()).withType(Entity.TEAM).withName("finance");

  private static final EntityReference TERM_REF =
      new EntityReference().withId(UUID.randomUUID()).withType(Entity.GLOSSARY_TERM);

  private static final GlossaryTerm TERM =
      new GlossaryTerm().withOwners(List.of(ANA, FINANCE_TEAM)).withReviewers(List.of(BEN));

  @Test
  void ownersApproveByDefaultWithoutTheRequester() {
    List<EntityReference> approvers =
        StatusUpdateTasks.selectApprovers(approval(LifecycleApproverGroup.OWNERS), TERM, "ana");

    assertEquals(List.of(FINANCE_TEAM), approvers);
  }

  @Test
  void reviewersAndNamedUsersApproveWhenTheExitNamesThem() {
    LifecycleTransitionApproval approval =
        approval(LifecycleApproverGroup.REVIEWERS).withCandidates(List.of(CARA));

    List<EntityReference> approvers = StatusUpdateTasks.selectApprovers(approval, TERM, "ana");

    assertEquals(List.of(BEN, CARA), approvers);
  }

  @Test
  void aUserNamedInSeveralGroupsIsAssignedOnce() {
    LifecycleTransitionApproval approval =
        approval(LifecycleApproverGroup.OWNERS, LifecycleApproverGroup.REVIEWERS)
            .withCandidates(List.of(BEN));

    List<EntityReference> approvers = StatusUpdateTasks.selectApprovers(approval, TERM, "cara");

    assertEquals(3, approvers.size());
    assertTrue(approvers.containsAll(List.of(ANA, FINANCE_TEAM, BEN)));
  }

  @Test
  void aTeamNamedLikeTheRequesterStillApproves() {
    GlossaryTerm ownedByTeam = new GlossaryTerm().withOwners(List.of(FINANCE_TEAM));

    List<EntityReference> approvers =
        StatusUpdateTasks.selectApprovers(
            approval(LifecycleApproverGroup.OWNERS), ownedByTeam, "finance");

    assertEquals(List.of(FINANCE_TEAM), approvers);
  }

  @Test
  void theRequesterAsSoleOwnerLeavesNoApprover() {
    GlossaryTerm ownedByAna = new GlossaryTerm().withOwners(List.of(ANA));

    List<EntityReference> approvers =
        StatusUpdateTasks.selectApprovers(
            approval(LifecycleApproverGroup.OWNERS), ownedByAna, "ana");

    assertTrue(approvers.isEmpty());
  }

  @Test
  void anApprovalNamingNoGroupUsesOnlyItsNamedUsers() {
    LifecycleTransitionApproval approval =
        new LifecycleTransitionApproval().withCandidates(List.of(CARA));

    assertEquals(List.of(CARA), StatusUpdateTasks.selectApprovers(approval, TERM, "ana"));
  }

  @Test
  void requestedStageIsReadFromThePayload() {
    assertEquals("Deprecated", StatusUpdateTasks.requestedStage(request("Deprecated")));
  }

  @Test
  void aRequestWithoutAStatusIsRejected() {
    assertThrows(
        BadRequestException.class,
        () -> StatusUpdateTasks.requestedStage(statusTask(Map.of("reason", "old"))));
    assertThrows(BadRequestException.class, () -> StatusUpdateTasks.requestedStage(request(" ")));
  }

  @Test
  void aResolutionCannotChangeTheRequestedStatus() {
    Task task = request("Deprecated");

    BadRequestException changed =
        assertThrows(
            BadRequestException.class,
            () ->
                StatusUpdateTasks.requireUnchangedRequest(
                    task, Map.of(StatusUpdateTasks.NEW_STATUS, "Archived")));

    assertTrue(changed.getMessage().contains("Archived"));
  }

  @Test
  void aResolutionAsRequestedOrWithoutAStatusIsAccepted() {
    Task task = request("Deprecated");

    assertDoesNotThrow(
        () ->
            StatusUpdateTasks.requireUnchangedRequest(
                task, Map.of(StatusUpdateTasks.NEW_STATUS, "Deprecated")));
    assertDoesNotThrow(
        () -> StatusUpdateTasks.requireUnchangedRequest(task, Map.of("comment", "ok")));
    assertDoesNotThrow(() -> StatusUpdateTasks.requireUnchangedRequest(task, null));
  }

  @Test
  void otherTaskTypesAreLeftAlone() {
    Task tierTask =
        new Task()
            .withType(TaskEntityType.TierUpdate)
            .withPayload(Map.of(StatusUpdateTasks.NEW_STATUS, "Tier1"));

    assertDoesNotThrow(
        () ->
            StatusUpdateTasks.requireUnchangedRequest(
                tierTask, Map.of(StatusUpdateTasks.NEW_STATUS, "Tier2")));
    assertDoesNotThrow(() -> StatusUpdateTasks.requireStillOffered(tierTask));
    assertDoesNotThrow(() -> StatusUpdateTasks.prepare(tierTask, false));
    assertNull(tierTask.getAssignees());
  }

  @Test
  void updatingAnExistingRequestIsNotPreparedAgain() {
    Task task = request("Deprecated");

    assertDoesNotThrow(() -> StatusUpdateTasks.prepare(task, true));
    assertNull(task.getAssignees());
  }

  @Test
  void aRaisedRequestKeepsItsStageItsStartingStageAndItsAsset() {
    Task raised = raisedFrom("In Review", "Rejected");

    assertThrows(
        BadRequestException.class,
        () ->
            StatusUpdateTasks.requireUneditedRequest(
                raised, raisedFrom("In Review", "Approved"), false));
    assertThrows(
        BadRequestException.class,
        () ->
            StatusUpdateTasks.requireUneditedRequest(
                raised, raisedFrom("Approved", "Rejected"), false));
    assertThrows(
        BadRequestException.class,
        () ->
            StatusUpdateTasks.requireUneditedRequest(
                raised, raisedFrom("In Review", "Rejected").withAbout(ANA), false));
  }

  @Test
  void aRaisedRequestsReasonCanStillBeEdited() {
    Task raised = raisedFrom("In Review", "Rejected");
    Task reworded = raisedFrom("In Review", "Rejected");
    reworded.setPayload(
        Map.of(
            StatusUpdateTasks.NEW_STATUS,
            "Rejected",
            StatusUpdateTasks.CURRENT_STATUS,
            "In Review",
            "reason",
            "Reworded"));

    assertDoesNotThrow(() -> StatusUpdateTasks.requireUneditedRequest(raised, reworded, false));
  }

  @Test
  void onlyAnAdminReassignsARaisedRequest() {
    Task raised = raisedFrom("In Review", "Rejected").withAssignees(List.of(BEN));
    Task reassigned = raisedFrom("In Review", "Rejected").withAssignees(List.of(ANA));
    Task reordered = raisedFrom("In Review", "Rejected").withAssignees(List.of(BEN));

    assertThrows(
        BadRequestException.class,
        () -> StatusUpdateTasks.requireUneditedRequest(raised, reassigned, false));
    assertDoesNotThrow(() -> StatusUpdateTasks.requireUneditedRequest(raised, reassigned, true));
    assertDoesNotThrow(() -> StatusUpdateTasks.requireUneditedRequest(raised, reordered, false));
    assertThrows(
        BadRequestException.class, () -> StatusUpdateTasks.requireReassignableBy(raised, false));
    assertDoesNotThrow(
        () ->
            StatusUpdateTasks.requireReassignableBy(
                new Task().withType(TaskEntityType.TierUpdate), false));
  }

  @Test
  void otherTaskTypesKeepTheirEditablePayload() {
    Task tierTask =
        new Task()
            .withType(TaskEntityType.TierUpdate)
            .withPayload(Map.of(StatusUpdateTasks.NEW_STATUS, "Tier1"));
    Task edited =
        new Task()
            .withType(TaskEntityType.TierUpdate)
            .withPayload(Map.of(StatusUpdateTasks.NEW_STATUS, "Tier2"));

    assertDoesNotThrow(() -> StatusUpdateTasks.requireUneditedRequest(tierTask, edited, false));
  }

  private static LifecycleTransitionApproval approval(LifecycleApproverGroup... groups) {
    return new LifecycleTransitionApproval().withAssignees(Set.of(groups));
  }

  private static Task request(String stage) {
    return statusTask(Map.of(StatusUpdateTasks.NEW_STATUS, stage));
  }

  private static Task raisedFrom(String currentStage, String requestedStage) {
    return statusTask(
            Map.of(
                StatusUpdateTasks.NEW_STATUS,
                requestedStage,
                StatusUpdateTasks.CURRENT_STATUS,
                currentStage))
        .withAbout(TERM_REF);
  }

  private static Task statusTask(Map<String, Object> payload) {
    return new Task().withType(TaskEntityType.StatusUpdate).withPayload(payload);
  }

  private static EntityReference user(String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName(name);
  }
}
