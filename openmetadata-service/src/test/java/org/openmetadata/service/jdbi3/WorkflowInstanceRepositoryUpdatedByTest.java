/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.Stage;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;

class WorkflowInstanceRepositoryUpdatedByTest {

  private static WorkflowInstanceState stateWithUpdatedBy(String updatedBy, Long endedAt) {
    Stage stage = new Stage().withUpdatedBy(updatedBy).withEndedAt(endedAt);
    return new WorkflowInstanceState().withStage(stage);
  }

  @Test
  void extractUpdatedByFromStates_returnsLatestNonNullUpdatedBy() {
    WorkflowInstanceState old = stateWithUpdatedBy("first-approver", 1000L);
    WorkflowInstanceState latest = stateWithUpdatedBy("latest-approver", 3000L);
    WorkflowInstanceState middle = stateWithUpdatedBy("middle-approver", 2000L);

    assertEquals(
        "latest-approver",
        WorkflowInstanceRepository.extractUpdatedByFromStates(List.of(old, latest, middle)));
  }

  @Test
  void extractUpdatedByFromStates_skipsNullUpdatedBy() {
    WorkflowInstanceState withNull = stateWithUpdatedBy(null, 5000L);
    WorkflowInstanceState withValue = stateWithUpdatedBy("approver", 1000L);

    assertEquals(
        "approver",
        WorkflowInstanceRepository.extractUpdatedByFromStates(List.of(withNull, withValue)));
  }

  @Test
  void extractUpdatedByFromStates_allNull_returnsNull() {
    assertNull(
        WorkflowInstanceRepository.extractUpdatedByFromStates(
            List.of(stateWithUpdatedBy(null, 1000L), stateWithUpdatedBy(null, 2000L))));
  }

  @Test
  void extractUpdatedByFromStates_emptyList_returnsNull() {
    assertNull(WorkflowInstanceRepository.extractUpdatedByFromStates(List.of()));
  }

  @Test
  void extractUpdatedByFromStates_nullEndedAt_treatedAsZero() {
    WorkflowInstanceState withNullEndedAt = stateWithUpdatedBy("approver-a", null);
    WorkflowInstanceState withEndedAt = stateWithUpdatedBy("approver-b", 1L);

    assertEquals(
        "approver-b",
        WorkflowInstanceRepository.extractUpdatedByFromStates(
            List.of(withNullEndedAt, withEndedAt)));
  }
}
