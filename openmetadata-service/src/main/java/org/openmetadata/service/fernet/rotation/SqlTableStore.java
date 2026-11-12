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

package org.openmetadata.service.fernet.rotation;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Spliterator;
import java.util.Spliterators;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Query;
import org.jdbi.v3.core.statement.SqlStatement;
import org.jdbi.v3.core.statement.Update;
import org.openmetadata.service.fernet.rotation.SqlCatalog.ColumnType;
import org.openmetadata.service.fernet.rotation.SqlCatalog.SqlColumn;
import org.openmetadata.service.fernet.rotation.SqlCatalog.SqlTable;

/**
 * One table. Pages walk the primary key {@value #PAGE_SIZE} rows at a time and return only the key
 * and one "holds {@code fernet:}" flag per eligible column, so each statement does bounded work
 * however rare tokens are; the text of flagged cells is then fetched by key, {@value #FETCH_BATCH}
 * rows at a time. A write is {@code UPDATE t SET c = v WHERE key AND c still equals what was read}.
 * A table without a primary key is read in one statement and never written.
 */
final class SqlTableStore implements TokenStore {
  static final int PAGE_SIZE = 1000;
  static final int FETCH_BATCH = 100;
  private static final String AFTER = "after";
  private static final String KEY = "k";
  private static final String READ = "read";
  private static final String VALUE = "v";

  private final Handle handle;
  private final Dialect dialect;
  private final SqlTable table;
  private final String from;
  private final String keyColumns;

  SqlTableStore(Handle handle, Dialect dialect, SqlTable table) {
    this.handle = handle;
    this.dialect = dialect;
    this.table = table;
    this.from = " FROM " + dialect.quote(table.name());
    this.keyColumns =
        table.primaryKey().stream().map(dialect::quote).collect(Collectors.joining(", "));
  }

  /** The last key of a page and how many rows the page had. */
  private record Page(List<Object> lastKey, int rows) {}

  SqlTable table() {
    return table;
  }

  @Override
  public String name() {
    return table.name();
  }

  @Override
  public Stream<StoredText> candidates() {
    return table.hasPrimaryKey()
        ? StreamSupport.stream(
            Spliterators.spliteratorUnknownSize(new Pages(), Spliterator.ORDERED), false)
        : unkeyedCandidates();
  }

  @Override
  public Optional<StoredText> reread(Location at) {
    Optional<StoredText> current = Optional.empty();
    Optional<SqlColumn> column = table.column(at.container());
    if (table.hasPrimaryKey() && column.isPresent()) {
      Query query =
          handle.createQuery(
              "SELECT " + dialect.asText(column.get()) + from + " WHERE " + keyEquals());
      bindKey(query, at.keyValues());
      current =
          query
              .map((rs, ctx) -> cell(rs, 1, column.get()))
              .findFirst()
              .flatMap(
                  text ->
                      text.map(it -> StoredText.writable(at, it, column.get().type().encoding())));
    }
    return current;
  }

  @Override
  public boolean compareAndSet(StoredText read, String replacement) {
    Optional<SqlColumn> column = table.column(read.at().container());
    boolean written = false;
    if (table.hasPrimaryKey() && column.isPresent()) {
      Update update =
          handle.createUpdate(
              "UPDATE "
                  + dialect.quote(table.name())
                  + " SET "
                  + dialect.quote(column.get().name())
                  + " = "
                  + dialect.value(column.get(), VALUE)
                  + " WHERE "
                  + keyEquals()
                  + " AND "
                  + dialect.sameAs(column.get(), READ));
      bindKey(update, read.at().keyValues());
      bindText(update, VALUE, replacement, column.get().type());
      bindText(update, READ, read.text(), column.get().type());
      written = update.execute() == 1;
    }
    return written;
  }

  /** The token-holding cells of the rows that satisfy {@code condition}, bound by {@code binder}. */
  List<StoredText> flaggedCellsWhere(String condition, Consumer<Query> binder) {
    Query query =
        handle.createQuery(
            "SELECT "
                + keyColumns
                + ", "
                + cellColumns()
                + from
                + " WHERE ("
                + condition
                + ") AND ("
                + anyFlag()
                + ")");
    binder.accept(query);
    return query.map((rs, ctx) -> keyedCells(rs)).list().stream().flatMap(List::stream).toList();
  }

  private Stream<StoredText> unkeyedCandidates() {
    return handle
        .createQuery("SELECT " + cellColumns() + from + " WHERE " + anyFlag())
        .map((rs, ctx) -> unkeyedCells(rs))
        .stream()
        .flatMap(List::stream);
  }

  private Page page(List<Object> after, List<List<Object>> flaggedKeys) {
    String flags =
        IntStream.range(0, table.columns().size())
            .mapToObj(i -> "(" + dialect.holdsToken(table.columns().get(i)) + ") AS f" + i)
            .collect(Collectors.joining(", "));
    String where = after.isEmpty() ? "" : " WHERE " + dialect.after(table.primaryKey(), AFTER);
    Query query =
        handle.createQuery(
            "SELECT "
                + keyColumns
                + ", "
                + flags
                + from
                + where
                + " ORDER BY "
                + keyColumns
                + " LIMIT "
                + PAGE_SIZE);
    IntStream.range(0, after.size()).forEach(i -> query.bind(AFTER + i, after.get(i)));
    List<List<Object>> rows = query.map((rs, ctx) -> pageRow(rs)).list();
    List<Object> last = List.of();
    for (List<Object> row : rows) {
      last = List.copyOf(row.subList(0, table.primaryKey().size()));
      if (row.subList(table.primaryKey().size(), row.size()).contains(Boolean.TRUE)) {
        flaggedKeys.add(last);
      }
    }
    return new Page(last, rows.size());
  }

