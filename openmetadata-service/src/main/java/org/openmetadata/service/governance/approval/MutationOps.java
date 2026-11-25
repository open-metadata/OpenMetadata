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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Presents a revision's ops in the ChangeDescription shape the task UI and workflow nodes read. Op
 * values are stored as JSON text; each is read back into a plain value (a string, a list or a map),
 * as in a change description recorded by an entity update.
 */
public final class MutationOps {
  private MutationOps() {}

  public static ChangeDescription toChangeDescription(
      List<MutationOp> ops, Double previousVersion) {
    List<FieldChange> updated = new ArrayList<>();
    Map<String, List<Object>> added = new LinkedHashMap<>();
    Map<String, List<Object>> deleted = new LinkedHashMap<>();
    for (MutationOp op : ops) {
      switch (op.getOp()) {
        case SET -> updated.add(
            new FieldChange()
                .withName(op.getField())
                .withOldValue(plainValue(op.getBaseValue()))
                .withNewValue(plainValue(op.getValue())));
        case ADD -> elements(added, op).add(plainValue(op.getValue()));
        case REMOVE -> elements(deleted, op).add(plainValue(op.getValue()));
      }
    }
    return new ChangeDescription()
        .withPreviousVersion(previousVersion)
        .withFieldsUpdated(updated)
        .withFieldsAdded(asChanges(added, true))
        .withFieldsDeleted(asChanges(deleted, false));
  }

  private static Object plainValue(String json) {
    return JsonUtils.readValue(json, Object.class);
  }

  private static List<Object> elements(Map<String, List<Object>> byField, MutationOp op) {
    return byField.computeIfAbsent(op.getField(), ignored -> new ArrayList<>());
  }

  private static List<FieldChange> asChanges(Map<String, List<Object>> byField, boolean added) {
    List<FieldChange> changes = new ArrayList<>();
    byField.forEach(
        (field, values) ->
            changes.add(
                added
                    ? new FieldChange().withName(field).withNewValue(values)
                    : new FieldChange().withName(field).withOldValue(values)));
    return changes;
  }
}
