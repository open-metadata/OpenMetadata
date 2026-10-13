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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryDispute;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;

class MemoryConflictDecisionTest {

  private static final long DETECTED_AT = 200L;

  @Test
  void approvingSupersedesTheDisputedMemoryAndThenApprovesTheReviewedOne() {
    ContextMemory approved = memory("five-orders", ContextMemoryStatus.APPROVED, 100L);
    ContextMemory reviewed = reviewed("three-orders", approved);

    List<MemoryChange> changes = MemoryConflictDecision.approve(reviewed, byId(approved));

    assertEquals(2, changes.size());
    ContextMemory superseded = changes.getFirst().after();
    assertEquals(approved.getId(), superseded.getId());
    assertEquals(ContextMemoryStatus.SUPERSEDED, superseded.getEntityStatus());
    assertEquals(reviewed.getId(), superseded.getSupersededBy().getId());
    assertTrue(superseded.getStatusReason().contains("three-orders"));
    ContextMemory promoted = changes.getLast().after();
    assertEquals(reviewed.getId(), promoted.getId());
    assertEquals(ContextMemoryStatus.APPROVED, promoted.getEntityStatus());
    assertEquals(ContextMemoryStatus.DRAFT, changes.getLast().before().getEntityStatus());
  }

  @Test
  void aLegacyMemoryWithoutAStageCountsAsApproved() {
    ContextMemory legacy = memory("legacy", null, 100L);

    List<MemoryChange> changes =
        MemoryConflictDecision.approve(reviewed("correction", legacy), byId(legacy));

    assertEquals(ContextMemoryStatus.SUPERSEDED, changes.getFirst().after().getEntityStatus());
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"SUPERSEDED", "REJECTED", "DRAFT", "INVALIDATED"})
  void aDisputedMemoryThatIsNoLongerApprovedIsLeftAlone(ContextMemoryStatus stage) {
    ContextMemory retired = memory("retired", stage, 100L);
    ContextMemory reviewed = reviewed("correction", retired);

    List<MemoryChange> changes = MemoryConflictDecision.approve(reviewed, byId(retired));

    assertEquals(1, changes.size());
    assertEquals(reviewed.getId(), changes.getFirst().after().getId());
  }

  @Test
  void aDeletedDisputedMemoryIsLeftAlone() {
    ContextMemory gone = memory("gone", ContextMemoryStatus.APPROVED, 100L);

    List<MemoryChange> changes =
        MemoryConflictDecision.approve(reviewed("correction", gone), Map.of());

    assertEquals(1, changes.size());
    assertEquals(ContextMemoryStatus.APPROVED, changes.getFirst().after().getEntityStatus());
  }

  @Test
  void approvingIsRefusedWhenADisputedMemoryChangedAfterTheConflictWasDetected() {
    ContextMemory edited = memory("edited", ContextMemoryStatus.APPROVED, DETECTED_AT + 1);

    PreconditionFailedException error =
        assertThrows(
            PreconditionFailedException.class,
            () -> MemoryConflictDecision.approve(reviewed("correction", edited), byId(edited)));

    assertTrue(error.getMessage().contains("changed after the conflict was detected"));
  }

  @Test
  void contentTimeFallsBackToTheAuditTimestampOfALegacyMemory() {
    ContextMemory legacy =
        memory("legacy-clock", ContextMemoryStatus.APPROVED, null).withUpdatedAt(DETECTED_AT + 1);

    assertThrows(
        PreconditionFailedException.class,
        () -> MemoryConflictDecision.approve(reviewed("correction", legacy), byId(legacy)));
  }

  @Test
  void rejectingRejectsOnlyTheReviewedMemoryAndRecordsWhy() {
    ContextMemory approved = memory("five-orders", ContextMemoryStatus.APPROVED, 100L);

    List<MemoryChange> changes =
        MemoryConflictDecision.reject(
            reviewed("three-orders", approved), "Orders count from the first purchase");

    assertEquals(1, changes.size());
    ContextMemory rejected = changes.getFirst().after();
    assertEquals(ContextMemoryStatus.REJECTED, rejected.getEntityStatus());
    assertEquals(
        "Rejected in conflict review: Orders count from the first purchase",
        rejected.getStatusReason());
  }

  @Test
  void rejectingWithoutACommentStillRecordsTheReview() {
    List<MemoryChange> changes =
        MemoryConflictDecision.reject(
            reviewed("three-orders", memory("x", ContextMemoryStatus.APPROVED, 1L)), null);

    assertEquals("Rejected in conflict review", changes.getFirst().after().getStatusReason());
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"APPROVED", "UNPROCESSED", "REJECTED"})
  void aMemoryThatLeftReviewCannotBeDecided(ContextMemoryStatus stage) {
    ContextMemory approved = memory("five-orders", ContextMemoryStatus.APPROVED, 100L);
    ContextMemory moved = reviewed("three-orders", approved).withEntityStatus(stage);

    assertThrows(
        PreconditionFailedException.class,
        () -> MemoryConflictDecision.approve(moved, byId(approved)));
    assertThrows(PreconditionFailedException.class, () -> MemoryConflictDecision.reject(moved, ""));
  }

  @Test
  void approvingWithoutDisputesOnlyApprovesTheReviewedMemory() {
    ContextMemory reviewed =
        memory("orphan", ContextMemoryStatus.DRAFT, 100L).withStatusReason("contradicts: x");

    List<MemoryChange> changes = MemoryConflictDecision.approve(reviewed, Map.of());

    assertEquals(1, changes.size());
    assertNull(changes.getFirst().after().getSupersededBy());
  }

  private static ContextMemory reviewed(String name, ContextMemory disputed) {
    MemoryDispute dispute =
        new MemoryDispute()
            .withMemory(referenceTo(disputed))
            .withReason("contradicts the qualification threshold")
            .withDetectedAt(DETECTED_AT);
    return memory(name, ContextMemoryStatus.DRAFT, 150L)
        .withStatusReason("contradicts: threshold differs")
        .withDisputes(List.of(dispute));
  }

  private static ContextMemory memory(String name, ContextMemoryStatus stage, Long contentTime) {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withTitle(name)
        .withEntityStatus(stage)
        .withLastContentUpdatedAt(contentTime)
        .withUpdatedAt(contentTime == null ? 1L : contentTime)
        .withVersion(0.1);
  }

  private static EntityReference referenceTo(ContextMemory memory) {
    return new EntityReference()
        .withId(memory.getId())
        .withType(Entity.CONTEXT_MEMORY)
        .withName(memory.getName());
  }

  private static Map<UUID, ContextMemory> byId(ContextMemory... memories) {
    Map<UUID, ContextMemory> byId = new HashMap<>();
    for (ContextMemory memory : memories) {
      byId.put(memory.getId(), memory);
    }
    return byId;
  }
}
