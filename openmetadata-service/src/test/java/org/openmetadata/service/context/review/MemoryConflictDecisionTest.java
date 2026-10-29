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

import java.util.ArrayList;
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
import org.openmetadata.schema.type.ComparedMemory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MemoryConflictReviewResolution;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;

class MemoryConflictDecisionTest {

  private static final long DETECTED_AT = 200L;

  /**
   * Approving first means an approval interrupted before it supersedes leaves both claims Approved,
   * never a retired claim with nothing in its place.
   */
  @Test
  void approvingApprovesTheReviewedMemoryAndThenSupersedesTheDisputedOne() {
    ContextMemory approved = memory("five-orders", ContextMemoryStatus.APPROVED, 100L);
    ContextMemory reviewed = reviewed("three-orders", approved);

    List<MemoryChange> changes = approve(reviewed, approved);

    assertEquals(2, changes.size());
    ContextMemory promoted = changes.getFirst().after();
    assertEquals(reviewed.getId(), promoted.getId());
    assertEquals(ContextMemoryStatus.APPROVED, promoted.getEntityStatus());
    assertEquals(ContextMemoryStatus.DRAFT, changes.getFirst().before().getEntityStatus());
    ContextMemory superseded = changes.getLast().after();
    assertEquals(approved.getId(), superseded.getId());
    assertEquals(ContextMemoryStatus.SUPERSEDED, superseded.getEntityStatus());
    assertEquals(reviewed.getId(), superseded.getSupersededBy().getId());
    assertTrue(superseded.getStatusReason().contains("three-orders"));
  }

