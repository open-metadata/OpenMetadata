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
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryDispute;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.context.review.MemoryConflictResolution.Verdict;

class MemoryConflictResolutionTest {

  /** A decision retried after its memory left Draft reads the disputes the task recorded. */
  @Test
  void aRetryReadsTheDisputesTheTaskRecorded() {
    UUID disputedId = UUID.randomUUID();
    ContextMemory reviewed =
        new ContextMemory()
            .withId(UUID.randomUUID())
            .withName("three-orders")
            .withFullyQualifiedName("three-orders")
            .withEntityStatus(ContextMemoryStatus.DRAFT)
            .withDisputes(
                List.of(
                    new MemoryDispute()
                        .withMemory(
                            new EntityReference()
                                .withId(disputedId)
                                .withType(Entity.CONTEXT_MEMORY)
                                .withName("five-orders"))
                        .withReason("Five orders against three")
                        .withDetectedAt(10L)));
    Task opened =
        MemoryConflictReviewTasks.reviewTask(reviewed, List.of(), new EntityReference(), 1L);
    Task stored = JsonUtils.readValue(JsonUtils.pojoToJson(opened), Task.class);

    List<MemoryDispute> recorded = MemoryConflictResolution.recordedDisputes(stored);

    assertEquals(1, recorded.size());
    assertEquals(disputedId, recorded.getFirst().getMemory().getId());
    assertEquals(10L, recorded.getFirst().getDetectedAt());
  }

  @ParameterizedTest
  @EnumSource(
      value = TaskResolutionType.class,
      names = {"Approved", "AutoApproved"})
  void approvalsApprove(TaskResolutionType resolution) {
    assertEquals(Optional.of(Verdict.APPROVE), MemoryConflictResolution.verdictOf(resolution));
  }

  @ParameterizedTest
  @EnumSource(
      value = TaskResolutionType.class,
      names = {"Rejected", "AutoRejected"})
  void rejectionsReject(TaskResolutionType resolution) {
    assertEquals(Optional.of(Verdict.REJECT), MemoryConflictResolution.verdictOf(resolution));
  }

  @ParameterizedTest
  @EnumSource(
      value = TaskResolutionType.class,
      names = {"Approved", "AutoApproved", "Rejected", "AutoRejected"},
      mode = EnumSource.Mode.EXCLUDE)
  void anyOtherResolutionLeavesTheMemoriesAlone(TaskResolutionType resolution) {
    assertTrue(MemoryConflictResolution.verdictOf(resolution).isEmpty());
  }

  @Test
  void anUnspecifiedResolutionDecidesNothing() {
    assertTrue(MemoryConflictResolution.verdictOf(null).isEmpty());
  }

  @Test
  void onlyAMemoryConflictReviewIsDecidedHere() {
    assertTrue(
        MemoryConflictResolution.decides(new Task().withType(TaskEntityType.MemoryConflictReview)));
    assertFalse(
        MemoryConflictResolution.decides(new Task().withType(TaskEntityType.RequestApproval)));
  }
}
