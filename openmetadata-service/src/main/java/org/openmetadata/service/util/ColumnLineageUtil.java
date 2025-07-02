package org.openmetadata.service.util;

import java.util.*;
import org.openmetadata.schema.type.ColumnLineage;

/**
 * Utility helper for manipulating {@link ColumnLineage} entries when table columns are removed or
 * renamed. This class contains only pure functions, making it easy to unit-test in isolation.
 */
public final class ColumnLineageUtil {

  private ColumnLineageUtil() {}

  /**
   * Returns a defensively-copied list of {@link ColumnLineage} after applying deletions and renames.
   *
   * @param original Original list (may be {@code null}).
   * @param removed Fully-qualified column names that disappeared from the table.
   * @param renameMap Mapping {@code oldFQN -> newFQN}. When an entry exists the *old* FQN will be
   *     replaced with the *new* FQN on both the {@code fromColumns} and {@code toColumn} sides.
   * @return A new list with the transformation applied.
   */
  public static List<ColumnLineage> transform(
      List<ColumnLineage> original, Set<String> removed, Map<String, String> renameMap) {
    if (original == null || original.isEmpty()) {
      return Collections.emptyList();
    }

    List<ColumnLineage> result = new ArrayList<>();
    for (ColumnLineage cl : original) {
      String to = cl.getToColumn();
      // Skip if the downstream column was deleted
      if (removed.contains(to)) {
        continue;
      }
      // Replace if renamed
      if (renameMap.containsKey(to)) {
        to = renameMap.get(to);
      }

      List<String> newFrom = new ArrayList<>();
      for (String fc : cl.getFromColumns()) {
        if (removed.contains(fc)) {
          // Skip deleted upstream column
          continue;
        }
        if (renameMap.containsKey(fc)) {
          newFrom.add(renameMap.get(fc));
        } else {
          newFrom.add(fc);
        }
      }

      if (!newFrom.isEmpty()) {
        ColumnLineage copy = new ColumnLineage();
        copy.setToColumn(to);
        copy.setFromColumns(newFrom);
        result.add(copy);
      }
    }
    return result;
  }
}
