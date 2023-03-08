/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.util;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import javax.json.JsonPatch;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.ResourceRegistry;

public class JsonPatchUtils {
  private JsonPatchUtils() {}

  public static List<MetadataOperation> getMetadataOperations(JsonPatch jsonPatch) {
    return jsonPatch.toJsonArray().stream()
        .map(JsonPatchUtils::getMetadataOperation)
        .distinct()
        .filter(Objects::nonNull)
        .collect(Collectors.toList());
  }

  private static MetadataOperation getMetadataOperation(Object jsonPatchObject) {
    Map<String, Object> jsonPatchMap = JsonUtils.getMap(jsonPatchObject);
    String path = jsonPatchMap.get("path").toString();
    String[] fields = ResourceRegistry.getEditableFields();
    for (String field : fields) {
      if (path.contains(field)) {
        return ResourceRegistry.getEditOperation(field);
      }
    }
    return null;
  }
}
