package org.openmetadata.mcp.tools;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
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
  private static final String VERSION_KEY = "version";
  private static final String CHANGED_KEY = "changed";
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

  /**
   * {@link #compact} plus the two things only an update can answer: the new version, and which
   * fields actually changed.
   *
   * <p>{@link #compact} strips {@code changeDescription} because it is noise on a create - nothing
   * changed, the entity is new. On a patch it is the confirmation the caller wrote for. Only the
   * field names are kept: the full object carries old and new values for every field, far more than
   * "did my change land" needs.
   */
  public static Map<String, Object> compactPatch(EntityInterface entity, EventType changeType) {
    Map<String, Object> doc = compact(entity, changeType);
    doc.put(VERSION_KEY, entity.getVersion());
    List<String> changed = changedFields(entity.getChangeDescription());
    if (!changed.isEmpty()) {
      doc.put(CHANGED_KEY, changed);
    }
    return doc;
  }

  private static List<String> changedFields(ChangeDescription change) {
    Set<String> names = new LinkedHashSet<>();
    if (change != null) {
      collectNames(change.getFieldsAdded(), names);
      collectNames(change.getFieldsUpdated(), names);
      collectNames(change.getFieldsDeleted(), names);
    }
    return new ArrayList<>(names);
  }

  private static void collectNames(List<FieldChange> changes, Set<String> names) {
    if (changes != null) {
      changes.stream().map(FieldChange::getName).filter(Objects::nonNull).forEach(names::add);
    }
  }
}
