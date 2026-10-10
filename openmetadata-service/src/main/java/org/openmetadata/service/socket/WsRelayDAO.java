/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.socket;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import lombok.Getter;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindBean;
import org.jdbi.v3.sqlobject.statement.SqlBatch;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

/**
 * DAO for the {@code ws_relay_message} broadcast table backing {@link DbWebSocketRelay}. The row is
 * generic — {@code scope} + {@code target} express any delivery pattern (USER/ALL/future) — so one
 * table serves every {@link WebSocketManager} relay use. {@code createdAt} is DB-assigned and is the
 * ordering key the consumer cursor pages on. All statements are plain SQL that runs identically on
 * MySQL and PostgreSQL (no JSON columns, no engine-specific functions).
 */
public interface WsRelayDAO {

  /**
   * Batched insert of queued frames in a single JDBC round-trip. The relay enqueues off the caller's
   * thread and drains here, so callers never block on the DB and a burst (e.g. a broadcast to many
   * receivers) costs one statement instead of one per frame. {@code createdAt} is filled by the DB
   * default so every row is stamped on one clock.
   */
  @SqlBatch(
      "INSERT INTO ws_relay_message (scope, target, event, payload, senderPod) "
          + "VALUES (:scope, :target, :event, :payload, :senderPod)")
  void insertBatch(@BindBean List<Frame> frames);

  /** Highest createdAt in the table, or 0 when empty — used to seed a starting pod's cursor. */
  @SqlQuery("SELECT COALESCE(MAX(createdAt), 0) FROM ws_relay_message")
  long maxCreatedAt();

  /**
   * One keyset page of peer frames after {@code (afterCreatedAt, afterId)}, ordered by the same key.
   * The consumer pages until a short page returns, so it reads each row about once (only the trailing
   * overlap re-reads) and never caps delivery at the page size. Both engines range-scan the
   * {@code (createdAt, id)} index for this predicate. Keep the OR form: the tuple form
   * {@code (createdAt, id) > (:a, :b)} is cleaner but MySQL cannot index it and falls back to a table
   * scan.
   */
  @SqlQuery(
      "SELECT id, scope, target, event, payload, createdAt FROM ws_relay_message "
          + "WHERE senderPod <> :self "
          + "AND (createdAt > :afterCreatedAt OR (createdAt = :afterCreatedAt AND id > :afterId)) "
          + "ORDER BY createdAt ASC, id ASC LIMIT :limit")
  @RegisterRowMapper(RelayRowMapper.class)
  List<RelayRow> fetchAfter(
      @Bind("self") String self,
      @Bind("afterCreatedAt") long afterCreatedAt,
      @Bind("afterId") long afterId,
      @Bind("limit") int limit);

  /** Reap frames older than the TTL floor (createdAt-based, same {@code (createdAt, id)} index). */
  @SqlUpdate("DELETE FROM ws_relay_message WHERE createdAt < :floor")
  int deleteOlderThan(@Bind("floor") long floor);

  record RelayRow(
      long id, String scope, String target, String event, String payload, long createdAt) {}

  /** A frame queued for insert. Getters supply the {@code :name} binds for {@link #insertBatch}. */
  @Getter
  class Frame {
    private final String scope;
    private final String target;
    private final String event;
    private final String payload;
    private final String senderPod;

    Frame(String scope, String target, String event, String payload, String senderPod) {
      this.scope = scope;
      this.target = target;
      this.event = event;
      this.payload = payload;
      this.senderPod = senderPod;
    }
  }

  class RelayRowMapper implements RowMapper<RelayRow> {
    @Override
    public RelayRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new RelayRow(
          rs.getLong("id"),
          rs.getString("scope"),
          rs.getString("target"),
          rs.getString("event"),
          rs.getString("payload"),
          rs.getLong("createdAt"));
    }
  }
}
