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
 * table serves every {@link WebSocketManager} relay use. All statements are plain SQL that runs
 * identically on MySQL and PostgreSQL (no JSON columns, no engine-specific functions).
 */
public interface WsRelayDAO {

  /**
   * Batched insert of queued frames in a single JDBC round-trip. The relay enqueues off the caller's
   * thread and drains here, so callers never block on the DB and a burst (e.g. a broadcast to many
   * receivers) costs one statement instead of one per frame.
   */
  @SqlBatch(
      "INSERT INTO ws_relay_message (scope, target, event, payload, senderPod, expiresAt) "
          + "VALUES (:scope, :target, :event, :payload, :senderPod, :expiresAt)")
  void insertBatch(@BindBean List<Frame> frames);

  /**
   * Frames this pod did not publish that are still within the rescan window, i.e. {@code expiresAt >
   * recentFloor} where {@code recentFloor = now + ttl - rescanWindow}. Keyed on expiry (= createdAt +
   * ttl) so a frame that becomes visible out of insert order is still returned while recent; the
   * caller dedupes by id. Uses the expiresAt index.
   */
  @SqlQuery(
      "SELECT id, scope, target, event, payload FROM ws_relay_message "
          + "WHERE senderPod <> :self AND expiresAt > :recentFloor "
          + "ORDER BY expiresAt ASC, id ASC LIMIT :limit")
  @RegisterRowMapper(RelayRowMapper.class)
  List<RelayRow> fetchRecent(
      @Bind("self") String self, @Bind("recentFloor") long recentFloor, @Bind("limit") int limit);

  @SqlUpdate("DELETE FROM ws_relay_message WHERE expiresAt < :now")
  int deleteExpired(@Bind("now") long now);

  record RelayRow(long id, String scope, String target, String event, String payload) {}

  /** A frame queued for insert. Getters supply the {@code :name} binds for {@link #insertBatch}. */
  @Getter
  class Frame {
    private final String scope;
    private final String target;
    private final String event;
    private final String payload;
    private final String senderPod;
    private final long expiresAt;

    Frame(
        String scope,
        String target,
        String event,
        String payload,
        String senderPod,
        long expiresAt) {
      this.scope = scope;
      this.target = target;
      this.event = event;
      this.payload = payload;
      this.senderPod = senderPod;
      this.expiresAt = expiresAt;
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
          rs.getString("payload"));
    }
  }
}
