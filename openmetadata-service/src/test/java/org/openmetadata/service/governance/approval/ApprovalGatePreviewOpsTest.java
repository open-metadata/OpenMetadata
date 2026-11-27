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
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;

class ApprovalGatePreviewOpsTest {
  private static TagLabel tag(String fqn, TagLabel.LabelType labelType) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(labelType)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static Table table(String description, List<TagLabel> tags, List<TagLabel> columnTags) {
    return new Table()
        .withId(UUID.fromString("11111111-1111-1111-1111-111111111111"))
        .withName("orders")
        .withFullyQualifiedName("svc.db.schema.orders")
        .withDescription(description)
        .withTags(tags)
        .withColumns(
            List.of(
                new Column()
                    .withName("card")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withFullyQualifiedName("svc.db.schema.orders.card")
                    .withTags(columnTags)));
  }

  private static List<String> planned(Table original, Table updated, Set<String> fields) {
    return ApprovalGate.previewOps(original, updated, ApprovalGate.Edit.patch(fields)).stream()
        .map(MutationOp::getField)
        .toList();
  }

  @Test
  void aDescriptionEditDoesNotReportTheInheritedTagsPreparationDrops() {
    TagLabel tier = tag("Tier.Tier2", TagLabel.LabelType.MANUAL);
    TagLabel inherited = tag("PII.NonSensitive", TagLabel.LabelType.DERIVED);
    TagLabel implied = tag("PII.Sensitive", TagLabel.LabelType.DERIVED);
    Table original = table("old", List.of(tier, inherited), List.of(implied));
    Table updated = table("new", List.of(tier), List.of());

    assertEquals(List.of("description"), planned(original, updated, Set.of("description")));
    assertEquals(
        List.of(tier, inherited),
        original.getTags(),
        "the entity read is left as it was; only the planned copies drop the derived labels");
  }

  @Test
  void removingAManualTagIsStillPreviewed() {
    TagLabel tier = tag("Tier.Tier2", TagLabel.LabelType.MANUAL);
    TagLabel inherited = tag("PII.NonSensitive", TagLabel.LabelType.DERIVED);
    Table original = table("old", List.of(tier, inherited), List.of());
    Table updated = table("old", List.of(), List.of());

    List<MutationOp> ops =
        ApprovalGate.previewOps(original, updated, ApprovalGate.Edit.patch(Set.of("tags")));

    assertEquals(1, ops.size(), JsonUtils.pojoToJson(ops));
    assertEquals("tags", ops.get(0).getField());
    assertEquals("Tier.Tier2", ops.get(0).getKey());
  }
}
