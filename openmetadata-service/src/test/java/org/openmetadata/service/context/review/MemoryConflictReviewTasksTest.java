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
import static org.junit.jupiter.api.Assertions.assertNull;
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
    assertEquals("Review conflicting memory: Three orders", task.getDisplayName());
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

  @Test
  void theDescriptionStatesBothClaimsAndWhyTheyConflict() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);

    String description =
        MemoryConflictReviewTasks.reviewTask(reviewed(disputed), List.of(disputed), BOT, 1L)
            .getDescription();

    assertTrue(description.contains("**In review:** Customers need three orders."));
    assertTrue(
        description.contains("**Contradicts \"Five orders\":** Customers need five orders."));
    assertTrue(description.contains("**Why:** Five orders against three orders"));
  }

  @Test
  void theTaskRecordsBothClaimsForTheReviewerToCompare() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);

    Task task =
        MemoryConflictReviewTasks.reviewTask(reviewed(disputed), List.of(disputed), BOT, 1L);

    Map<?, ?> payload = JsonUtils.convertValue(task.getPayload(), Map.class);
    Map<?, ?> claim = (Map<?, ?>) payload.get("claim");
    assertEquals("Three orders", claim.get("title"));
    assertEquals("Customers need three orders.", claim.get("answer"));
    assertEquals("Draft", claim.get("status"));
    Map<?, ?> contradiction = (Map<?, ?>) ((List<?>) payload.get("disputes")).getFirst();
    Map<?, ?> disputedClaim = (Map<?, ?>) contradiction.get("claim");
    assertEquals("Customers need five orders.", disputedClaim.get("answer"));
    assertEquals("Approved", disputedClaim.get("status"));
    assertEquals("Five orders against three orders", contradiction.get("reason"));
  }

  /** Generated memory names such as {@code orders.pdf-<uuid>} label nothing for a reviewer. */
  @Test
  void theTaskTitlesTheReviewedMemoryAndEachDisputedOne() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);
    ContextMemory reviewed = reviewed(disputed);

    Task task = MemoryConflictReviewTasks.reviewTask(reviewed, List.of(disputed), BOT, 1L);

    Map<?, ?> payload = JsonUtils.convertValue(task.getPayload(), Map.class);
    assertEquals("Three orders", payload.get("memoryTitle"));
    Map<?, ?> disputedMemory =
        (Map<?, ?>) ((Map<?, ?>) ((List<?>) payload.get("disputes")).getFirst()).get("memory");
    assertEquals("Five orders", disputedMemory.get("displayName"));
    assertEquals("five-orders", disputedMemory.get("name"));
    assertNull(
        reviewed.getDisputes().getFirst().getMemory().getDisplayName(),
        "the memory's own disputes stay as written");
  }

  @Test
  void aDisputedMemoryThatIsGoneKeepsItsNameAndHasNoClaim() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);

    Task task = MemoryConflictReviewTasks.reviewTask(reviewed(disputed), List.of(), BOT, 1L);

    assertTrue(
        task.getDescription()
            .contains("**Contradicts \"five-orders\":** " + MemoryConflictReviewTasks.MEMORY_GONE));
    Map<?, ?> payload = JsonUtils.convertValue(task.getPayload(), Map.class);
    Map<?, ?> contradiction = (Map<?, ?>) ((List<?>) payload.get("disputes")).getFirst();
    assertNull(contradiction.get("claim"));
  }

  @Test
  void anEditToWhatTheReviewShowsChangesIt() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);
    ContextMemory before = reviewed(disputed);

    assertTrue(changes(before, copy(before).withTitle("Three completed orders")));
    assertTrue(changes(before, copy(before).withAnswer("At least three completed orders.")));
    assertTrue(changes(before, copy(before).withQuestion("Who is an active customer?")));
    assertTrue(changes(before, copy(before).withPrimaryEntity(CURATOR)));
    assertTrue(changes(before, copy(before).withDisputes(List.of())));
    assertTrue(changes(before, copy(before).withOwners(List.of(CURATOR))));
    assertTrue(changes(null, before));
    assertFalse(changes(before, copy(before).withSummary("Three orders make a customer active.")));
  }

  @Test
  void theTaskRecordsTheRevisionItWasOpenedFor() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);
    ContextMemory reviewed = reviewed(disputed).withVersion(0.3);

    Task task = MemoryConflictReviewTasks.reviewTask(reviewed, List.of(disputed), BOT, 1L);

    Map<?, ?> payload = JsonUtils.convertValue(task.getPayload(), Map.class);
    assertEquals(0.3, payload.get("memoryVersion"));
    assertEquals(1, ((List<?>) payload.get("disputes")).size());
  }

  @Test
  void anUntitledMemoryIsLabelledByItsName() {
    ContextMemory blank = memory("blank", ContextMemoryStatus.DRAFT, REVIEWER).withTitle("  ");
    ContextMemory missing = memory("missing", ContextMemoryStatus.DRAFT, REVIEWER).withTitle(null);

    assertEquals("blank", MemoryConflictReviewTasks.label(blank));
    assertEquals("missing", MemoryConflictReviewTasks.label(missing));
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
                    .withName(disputed.getName()))
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
