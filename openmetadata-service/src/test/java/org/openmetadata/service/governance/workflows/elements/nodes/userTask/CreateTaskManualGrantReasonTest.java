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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * {@code CreateTask.mergeManualGrantReason} is on the shared approval-task path. These guard that it
 * is a strict no-op for workflows (Glossary, etc.) that don't supply a reason, and that the Policy
 * Agent DAR path gets the reason in its own {@code payload.manualGrantReason} field.
 */
class CreateTaskManualGrantReasonTest {

  @Test
  void nullReasonReturnsPayloadUnchanged() {
    Object payload = Map.of("accessType", "FullAccess");
    assertSame(payload, CreateTask.mergeManualGrantReason(payload, null));
  }

  @Test
  void blankReasonReturnsPayloadUnchanged() {
    Object payload = Map.of("accessType", "FullAccess");
    assertSame(payload, CreateTask.mergeManualGrantReason(payload, "  "));
  }

  @Test
  void nullPayloadAndNullReasonStaysNull() {
    assertNull(CreateTask.mergeManualGrantReason(null, null));
  }

  @Test
  void setsManualGrantReasonAndPreservesExistingKeys() {
    Object result =
        CreateTask.mergeManualGrantReason(
            Map.of("accessType", "FullAccess"), "needs manual approval");
    Map<String, Object> map = JsonUtils.getMap(result);
    assertEquals("needs manual approval", map.get("manualGrantReason"));
    assertEquals("FullAccess", map.get("accessType"));
  }

  @Test
  void nullPayloadWithReasonCreatesPayloadWithReason() {
    Object result = CreateTask.mergeManualGrantReason(null, "needs manual approval");
    assertEquals("needs manual approval", JsonUtils.getMap(result).get("manualGrantReason"));
  }

  @Test
  void overwritesPriorReasonOnStageUpdate() {
    Object result =
        CreateTask.mergeManualGrantReason(Map.of("manualGrantReason", "old"), "new reason");
    assertEquals("new reason", JsonUtils.getMap(result).get("manualGrantReason"));
  }
}
