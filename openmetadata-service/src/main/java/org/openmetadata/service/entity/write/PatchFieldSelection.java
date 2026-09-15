package org.openmetadata.service.entity.write;

import java.util.Set;
import org.openmetadata.service.Entity;

/** Matches PATCH projections against the nested field paths used by change tracking. */
public final class PatchFieldSelection {
  private PatchFieldSelection() {}

  public static boolean shouldCompare(final Set<String> patchedFields, final String fieldName) {
    if (patchedFields == null || fieldName == null || patchedFields.contains(fieldName)) {
      return true;
    }
    final int separator = fieldName.indexOf(Entity.SEPARATOR);
    if (separator > 0 && patchedFields.contains(fieldName.substring(0, separator))) {
      return true;
    }
    for (final String patchedField : patchedFields) {
      if (fieldName.startsWith(patchedField + Entity.SEPARATOR)
          || patchedField.startsWith(fieldName + Entity.SEPARATOR)) {
        return true;
      }
    }
    return false;
  }
}
