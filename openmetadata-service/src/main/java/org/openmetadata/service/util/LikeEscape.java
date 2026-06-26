/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 */

package org.openmetadata.service.util;

/**
 * Escape a string so it can be embedded inside a SQL {@code LIKE} pattern as a literal.
 * Caller must declare {@code ESCAPE '!'} in the SQL — bang is the convention already used by
 * {@code ContainerRepository#buildNameLikeBind}. Backslash is unsafe here because MySQL
 * treats backslash as a string-literal escape (so {@code ESCAPE '\'} parses as an
 * unterminated string), and JDBI's ColonPrefixSqlParser additionally mishandles literal
 * {@code '\'} inside single-quoted SQL strings.
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
    return value.replace("!", "!!").replace("%", "!%").replace("_", "!_");
  }
}
