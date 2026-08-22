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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.Entity;

/**
 * End-to-end coverage for the approval-gated pending-change hold (#4673). An edit on a Glossary
 * governed by a workflow that carries a resolvePendingChange hook is held out of the entity until the
 * workflow commits it (on approve), discards it (on reject), or parks it (action=hold). Non-gated
 * edits - no workflow, no hook, a field outside include, an excluded field, or a filtered-out entity
 * - persist immediately.
 *
 * <p>Targets the Glossary entity (top-level, supports reviewers, no shipped approval workflow), so the
 * only workflows that can gate it are the ones these tests deploy. Every deployed workflow scopes its
 * trigger {@code filter} to its own glossary's FQN via JsonLogic, so concurrently-running tests never
 * gate each other's glossary - which also exercises the object-form filter and the RuleEngine on a
 * real entity, the same path the trigger uses.
 */
@ExtendWith(TestNamespaceExtension.class)
public class PendingApprovalChangeIT {
  private static final String APPROVED = "approved baseline description";
  private static final String ORIGINAL_DN = "original display name";
  private static final String INCLUDE_DESCRIPTION = "\"description\"";
  private static final String EXCLUDE_STATUS = "\"entityStatus\"";
  private static final String COMMIT = "commit";
  // Object-form filter whose JsonLogic is always TRUE -> the entity is excluded, nothing is held.
  private static final String FILTER_EXCLUDES_ALL =
      JsonUtils.pojoToJson(Map.of("glossary", "{\"==\":[1,1]}"));

  // Object-form filter that excludes every glossary except the one with this FQN, so a workflow
  // only
  // gates its own test's glossary even when other tests run concurrently.
  private static String filterScopedTo(String fqn) {
    String logic = "{\"!=\":[{\"var\":\"fullyQualifiedName\"},\"%s\"]}".formatted(fqn);
    return JsonUtils.pojoToJson(Map.of("glossary", logic));
  }

  /** Deploys a hook workflow: Start -> Approve -> (approve) commit hook, (reject) discard hook. */
  private void deployHookWorkflow(TestNamespace ns, String include, String exclude, String filter) {
    deployWorkflow(ns, include, exclude, filter, COMMIT, true);
  }

  /**
   * @param approveAction action of the hook on the approve path (commit/hold)
   * @param withHook when false, no resolvePendingChange hook is present (the change is never held)
   */
  private void deployWorkflow(
      TestNamespace ns,
      String include,
      String exclude,
      String filter,
      String approveAction,
      boolean withHook) {
    // Workflow name becomes the BPMN process id, which must be a valid XML NCName (no leading
    // digit).
    String name = "Wf" + ns.shortPrefix("pendinghook");
    String approveTarget = withHook ? "CommitChange" : "ApprovedEnd";
    String rejectTarget = withHook ? "DiscardChange" : "RejectedEnd";
    String hookNodes =
        withHook
            ? """
              ,{"type": "automatedTask", "subType": "resolvePendingChangeTask", "name": "CommitChange",
               "config": {"action": "%s"}, "inputNamespaceMap": {"relatedEntity": "global"}},
              {"type": "automatedTask", "subType": "resolvePendingChangeTask", "name": "DiscardChange",
               "config": {"action": "discard"}, "inputNamespaceMap": {"relatedEntity": "global"}}
              """
                .formatted(approveAction)
            : "";
    String hookEdges =
        withHook
            ? ",{\"from\": \"CommitChange\", \"to\": \"ApprovedEnd\"},"
                + "{\"from\": \"DiscardChange\", \"to\": \"RejectedEnd\"}"
            : "";
    String json =
        """
        {
          "name": "%s",
          "displayName": "Pending Change Hook Test Workflow",
          "description": "Holds edits on glossaries and resolves them on approval.",
          "config": {"storeStageStatus": true},
          "trigger": {
            "type": "eventBasedEntity",
            "config": {
              "entityTypes": ["glossary"],
              "events": ["Updated"],
              "exclude": [%s],
              "include": [%s],
              "filter": %s
            },
            "output": ["relatedEntity", "updatedBy"]
          },
          "nodes": [
            {"type": "startEvent", "subType": "startEvent", "name": "Start"},
            {"type": "userTask", "subType": "userApprovalTask", "name": "Approve",
             "config": {"assignees": {"addReviewers": true, "addOwners": false, "candidates": []},
                        "approvalThreshold": 1, "rejectionThreshold": 1, "stageId": "review",
                        "stageDisplayName": "Review", "taskStatus": "Open",
                        "assigneeStrategy": "reviewers-and-assignees",
                        "transitionMetadata": [
                          {"id": "approve", "label": "Approve", "targetStageId": "approved",
                           "targetTaskStatus": "Approved", "resolutionType": "Approved",
                           "formRef": "approve", "requiresComment": false},
                          {"id": "reject", "label": "Reject", "targetStageId": "rejected",
                           "targetTaskStatus": "Rejected", "resolutionType": "Rejected",
                           "formRef": "reject", "requiresComment": true}]},
             "inputNamespaceMap": {"relatedEntity": "global"}},
            {"type": "endEvent", "subType": "endEvent", "name": "ApprovedEnd"},
            {"type": "endEvent", "subType": "endEvent", "name": "RejectedEnd"}%s
          ],
          "edges": [
            {"from": "Start", "to": "Approve"},
            {"from": "Approve", "to": "%s", "condition": "approve"},
            {"from": "Approve", "to": "%s", "condition": "reject"}%s
          ]
        }
        """
            .formatted(
                name, exclude, include, filter, hookNodes, approveTarget, rejectTarget, hookEdges);
    CreateWorkflowDefinition request = JsonUtils.readValue(json, CreateWorkflowDefinition.class);
    ns.trackRoot(
        Entity.WORKFLOW_DEFINITION, SdkClients.adminClient().workflowDefinitions().create(request));
  }

