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
package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.lineage.LineageSceneMapper.lastFqnPart;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.api.lineage.LineageSceneField;

/** Per-asset field indexes, owned by one scene rather than retained between requests. */
final class LineageSceneFieldIndex {
  private final List<LineageSceneField> fields;
  private final Map<String, String> idsByExactValue = new LinkedHashMap<>();
  private final Map<String, String> idsByName = new LinkedHashMap<>();

  LineageSceneFieldIndex(List<LineageSceneField> fields, boolean indexEndpoints) {
    this.fields = fields;
    if (indexEndpoints) {
      for (LineageSceneField field : fields) {
        addField(field);
      }
    }
  }

  List<LineageSceneField> fields() {
    return fields;
  }

  String endpoint(String column) {
    String exact = idsByExactValue.get(column);
    if (exact != null) {
      return exact;
    }
    String name = idsByName.get(column);
    return name == null ? idsByName.getOrDefault(lastFqnPart(column), column) : name;
  }

  private void addField(LineageSceneField field) {
    idsByExactValue.putIfAbsent(field.getId(), field.getId());
    if (!nullOrEmpty(field.getFullyQualifiedName())) {
      idsByExactValue.putIfAbsent(field.getFullyQualifiedName(), field.getId());
    }
    idsByName.putIfAbsent(field.getName(), field.getId());
  }
}
