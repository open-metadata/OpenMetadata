package org.openmetadata.service.util;

import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_OWNER;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import javax.json.JsonPatch;
import org.openmetadata.schema.type.MetadataOperation;

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

    // TODO clean this up
    if (path.contains(FIELD_DESCRIPTION)) {
      return MetadataOperation.EDIT_DESCRIPTION;
    }
    if (path.contains(FIELD_DISPLAY_NAME)) {
      return MetadataOperation.EDIT_DISPLAY_NAME;
    }
    if (path.contains("tags")) {
      return MetadataOperation.EDIT_TAGS;
    }
    if (path.contains(FIELD_OWNER)) {
      return MetadataOperation.EDIT_OWNER;
    }
    if (path.startsWith("/users")) { // Ability to update users within a team.
      return MetadataOperation.EDIT_USERS;
    }
    return null;
  }
}