  private Glossary gatedGlossary(TestNamespace ns) {
    return gatedGlossary(ns, null);
  }

  private Glossary gatedGlossary(TestNamespace ns, String displayName) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.shortPrefix("pgl"))
            .withDisplayName(displayName)
            .withDescription(APPROVED)
            .withReviewers(List.of(SharedEntities.get().USER1.getEntityReference()));
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private Glossary fetch(UUID glossaryId) {
    return SdkClients.adminClient().glossaries().get(glossaryId.toString(), "reviewers");
  }

  private String descriptionOf(UUID glossaryId) {
    return fetch(glossaryId).getDescription();
  }

  private String displayNameOf(UUID glossaryId) {
    return fetch(glossaryId).getDisplayName();
  }

  private void patch(UUID glossaryId, String opsJson) {
    SdkClients.adminClient().glossaries().patch(glossaryId.toString(), JsonUtils.readTree(opsJson));
  }

  private void patchDescription(UUID glossaryId, String value) {
    patch(
        glossaryId,
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"%s\"}]".formatted(value));
  }

  private void putDescription(UUID glossaryId, String value) {
    Glossary current = fetch(glossaryId);
    current.setDescription(value);
    SdkClients.adminClient().glossaries().update(glossaryId.toString(), current);
  }

  private Map<String, String> openTaskFilters(String glossaryFqn) {
    return Map.of(
        "limit", "100", "status", TaskEntityStatus.Open.value(), "aboutEntity", glossaryFqn);
  }

  private Task awaitOpenApprovalTask(String glossaryFqn) {
    Map<String, String> filters = openTaskFilters(glossaryFqn);
    Awaitility.await("open approval task for " + glossaryFqn)
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(() -> !listTasks(filters).isEmpty());
    return listTasks(filters).get(0);
  }

  private void assertNoOpenApprovalTask(String glossaryFqn) {
    Map<String, String> filters = openTaskFilters(glossaryFqn);
    Awaitility.await("no approval task for " + glossaryFqn)
        .during(Duration.ofSeconds(10))
        .atMost(Duration.ofSeconds(12))
        .until(() -> listTasks(filters).isEmpty());
  }

  private List<Task> listTasks(Map<String, String> filters) {
    List<Task> tasks;
    try {
      ListResponse<Task> response = SdkClients.adminClient().tasks().listWithFilters(filters);
      tasks = response.getData() == null ? List.of() : response.getData();
    } catch (RuntimeException e) {
      tasks = List.of();
    }
    return tasks;
  }

  private String taskPayloadJson(UUID taskId) {
    Task task = SdkClients.adminClient().tasks().get(taskId.toString());
    return task.getPayload() == null ? "" : JsonUtils.pojoToJson(task.getPayload());
  }

  private void resolve(UUID taskId, String transitionId, TaskResolutionType resolution) {
    ResolveTask resolve =
        new ResolveTask()
            .withTransitionId(transitionId)
            .withResolutionType(resolution)
            .withComment("pending-change IT");
    SdkClients.user1Client().tasks().resolve(taskId.toString(), resolve);
  }

  private void awaitDescription(UUID glossaryId, String expected, String reason) {
    Awaitility.await(reason)
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(() -> expected.equals(descriptionOf(glossaryId)));
  }

  private void awaitHeldAt(UUID glossaryId, String expected, String reason) {
    Awaitility.await(reason)
        .during(Duration.ofSeconds(3))
        .atMost(Duration.ofSeconds(30))
        .until(() -> expected.equals(descriptionOf(glossaryId)));
  }

  // ---- Held then committed / discarded --------------------------------------------------------

  @Test
  void editHeldUntilApproved_thenCommitted(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    deployHookWorkflow(
        ns, INCLUDE_DESCRIPTION, EXCLUDE_STATUS, filterScopedTo(glossary.getFullyQualifiedName()));

    patchDescription(glossary.getId(), "proposed pending approval");
    awaitHeldAt(glossary.getId(), APPROVED, "description held at approved value");

    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    resolve(task.getId(), "approve", TaskResolutionType.Approved);
    awaitDescription(
        glossary.getId(), "proposed pending approval", "description applied on approve");
  }

  @Test
  void heldChangeIsVisibleInApprovalTaskPayload(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    deployHookWorkflow(
        ns, INCLUDE_DESCRIPTION, EXCLUDE_STATUS, filterScopedTo(glossary.getFullyQualifiedName()));

    patchDescription(glossary.getId(), "proposed visible value");

    // The reviewer must see WHAT is on hold: the approval task's proposedChanges carries the held
    // diff even though the entity's own description still shows the approved value.
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    Awaitility.await("held change surfaced in the approval task payload")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              String payload = taskPayloadJson(task.getId());
              return payload.contains("proposedChanges")
                  && payload.contains("proposed visible value");
            });
    assertEquals(APPROVED, descriptionOf(glossary.getId()));
  }

  @Test
  void editDiscardedOnReject(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    deployHookWorkflow(
        ns, INCLUDE_DESCRIPTION, EXCLUDE_STATUS, filterScopedTo(glossary.getFullyQualifiedName()));

    patchDescription(glossary.getId(), "will be discarded");
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    resolve(task.getId(), "reject", TaskResolutionType.Rejected);

    awaitHeldAt(glossary.getId(), APPROVED, "approved value remains after reject");
    assertEquals(APPROVED, descriptionOf(glossary.getId()));
  }

  @Test
  void holdActionParksChange_notAppliedOnApprove(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    // The approve path runs a hook with action=hold: the change is parked, NOT applied, on approve.
    deployWorkflow(
        ns,
        INCLUDE_DESCRIPTION,
        EXCLUDE_STATUS,
        filterScopedTo(glossary.getFullyQualifiedName()),
        "hold",
        true);

    patchDescription(glossary.getId(), "parked proposal");
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    resolve(task.getId(), "approve", TaskResolutionType.Approved);

    // action=hold neither applies nor discards: the approved value stays even after the task
    // resolves.
    awaitHeldAt(glossary.getId(), APPROVED, "held value stays parked after hold action");
    assertEquals(APPROVED, descriptionOf(glossary.getId()));
  }

  // ---- Generic (any-field) behaviour ----------------------------------------------------------

  @Test
  void genericNonDescriptionFieldHeld_thenCommitted(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns, ORIGINAL_DN);
    deployHookWorkflow(
        ns, "\"displayName\"", EXCLUDE_STATUS, filterScopedTo(glossary.getFullyQualifiedName()));

    patch(
        glossary.getId(),
        "[{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"proposed dn\"}]");

    Awaitility.await("displayName held at original value")
        .during(Duration.ofSeconds(3))
        .atMost(Duration.ofSeconds(30))
        .until(() -> ORIGINAL_DN.equals(displayNameOf(glossary.getId())));

    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    resolve(task.getId(), "approve", TaskResolutionType.Approved);

    Awaitility.await("displayName applied after approve")
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(() -> "proposed dn".equals(displayNameOf(glossary.getId())));
  }

  @Test
  void genericFieldDiscardedOnReject(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns, ORIGINAL_DN);
    deployHookWorkflow(
        ns, "\"displayName\"", EXCLUDE_STATUS, filterScopedTo(glossary.getFullyQualifiedName()));

    patch(
        glossary.getId(),
        "[{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"rejected dn\"}]");
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    resolve(task.getId(), "reject", TaskResolutionType.Rejected);

    Awaitility.await("displayName unchanged after reject")
        .during(Duration.ofSeconds(3))
        .atMost(Duration.ofSeconds(60))
        .until(() -> ORIGINAL_DN.equals(displayNameOf(glossary.getId())));
    assertEquals(ORIGINAL_DN, displayNameOf(glossary.getId()));
  }

  @Test
  void multipleIncludedFieldsHeldTogether_thenCommitted(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns, ORIGINAL_DN);
    deployHookWorkflow(
        ns,
        "\"description\",\"displayName\"",
        EXCLUDE_STATUS,
        filterScopedTo(glossary.getFullyQualifiedName()));

    patch(
        glossary.getId(),
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"multi desc\"},"
            + "{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"multi dn\"}]");

    // Both included fields held: entity keeps both approved values while the approval is pending.
    Awaitility.await("both fields held at approved values")
        .during(Duration.ofSeconds(3))
        .atMost(Duration.ofSeconds(30))
        .until(
            () ->
                APPROVED.equals(descriptionOf(glossary.getId()))
                    && ORIGINAL_DN.equals(displayNameOf(glossary.getId())));

    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    resolve(task.getId(), "approve", TaskResolutionType.Approved);

    awaitDescription(glossary.getId(), "multi desc", "description applied on approve");
    assertEquals("multi dn", displayNameOf(glossary.getId()));
  }

  @Test
  void repeatedEditsAccumulateIntoSingleHold_thenLatestCommitted(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    deployHookWorkflow(
        ns, INCLUDE_DESCRIPTION, EXCLUDE_STATUS, filterScopedTo(glossary.getFullyQualifiedName()));

    patchDescription(glossary.getId(), "first proposal");
    awaitHeldAt(glossary.getId(), APPROVED, "held after first edit");
    patchDescription(glossary.getId(), "second proposal");
    awaitHeldAt(glossary.getId(), APPROVED, "still held after second edit");

    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    resolve(task.getId(), "approve", TaskResolutionType.Approved);

    // Accumulated hold keeps the latest proposed value; approval applies it.
    awaitDescription(glossary.getId(), "second proposal", "latest accumulated value applied");
  }

  // ---- include / exclude / filter selection ---------------------------------------------------

  @Test
  void emptyIncludeHoldsNonExcludedFieldButPersistsExcludedField(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns, ORIGINAL_DN);
    // Empty include + exclude=displayName: holds every changed trigger field EXCEPT displayName.
    deployHookWorkflow(
        ns,
        "",
        "\"displayName\",\"entityStatus\"",
        filterScopedTo(glossary.getFullyQualifiedName()));

    patch(
        glossary.getId(),
        "[{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"persisted dn\"},"
            + "{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"proposed held desc\"}]");

    // Excluded displayName persists immediately; non-excluded description is held.
    Awaitility.await("excluded field persists while held field waits")
        .during(Duration.ofSeconds(3))
        .atMost(Duration.ofSeconds(30))
        .until(
            () ->
                "persisted dn".equals(displayNameOf(glossary.getId()))
                    && APPROVED.equals(descriptionOf(glossary.getId())));

    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    resolve(task.getId(), "approve", TaskResolutionType.Approved);
    awaitDescription(glossary.getId(), "proposed held desc", "held description applied on approve");
    assertEquals("persisted dn", displayNameOf(glossary.getId()));
  }

  @Test
  void fieldOutsideIncludePersistsImmediatelyWithNoTask(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    // include=tags: a description edit is not gated -> persists at once, no approval task.
    deployHookWorkflow(
        ns, "\"tags\"", EXCLUDE_STATUS, filterScopedTo(glossary.getFullyQualifiedName()));

    patchDescription(glossary.getId(), "not gated - persists now");
    awaitDescription(
        glossary.getId(), "not gated - persists now", "field outside include persists");
    assertNoOpenApprovalTask(glossary.getFullyQualifiedName());
  }

  @Test
  void jsonLogicFilterExcludesEntity_persistsImmediatelyWithNoTask(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    // The object-form filter's JsonLogic matches (excludes) the entity, so the change is not held.
    deployHookWorkflow(ns, INCLUDE_DESCRIPTION, EXCLUDE_STATUS, FILTER_EXCLUDES_ALL);

    patchDescription(glossary.getId(), "applied immediately - filter excluded");
    awaitDescription(
        glossary.getId(), "applied immediately - filter excluded", "filtered-out entity persists");
    assertNoOpenApprovalTask(glossary.getFullyQualifiedName());
  }

  // ---- opt-in: no workflow / no hook ----------------------------------------------------------

  @Test
  void noGatingWorkflow_editPersistsImmediately(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    // No workflow deployed at all: the edit is never held.
    patchDescription(glossary.getId(), "no workflow - persists now");
    awaitDescription(glossary.getId(), "no workflow - persists now", "ungoverned edit persists");
    assertNoOpenApprovalTask(glossary.getFullyQualifiedName());
  }

  @Test
  void workflowWithoutHook_editPersistsImmediately(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    // eventBasedEntity workflow WITHOUT a resolvePendingChange hook: the hook is the opt-in, so
    // with
    // none the edit persists immediately even though the workflow itself may run.
    deployWorkflow(
        ns,
        INCLUDE_DESCRIPTION,
        EXCLUDE_STATUS,
        filterScopedTo(glossary.getFullyQualifiedName()),
        COMMIT,
        false);

    patchDescription(glossary.getId(), "no hook - persists now");
    awaitDescription(
        glossary.getId(), "no hook - persists now", "un-hooked workflow does not hold");
  }

  // ---- write path coverage: PUT as well as PATCH ----------------------------------------------

  // ---- validation: a hook workflow must resolve the hold on every terminal path ----------------

  @Test
  void hookWorkflowWithUnresolvedTerminalPathIsRejectedAtCreate(TestNamespace ns) {
    // Hook on the approve path only; the reject path reaches an end WITHOUT a commit/discard, which
    // would hold the edit forever. validatePendingChangeResolution must reject the workflow.
    CreateWorkflowDefinition invalid = unresolvedHookWorkflow(ns);
    InvalidRequestException failure =
        assertThrows(
            InvalidRequestException.class,
            () -> SdkClients.adminClient().workflowDefinitions().create(invalid),
            "a hook workflow with an unresolved terminal path must be rejected");
    String message = failure.getMessage() == null ? "" : failure.getMessage().toLowerCase();
    assertTrue(
        message.contains("held") || message.contains("resolve"),
        "expected a pending-change-resolution rejection, got: " + failure.getMessage());
  }

  private CreateWorkflowDefinition unresolvedHookWorkflow(TestNamespace ns) {
    String name = "Wf" + ns.shortPrefix("badhook");
    String json =
        """
        {
          "name": "%s",
          "displayName": "Unresolved Hook Workflow",
          "description": "Hook on approve only; the reject path ends without resolving the hold.",
          "config": {"storeStageStatus": true},
          "trigger": {
            "type": "eventBasedEntity",
            "config": {"entityTypes": ["glossary"], "events": ["Updated"],
                       "exclude": ["entityStatus"], "include": ["description"], "filter": {}},
            "output": ["relatedEntity", "updatedBy"]
          },
          "nodes": [
            {"type": "startEvent", "subType": "startEvent", "name": "Start"},
            {"type": "userTask", "subType": "userApprovalTask", "name": "Approve",
             "config": {"assignees": {"addReviewers": true, "addOwners": false, "candidates": []},
                        "approvalThreshold": 1, "rejectionThreshold": 1, "stageId": "review",
                        "stageDisplayName": "Review", "taskStatus": "Open",
                        "assigneeStrategy": "reviewers-and-assignees",
                        "transitionMetadata": [
                          {"id": "approve", "label": "Approve", "targetStageId": "approved",
                           "targetTaskStatus": "Approved", "resolutionType": "Approved",
                           "formRef": "approve", "requiresComment": false},
                          {"id": "reject", "label": "Reject", "targetStageId": "rejected",
                           "targetTaskStatus": "Rejected", "resolutionType": "Rejected",
                           "formRef": "reject", "requiresComment": true}]},
             "inputNamespaceMap": {"relatedEntity": "global"}},
            {"type": "automatedTask", "subType": "resolvePendingChangeTask", "name": "CommitChange",
             "config": {"action": "commit"}, "inputNamespaceMap": {"relatedEntity": "global"}},
            {"type": "endEvent", "subType": "endEvent", "name": "ApprovedEnd"},
            {"type": "endEvent", "subType": "endEvent", "name": "RejectedEnd"}
          ],
          "edges": [
            {"from": "Start", "to": "Approve"},
            {"from": "Approve", "to": "CommitChange", "condition": "approve"},
            {"from": "CommitChange", "to": "ApprovedEnd"},
            {"from": "Approve", "to": "RejectedEnd", "condition": "reject"}
          ]
        }
        """
            .formatted(name);
    return JsonUtils.readValue(json, CreateWorkflowDefinition.class);
  }

  @Test
  void putEditHeldUntilApproved_thenCommitted(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    deployHookWorkflow(
        ns, INCLUDE_DESCRIPTION, EXCLUDE_STATUS, filterScopedTo(glossary.getFullyQualifiedName()));

    putDescription(glossary.getId(), "put proposed value");
    awaitHeldAt(glossary.getId(), APPROVED, "PUT edit held at approved value");

    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    resolve(task.getId(), "approve", TaskResolutionType.Approved);
    awaitDescription(glossary.getId(), "put proposed value", "PUT edit applied on approve");
  }
}
