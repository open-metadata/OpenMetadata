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
package org.openmetadata.service.migration.utils;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Splits a migration SQL script into individual statements, replacing the Flyway parsers that were
 * previously used only for this purpose.
 *
 * <p>Statement boundaries are top-level {@code ;} delimiters. The splitter understands, per
 * dialect: {@code --} line comments (MySQL additionally {@code #}, and requires whitespace after
 * {@code --}), {@code /* *}{@code /} block comments (nested on PostgreSQL), single-quoted strings
 * ({@code ''} doubling everywhere; backslash escapes on MySQL and in PostgreSQL {@code E''}
 * strings), double-quoted strings/identifiers, MySQL backtick identifiers, and PostgreSQL
 * dollar-quoting ({@code $$ … $$}, {@code $tag$ … $tag$}).
 *
 * <p>Emitted statement text intentionally matches what the Flyway parser produced for the same
 * input — comments (leading and interior) stay attached to the statement that follows them,
 * leading/trailing whitespace and the trailing delimiter are excluded, comment-only chunks emit
 * nothing — because per-statement MD5 checksums recorded in SERVER_MIGRATION_SQL_LOGS must keep
 * matching for already-applied migrations.
 *
 * <p>Deliberately unsupported: MySQL {@code DELIMITER} redefinition (stored
 * procedure/function/trigger bodies). Splitting such a script on its interior semicolons would
 * produce fragments that execute as broken SQL, so encountering the directive throws rather than
 * silently corrupting the migration.
 */
public final class SqlStatementSplitter {

  /** {@code DELIMITER} as a line-leading client directive, not the word inside some expression. */
  private static final Pattern DELIMITER_DIRECTIVE =
      Pattern.compile("(?im)^[ \\t]*DELIMITER[ \\t]+\\S");

  private SqlStatementSplitter() {}

  public static List<String> splitStatements(String sql, ConnectionType connectionType) {
    List<String> statements = new Splitter(sql, connectionType).splitAll();
    if (connectionType == ConnectionType.MYSQL) {
      statements.forEach(SqlStatementSplitter::rejectDelimiterDirective);
    }
    return statements;
  }

  /**
   * A {@code DELIMITER} line is a client directive, not SQL: the server rejects it, and its purpose
   * is to change how the rest of the file is split — which this splitter does not honour. Failing
   * here turns an unsupported script into an obvious error instead of a half-applied migration.
   */
  private static void rejectDelimiterDirective(String statement) {
    if (DELIMITER_DIRECTIVE.matcher(statement).find()) {
      throw new IllegalArgumentException(
          "Migration SQL uses the MySQL DELIMITER directive, which is not supported —"
              + " express stored procedure/trigger logic as a Java migration instead. Statement: "
              + statement.substring(0, Math.min(statement.length(), 120)));
    }
  }

  public static List<String> splitFile(Path file, ConnectionType connectionType) {
    try {
      String content = Files.readString(file, StandardCharsets.UTF_8);
      return splitStatements(stripByteOrderMark(content), connectionType);
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to read SQL file: " + file, e);
    }
  }

  private static String stripByteOrderMark(String content) {
    String result = content;
    if (!content.isEmpty() && content.charAt(0) == '﻿') {
      result = content.substring(1);
    }
    return result;
  }

  private static final class Splitter {
    private static final char STATEMENT_DELIMITER = ';';

    private final String text;
    private final boolean mysql;
    private final StringBuilder current = new StringBuilder();
    private final List<String> statements = new ArrayList<>();
    private int pos;

    private Splitter(String text, ConnectionType connectionType) {
      this.text = text;
      this.mysql = connectionType == ConnectionType.MYSQL;
    }

    private List<String> splitAll() {
      while (pos < text.length()) {
        consumeNext();
      }
      finishStatement();
      return statements;
    }

    private void consumeNext() {
      char c = text.charAt(pos);
      if (c == STATEMENT_DELIMITER) {
        pos++;
        finishStatement();
      } else if (atLineComment()) {
        consumeLineComment();
      } else if (atBlockCommentStart()) {
        consumeBlockComment();
      } else if (c == '\'') {
        consumeQuoted('\'', singleQuoteUsesBackslash());
      } else if (c == '"') {
        consumeQuoted('"', mysql);
      } else if (mysql && c == '`') {
        consumeQuoted('`', false);
      } else if (!mysql && c == '$' && dollarQuoteTagLength() > 0) {
        consumeDollarQuoted();
      } else {
        appendCurrentChar();
      }
    }

    private void appendCurrentChar() {
      if (pos < text.length()) {
        current.append(text.charAt(pos));
        pos++;
      }
    }

    private boolean atLineComment() {
      boolean result = mysql && charAt(pos) == '#';
      if (!result && charAt(pos) == '-' && charAt(pos + 1) == '-') {
        // MySQL requires whitespace (or end of line) after "--"; PostgreSQL does not.
        result = !mysql || isLineCommentTerminator(charAt(pos + 2));
      }
      return result;
    }

    private boolean isLineCommentTerminator(char c) {
      return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\0';
    }

    private void consumeLineComment() {
      while (pos < text.length() && text.charAt(pos) != '\n') {
        appendCurrentChar();
      }
    }

    private boolean atBlockCommentStart() {
      return charAt(pos) == '/' && charAt(pos + 1) == '*';
    }

    private void consumeBlockComment() {
      int depth = 0;
      do {
        if (atBlockCommentStart()) {
          depth = advanceBlockCommentDepth(depth, 1);
        } else if (charAt(pos) == '*' && charAt(pos + 1) == '/') {
          depth = advanceBlockCommentDepth(depth, -1);
        } else {
          appendCurrentChar();
        }
        // MySQL comments do not nest: any "/*" inside is plain text, so depth stays at 1.
      } while (depth > 0 && pos < text.length());
    }

    private int advanceBlockCommentDepth(int depth, int delta) {
      int result = depth;
      if (delta > 0 && (depth == 0 || !mysql)) {
        result = depth + 1;
      } else if (delta < 0) {
        result = depth - 1;
      }
      appendCurrentChar();
      appendCurrentChar();
      return result;
    }

    private boolean singleQuoteUsesBackslash() {
      // PostgreSQL treats backslash literally except in E'…' strings
      // (standard_conforming_strings, which the Flyway parser also assumes).
      return mysql || isEscapeStringPrefix();
    }

    private boolean isEscapeStringPrefix() {
      boolean result = false;
      char prefix = charAt(pos - 1);
      if (prefix == 'E' || prefix == 'e') {
        result = !isIdentifierChar(charAt(pos - 2));
      }
      return result;
    }

    private boolean isIdentifierChar(char c) {
      return Character.isLetterOrDigit(c) || c == '_';
    }

    private void consumeQuoted(char quote, boolean backslashEscapes) {
      appendCurrentChar();
      boolean closed = false;
      while (!closed && pos < text.length()) {
        char c = text.charAt(pos);
        if (backslashEscapes && c == '\\') {
          appendCurrentChar();
          appendCurrentChar();
        } else if (c == quote && charAt(pos + 1) == quote) {
          appendCurrentChar();
          appendCurrentChar();
        } else {
          closed = c == quote;
          appendCurrentChar();
        }
      }
    }

    /** Length of a valid dollar-quote tag ({@code $$} or {@code $tag$}) at pos, or 0. */
    private int dollarQuoteTagLength() {
      int end = pos + 1;
      while (end < text.length() && isTagChar(text.charAt(end))) {
        end++;
      }
      boolean valid = end < text.length() && text.charAt(end) == '$';
      return valid ? end - pos + 1 : 0;
    }

    private boolean isTagChar(char c) {
      return Character.isLetterOrDigit(c) || c == '_';
    }

    private void consumeDollarQuoted() {
      int tagLength = dollarQuoteTagLength();
      String tag = text.substring(pos, pos + tagLength);
      appendChars(tagLength);
      int close = text.indexOf(tag, pos);
      int consumeTo = close < 0 ? text.length() : close + tagLength;
      appendChars(consumeTo - pos);
    }

    private void appendChars(int count) {
      current.append(text, pos, pos + count);
      pos += count;
    }

    /** Returns the character at index, or {@code '\0'} when out of bounds. */
    private char charAt(int index) {
      return index >= 0 && index < text.length() ? text.charAt(index) : '\0';
    }

    /**
     * Matching the Flyway parser: leading/trailing whitespace is stripped, comments (leading and
     * interior alike) stay part of the statement text, and chunks containing nothing but comments
     * and whitespace produce no statement at all.
     */
    private void finishStatement() {
      String statement = current.toString().strip();
      current.setLength(0);
      if (hasExecutableContent(statement)) {
        statements.add(statement);
      }
    }

    private boolean hasExecutableContent(String statement) {
      boolean result = false;
      int index = 0;
      while (!result && index < statement.length()) {
        if (isLineCommentAt(statement, index)) {
          index = skipLineComment(statement, index);
        } else if (statement.startsWith("/*", index)) {
          index = skipBlockComment(statement, index);
        } else if (Character.isWhitespace(statement.charAt(index))) {
          index++;
        } else {
          result = true;
        }
      }
      return result;
    }

    private boolean isLineCommentAt(String statement, int index) {
      boolean result = mysql && statement.charAt(index) == '#';
      if (!result && statement.startsWith("--", index)) {
        result = !mysql || isLineCommentTerminator(charAtOrNul(statement, index + 2));
      }
      return result;
    }

    private int skipLineComment(String statement, int from) {
      int newline = statement.indexOf('\n', from);
      return newline < 0 ? statement.length() : newline + 1;
    }

    /** Skip past the block comment opening at {@code from}, nesting-aware on PostgreSQL. */
    private int skipBlockComment(String statement, int from) {
      int depth = 0;
      int index = from;
      int result = -1;
      while (result < 0 && index < statement.length() - 1) {
        if (statement.startsWith("/*", index) && (depth == 0 || !mysql)) {
          depth++;
          index += 2;
        } else if (statement.startsWith("*/", index)) {
          depth--;
          index += 2;
          result = depth == 0 ? index : result;
        } else {
          index++;
        }
      }
      return result < 0 ? statement.length() : result;
    }

    private char charAtOrNul(String statement, int index) {
      return index < statement.length() ? statement.charAt(index) : '\0';
    }
  }
}
