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

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.service.context.review.MemoryConflictResolution.Verdict;

class MemoryConflictResolutionTest {

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
