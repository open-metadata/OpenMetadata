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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.services.context.ContextMemoryService;

/**
 * A Draft memory with disputes opens a review task whose decision supersedes or rejects
 * (ADR:2026-10-13-a-memory-conflict-opens-a-review-task-and-approving-it-supersedes-the-disputed-memory).
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ContextMemoryConflictReviewIT {

  private static final String HOLD_FOR_REVIEW =
      """
      [{"op":"replace","path":"/entityStatus","value":"Draft"},
       {"op":"add","path":"/statusReason","value":"contradicts: the order threshold differs"},
       {"op":"add","path":"/disputes","value":[{"memory":{"id":"%s","type":"contextMemory"},\
      "reason":"%s"}]}]""";

  private static final String HOLD_FOR_REVIEW_DETECTED_AT =
      """
      [{"op":"replace","path":"/entityStatus","value":"Draft"},
       {"op":"add","path":"/disputes","value":[{"memory":{"id":"%s","type":"contextMemory"},\
      "reason":"%s","detectedAt":1700000000000}]}]""";

  private static final String THRESHOLD_REASON = "Five orders against three orders";

  @Test
  void aDisputedMemoryInReviewOpensOneTaskForTheOwnersOfBothMemories(TestNamespace ns) {
    Conflict conflict = conflict(ns, "open");

    Task task = openTask(conflict.reviewed());

    assertEquals(TaskEntityType.MemoryConflictReview, task.getType());
    assertEquals(TaskCategory.Review, task.getCategory());
    assertEquals(conflict.reviewed().getId(), task.getAbout().getId());
    assertEquals(Set.of("approve", "reject"), transitionIds(task));
    assertTrue(task.getDescription().contains(THRESHOLD_REASON));
    Set<String> assignees = names(task.getAssignees());
    assertTrue(assignees.contains(shared().USER2.getName()), "owner of the reviewed memory");
    assertTrue(assignees.contains(shared().USER3.getName()), "owner of the disputed memory");

    admin()
        .patch(
            idOf(conflict.reviewed()),
            JsonUtils.readTree(
                """
                [{"op":"replace","path":"/answer","value":"At least three completed orders."}]"""));

    assertEquals(
        1, openTasks(conflict.reviewed()).size(), "an edit in review opens no second task");
  }

  @Test
  void approvingSupersedesTheDisputedMemoryWithTheReviewedOne(TestNamespace ns) {
    Conflict conflict = conflict(ns, "approve");
    Task task = openTask(conflict.reviewed());

    Task resolved = resolve(SdkClients.adminClient(), task, "approve", TaskResolutionType.Approved);

    assertEquals(TaskEntityStatus.Approved, resolved.getStatus());
    ContextMemory approved = admin().get(idOf(conflict.reviewed()));
    assertEquals(ContextMemoryStatus.APPROVED, approved.getEntityStatus());
    assertTrue(listOrEmpty(approved.getDisputes()).isEmpty(), "approval releases the disputes");
    ContextMemory superseded = admin().get(idOf(conflict.disputed()));
    assertEquals(ContextMemoryStatus.SUPERSEDED, superseded.getEntityStatus());
    assertEquals(conflict.reviewed().getId(), superseded.getSupersededBy().getId());
    assertTrue(superseded.getStatusReason().contains(conflict.reviewed().getTitle()));
    assertTrue(openTasks(conflict.reviewed()).isEmpty());
  }

  @Test
  void rejectingRejectsTheReviewedMemoryAndKeepsTheDisputedOne(TestNamespace ns) {
    Conflict conflict = conflict(ns, "reject");
    Task task = openTask(conflict.reviewed());

    Task resolved =
        SdkClients.adminClient()
            .tasks()
            .resolve(
                task.getId().toString(),
                new ResolveTask()
                    .withTransitionId("reject")
                    .withResolutionType(TaskResolutionType.Rejected)
                    .withComment("Customers count from the first order"));

    assertEquals(TaskEntityStatus.Rejected, resolved.getStatus());
    ContextMemory rejected = admin().get(idOf(conflict.reviewed()));
    assertEquals(ContextMemoryStatus.REJECTED, rejected.getEntityStatus());
    assertEquals(
        "Rejected in conflict review: Customers count from the first order",
        rejected.getStatusReason());
    assertEquals(
        ContextMemoryStatus.APPROVED, admin().get(idOf(conflict.disputed())).getEntityStatus());
  }

  @Test
  void leavingReviewOutsideTheTaskClosesIt(TestNamespace ns) {
    Conflict conflict = conflict(ns, "requeue");
    Task task = openTask(conflict.reviewed());

    admin()
        .patch(
            idOf(conflict.reviewed()),
            JsonUtils.readTree(
                """
                [{"op":"replace","path":"/entityStatus","value":"Unprocessed"}]"""));

    assertTrue(openTasks(conflict.reviewed()).isEmpty());
    Task closed = SdkClients.adminClient().tasks().get(task.getId().toString());
    assertEquals(TaskEntityStatus.Cancelled, closed.getStatus());
    assertTrue(listOrEmpty(admin().get(idOf(conflict.reviewed())).getDisputes()).isEmpty());
  }

  @Test
  void deletingAMemoryInReviewClosesItsTaskAndRestoringItReopensOne(TestNamespace ns) {
    Conflict conflict = conflict(ns, "deleted");
    Task task = openTask(conflict.reviewed());

    admin().delete(idOf(conflict.reviewed()));

    assertEquals(
        TaskEntityStatus.Cancelled,
        SdkClients.adminClient().tasks().get(task.getId().toString()).getStatus());

    admin().restore(idOf(conflict.reviewed()));

    assertNotEquals(task.getId(), openTask(conflict.reviewed()).getId(), "a fresh review");
  }

  @Test
  void approvingIsRefusedWhenTheDisputedMemoryChangedAfterTheConflictWasDetected(TestNamespace ns) {
    ContextMemory disputed = admin().create(memory(ns, "stale-five", shared().USER3_REF));
    ContextMemory reviewed = pending(ns, "stale-three", shared().USER2_REF);
    admin()
        .patch(
            idOf(reviewed),
            JsonUtils.readTree(
                HOLD_FOR_REVIEW_DETECTED_AT.formatted(disputed.getId(), THRESHOLD_REASON)));
    Task task = openTask(reviewed);

    OpenMetadataException refused =
        assertThrows(
            OpenMetadataException.class,
            () -> resolve(SdkClients.adminClient(), task, "approve", TaskResolutionType.Approved));

    assertEquals(412, refused.getStatusCode());
    assertTrue(refused.getMessage().contains("changed after the conflict was detected"));
    assertEquals(ContextMemoryStatus.DRAFT, admin().get(idOf(reviewed)).getEntityStatus());
    assertEquals(ContextMemoryStatus.APPROVED, admin().get(idOf(disputed)).getEntityStatus());
    assertEquals(1, openTasks(reviewed).size(), "a refused decision leaves the task open");
  }

  @Test
  void approvingNeedsTheRightToSupersedeTheDisputedMemory(TestNamespace ns) {
    Conflict conflict = conflict(ns, "authority");
    Task task = openTask(conflict.reviewed());

    OpenMetadataException denied =
        assertThrows(
            OpenMetadataException.class,
            () -> resolve(SdkClients.user2Client(), task, "approve", TaskResolutionType.Approved));

    assertEquals(403, denied.getStatusCode());
    assertEquals(
        ContextMemoryStatus.APPROVED, admin().get(idOf(conflict.disputed())).getEntityStatus());
    assertEquals(
        ContextMemoryStatus.DRAFT, admin().get(idOf(conflict.reviewed())).getEntityStatus());

    Task approvedByDisputedOwner =
        resolve(SdkClients.user3Client(), task, "approve", TaskResolutionType.Approved);

    assertEquals(TaskEntityStatus.Approved, approvedByDisputedOwner.getStatus());
    assertEquals(
        ContextMemoryStatus.SUPERSEDED, admin().get(idOf(conflict.disputed())).getEntityStatus());
  }

  /** The same owner who may not supersede the disputed memory may still withdraw their own claim. */
  @Test
  void theOwnerOfTheReviewedMemoryMayRejectIt(TestNamespace ns) {
    Conflict conflict = conflict(ns, "withdraw");
    Task task = openTask(conflict.reviewed());

    Task rejected = resolve(SdkClients.user2Client(), task, "reject", TaskResolutionType.Rejected);

    assertEquals(TaskEntityStatus.Rejected, rejected.getStatus());
    assertEquals(
        ContextMemoryStatus.REJECTED, admin().get(idOf(conflict.reviewed())).getEntityStatus());
    assertEquals(
        ContextMemoryStatus.APPROVED, admin().get(idOf(conflict.disputed())).getEntityStatus());
  }

  @Test
  void aConflictReviewCannotBeFiledThroughTheApi(TestNamespace ns) {
    ContextMemory memory = pending(ns, "filed", shared().USER2_REF);

    assertThrows(
        InvalidRequestException.class,
        () ->
            SdkClients.adminClient()
                .tasks()
                .create(
                    new CreateTask()
                        .withName(ns.prefix("filed-review"))
                        .withCategory(TaskCategory.Review)
                        .withType(TaskEntityType.MemoryConflictReview)
                        .withAbout("<#E::contextMemory::" + memory.getFullyQualifiedName() + ">")));
  }

  @Test
  void anotherTaskCannotBePatchedIntoAConflictReview(TestNamespace ns) {
    ContextMemory memory = pending(ns, "patched", shared().USER2_REF);
    Task custom =
        SdkClients.adminClient()
            .tasks()
            .create(
                new CreateTask()
                    .withName(ns.prefix("custom-review"))
                    .withCategory(TaskCategory.Custom)
                    .withType(TaskEntityType.CustomTask)
                    .withAbout("<#E::contextMemory::" + memory.getFullyQualifiedName() + ">"));

    assertThrows(
        InvalidRequestException.class,
        () ->
            SdkClients.adminClient()
                .tasks()
                .patch(
                    custom.getId(),
                    JsonUtils.readTree(
                        """
                        [{"op":"replace","path":"/type","value":"MemoryConflictReview"}]""")));
  }

  private record Conflict(ContextMemory reviewed, ContextMemory disputed) {}

  /** USER3's Approved memory is disputed by USER2's pending correction, as reconciliation does. */
  private static Conflict conflict(TestNamespace ns, String name) {
    ContextMemory disputed = admin().create(memory(ns, name + "-five", shared().USER3_REF));
    ContextMemory reviewed = pending(ns, name + "-three", shared().USER2_REF);
    ContextMemory held =
        admin()
            .patch(
                idOf(reviewed),
                JsonUtils.readTree(HOLD_FOR_REVIEW.formatted(disputed.getId(), THRESHOLD_REASON)));
    return new Conflict(held, disputed);
  }

  private static ContextMemory pending(TestNamespace ns, String name, EntityReference owner) {
    return admin()
        .create(memory(ns, name, owner).withEntityStatus(ContextMemoryStatus.UNPROCESSED));
  }

  private static CreateContextMemory memory(TestNamespace ns, String name, EntityReference owner) {
    return new CreateContextMemory()
        .withName(ns.prefix(ns.shortPrefix(name)))
        .withTitle(ns.shortPrefix(name))
        .withEntityStatus(ContextMemoryStatus.APPROVED)
        .withQuestion("Who qualifies as a customer?")
        .withAnswer("Customers need at least " + name + " orders.")
        .withOwners(List.of(owner))
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
  }

  private static Task resolve(
      OpenMetadataClient client, Task task, String transitionId, TaskResolutionType resolution) {
    return client
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask().withTransitionId(transitionId).withResolutionType(resolution));
  }

  private static Task openTask(ContextMemory memory) {
    List<Task> open = openTasks(memory);
    assertEquals(1, open.size(), "exactly one open review task");
    assertNotNull(open.getFirst().getAssignees());
    return open.getFirst();
  }

  private static List<Task> openTasks(ContextMemory memory) {
    return SdkClients.adminClient()
        .tasks()
        .listWithFilters(
            Map.of(
                "aboutEntity", memory.getFullyQualifiedName(),
                "type", TaskEntityType.MemoryConflictReview.value(),
                "status", TaskEntityStatus.Open.value(),
                "fields", "about,assignees,availableTransitions"))
        .getData()
        .stream()
        .filter(task -> memory.getId().equals(task.getAbout().getId()))
        .toList();
  }

  private static Set<String> transitionIds(Task task) {
    return listOrEmpty(task.getAvailableTransitions()).stream()
        .map(TaskAvailableTransition::getId)
        .collect(Collectors.toSet());
  }

  private static Set<String> names(List<EntityReference> references) {
    return listOrEmpty(references).stream()
        .map(EntityReference::getName)
        .collect(Collectors.toSet());
  }

  private static String idOf(ContextMemory memory) {
    return memory.getId().toString();
  }

  private static SharedEntities shared() {
    return SharedEntities.get();
  }

  private static ContextMemoryService admin() {
    return new ContextMemoryService(SdkClients.adminClient().getHttpClient());
  }
}
