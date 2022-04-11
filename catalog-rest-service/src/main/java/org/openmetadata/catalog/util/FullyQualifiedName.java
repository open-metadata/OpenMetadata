package org.openmetadata.catalog.util;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.antlr.v4.runtime.BailErrorStrategy;
import org.antlr.v4.runtime.CharStreams;
import org.antlr.v4.runtime.CommonTokenStream;
import org.antlr.v4.runtime.tree.ParseTreeWalker;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.FqnBaseListener;
import org.openmetadata.catalog.FqnLexer;
import org.openmetadata.catalog.FqnParser;
import org.openmetadata.catalog.FqnParser.FqnContext;
import org.openmetadata.catalog.FqnParser.QuotedNameContext;
import org.openmetadata.catalog.FqnParser.UnquotedNameContext;

public class FullyQualifiedName {

  // Match any reserved char
  private static final Pattern reserved = Pattern.compile("[.\"]");

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

  private static class SplitListener extends FqnBaseListener {
    List<String> list = new ArrayList<>();

    public String[] split() {
      return list.toArray(new String[list.size()]);
    }

    @Override
    public void enterQuotedName(QuotedNameContext ctx) {
      list.add(unquoteName(ctx.getText()));
    }

    @Override
    public void enterUnquotedName(UnquotedNameContext ctx) {
      list.add(ctx.getText());
    }
  }

  /** Adds quotes to name as required */
  public static String quoteName(String name) {
    if (reserved.matcher(name).find()) {
      return "\"" + name.replace("\"", "\"\"") + "\"";
    } else {
      return name;
    }
  }

  public static String unquoteName(String name) {
    return name.replaceAll("^\"|\"$", "").replace("\"\"", "\"");
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

  public static String getServiceName(String fqn) {
    return split(fqn)[0];
  }

  public static String getColumnName(String columnFQN) {
    return FullyQualifiedName.split(columnFQN)[4]; // Get from column name from FQN
  }
}