  private List<Object> pageRow(ResultSet rs) throws SQLException {
    List<Object> row = new ArrayList<>(keyOf(rs));
    for (int i = 0; i < table.columns().size(); i++) {
      row.add(rs.getBoolean(table.primaryKey().size() + 1 + i));
    }
    return row;
  }

  private List<StoredText> fetch(List<List<Object>> keys) {
    boolean composite = table.primaryKey().size() > 1;
    String params =
        IntStream.range(0, keys.size())
            .mapToObj(row -> rowParams(row, composite))
            .collect(Collectors.joining(", "));
    String in = (composite ? "(" + keyColumns + ")" : keyColumns) + " IN (" + params + ")";
    return flaggedCellsWhere(
        in,
        query ->
            IntStream.range(0, keys.size())
                .forEach(
                    row ->
                        IntStream.range(0, table.primaryKey().size())
                            .forEach(i -> query.bind(KEY + row + "_" + i, keys.get(row).get(i)))));
  }

  private String rowParams(int row, boolean composite) {
    String params =
        IntStream.range(0, table.primaryKey().size())
            .mapToObj(i -> ":" + KEY + row + "_" + i)
            .collect(Collectors.joining(", "));
    return composite ? "(" + params + ")" : params;
  }

  private List<StoredText> keyedCells(ResultSet rs) throws SQLException {
    List<Object> key = keyOf(rs);
    List<StoredText> cells = new ArrayList<>();
    for (int i = 0; i < table.columns().size(); i++) {
      SqlColumn column = table.columns().get(i);
      cell(rs, table.primaryKey().size() + 1 + i, column)
          .ifPresent(
              text ->
                  cells.add(
                      StoredText.writable(
                          new Location(table.name(), column.name(), table.primaryKey(), key),
                          text,
                          column.type().encoding())));
    }
    return cells;
  }

  private List<StoredText> unkeyedCells(ResultSet rs) throws SQLException {
    List<StoredText> cells = new ArrayList<>();
    for (int i = 0; i < table.columns().size(); i++) {
      SqlColumn column = table.columns().get(i);
      cell(rs, i + 1, column)
          .ifPresent(
              text ->
                  cells.add(
                      new StoredText(
                          new Location(table.name(), column.name(), List.of(), List.of()),
                          text,
                          column.type().encoding(),
                          Writability.NO_PRIMARY_KEY)));
    }
    return cells;
  }

  private List<Object> keyOf(ResultSet rs) throws SQLException {
    List<Object> key = new ArrayList<>();
    for (int i = 1; i <= table.primaryKey().size(); i++) {
      key.add(rs.getObject(i));
    }
    return key;
  }

  private static Optional<String> cell(ResultSet rs, int index, SqlColumn column)
      throws SQLException {
    Optional<String> text;
    if (column.type() == ColumnType.BYTES) {
      byte[] bytes = rs.getBytes(index);
      text =
          bytes == null
              ? Optional.empty()
              : Optional.of(new String(bytes, StandardCharsets.ISO_8859_1));
    } else {
      text = Optional.ofNullable(rs.getString(index));
    }
    return text;
  }

  private String cellColumns() {
    return IntStream.range(0, table.columns().size())
        .mapToObj(i -> dialect.cellIfFlagged(table.columns().get(i)) + " AS v" + i)
        .collect(Collectors.joining(", "));
  }

  private String anyFlag() {
    return table.columns().stream().map(dialect::holdsToken).collect(Collectors.joining(" OR "));
  }

  private String keyEquals() {
    return IntStream.range(0, table.primaryKey().size())
        .mapToObj(i -> dialect.quote(table.primaryKey().get(i)) + " = :" + KEY + i)
        .collect(Collectors.joining(" AND "));
  }

  private static void bindKey(SqlStatement<?> statement, List<Object> key) {
    IntStream.range(0, key.size()).forEach(i -> statement.bind(KEY + i, key.get(i)));
  }

  private static void bindText(Update update, String name, String text, ColumnType type) {
    if (type == ColumnType.BYTES) {
      update.bind(name, text.getBytes(StandardCharsets.ISO_8859_1));
    } else {
      update.bind(name, text);
    }
  }

  /** Pages of keys and flags, then the flagged cells of each page in fetch batches. */
  private final class Pages implements Iterator<StoredText> {
    private final Deque<StoredText> ready = new ArrayDeque<>();
    private final Deque<List<Object>> flagged = new ArrayDeque<>();
    private List<Object> after = List.of();
    private boolean lastPage;

    @Override
    public boolean hasNext() {
      while (ready.isEmpty() && !(flagged.isEmpty() && lastPage)) {
        if (flagged.isEmpty()) {
          loadPage();
        } else {
          fetchBatch();
        }
      }
      return !ready.isEmpty();
    }

    @Override
    public StoredText next() {
      if (!hasNext()) {
        throw new NoSuchElementException();
      }
      return ready.poll();
    }

    private void loadPage() {
      List<List<Object>> flaggedKeys = new ArrayList<>();
      Page page = page(after, flaggedKeys);
      lastPage = page.rows() < PAGE_SIZE;
      after = page.lastKey().isEmpty() ? after : page.lastKey();
      flagged.addAll(flaggedKeys);
    }

    private void fetchBatch() {
      List<List<Object>> batch = new ArrayList<>();
      while (!flagged.isEmpty() && batch.size() < FETCH_BATCH) {
        batch.add(flagged.poll());
      }
      ready.addAll(fetch(batch));
    }
  }
}