  @Test
  void aLegacyMemoryWithoutAStageCountsAsApproved() {
    ContextMemory legacy = memory("legacy", null, 100L);

    List<MemoryChange> changes = approve(reviewed("correction", legacy), legacy);

    assertEquals(ContextMemoryStatus.SUPERSEDED, changes.getLast().after().getEntityStatus());
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"SUPERSEDED", "REJECTED", "DRAFT", "INVALIDATED"})
  void aDisputedMemoryThatIsNoLongerApprovedIsLeftAlone(ContextMemoryStatus stage) {
    ContextMemory retired = memory("retired", stage, 100L);
    ContextMemory reviewed = reviewed("correction", retired);

    List<MemoryChange> changes = approve(reviewed, retired);

    assertEquals(1, changes.size());
    assertEquals(reviewed.getId(), changes.getFirst().after().getId());
  }

  @Test
  void aDeletedDisputedMemoryIsLeftAlone() {
    ContextMemory gone = memory("gone", ContextMemoryStatus.APPROVED, 100L);

    List<MemoryChange> changes = approve(reviewed("correction", gone));

    assertEquals(1, changes.size());
    assertEquals(ContextMemoryStatus.APPROVED, changes.getFirst().after().getEntityStatus());
  }

  @Test
  void approvingIsRefusedWhenADisputedMemoryChangedAfterTheConflictWasDetected() {
    ContextMemory edited = memory("edited", ContextMemoryStatus.APPROVED, DETECTED_AT + 1);

    PreconditionFailedException error =
        assertThrows(
            PreconditionFailedException.class,
            () -> approve(reviewed("correction", edited), edited));

    assertTrue(error.getMessage().contains("changed after the conflict was detected"));
  }

  @Test
  void contentTimeFallsBackToTheAuditTimestampOfALegacyMemory() {
    ContextMemory legacy =
        memory("legacy-clock", ContextMemoryStatus.APPROVED, null).withUpdatedAt(DETECTED_AT + 1);

    assertThrows(
        PreconditionFailedException.class, () -> approve(reviewed("correction", legacy), legacy));
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
      names = {"UNPROCESSED", "REJECTED", "SUPERSEDED"})
  void aMemoryThatLeftReviewCannotBeApproved(ContextMemoryStatus stage) {
    ContextMemory approved = memory("five-orders", ContextMemoryStatus.APPROVED, 100L);
    ContextMemory moved = reviewed("three-orders", approved).withEntityStatus(stage);

    assertThrows(PreconditionFailedException.class, () -> approve(moved, approved));
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"UNPROCESSED", "APPROVED", "SUPERSEDED"})
  void aMemoryThatLeftReviewCannotBeRejected(ContextMemoryStatus stage) {
    ContextMemory approved = memory("five-orders", ContextMemoryStatus.APPROVED, 100L);
    ContextMemory moved = reviewed("three-orders", approved).withEntityStatus(stage);

    assertThrows(PreconditionFailedException.class, () -> MemoryConflictDecision.reject(moved, ""));
  }

  /** The approval was written but the task could not resolve: retrying changes nothing. */
  @Test
  void aRetriedApprovalWhoseWritesLandedChangesNothing() {
    ContextMemory superseded = memory("five-orders", ContextMemoryStatus.SUPERSEDED, 100L);
    ContextMemory approved =
        reviewed("three-orders", superseded).withEntityStatus(ContextMemoryStatus.APPROVED);

    assertTrue(approve(approved, superseded).isEmpty());
  }

  @Test
  void aRetriedApprovalStillSupersedesWhatIsApproved() {
    ContextMemory stillApproved = memory("five-orders", ContextMemoryStatus.APPROVED, 100L);
    ContextMemory approved =
        reviewed("three-orders", stillApproved).withEntityStatus(ContextMemoryStatus.APPROVED);

    List<MemoryChange> changes = approve(approved, stillApproved);

    assertEquals(1, changes.size());
    assertEquals(ContextMemoryStatus.SUPERSEDED, changes.getFirst().after().getEntityStatus());
    assertEquals(stillApproved.getId(), changes.getFirst().before().getId());
  }

  @Test
  void aRetriedRejectionWhoseWriteLandedChangesNothing() {
    ContextMemory approved = memory("five-orders", ContextMemoryStatus.APPROVED, 100L);
    ContextMemory rejected =
        reviewed("three-orders", approved).withEntityStatus(ContextMemoryStatus.REJECTED);

    assertTrue(MemoryConflictDecision.reject(rejected, "").isEmpty());
  }

  @Test
  void approvingWithoutDisputesOnlyApprovesTheReviewedMemory() {
    ContextMemory reviewed =
        memory("orphan", ContextMemoryStatus.DRAFT, 100L).withStatusReason("contradicts: x");

    List<MemoryChange> changes = approve(reviewed);

    assertEquals(1, changes.size());
    assertNull(changes.getFirst().after().getSupersededBy());
  }

  @Test
  void aDecisionWithoutAComparisonActsOnTheMemoriesAsTheyAre() {
    ContextMemory approved = memory("five-orders", ContextMemoryStatus.APPROVED, 100L);
    ContextMemory reviewed = reviewed("three-orders", approved);

    requireComparedAsIs(null, reviewed, approved);
  }

  @Test
  void aComparisonOfTheClaimsAsTheyStandAllowsTheDecision() {
    ContextMemory approved = memory("five-orders", ContextMemoryStatus.APPROVED, 100L);
    ContextMemory reviewed = reviewed("three-orders", approved);

    requireComparedAsIs(comparing(reviewed, 150L, approved, 100L), reviewed, approved);
  }

  /** The reviewer read the claims before one of them changed: the decision is not theirs. */
  @Test
  void aClaimChangedSinceItWasComparedRefusesTheDecision() {
    ContextMemory approved = memory("five-orders", ContextMemoryStatus.APPROVED, 100L);
    ContextMemory reviewed = reviewed("three-orders", approved);

    PreconditionFailedException refused =
        assertThrows(
            PreconditionFailedException.class,
            () ->
                requireComparedAsIs(comparing(reviewed, 140L, approved, 100L), reviewed, approved));

    assertEquals(MemoryConflictDecision.STALE_COMPARISON, refused.getMessage());
  }

  @Test
  void aDisputeTheReviewerDidNotCompareRefusesTheDecision() {
    ContextMemory approved = memory("five-orders", ContextMemoryStatus.APPROVED, 100L);
    ContextMemory reviewed = reviewed("three-orders", approved);

    assertThrows(
        PreconditionFailedException.class,
        () -> requireComparedAsIs(comparing(reviewed, 150L), reviewed, approved));
  }

  @Test
  void aMemoryTheReviewerCouldNotReadHasNoClaimToCheck() {
    ContextMemory approved = memory("five-orders", ContextMemoryStatus.APPROVED, 100L);
    ContextMemory reviewed = reviewed("three-orders", approved);

    requireComparedAsIs(comparing(reviewed, 150L, approved, null), reviewed, approved);
  }

  private static void requireComparedAsIs(
      MemoryConflictReviewResolution comparison,
      ContextMemory reviewed,
      ContextMemory... disputed) {
    MemoryConflictDecision.requireComparedAsIs(
        comparison, reviewed, reviewed.getDisputes(), byId(disputed));
  }

  /** Pairs of a memory and the claim time the reviewer read for it. */
  private static MemoryConflictReviewResolution comparing(Object... memoryAndTime) {
    List<ComparedMemory> compared = new ArrayList<>();
    for (int index = 0; index < memoryAndTime.length; index += 2) {
      compared.add(
          new ComparedMemory()
              .withId(((ContextMemory) memoryAndTime[index]).getId())
              .withContentUpdatedAt((Long) memoryAndTime[index + 1]));
    }
    return new MemoryConflictReviewResolution().withCompared(compared);
  }

  private static List<MemoryChange> approve(ContextMemory reviewed, ContextMemory... disputed) {
    return MemoryConflictDecision.approve(reviewed, reviewed.getDisputes(), byId(disputed));
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
