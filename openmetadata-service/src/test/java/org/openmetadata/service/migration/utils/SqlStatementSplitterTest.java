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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Fixture tests for the statement-splitting semantics, which intentionally mirror the Flyway
 * parsers this class replaced: comments stay attached to the following statement, comment-only
 * chunks emit nothing, delimiters and surrounding whitespace are excluded.
 */
class SqlStatementSplitterTest {

  @Test
  void splitsPlainStatementsAndDropsDelimiter() {
    List<String> statements =
        SqlStatementSplitter.splitStatements(
            "CREATE TABLE a (id int);\nALTER TABLE a ADD COLUMN b int;\n", MYSQL);
    assertEquals(List.of("CREATE TABLE a (id int)", "ALTER TABLE a ADD COLUMN b int"), statements);
  }

  @Test
  void keepsFinalStatementWithoutTrailingDelimiter() {
    List<String> statements = SqlStatementSplitter.splitStatements("UPDATE t SET a = 1", POSTGRES);
    assertEquals(List.of("UPDATE t SET a = 1"), statements);
  }

  @Test
  void keepsLeadingAndInteriorCommentsAttachedToStatement() {
    String sql =
        """
        -- header comment
        -- another line
        ALTER TABLE a -- inline note
          ADD COLUMN b int;
        """;
    List<String> statements = SqlStatementSplitter.splitStatements(sql, MYSQL);
    assertEquals(
        List.of(
            "-- header comment\n-- another line\nALTER TABLE a -- inline note\n  ADD COLUMN b int"),
        statements);
  }

