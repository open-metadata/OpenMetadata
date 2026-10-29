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

package org.openmetadata.service.context.review;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryDispute;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class MemoryConflictReviewTasksTest {

  private static final EntityReference BOT = user("governance-bot");
  private static final EntityReference REVIEWER = user("reviewer");
  private static final EntityReference CURATOR = user("curator");

  @Test
  void aDraftMemoryWithDisputesIsHeldForConflicts() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);

    assertTrue(MemoryConflictReviewTasks.isHeldForConflicts(reviewed(disputed)));
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"DRAFT"},
      mode = EnumSource.Mode.EXCLUDE)
  void onlyADraftMemoryIsHeldForConflicts(ContextMemoryStatus stage) {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);

    assertFalse(
        MemoryConflictReviewTasks.isHeldForConflicts(reviewed(disputed).withEntityStatus(stage)));
  }

  @Test
  void aDraftMemoryWithoutDisputesIsAnotherKindOfReviewHold() {
    ContextMemory draft = memory("low-confidence", ContextMemoryStatus.DRAFT, REVIEWER);

    assertFalse(MemoryConflictReviewTasks.isHeldForConflicts(draft));
    assertFalse(MemoryConflictReviewTasks.isHeldForConflicts(null));
  }

  /** A governance workflow moves memories as governance-bot; that must still close the review. */
  @Test
  void aGovernanceWorkflowTakingTheMemoryOutOfReviewClosesTheTask() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);
    ContextMemory held = reviewed(disputed);
    ContextMemory approvedByWorkflow =
        copy(held)
            .withEntityStatus(ContextMemoryStatus.APPROVED)
            .withUpdatedBy("governance-bot")
            .withImpersonatedBy("governance-bot");

    assertTrue(MemoryConflictReviewTasks.leavesReviewOutsideTheTask(held, approvedByWorkflow));
  }

  @Test
  void theTasksOwnDecisionDoesNotCloseIt() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);
    ContextMemory held = reviewed(disputed);
    ContextMemory approved = copy(held).withEntityStatus(ContextMemoryStatus.APPROVED);
    boolean[] closes = new boolean[1];

    MemoryConflictResolution.whileDeciding(
        held.getId(),
        () -> closes[0] = MemoryConflictReviewTasks.leavesReviewOutsideTheTask(held, approved));

    assertFalse(closes[0]);
    assertTrue(MemoryConflictReviewTasks.leavesReviewOutsideTheTask(held, approved));
  }

  @Test
  void anEditThatKeepsTheStageAndTheDisputesLooksForNoReview() {
    ContextMemory approved = memory("five-orders", ContextMemoryStatus.APPROVED, REVIEWER);

    assertFalse(
        MemoryConflictReviewTasks.leavesReviewOutsideTheTask(
            approved, copy(approved).withAnswer("Customers need five completed orders.")));
    assertFalse(MemoryConflictReviewTasks.leavesReviewOutsideTheTask(null, approved));
  }

  /**
   * A session that put the memory into review and took it out again consolidates into one version,
   * whose previous state was never held; the change of stage still looks for the review.
   */
  @Test
  void aConsolidatedEditThatLeftReviewStillLooksForTheReview() {
    ContextMemory beforeSession = memory("three-orders", ContextMemoryStatus.UNPROCESSED, REVIEWER);
    ContextMemory afterSession = copy(beforeSession).withEntityStatus(ContextMemoryStatus.DRAFT);

    assertTrue(MemoryConflictReviewTasks.leavesReviewOutsideTheTask(beforeSession, afterSession));
  }

  @Test
  void theTaskIsAServerOpenedReviewAboutTheDisputedDraft() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);
    ContextMemory reviewed = reviewed(disputed);

    Task task = MemoryConflictReviewTasks.reviewTask(reviewed, List.of(disputed), BOT, 42L);

    assertEquals(TaskEntityType.MemoryConflictReview, task.getType());
    assertEquals(TaskCategory.Review, task.getCategory());
    assertEquals(TaskEntityStatus.Open, task.getStatus());
    assertEquals(reviewed.getId(), task.getAbout().getId());
    assertEquals(Entity.CONTEXT_MEMORY, task.getAbout().getType());
    assertEquals(BOT, task.getCreatedBy());
    assertEquals(42L, task.getCreatedAt());
    assertEquals(MemoryConflictReviewTasks.REVIEW_TITLE, task.getDisplayName());
  }

  @Test
  void approvingAndRejectingAreTheTwoDecisions() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);

    List<TaskAvailableTransition> transitions =
        MemoryConflictReviewTasks.reviewTask(reviewed(disputed), List.of(disputed), BOT, 1L)
            .getAvailableTransitions();

    assertEquals(2, transitions.size());
    assertEquals("approve", transitions.getFirst().getId());
    assertEquals(TaskResolutionType.Approved, transitions.getFirst().getResolutionType());
    assertEquals("reject", transitions.getLast().getId());
    assertEquals(TaskResolutionType.Rejected, transitions.getLast().getResolutionType());
  }

  @Test
  void theOwnersOfEitherSideAreAssignedOnce() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);
    ContextMemory alsoDisputed =
        memory("first-order", ContextMemoryStatus.APPROVED, REVIEWER, CURATOR);

    List<EntityReference> assignees =
        MemoryConflictReviewTasks.assignees(reviewed(disputed), List.of(disputed, alsoDisputed));

    assertEquals(List.of(REVIEWER, CURATOR), assignees);
  }

  /** Every user may read tasks, while a memory may be Private: none of it reaches the task. */
  @Test
  void theTaskSaysNothingEitherMemoryHolds() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);

    Task task =
        MemoryConflictReviewTasks.reviewTask(reviewed(disputed), List.of(disputed), BOT, 1L);

    String json = JsonUtils.pojoToJson(task);
    assertEquals(MemoryConflictReviewTasks.REVIEW_DESCRIPTION, task.getDescription());
    for (String content :
        List.of("Three orders", "Five orders", "Customers need", "Who is a customer?")) {
      assertFalse(json.contains(content), "the task leaks " + content);
    }
  }

  @Test
  void theTaskRecordsEachDisputedMemoryAndWhenItWasDetected() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);

    Task task =
        MemoryConflictReviewTasks.reviewTask(reviewed(disputed), List.of(disputed), BOT, 1L);

    Map<?, ?> payload = JsonUtils.convertValue(task.getPayload(), Map.class);
    Map<?, ?> contradiction = (Map<?, ?>) ((List<?>) payload.get("disputes")).getFirst();
    Map<?, ?> disputedMemory = (Map<?, ?>) contradiction.get("memory");
    assertEquals(disputed.getId().toString(), disputedMemory.get("id"));
    assertEquals("five-orders", disputedMemory.get("name"));
    assertFalse(disputedMemory.containsKey("displayName"), "a stored reference carries a title");
    assertEquals(10, ((Number) contradiction.get("detectedAt")).intValue());
  }

  @Test
  void aDisputedMemoryThatIsGoneStaysRecordedButAssignsNobody() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);

    Task task = MemoryConflictReviewTasks.reviewTask(reviewed(disputed), List.of(), BOT, 1L);

    Map<?, ?> payload = JsonUtils.convertValue(task.getPayload(), Map.class);
    assertEquals(1, ((List<?>) payload.get("disputes")).size());
    assertEquals(List.of(REVIEWER), task.getAssignees());
  }

  @Test
  void onlyChangingDisputesOrOwnersChangesTheReview() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);
    ContextMemory before = reviewed(disputed);

    assertTrue(changes(before, copy(before).withDisputes(List.of())));
    assertTrue(changes(before, copy(before).withOwners(List.of(CURATOR))));
    assertTrue(changes(null, before));
    assertFalse(changes(before, copy(before).withTitle("Three completed orders")));
    assertFalse(changes(before, copy(before).withAnswer("At least three completed orders.")));
    assertFalse(changes(before, copy(before).withQuestion("Who is an active customer?")));
  }

  private static boolean changes(ContextMemory previous, ContextMemory current) {
    return MemoryConflictReviewTasks.changesWhatTheReviewShows(previous, current);
  }

  private static ContextMemory copy(ContextMemory memory) {
    return JsonUtils.deepCopy(memory, ContextMemory.class);
  }

  private static ContextMemory reviewed(ContextMemory disputed) {
    MemoryDispute dispute =
        new MemoryDispute()
            .withMemory(
                new EntityReference()
                    .withId(disputed.getId())
                    .withType(Entity.CONTEXT_MEMORY)
                    .withName(disputed.getName())
                    .withDisplayName(disputed.getTitle()))
            .withReason("Five orders against three orders")
            .withDetectedAt(10L);
    return memory("three-orders", ContextMemoryStatus.DRAFT, REVIEWER)
        .withDisputes(List.of(dispute));
  }

  private static ContextMemory memory(
      String name, ContextMemoryStatus stage, EntityReference... owners) {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withTitle(titleOf(name))
        .withQuestion("Who is a customer?")
        .withAnswer("Customers need " + name.replace("-orders", " orders") + ".")
        .withEntityStatus(stage)
        .withVersion(0.1)
        .withOwners(List.of(owners));
  }

  /** {@code five-orders} is titled {@code Five orders}, so a test can tell a title from a name. */
  private static String titleOf(String name) {
    String words = name.replace('-', ' ');
    return Character.toUpperCase(words.charAt(0)) + words.substring(1);
  }

  private static EntityReference user(String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName(name);
  }
}
