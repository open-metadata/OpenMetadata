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

package org.openmetadata.service.socket;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;

/**
 * The exp of the token each socket opened without a session was accepted on, as the handshake
 * stamped it. One entry per registered socket, dropped on every disconnect path, so it is bounded
 * by the live connections.
 * ADR:2026-11-26-a-push-feed-socket-without-a-session-ends-when-its-token-expires-or-its-user-is-deleted
 */
@Slf4j
final class SocketTokenExpiries {
  private final Map<String, Instant> expiresAt = new ConcurrentHashMap<>();

  /** The handshake stamps epoch milliseconds; a value the server cannot read fails closed. */
  void record(String socketId, String stampedEpochMillis) {
    Instant expiry;
    try {
      expiry = Instant.ofEpochMilli(Long.parseLong(stampedEpochMillis.trim()));
    } catch (NumberFormatException unreadable) {
      LOG.warn(
          "Push-feed socket {} carries a token expiry the server cannot read; treating its token"
              + " as expired",
          socketId);
      expiry = Instant.EPOCH;
    }
    expiresAt.put(socketId, expiry);
  }

  /** Strictly before now, with no leeway, as {@code JwtFilter} judges the token on REST. */
  boolean hasExpired(String socketId, Instant now) {
    Instant expiry = expiresAt.get(socketId);
    return expiry != null && expiry.isBefore(now);
  }

  boolean isTracked(String socketId) {
    return expiresAt.containsKey(socketId);
  }

  void forget(String socketId) {
    expiresAt.remove(socketId);
  }
}
