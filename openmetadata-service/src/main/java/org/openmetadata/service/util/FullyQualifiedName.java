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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL;
import static org.openmetadata.service.Entity.TABLE;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.antlr.v4.runtime.BailErrorStrategy;
import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;
import org.antlr.v4.runtime.misc.ParseCancellationException;
import org.antlr.v4.runtime.tree.ParseTreeWalker;
import org.openmetadata.schema.FqnBaseListener;
import org.openmetadata.schema.FqnLexer;
import org.openmetadata.schema.FqnParser;
import org.openmetadata.schema.FqnParser.FqnContext;
import org.openmetadata.schema.FqnParser.QuotedNameContext;
import org.openmetadata.schema.FqnParser.UnquotedNameContext;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;

public class FullyQualifiedName {
  // Quoted name of format "sss" or unquoted string sss
  private static final Pattern namePattern = Pattern.compile("^(\")([^\"]+)(\")$|^(.*)$");

  private FullyQualifiedName() {
    /* Utility class with private constructor */
  }

  /** Add to an existing valid FQN the given string */
  public static String add(String fqn, String part) {
    return fqn + Entity.SEPARATOR + quoteName(part);
  }

  /** From the given set of string, build FQN. */
  public static String build(String... strings) {
    List<String> list = new ArrayList<>();
    for (String string : strings) {
      list.add(quoteName(string));
    }
    return String.join(Entity.SEPARATOR, list);
  }

  public static String buildHash(String... strings) {
    List<String> list = new ArrayList<>();
    for (String string : strings) {
      list.add(EntityUtil.hash(quoteName(string)));
    }
    return String.join(Entity.SEPARATOR, list);
  }

  public static String buildHash(String fullyQualifiedName) {
    if (fullyQualifiedName != null && !fullyQualifiedName.isEmpty()) {
      String[] split = split(fullyQualifiedName);
      return buildHash(split);
    }
    return fullyQualifiedName;
  }

  public static String[] split(String string) {
    SplitListener listener = new SplitListener();
    walk(string, listener);
    return listener.split();
  }

  private static <L extends FqnBaseListener> void walk(String string, L listener) {
    FqnLexer fqnLexer = new FqnLexer(CharStreams.fromString(string));
    CommonTokenStream tokens = new CommonTokenStream(fqnLexer);
    FqnParser fqnParser = new FqnParser(tokens);
    fqnParser.setErrorHandler(new BailErrorStrategy());
    FqnContext fqn = fqnParser.fqn();
    ParseTreeWalker walker = new ParseTreeWalker();
    walker.walk(listener, fqn);
  }

  public static String getParentFQN(String fqn) {
    // Split fqn of format a.b.c.d and return the parent a.b.c
    String[] split = split(fqn);
    return getParentFQN(split);
  }

  public static String getParentFQN(String... fqnParts) {
    // Fqn parts a b c d are given from fqn a.b.c.d
    if (fqnParts.length <= 1) {
      return null;
    }
    if (fqnParts.length == 2) {
      return fqnParts[0];
    }

    String parent = build(fqnParts[0]);
    for (int i = 1; i < fqnParts.length - 1; i++) {
      parent = add(parent, fqnParts[i]);
    }
    return parent;
  }

  public static String getRoot(String fqn) {
    // Split fqn of format a.b.c.d and return the root a
    String[] split = split(fqn);
    if (split.length <= 1) {
      return null;
    }
    return split[0];
  }

  public static boolean isParent(String childFqn, String parentFqn) {
    // Returns true if the childFqn is indeed the child of parentFqn
    // Adding "." ensures that we are checking for a true parent-child relationship
    // For example, "a.b.c" should be a child of "a.b" but  "a.b c" should not be a child of "a.b"
    return childFqn.startsWith(parentFqn + ".") && childFqn.length() > parentFqn.length();
  }

  private static class SplitListener extends FqnBaseListener {
    final List<String> list = new ArrayList<>();

