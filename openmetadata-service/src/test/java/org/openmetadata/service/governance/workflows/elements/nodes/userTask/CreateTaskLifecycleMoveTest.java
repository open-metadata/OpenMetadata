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

package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.LifecycleMove;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;

/** A lifecycle approval names the stage move it gates instead of the entity's latest changes. */
class CreateTaskLifecycleMoveTest {
  private static final LifecycleMove IN_REVIEW_TO_APPROVED =
      new LifecycleMove().withStage(EntityStatus.IN_REVIEW).withTargetStage(EntityStatus.APPROVED);

  @Test
  void aLifecycleApprovalCarriesItsMoveAndNoProposedChanges() {
    final Map<String, Object> payload =
        JsonUtils.getMap(
            CreateTask.approvalPayload(
                TaskEntityType.RequestApproval,
                stageChangedDomain(),
                Map.of("proposedChanges", Map.of("entityStatus", Map.of())),
                IN_REVIEW_TO_APPROVED,
                null));

    assertFalse(payload.containsKey("proposedChanges"));
    assertEquals(
        Map.of("stage", "In Review", "targetStage", "Approved"), payload.get("lifecycleMove"));
  }

  @Test
  void anApprovalWithoutAMoveStillListsTheProposedChanges() {
    final Map<String, Object> payload =
        JsonUtils.getMap(
            CreateTask.approvalPayload(
                TaskEntityType.RequestApproval,
                changedDomain("description", "Old", "New"),
                null,
                null,
                null));

    assertEquals(
        List.of("description"), List.copyOf(((Map<?, ?>) payload.get("proposedChanges")).keySet()));
  }

  private static Domain stageChangedDomain() {
    return changedDomain("entityStatus", "Draft", "In Review");
  }

  private static Domain changedDomain(String field, String oldValue, String newValue) {
    return new Domain()
        .withName("finance")
        .withVersion(0.2)
        .withChangeDescription(
            new ChangeDescription()
                .withPreviousVersion(0.1)
                .withFieldsUpdated(
                    List.of(
                        new FieldChange()
                            .withName(field)
                            .withOldValue(oldValue)
                            .withNewValue(newValue))));
  }
}
