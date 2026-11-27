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

package org.openmetadata.service.governance.approval;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.util.ChangePreviewUtils;
import org.openmetadata.service.governance.workflows.util.ChangePreviewUtils.FieldDiff;

class MutationOpsTest {
  @Test
  void opsBecomeOneFieldChangePerFieldAndKind() {
    var base = JsonUtils.readTree("{\"description\":\"a\",\"tags\":[{\"tagFQN\":\"A\"}]}");
    var proposed =
        JsonUtils.readTree(
            "{\"description\":\"b\",\"tags\":[{\"tagFQN\":\"B\"},{\"tagFQN\":\"C\"}]}");
    var ops =
        MutationPlanner.plan(
            base, proposed, Set.of("description", "tags"), Set.of("description", "tags"));
    ChangeDescription change = MutationOps.toChangeDescription(ops, 0.1);
    assertEquals(1, change.getFieldsUpdated().size());
    assertEquals("description", change.getFieldsUpdated().get(0).getName());
    assertEquals(1, change.getFieldsAdded().size());
    assertEquals(2, JsonUtils.valueToTree(change.getFieldsAdded().get(0).getNewValue()).size());
    assertEquals(1, change.getFieldsDeleted().size());
    assertEquals(0.1, change.getPreviousVersion());
  }

  @Test
  void proposedChangesNameTagsByFqnAndShowTextUnquoted() {
    var base = JsonUtils.readTree("{\"description\":\"<p>a</p>\",\"tags\":[{\"tagFQN\":\"A.X\"}]}");
    var proposed =
        JsonUtils.readTree(
            "{\"description\":\"<p>b</p>\",\"tags\":[{\"tagFQN\":\"PII.Sensitive\"}]}");
    var ops =
        MutationPlanner.plan(
            base, proposed, Set.of("description", "tags"), Set.of("description", "tags"));

    Map<String, FieldDiff> changes =
        ChangePreviewUtils.buildChangeMap(MutationOps.toChangeDescription(ops, 0.1));

    assertEquals(new FieldDiff(List.of("PII.Sensitive"), List.of("A.X")), changes.get("tags"));
    assertEquals(
        new FieldDiff(List.of("<p>b</p>"), List.of("<p>a</p>")), changes.get("description"));
  }
}
