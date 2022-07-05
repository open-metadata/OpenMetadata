package org.openmetadata.catalog.util;

import static org.openmetadata.catalog.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.catalog.Entity.FIELD_OWNER;

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

    if (path.contains(FIELD_DESCRIPTION)) {
      return MetadataOperation.EDIT_DESCRIPTION;
    }
    if (path.contains("tags")) {
      return MetadataOperation.EDIT_TAGS;
    }
    if (path.contains(FIELD_OWNER)) {
      return MetadataOperation.EDIT_OWNER;
    }
    if (path.startsWith("/users")) { // Ability to update users within a team.
      return MetadataOperation.TEAM_EDIT_USERS;
    }
    return null;
  }
}
