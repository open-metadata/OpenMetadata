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
    assertEquals("Review conflicting memory: three-orders", task.getDisplayName());
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
  void theDescriptionNamesEachDisputedMemoryAndWhy() {
    ContextMemory disputed = memory("five-orders", ContextMemoryStatus.APPROVED, CURATOR);

    String description = MemoryConflictReviewTasks.describe(reviewed(disputed));

    assertTrue(description.contains("- five-orders: Five orders against three orders"));
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
        .withTitle(name)
        .withEntityStatus(stage)
        .withVersion(0.1)
        .withOwners(List.of(owners));
  }

  private static EntityReference user(String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName(name);
  }
}
