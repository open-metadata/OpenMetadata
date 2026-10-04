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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BiConsumer;
import org.junit.jupiter.api.Test;

/**
 * Exercises the DB-relay dispatch logic against an in-memory DAO that honours the same WHERE
 * semantics as the real SQL (id &gt; cursor, senderPod &lt;&gt; self, not expired). Two relay
 * instances sharing one store model two pods.
 */
class DbWebSocketRelayTest {

  private static final long HOUR = 3_600_000L;
  // Large intervals so the background scheduler never fires during the test; we drive dispatchOnce.
  private static final long NEVER = 3_600_000L;

  @Test
  void frameFromOnePodIsDeliveredByThePeerAndNotTheSender() {
    InMemoryDao dao = new InMemoryDao();
    Capture capA = new Capture();
    Capture capB = new Capture();
    DbWebSocketRelay podA = relay(dao, "podA", HOUR, capA);
    DbWebSocketRelay podB = relay(dao, "podB", HOUR, capB);
    podA.start();
    podB.start();

    UUID user = UUID.randomUUID();
    podA.publish(user, WebSocketManager.CSV_IMPORT_CHANNEL, "done");

    podB.dispatchOnce();
    podA.dispatchOnce();

    assertEquals(1, capB.rows.size(), "peer pod should deliver the frame");
    assertEquals(user, capB.rows.get(0).user);
    assertEquals(WebSocketManager.CSV_IMPORT_CHANNEL, capB.rows.get(0).event);
    assertEquals("done", capB.rows.get(0).payload);
    assertTrue(capA.rows.isEmpty(), "sender pod must skip its own frame");

    podA.stop();
    podB.stop();
  }

  @Test
  void cursorAdvancesSoAFrameIsDeliveredOnlyOnce() {
    InMemoryDao dao = new InMemoryDao();
    Capture capB = new Capture();
    DbWebSocketRelay podA = relay(dao, "podA", HOUR, new Capture());
    DbWebSocketRelay podB = relay(dao, "podB", HOUR, capB);
    podA.start();
    podB.start();

    podA.publish(UUID.randomUUID(), "e", "m");
    podB.dispatchOnce();
    podB.dispatchOnce(); // no new rows

    assertEquals(1, capB.rows.size());

    podA.stop();
    podB.stop();
  }

  @Test
  void expiredFramesAreNotDelivered() {
    InMemoryDao dao = new InMemoryDao();
    Capture capB = new Capture();
    // podA's TTL is negative, so every frame it inserts is already expired.
    DbWebSocketRelay podA = relay(dao, "podA", -1L, new Capture());
    DbWebSocketRelay podB = relay(dao, "podB", HOUR, capB);
    podA.start();
    podB.start();

    podA.publish(UUID.randomUUID(), "e", "m");
    podB.dispatchOnce();

    assertTrue(capB.rows.isEmpty(), "expired frame must be filtered out");

    podA.stop();
    podB.stop();
  }

  @Test
  void startSeedsCursorAtTailSoPreexistingFramesAreNotReplayed() {
    InMemoryDao dao = new InMemoryDao();
    // A frame already exists before podB starts.
    dao.insert(
        UUID.randomUUID().toString(), "e", "m", "someOtherPod", System.currentTimeMillis() + HOUR);
    Capture capB = new Capture();
    DbWebSocketRelay podB = relay(dao, "podB", HOUR, capB);
    podB.start();

    podB.dispatchOnce();

    assertTrue(capB.rows.isEmpty(), "frames predating start must not be replayed");
    podB.stop();
  }

  private DbWebSocketRelay relay(InMemoryDao dao, String id, long ttlMs, Capture capture) {
    BiConsumer<UUID, WsRelayDAO.RelayRow> deliver =
        (user, row) -> capture.rows.add(new Delivered(user, row.event(), row.payload()));
    return new DbWebSocketRelay(dao, id, NEVER, ttlMs, NEVER, deliver);
  }

  private static final class Capture {
    private final List<Delivered> rows = new CopyOnWriteArrayList<>();
  }

  private record Delivered(UUID user, String event, String payload) {}

  /** In-memory stand-in for ws_relay_message that applies the real query predicates. */
  private static final class InMemoryDao implements WsRelayDAO {
    private final List<Row> rows = new ArrayList<>();
    private final AtomicLong seq = new AtomicLong(0);

    @Override
    public synchronized void insert(
        String userId, String event, String payload, String senderPod, long expiresAt) {
      rows.add(new Row(seq.incrementAndGet(), userId, event, payload, senderPod, expiresAt));
    }

    @Override
    public synchronized long maxId() {
      return rows.stream().mapToLong(Row::id).max().orElse(0);
    }

    @Override
    public synchronized List<RelayRow> fetchNewer(long cursor, String self, long now, int limit) {
      List<RelayRow> out = new ArrayList<>();
      for (Row r : rows) {
        if (r.id() > cursor && !r.senderPod().equals(self) && r.expiresAt() > now) {
          out.add(new RelayRow(r.id(), r.userId(), r.event(), r.payload()));
          if (out.size() >= limit) {
            break;
          }
        }
      }
      return out;
    }

    @Override
    public synchronized int deleteExpired(long now) {
      int before = rows.size();
      rows.removeIf(r -> r.expiresAt() < now);
      return before - rows.size();
    }

    private record Row(
        long id, String userId, String event, String payload, String senderPod, long expiresAt) {}
  }
}