    public String[] split() {
      return list.toArray(new String[0]);
    }

    @Override
    public void enterQuotedName(QuotedNameContext ctx) {
      list.add(ctx.getText());
    }

    @Override
    public void enterUnquotedName(UnquotedNameContext ctx) {
      list.add(ctx.getText());
    }
  }

  /**
   * Encodes a raw name into its FQN-segment form. Names containing the reserved separator '.'
   * or a '"' are wrapped in quotes, with any internal '"' escaped by doubling it (""), matching
   * the Fqn grammar. Names that are already in valid quoted form are returned unchanged (idempotent),
   * and quoted names that no longer need quoting are unquoted.
   */
  public static String quoteName(String name) {
    validateName(name);
    if (isQuotedName(name)) {
      String unquotedName = decodeQuotedName(name);
      return needsQuoting(unquotedName) ? name : unquotedName;
    }
    return needsQuoting(name) ? "\"" + name.replace("\"", "\"\"") + "\"" : name;
  }

  /** Decodes an FQN-segment form back into its raw name, removing quotes and unescaping "". */
  public static String unquoteName(String name) {
    validateName(name);
    return isQuotedName(name) ? decodeQuotedName(name) : name;
  }

  /**
   * Verifies that a name can be safely encoded into and parsed back out of a fully qualified name.
   * Nested objects (table columns, pipeline tasks, topic/searchIndex/apiEndpoint fields, mlFeatures)
   * carry FQNs derived from their {@code name} but are not hash-validated at insert time, so a name
   * that cannot round-trip would persist silently and only fail later when its FQN is hashed (e.g. on
   * a tags read). Calling this at write time rejects such names up front with a clear error. A
   * null or empty name is rejected too: it yields an empty FQN segment ({@code parent.}) that cannot
   * be parsed or hashed.
   */
  public static void validateFqnName(String name) {
    boolean valid;
    if (nullOrEmpty(name)) {
      valid = false;
    } else {
      String segment = quoteName(name);
      valid = segment.equals(name) || roundTripsAsSegment(name, segment);
    }
    if (!valid) {
      throw new IllegalArgumentException(CatalogExceptionMessage.invalidName(name));
    }
  }

  private static boolean roundTripsAsSegment(String name, String segment) {
    boolean roundTrips;
    try {
      String[] parts = split(segment);
      roundTrips = parts.length == 1 && unquoteName(parts[0]).equals(name);
    } catch (ParseCancellationException e) {
      roundTrips = false;
    }
    return roundTrips;
  }

  /**
   * Returns true if the given fully qualified name can be parsed (and therefore hashed). Legacy
   * FQNs produced before the quote-escaping fix do not parse; callers can use this to detect and
   * repair them on the fly instead of failing.
   */
  public static boolean isValid(String fullyQualifiedName) {
    boolean valid;
    if (nullOrEmpty(fullyQualifiedName)) {
      valid = false;
    } else {
      try {
        split(fullyQualifiedName);
        valid = true;
      } catch (ParseCancellationException e) {
        valid = false;
      }
    }
    return valid;
  }

  private static void validateName(String name) {
    if (name == null) {
      throw new IllegalArgumentException(CatalogExceptionMessage.invalidName(name));
    }
    Matcher matcher = namePattern.matcher(name);
    if (!matcher.find() || matcher.end() != name.length()) {
      throw new IllegalArgumentException(CatalogExceptionMessage.invalidName(name));
    }
  }

  private static boolean needsQuoting(String rawName) {
    return rawName.contains(".") || rawName.contains("\"");
  }

  private static boolean isQuotedName(String name) {
    if (name.length() < 2 || name.charAt(0) != '"' || name.charAt(name.length() - 1) != '"') {
      return false;
    }
    String body = name.substring(1, name.length() - 1);
    return !body.replace("\"\"", "").contains("\"");
  }

