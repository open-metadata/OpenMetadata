/*
 *  Copyright 2026 Collate
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
package org.openmetadata.it.tests;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jdbi.v3.core.Handle;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.testcontainers.containers.Container.ExecResult;
import org.testcontainers.containers.GenericContainer;

/**
 * Finds every Fernet token in the suite's database and Redis, with its own schema query and its own
 * token pattern. It shares nothing with the rotation command, so it can say what the command
 * missed: it reads every text, JSON and binary column of every base table in the current schema,
 * whether or not anyone listed it.
 */
final class FernetStoreScan {
  /** The server writes at least 107 characters per token; the pattern ignores shorter text. */
  static final Pattern TOKEN = Pattern.compile("fernet:(?:bound:)?[A-Za-z0-9_-]{80,}={0,2}");

  static final String REDIS = "redis";

  record Token(String store, String text) {
    /** The table of an SQL store, or {@code redis}. */
    String table() {
      int dot = store.indexOf('.');
      return dot < 0 ? store : store.substring(0, dot);
    }
  }

  record Column(String table, String name, boolean binary) {}

  record Scan(List<Token> tokens) {
    /** The SQL tokens as sorted lines: equal fingerprints mean no cell holding a token changed. */
    List<String> sqlFingerprint() {
      return tokens.stream()
          .filter(token -> !REDIS.equals(token.store()))
          .map(token -> token.store() + "|" + token.text())
          .sorted()
          .toList();
    }
  }

  private static final String MYSQL_TYPES =
      "'json','char','varchar','tinytext','text','mediumtext','longtext','binary','varbinary',"
          + "'tinyblob','blob','mediumblob','longblob'";
  private static final String POSTGRES_TYPES =
      "'json','jsonb','text','character varying','character','bytea'";
  private static final Set<String> MYSQL_BINARY =
      Set.of("binary", "varbinary", "tinyblob", "blob", "mediumblob", "longblob");

  private FernetStoreScan() {}

  static Scan take(boolean withRedis) {
    List<Token> tokens = new ArrayList<>();
    boolean mysql = TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL;
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              for (Column column : columns(handle, mysql)) {
                readHits(handle, column, mysql, tokens);
              }
            });
    if (withRedis && TestSuiteBootstrap.isRedisEnabled()) {
      tokens.addAll(redisTokens());
    }
    return new Scan(List.copyOf(tokens));
  }

  private static final String POSTGRES_EXCLUDE_PARTITIONS =
      " AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class pc"
          + " JOIN pg_catalog.pg_namespace pn ON pn.oid = pc.relnamespace"
          + " WHERE pn.nspname = t.table_schema AND pc.relname = t.table_name"
          + " AND pc.relispartition)";

  static List<String> tables() {
    boolean mysql = TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL;
    String schema = mysql ? "DATABASE()" : "current_schema()";
    String partitionFilter = mysql ? "" : POSTGRES_EXCLUDE_PARTITIONS;
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT t.table_name AS tbl FROM information_schema.tables t"
                            + " WHERE t.table_schema = "
                            + schema
                            + " AND t.table_type = 'BASE TABLE'"
                            + partitionFilter)
                    .mapTo(String.class)
                    .list());
  }

  private static List<Column> columns(Handle handle, boolean mysql) {
    String schema = mysql ? "DATABASE()" : "current_schema()";
    String types = mysql ? MYSQL_TYPES : POSTGRES_TYPES;
    String partitionFilter = mysql ? "" : POSTGRES_EXCLUDE_PARTITIONS;
    return handle
        .createQuery(
            "SELECT c.table_name AS tbl, c.column_name AS col, c.data_type AS typ"
                + " FROM information_schema.columns c JOIN information_schema.tables t"
                + " ON t.table_schema = c.table_schema AND t.table_name = c.table_name"
                + " WHERE c.table_schema = "
                + schema
                + " AND t.table_type = 'BASE TABLE'"
                + partitionFilter
                + " AND c.data_type IN ("
                + types
                + ") ORDER BY c.table_name, c.ordinal_position")
        .map(
            (rs, ctx) -> {
              String type = rs.getString("typ").toLowerCase(Locale.ROOT);
              boolean binary = mysql ? MYSQL_BINARY.contains(type) : "bytea".equals(type);
              return new Column(rs.getString("tbl"), rs.getString("col"), binary);
            })
        .list();
  }

  private static void readHits(Handle handle, Column column, boolean mysql, List<Token> sink) {
    String quote = mysql ? "`" : "\"";
    String name = quote + column.name() + quote;
    String table = quote + column.table() + quote;
    String hit;
    if (column.binary()) {
      hit =
          mysql
              ? "LOCATE('fernet:', " + name + ") > 0"
              : "position('\\x6665726e65743a'::bytea in " + name + ") > 0";
    } else {
      hit =
          mysql ? "CAST(" + name + " AS CHAR) LIKE '%fernet:%'" : name + "::text LIKE '%fernet:%'";
    }
    List<String> values =
        handle
            .createQuery("SELECT " + name + " FROM " + table + " WHERE " + hit)
            .map(
                (rs, ctx) ->
                    column.binary()
                        ? new String(rs.getBytes(1), StandardCharsets.ISO_8859_1)
                        : rs.getString(1))
            .list();
    String store = column.table() + "." + column.name();
    for (String value : values) {
      extract(store, value, sink);
    }
  }

  private static void extract(String store, String text, List<Token> sink) {
    if (text == null) {
      return;
    }
    Matcher matcher = TOKEN.matcher(text);
    while (matcher.find()) {
      sink.add(new Token(store, matcher.group()));
    }
  }

  /** Every string and hash value under the suite's keyspace, read with the container's redis-cli. */
  private static List<Token> redisTokens() {
    String keyspace =
        TestSuiteBootstrap.createApplicationConfigCopy().getCacheConfig().redis.keyspace;
    String script =
        "redis-cli --scan --pattern '"
            + keyspace
            + ":*' | while IFS= read -r k; do t=$(redis-cli type \"$k\"); "
            + "case \"$t\" in string) redis-cli --raw get \"$k\";; hash) redis-cli --raw hgetall \"$k\";; esac; done";
    List<Token> tokens = new ArrayList<>();
    extract(REDIS, redis(script).getStdout(), tokens);
    return tokens;
  }

  /** The output of one {@code sh -c} script in the Redis container. */
  static ExecResult redis(String script) {
    GenericContainer<?> container = TestSuiteBootstrap.getRedisContainer();
    try {
      ExecResult result = container.execInContainer("sh", "-c", script);
      if (result.getExitCode() != 0) {
        throw new IllegalStateException("redis-cli script failed: " + result.getStderr());
      }
      return result;
    } catch (IOException failure) {
      throw new IllegalStateException("Cannot run redis-cli in the Redis container", failure);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while running redis-cli", interrupted);
    }
  }
}
