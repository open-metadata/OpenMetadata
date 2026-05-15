/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 */

package org.openmetadata.service.util;

/**
 * Escape a string so it can be embedded inside a SQL {@code LIKE} pattern as a literal.
 * Caller must declare {@code ESCAPE '\'} in the SQL — both MySQL and PostgreSQL honor that.
 *
 * <p>Required because table and column FQNs can legitimately contain {@code _} or {@code %},
 * which are LIKE wildcards. Without escaping, a table named {@code my_table} would also match
 * {@code myXtable} via the prefix query.
 */
public final class LikeEscape {

  private LikeEscape() {}

  public static String escape(String value) {
    if (value == null) {
      return null;
    }
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
  }
}
