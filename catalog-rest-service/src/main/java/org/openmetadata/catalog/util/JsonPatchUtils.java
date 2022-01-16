package org.openmetadata.catalog.util;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import javax.json.JsonPatch;
import org.openmetadata.catalog.type.MetadataOperation;

public class JsonPatchUtils {
  private JsonPatchUtils() {}

  public static List<MetadataOperation> getMetadataOperations(JsonPatch jsonPatch) {
    return jsonPatch.toJsonArray().stream()
        .map(JsonPatchUtils::getMetadataOperation)
        .filter(Objects::nonNull)
        .collect(Collectors.toList());
  }

  private static MetadataOperation getMetadataOperation(Object jsonPatchObject) {
    Map<String, Object> jsonPatchMap = JsonUtils.getMap(jsonPatchObject);
    String path = jsonPatchMap.get("path").toString();

    // To get operation, use the following:
    // JsonPatch.Operation op =  JsonPatch.Operation.fromOperationName(jsonPatchMap.get("op").toString());

    if (path.contains("description")) {
      return MetadataOperation.UpdateDescription;
    }
    if (path.contains("tags")) {
      return MetadataOperation.UpdateTags;
    }
    if (path.contains("owner")) {
      return MetadataOperation.UpdateOwner;
    }
    return null;
  }
}