  @Test
  void keepsBlankLinesBetweenLeadingCommentsAndStatement() {
    String sql = "\n\n-- c1\n\n-- c2\nSTMT_B;\n\n";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, POSTGRES);
    assertEquals(List.of("-- c1\n\n-- c2\nSTMT_B"), statements);
  }

  @Test
  void sameLineCommentAfterDelimiterAttachesToNextStatement() {
    String sql = "STMT1; -- same-line note\nSTMT2;";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, POSTGRES);
    assertEquals(List.of("STMT1", "-- same-line note\nSTMT2"), statements);
  }

  @Test
  void dropsCommentOnlyAndEmptyChunks() {
    String sql = "-- only a comment\n;;\n/* block */\nCREATE TABLE a (id int);\n-- trailing\n";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, POSTGRES);
    assertEquals(List.of("/* block */\nCREATE TABLE a (id int)"), statements);
  }

  @Test
  void ignoresDelimitersInsideQuotedStrings() {
    String sql = "INSERT INTO t VALUES ('a;b', \"c;d\");\nUPDATE t SET j = '{\"k\": \";\"}';";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, MYSQL);
    assertEquals(2, statements.size());
    assertEquals("INSERT INTO t VALUES ('a;b', \"c;d\")", statements.get(0));
    assertEquals("UPDATE t SET j = '{\"k\": \";\"}'", statements.get(1));
  }

  @Test
  void handlesMysqlBackslashEscapesInsideStrings() {
    String sql = "UPDATE t SET a = 'it\\'s; fine', b = 'x';";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, MYSQL);
    assertEquals(List.of("UPDATE t SET a = 'it\\'s; fine', b = 'x'"), statements);
  }

  @Test
  void treatsBackslashLiterallyInPostgresStrings() {
    String sql = "UPDATE t SET a = 'ends with backslash \\';\nUPDATE t SET b = 1;";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, POSTGRES);
    assertEquals(
        List.of("UPDATE t SET a = 'ends with backslash \\'", "UPDATE t SET b = 1"), statements);
  }

  @Test
  void handlesPostgresEscapeStringPrefix() {
    String sql = "UPDATE t SET a = E'it\\'s; ok';";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, POSTGRES);
    assertEquals(List.of("UPDATE t SET a = E'it\\'s; ok'"), statements);
  }

  @Test
  void handlesDoubledQuotes() {
    String sql = "INSERT INTO t VALUES ('it''s; quoted');";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, POSTGRES);
    assertEquals(List.of("INSERT INTO t VALUES ('it''s; quoted')"), statements);
  }

  @Test
  void ignoresDelimitersInsideBacktickIdentifiers() {
    String sql = "SELECT `weird;name` FROM t;";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, MYSQL);
    assertEquals(List.of("SELECT `weird;name` FROM t"), statements);
  }

  @Test
  void handlesPostgresDollarQuotedBlocks() {
    String sql =
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1) THEN
            ALTER TABLE a ADD COLUMN b int;
          END IF;
        END $$;
        UPDATE t SET a = 1;
        """;
    List<String> statements = SqlStatementSplitter.splitStatements(sql, POSTGRES);
    assertEquals(2, statements.size());
    assertTrue(statements.get(0).startsWith("DO $$"));
    assertTrue(statements.get(0).endsWith("END $$"));
    assertEquals("UPDATE t SET a = 1", statements.get(1));
  }

  @Test
  void handlesTaggedDollarQuotes() {
    String sql = "UPDATE t SET body = $fn$ contains ; and $$ inside $fn$;";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, POSTGRES);
    assertEquals(List.of("UPDATE t SET body = $fn$ contains ; and $$ inside $fn$"), statements);
  }

  @Test
  void dollarSignWithoutTagIsNotAQuote() {
    String sql = "UPDATE t SET a = 'x' WHERE b = $1;";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, POSTGRES);
    assertEquals(List.of("UPDATE t SET a = 'x' WHERE b = $1"), statements);
  }

  @Test
  void handlesNestedBlockCommentsOnPostgres() {
    String sql = "/* outer /* inner ; */ still outer ; */ CREATE TABLE a (id int);";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, POSTGRES);
    assertEquals(
        List.of("/* outer /* inner ; */ still outer ; */ CREATE TABLE a (id int)"), statements);
  }

  @Test
  void mysqlBlockCommentsDoNotNest() {
    String sql = "SELECT 1 /* c1 /* not nested */ ;\nSELECT 2;";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, MYSQL);
    assertEquals(List.of("SELECT 1 /* c1 /* not nested */", "SELECT 2"), statements);
  }

  @Test
  void mysqlDoubleDashWithoutSpaceIsNotAComment() {
    String sql = "UPDATE t SET a = b--1;";
    assertEquals(
        List.of("UPDATE t SET a = b--1"), SqlStatementSplitter.splitStatements(sql, MYSQL));
    // PostgreSQL treats -- as a comment regardless: the delimiter is swallowed by the comment, so
    // the whole text is one undelimited statement with the comment text still attached.
    assertEquals(
        List.of("UPDATE t SET a = b--1;"), SqlStatementSplitter.splitStatements(sql, POSTGRES));
  }

  @Test
  void handlesMysqlHashComments() {
    String sql = "# header\nSELECT 1; # trailing note\nSELECT 2;";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, MYSQL);
    assertEquals(List.of("# header\nSELECT 1", "# trailing note\nSELECT 2"), statements);
  }

  /**
   * Silently splitting a procedure body on its interior semicolons would execute broken fragments,
   * so the unsupported directive has to fail loudly.
   */
  @Test
  void mysqlDelimiterDirectiveIsRejected() {
    String sql =
        """
        DELIMITER $$
        CREATE PROCEDURE p()
        BEGIN
          SELECT 1;
        END$$
        DELIMITER ;
        """;
    IllegalArgumentException failure =
        assertThrows(
            IllegalArgumentException.class, () -> SqlStatementSplitter.splitStatements(sql, MYSQL));
    assertTrue(failure.getMessage().contains("DELIMITER"));
  }

  @Test
  void delimiterAsAnOrdinaryIdentifierIsNotRejected() {
    List<String> statements =
        SqlStatementSplitter.splitStatements("UPDATE t SET delimiter = ',' WHERE id = 1;", MYSQL);
    assertEquals(List.of("UPDATE t SET delimiter = ',' WHERE id = 1"), statements);
  }

  @Test
  void dropsCommentOnlyTrailingChunk() {
    String sql = "STMT_F;\n-- trailing comment only\n";
    List<String> statements = SqlStatementSplitter.splitStatements(sql, MYSQL);
    assertEquals(List.of("STMT_F"), statements);
  }
}
