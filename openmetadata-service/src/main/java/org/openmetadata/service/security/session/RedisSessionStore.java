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
package org.openmetadata.service.security.session;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.lettuce.core.Range;
import io.lettuce.core.ScriptOutputType;
import io.lettuce.core.SetArgs;
import io.lettuce.core.api.sync.RedisCommands;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Redis-backed {@link SessionStore}. Primary session JSON is stored at
 * {@code {keyspace}:session:{id}} with a TTL equal to the session's absolute expiry — once that
 * elapses Redis removes the row for us, so {@link #findSessionsToExpire} and
 * {@link #findSessionsToPrune} return empty lists (the SessionService cleanup loop becomes a
 * no-op when this store is active).
 *
 * <p>Per-user session enumeration is supported by a secondary ZSET index per
 * {@code (userId, status)} scored by {@code lastAccessedAt}. Updates that change a session's
 * status maintain the indexes (active → terminal moves the entry out of the active index).
 *
 * <p>Optimistic CAS on the {@code version} field is implemented as a server-side Lua script that
 * reads the current JSON, parses out the version, compares against the expected value, and
 * rewrites the row in a single round-trip. This is the same contract as the JDBC
 * {@code UPDATE … WHERE version = :expectedVersion} statement.
 */
@Slf4j
public class RedisSessionStore implements SessionStore {

  // Sessions stored with at least 60s TTL so a session within its idle/refresh window that gets
  // mutated doesn't immediately become unreadable. The actual absolute expiry is checked in-process
  // by SessionService — this is just the Redis-side fallback.
  private static final long MIN_TTL_SECONDS = 60L;
  // findByUserIdAndStatus oversamples by this multiplier so lazy cleanup (ZREM-on-missing-key) has
  // headroom to skip stale index entries before truncating to the caller's limit. 3× is enough for
  // typical workloads without becoming expensive on a very chatty user.
  private static final int USER_INDEX_OVERSAMPLE = 3;

  // Lua CAS: parses "version":N from the stored JSON, compares against ARGV[1], rewrites with
  // ARGV[2] and TTL ARGV[3] when matched. Returns 1 on success, 0 on miss (key absent or version
  // mismatch). Pattern keeps the script tiny and self-contained — no JSON parsing dependency.
  //
  //   KEYS[1] = session key
  //   ARGV[1] = expected version (decimal string)
  //   ARGV[2] = new JSON
  //   ARGV[3] = TTL seconds (positive; 0 means "no TTL set")
  private static final String CAS_LUA =
      "local current = redis.call('GET', KEYS[1])\n"
          + "if current == false then return 0 end\n"
          + "local _, _, v = string.find(current, '\"version\"%s*:%s*(%-?%d+)')\n"
          + "if v == nil or tonumber(v) ~= tonumber(ARGV[1]) then return 0 end\n"
          + "local ttl = tonumber(ARGV[3])\n"
          + "if ttl and ttl > 0 then\n"
          + "  redis.call('SET', KEYS[1], ARGV[2], 'EX', ttl)\n"
          + "else\n"
          + "  redis.call('SET', KEYS[1], ARGV[2])\n"
          + "end\n"
          + "return 1\n";

  private final RedisCommands<String, String> commands;
  private final String keyspace;

  public RedisSessionStore(RedisCommands<String, String> commands, String keyspace) {
    this.commands = commands;
    this.keyspace = keyspace == null || keyspace.isBlank() ? "om" : keyspace;
  }

  private String sessionKey(String id) {
    return keyspace + ":session:" + id;
  }

  private String userIndexKey(String userId, SessionStatus status) {
    return keyspace + ":session:idx:user:" + userId + ":" + status.name();
  }

  private long ttlSecondsFor(UserSession session) {
    long now = System.currentTimeMillis();
    long expiresAt = session.getExpiresAt() == null ? now : session.getExpiresAt();
    long idleExpiresAt = session.getIdleExpiresAt() == null ? now : session.getIdleExpiresAt();
    long horizon = Math.max(expiresAt, idleExpiresAt);
    long millis = horizon - now;
    long seconds = Math.max(Duration.ofMillis(millis).getSeconds(), MIN_TTL_SECONDS);
    return seconds;
  }

  private static boolean isTerminal(SessionStatus status) {
    return status == SessionStatus.REVOKED || status == SessionStatus.EXPIRED;
  }

  @Override
  public Optional<UserSession> findById(String sessionId) {
    if (nullOrEmpty(sessionId)) {
      return Optional.empty();
    }
    String json = commands.get(sessionKey(sessionId));
    if (json == null) {
      return Optional.empty();
    }
    return Optional.of(JsonUtils.readValue(json, UserSession.class));
  }

  @Override
  public List<UserSession> findByUserIdAndStatus(String userId, SessionStatus status, int limit) {
    if (nullOrEmpty(userId) || limit <= 0) {
      return Collections.emptyList();
    }
    String indexKey = userIndexKey(userId, status);
    // Oversample so lazy cleanup of stale index entries doesn't shrink the result below
    // the requested limit for a user whose oldest entries are TTL-expired.
    long stop = (long) limit * USER_INDEX_OVERSAMPLE - 1;
    List<String> ids = commands.zrange(indexKey, 0, stop);
    if (ids == null || ids.isEmpty()) {
      return Collections.emptyList();
    }
    List<UserSession> sessions = new ArrayList<>(limit);
    List<String> stale = new ArrayList<>();
    for (String id : ids) {
      if (sessions.size() >= limit) {
        break;
      }
      String json = commands.get(sessionKey(id));
      if (json == null) {
        stale.add(id);
        continue;
      }
      UserSession session = JsonUtils.readValue(json, UserSession.class);
      if (session.getStatus() == status) {
        sessions.add(session);
      } else {
        // Status drifted — entry no longer belongs in this index.
        stale.add(id);
      }
    }
    if (!stale.isEmpty()) {
      commands.zrem(indexKey, stale.toArray(new String[0]));
    }
    return sessions;
  }

  @Override
  public List<UserSession> findSessionsToExpire(long now, int limit) {
    // Redis evicts expired keys for us — the in-process cleanup loop has nothing to do.
    return Collections.emptyList();
  }

  @Override
  public List<UserSession> findSessionsToPrune(long cutoff, int limit) {
    // Redis evicts terminal keys via TTL — nothing to physically prune.
    return Collections.emptyList();
  }

  @Override
  public void create(UserSession session) {
    String json = JsonUtils.pojoToJson(session);
    long ttl = ttlSecondsFor(session);
    commands.set(sessionKey(session.getId()), json, SetArgs.Builder.ex(ttl));
    if (!isTerminal(session.getStatus()) && !nullOrEmpty(session.getUserId())) {
      double score = scoreFor(session);
      commands.zadd(userIndexKey(session.getUserId(), session.getStatus()), score, session.getId());
    }
  }

  @Override
  public boolean updateIfVersion(UserSession session, long expectedVersion) {
    String json = JsonUtils.pojoToJson(session);
    long ttl = ttlSecondsFor(session);
    Long result =
        commands.eval(
            CAS_LUA,
            ScriptOutputType.INTEGER,
            new String[] {sessionKey(session.getId())},
            Long.toString(expectedVersion),
            json,
            Long.toString(ttl));
    if (result == null || result == 0L) {
      return false;
    }
    maintainUserIndex(session);
    return true;
  }

  private double scoreFor(UserSession session) {
    Long lastAccessed = session.getLastAccessedAt();
    return lastAccessed == null ? 0.0 : lastAccessed.doubleValue();
  }

  private void maintainUserIndex(UserSession session) {
    if (nullOrEmpty(session.getUserId())) {
      return;
    }
    String userId = session.getUserId();
    SessionStatus status = session.getStatus();
    if (isTerminal(status)) {
      // Remove from every per-status index; we don't know which one previously held it.
      for (SessionStatus s : SessionStatus.values()) {
        if (!isTerminal(s)) {
          commands.zrem(userIndexKey(userId, s), session.getId());
        }
      }
      return;
    }
    // Active/pending/refreshing — make sure the entry sits in the right per-status index and
    // not in any sibling indexes (a refresh moves ACTIVE → REFRESHING, etc.).
    commands.zadd(userIndexKey(userId, status), scoreFor(session), session.getId());
    for (SessionStatus s : SessionStatus.values()) {
      if (s != status && !isTerminal(s)) {
        commands.zrem(userIndexKey(userId, s), session.getId());
      }
    }
  }

  @Override
  public void delete(String sessionId) {
    if (nullOrEmpty(sessionId)) {
      return;
    }
    // Fetch first so we can clean the per-user index. If the key is already gone, just clear any
    // dangling index entries we know about.
    String json = commands.get(sessionKey(sessionId));
    commands.del(sessionKey(sessionId));
    if (json == null) {
      return;
    }
    UserSession session = JsonUtils.readValue(json, UserSession.class);
    removeFromAllUserIndexes(session);
  }

  @Override
  public int deleteByIds(List<String> sessionIds) {
    if (sessionIds == null || sessionIds.isEmpty()) {
      return 0;
    }
    int removed = 0;
    for (String id : sessionIds) {
      String json = commands.get(sessionKey(id));
      Long del = commands.del(sessionKey(id));
      if (del != null && del > 0L) {
        removed++;
      }
      if (json != null) {
        UserSession session = JsonUtils.readValue(json, UserSession.class);
        removeFromAllUserIndexes(session);
      }
    }
    return removed;
  }

  private void removeFromAllUserIndexes(UserSession session) {
    if (nullOrEmpty(session.getUserId())) {
      return;
    }
    for (SessionStatus s : SessionStatus.values()) {
      if (!isTerminal(s)) {
        commands.zrem(userIndexKey(session.getUserId(), s), session.getId());
      }
    }
  }

  // Visible for tests — lets contract tests inspect the secondary index size after operations.
  long userIndexSize(String userId, SessionStatus status) {
    Long size = commands.zcard(userIndexKey(userId, status));
    return size == null ? 0L : size;
  }

  @SuppressWarnings("unused")
  private static Range<Double> openRangeFrom(double from) {
    return Range.create(from, Double.POSITIVE_INFINITY);
  }
}
