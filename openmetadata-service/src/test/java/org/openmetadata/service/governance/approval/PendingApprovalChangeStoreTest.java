/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.approval;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;

class PendingApprovalChangeStoreTest {

  private static ChangeDescription cd(Double previousVersion, FieldChange... updated) {
    return new ChangeDescription()
        .withPreviousVersion(previousVersion)
        .withFieldsUpdated(List.of(updated));
  }

  private static FieldChange field(String name, Object newValue) {
    return new FieldChange().withName(name).withNewValue(newValue);
  }

  private static Map<String, Object> updatedByName(ChangeDescription changeDescription) {
    return changeDescription.getFieldsUpdated().stream()
        .collect(Collectors.toMap(FieldChange::getName, FieldChange::getNewValue));
  }

  @Test
  void merge_withNoExisting_returnsIncoming() {
    ChangeDescription incoming = cd(0.2, field("description", "new"));
    assertSame(incoming, PendingApprovalChangeStore.merge(null, incoming));
  }

  @Test
  void merge_accumulatesDistinctFields() {
    ChangeDescription existing = cd(0.2, field("description", "d1"));
    ChangeDescription incoming = cd(0.3, field("tags", "t1"));

    ChangeDescription merged = PendingApprovalChangeStore.merge(existing, incoming);

    assertEquals(Map.of("description", "d1", "tags", "t1"), updatedByName(merged));
  }

  @Test
  void merge_laterEditSupersedesSameField_andKeepsOriginalBaseline() {
    ChangeDescription existing = cd(0.2, field("description", "first"));
    ChangeDescription incoming = cd(0.3, field("description", "second"));

    ChangeDescription merged = PendingApprovalChangeStore.merge(existing, incoming);

    assertEquals(Map.of("description", "second"), updatedByName(merged));
    // Baseline (previous approved version) is preserved from the first hold, not overwritten.
    assertEquals(0.2, merged.getPreviousVersion());
  }
}
