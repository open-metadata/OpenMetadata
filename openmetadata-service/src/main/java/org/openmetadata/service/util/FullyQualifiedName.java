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

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.antlr.v4.runtime.BailErrorStrategy;
import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;
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

  public static String getParent(String fqn) {
    // Split fqn of format a.b.c.d and return the parent a.b.c
    String[] split = split(fqn);
    return getParent(split);
  }

  public static String getParent(String... fqnParts) {
    // Fqn parts a b c d are given from fqn a.b.c.d
    if (fqnParts.length <= 1) {
      return null;
    }
    if (fqnParts.length == 2) {
      return unquoteName(fqnParts[0]); // The root name is not quoted and only the unquoted name is returned
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
    return childFqn.startsWith(parentFqn) && childFqn.length() > parentFqn.length();
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

  /** Adds quotes to name as required */
  public static String quoteName(String name) {
    Matcher matcher = namePattern.matcher(name);
    if (!matcher.find() || matcher.end() != name.length()) {
      throw new IllegalArgumentException(CatalogExceptionMessage.invalidName(name));
    }

    // Name matches quoted string "sss".
    // If quoted string does not contain "." return unquoted sss, else return quoted "sss"
    if (matcher.group(1) != null) {
      String unquotedName = matcher.group(2);
      return unquotedName.contains(".") ? name : unquotedName;
    }

    // Name matches unquoted string sss
    // If unquoted string contains ".", return quoted "sss", else unquoted sss
    String unquotedName = matcher.group(4);
    if (!unquotedName.contains("\"")) {
      return unquotedName.contains(".") ? "\"" + name + "\"" : unquotedName;
    }
    throw new IllegalArgumentException(CatalogExceptionMessage.invalidName(name));
  }

  /** Adds quotes to name as required */
  public static String unquoteName(String name) {
    Matcher matcher = namePattern.matcher(name);
    if (!matcher.find() || matcher.end() != name.length()) {
      throw new IllegalArgumentException(CatalogExceptionMessage.invalidName(name));
    }

    // Name matches quoted string "sss".
    // If quoted string does not contain "." return unquoted sss, else return quoted "sss"
    if (matcher.group(1) != null) {
      return matcher.group(2);
    }
    return name;
  }

  public static String getTableFQN(String columnFQN) {
    // Split columnFQN of format databaseServiceName.databaseName.tableName.columnName
    String[] split = split(columnFQN);
    if (split.length != 5) {
      throw new IllegalArgumentException("Invalid fully qualified column name " + columnFQN);
    }
    // Return table FQN of format databaseService.tableName
    return build(split[0], split[1], split[2], split[3]);
  }

  public static String getColumnName(String columnFQN) {
    return FullyQualifiedName.split(columnFQN)[4]; // Get from column name from FQN
  }
}