  private static String decodeQuotedName(String name) {
    return name.substring(1, name.length() - 1).replace("\"\"", "\"");
  }

  public static String getTableFQN(String columnFQN) {
    // Split columnFQN of format databaseServiceName.databaseName.tableName.columnName
    String[] split = split(columnFQN);
    // column FQN for struct columns are of format
    // service.database.schema.table.column.child1.child2
    // and not service.database.schema.table."column.child1.child2" so split length should be 5 or
    // more
    if (split.length < 5) {
      throw new IllegalArgumentException("Invalid fully qualified column name " + columnFQN);
    }
    // Return table FQN of format databaseService.tableName
    return build(split[0], split[1], split[2], split[3]);
  }

  public static String getColumnName(String columnFQN) {
    return FullyQualifiedName.split(columnFQN)[4]; // Get from column name from FQN
  }

  /**
   * Generates all possible FQN parts for search and matching purposes.
   * For example, given FQN "service.database.schema.table", this method generates:
   * - Full hierarchy: "service", "service.database", "service.database.schema", "service.database.schema.table"
   * - Individual parts: "service", "database", "schema", "table"
   * - Bottom-up combinations: "database.schema.table", "schema.table", "table"
   */
  public static Set<String> getAllParts(String fqn) {
    var parts = split(fqn);
    var fqnParts = new HashSet<String>();

    // Generate all possible sub-paths
    for (int start = 0; start < parts.length; start++) {
      for (int end = start + 1; end <= parts.length; end++) {
        var subPath =
            String.join(Entity.SEPARATOR, java.util.Arrays.copyOfRange(parts, start, end));
        fqnParts.add(subPath);
      }
    }

    return fqnParts;
  }

  /**
   * Generates hierarchical FQN parts from root to the full FQN.
   * For example, given FQN "service.database.schema.table", this method generates:
   * ["service", "service.database", "service.database.schema", "service.database.schema.table"]
   */
  public static List<String> getHierarchicalParts(String fqn) {
    var parts = split(fqn);
    return java.util.stream.IntStream.rangeClosed(1, parts.length)
        .mapToObj(i -> String.join(Entity.SEPARATOR, java.util.Arrays.copyOfRange(parts, 0, i)))
        .toList();
  }

  /**
   * Gets all ancestor FQNs for a given FQN.
   * For example, given FQN "service.database.schema.table", this method returns:
   * ["service.database.schema", "service.database", "service"]
   */
  public static List<String> getAncestors(String fqn) {
    var parts = split(fqn);
    return java.util.stream.IntStream.range(1, parts.length)
        .mapToObj(
            i ->
                String.join(
                    Entity.SEPARATOR, java.util.Arrays.copyOfRange(parts, 0, parts.length - i)))
        .toList();
  }

  /**
   * Split columnFQN of format serviceName.model.dataModelName.columnName
   * column FQN for struct columns are of format
   * serviceName.model.dataModelName.column.child1.child2
   * and not serviceName.model.dataModelName."column.child1.child2" so split length should be 4 or more
   * Return data model FQN of format serviceName.model.dataModelName
   *
   * @param columnFQN the FQN of the column
   * @return the FQN of the parent dashboard data model
   */
  public static String getDashboardDataModelFQN(String columnFQN) {
    String[] split = split(columnFQN);
    if (split.length < 4) {
      throw new IllegalArgumentException("Invalid dashboard data model column FQN: " + columnFQN);
    }
    // Return data model FQN of format serviceName.model.dataModelName
    return build(split[0], split[1], split[2]);
  }

  // Get parent entity fqn for a given column fqn
  public static String getParentEntityFQN(String columnFQN, String entityType) {
    return switch (entityType) {
      case TABLE -> getTableFQN(columnFQN);
      case DASHBOARD_DATA_MODEL -> getDashboardDataModelFQN(columnFQN);
      default -> throw new IllegalArgumentException("Unsupported entity type: " + entityType);
    };
  }
}
