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

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Spliterator;
import java.util.Spliterators;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.fernet.rotation.SqlCatalog.SqlTable;

/**
 * The versions of the entities whose tables were read, when the large tables are left out. Rows of
 * {@code entity_extension} are read by {@code id IN (...)}, {@value #ID_BATCH} ids per statement
 * through its primary key, for the ids of every read table that has an {@code id} column. Its cost
 * follows the tables that can hold a secret, not the data assets.
 */
final class VersionsStore implements TokenStore {
  static final String TABLE = "entity_extension";
  static final int ID_BATCH = 500;
  private static final String ID = "id";

  private final Handle handle;
  private final Dialect dialect;
  private final SqlTableStore versions;
  private final List<SqlTable> idTables;

  VersionsStore(Handle handle, Dialect dialect, SqlTable versions, List<SqlTable> idTables) {
    this.handle = handle;
    this.dialect = dialect;
    this.versions = new SqlTableStore(handle, dialect, versions);
    this.idTables = idTables.stream().filter(table -> table.hasColumn(ID)).toList();
  }

  @Override
  public String name() {
    return TABLE;
  }

  @Override
  public Stream<StoredText> candidates() {
    return idTables.stream().flatMap(this::versionsOf);
  }

  @Override
  public Optional<StoredText> reread(Location at) {
    return versions.reread(at);
  }

  @Override
  public boolean compareAndSet(StoredText read, String replacement) {
    return versions.compareAndSet(read, replacement);
  }

  private Stream<StoredText> versionsOf(SqlTable table) {
    return StreamSupport.stream(
        Spliterators.spliteratorUnknownSize(new IdBatches(table), Spliterator.ORDERED), false);
  }

  private List<Object> idsAfter(SqlTable table, Optional<Object> after) {
    String where = after.isPresent() ? " WHERE " + dialect.quote(ID) + " > :after" : "";
    var query =
        handle.createQuery(
            "SELECT "
                + dialect.quote(ID)
                + " FROM "
                + dialect.quote(table.name())
                + where
                + " ORDER BY "
                + dialect.quote(ID)
                + " LIMIT "
                + ID_BATCH);
    after.ifPresent(value -> query.bind("after", value));
    return query.map((rs, ctx) -> rs.getObject(1)).list();
  }

  /**
   * The versions of one table's entities, one id batch at a time. The ids are bound as text:
   * {@code entity_extension.id} is a string, and PostgreSQL does not compare it with the numeric
   * {@code id} of a table such as {@code openmetadata_settings}.
   */
  private final class IdBatches implements Iterator<StoredText> {
    private final SqlTable table;
    private final List<StoredText> ready = new ArrayList<>();
    private Optional<Object> after = Optional.empty();
    private boolean exhausted;

    IdBatches(SqlTable table) {
      this.table = table;
    }

    @Override
    public boolean hasNext() {
      while (ready.isEmpty() && !exhausted) {
        List<Object> ids = idsAfter(table, after);
        exhausted = ids.size() < ID_BATCH;
        if (!ids.isEmpty()) {
          after = Optional.of(ids.getLast());
          ready.addAll(
              versions.flaggedCellsWhere(
                  dialect.quote(ID) + " IN (<ids>)",
                  query -> query.bindList("ids", ids.stream().map(String::valueOf).toList())));
        }
      }
      return !ready.isEmpty();
    }

    @Override
    public StoredText next() {
      if (!hasNext()) {
        throw new NoSuchElementException();
      }
      return ready.removeFirst();
    }
  }
}
