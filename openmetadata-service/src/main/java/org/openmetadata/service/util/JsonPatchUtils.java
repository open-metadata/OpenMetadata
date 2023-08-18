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

import static org.openmetadata.common.utils.CommonUtil.listOf;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.json.JsonPatch;
import javax.json.JsonValue;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.ResourceRegistry;

@Slf4j
public class JsonPatchUtils {
  private JsonPatchUtils() {}

  public static List<MetadataOperation> getMetadataOperations(JsonPatch jsonPatch) {
    Set<MetadataOperation> uniqueValues = new HashSet<>();
    for (JsonValue jsonValue : jsonPatch.toJsonArray()) {
      MetadataOperation metadataOperation = getMetadataOperation(jsonValue);
      if (metadataOperation.equals(MetadataOperation.EDIT_ALL)) {
        return listOf(MetadataOperation.EDIT_ALL); // No need to process each individual edit operation
      }
      uniqueValues.add(metadataOperation);
    }
    LOG.debug("Returning patch operations {}", Arrays.toString(uniqueValues.toArray()));
    return new ArrayList<>(uniqueValues);
  }

  public static MetadataOperation getMetadataOperation(Object jsonPatchObject) {
    // JsonPatch operation example - {"op":"add","path":"/defaultRoles/0","value"..."}
    Map<String, Object> jsonPatchMap = JsonUtils.getMap(jsonPatchObject);
    String path = jsonPatchMap.get("path").toString(); // Get "path" node - "/defaultRoles/0"
    return getMetadataOperation(path);
  }

  public static MetadataOperation getMetadataOperation(String path) {
    String[] fields = ResourceRegistry.getEditableFields(); // Get editable fields of an entity
    for (String field : fields) {
      if (path.contains(field)) { // If path contains the editable field
        return ResourceRegistry.getEditOperation(field); // Return the corresponding operation
      }
    }
    LOG.warn("Failed to find specific operation for patch path {}", path);
    return MetadataOperation.EDIT_ALL; // If path is not mapped to any edit field, then return edit all
  }
}
