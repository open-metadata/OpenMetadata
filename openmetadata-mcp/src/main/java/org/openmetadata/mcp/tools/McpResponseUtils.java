package org.openmetadata.mcp.tools;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;

public final class McpResponseUtils {
  private static final Set<String> NOISE_FIELDS =
      Set.of(
          "version",
          "updatedAt",
          "updatedBy",
          "changeDescription",
          "incrementalChangeDescription",
          "followers",
          "votes",
          "sourceHash");

  private static final String CREATED = "created";
  private static final String UPDATED = "updated";
  private static final String OPERATION_KEY = "_operation";
  private static final String DELETED_KEY = "deleted";

  private McpResponseUtils() {}

  public static Map<String, Object> compact(EntityInterface entity, EventType changeType) {
    Map<String, Object> doc = JsonUtils.getMap(entity);
    NOISE_FIELDS.forEach(doc::remove);
    if (Boolean.FALSE.equals(doc.get(DELETED_KEY))) {
      doc.remove(DELETED_KEY);
    }
    doc.put(OPERATION_KEY, EventType.ENTITY_CREATED.equals(changeType) ? CREATED : UPDATED);
    return doc;
  }
}
