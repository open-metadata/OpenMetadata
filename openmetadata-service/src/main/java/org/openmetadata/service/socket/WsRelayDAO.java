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
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

/**
 * DAO for the {@code ws_relay_message} broadcast table backing {@link DbWebSocketRelay}. All
 * statements are plain SQL that runs identically on MySQL and PostgreSQL (no JSON columns, no
 * engine-specific functions), so no connection-aware variants are needed.
 */
public interface WsRelayDAO {

  @SqlUpdate(
      "INSERT INTO ws_relay_message (userId, event, payload, senderPod, expiresAt) "
          + "VALUES (:userId, :event, :payload, :senderPod, :expiresAt)")
  void insert(
      @Bind("userId") String userId,
      @Bind("event") String event,
      @Bind("payload") String payload,
      @Bind("senderPod") String senderPod,
      @Bind("expiresAt") long expiresAt);

  /** Highest id currently in the table, or 0 when empty — used to seed a pod's start cursor. */
  @SqlQuery("SELECT COALESCE(MAX(id), 0) FROM ws_relay_message")
  long maxId();

  /**
   * Frames newer than this pod's cursor that it did not publish and have not expired. Ordered by id
   * so the caller can advance its cursor to the last row read.
   */
  @SqlQuery(
      "SELECT id, userId, event, payload FROM ws_relay_message "
          + "WHERE id > :cursor AND senderPod <> :self AND expiresAt > :now "
          + "ORDER BY id ASC LIMIT :limit")
  @RegisterRowMapper(RelayRowMapper.class)
  List<RelayRow> fetchNewer(
      @Bind("cursor") long cursor,
      @Bind("self") String self,
      @Bind("now") long now,
      @Bind("limit") int limit);

  @SqlUpdate("DELETE FROM ws_relay_message WHERE expiresAt < :now")
  int deleteExpired(@Bind("now") long now);

  record RelayRow(long id, String userId, String event, String payload) {}

  class RelayRowMapper implements RowMapper<RelayRow> {
    @Override
    public RelayRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new RelayRow(
          rs.getLong("id"), rs.getString("userId"), rs.getString("event"), rs.getString("payload"));
    }
  }
}
