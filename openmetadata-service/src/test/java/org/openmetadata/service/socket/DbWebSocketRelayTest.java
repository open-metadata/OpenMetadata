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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;

/**
 * Exercises the DB-relay dispatch logic against an in-memory DAO that honours the same WHERE
 * semantics as the real SQL (id &gt; from, senderPod &lt;&gt; self, not expired). Two relay instances
 * sharing one store model two pods. The relay is generic over scope/target, so both targeted (USER)
 * and broadcast (ALL) frames flow through the same table.
 */
class DbWebSocketRelayTest {

  private static final long HOUR = 3_600_000L;
  // Large intervals so the background scheduler never fires during the test; we drive dispatchOnce.
  private static final long NEVER = 3_600_000L;

  @Test
  void userFrameFromOnePodIsDeliveredByThePeerAndNotTheSender() {
    InMemoryDao dao = new InMemoryDao();
    Capture capA = new Capture();
    Capture capB = new Capture();
    DbWebSocketRelay podA = relay(dao, "podA", HOUR, capA);
    DbWebSocketRelay podB = relay(dao, "podB", HOUR, capB);
    podA.start();
    podB.start();

    UUID user = UUID.randomUUID();
    podA.publishToUser(user, WebSocketManager.CSV_IMPORT_CHANNEL, "done");

    podB.dispatchOnce();
    podA.dispatchOnce();

    assertEquals(1, capB.rows.size(), "peer pod should deliver the frame");
    assertEquals(WebSocketRelay.SCOPE_USER, capB.rows.get(0).scope());
    assertEquals(user.toString(), capB.rows.get(0).target());
    assertEquals(WebSocketManager.CSV_IMPORT_CHANNEL, capB.rows.get(0).event());
    assertEquals("done", capB.rows.get(0).payload());
    assertTrue(capA.rows.isEmpty(), "sender pod must skip its own frame");

    podA.stop();
    podB.stop();
  }

  @Test
  void broadcastFrameUsesTheSameTableWithAllScopeAndNullTarget() {
    InMemoryDao dao = new InMemoryDao();
    Capture capB = new Capture();
    DbWebSocketRelay podA = relay(dao, "podA", HOUR, new Capture());
    DbWebSocketRelay podB = relay(dao, "podB", HOUR, capB);
    podA.start();
    podB.start();

    podA.publishToAll(WebSocketManager.ANNOUNCEMENT_CHANNEL, "maintenance at 9pm");
    podB.dispatchOnce();

    assertEquals(1, capB.rows.size());
    assertEquals(WebSocketRelay.SCOPE_ALL, capB.rows.get(0).scope());
    assertNull(capB.rows.get(0).target(), "a broadcast frame has no single target");
    assertEquals("maintenance at 9pm", capB.rows.get(0).payload());

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

    podA.publishToUser(UUID.randomUUID(), "e", "m");
    podB.dispatchOnce();
    podB.dispatchOnce(); // no new rows

    assertEquals(1, capB.rows.size());

    podA.stop();
    podB.stop();
  }

  @Test
  void aLowerIdThatCommitsAfterTheCursorPassedIsStillDelivered() {
    // Models the auto-increment commit-ordering gap: id 2 is committed and delivered first, then id
    // 1
    // (assigned earlier, committed later) becomes visible. The trailing re-scan must still pick it
    // up
    // rather than lose it behind the advanced cursor.
    InMemoryDao dao = new InMemoryDao();
    Capture capB = new Capture();
    DbWebSocketRelay podB = relay(dao, "podB", HOUR, capB);
    podB.start(); // empty table -> startFloor 0

    long later = System.currentTimeMillis() + HOUR;
    dao.insertWithId(
        2, WebSocketRelay.SCOPE_USER, UUID.randomUUID().toString(), "e", "second", "podA", later);
    podB.dispatchOnce(); // delivers id 2, cursor -> 2

    dao.insertWithId(
        1, WebSocketRelay.SCOPE_USER, UUID.randomUUID().toString(), "e", "first", "podA", later);
    podB.dispatchOnce(); // id 1 < cursor but within the re-scan window -> delivered

    assertEquals(2, capB.rows.size(), "the late-committing lower id must not be lost");
    assertTrue(capB.rows.stream().anyMatch(d -> "first".equals(d.payload())));
    assertTrue(capB.rows.stream().anyMatch(d -> "second".equals(d.payload())));

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

    podA.publishToUser(UUID.randomUUID(), "e", "m");
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
        WebSocketRelay.SCOPE_USER,
        UUID.randomUUID().toString(),
        "e",
        "m",
        "someOtherPod",
        System.currentTimeMillis() + HOUR);
    Capture capB = new Capture();
    DbWebSocketRelay podB = relay(dao, "podB", HOUR, capB);
    podB.start();

    podB.dispatchOnce();

    assertTrue(capB.rows.isEmpty(), "frames predating start must not be replayed");
    podB.stop();
  }

  private DbWebSocketRelay relay(InMemoryDao dao, String id, long ttlMs, Capture capture) {
    Consumer<WsRelayDAO.RelayRow> deliver = capture.rows::add;
    return new DbWebSocketRelay(dao, id, NEVER, ttlMs, NEVER, deliver);
  }

  private static final class Capture {
    private final List<WsRelayDAO.RelayRow> rows = new CopyOnWriteArrayList<>();
  }

  /** In-memory stand-in for ws_relay_message that applies the real query predicates. */
  private static final class InMemoryDao implements WsRelayDAO {
    private final List<Row> rows = new ArrayList<>();
    private final AtomicLong seq = new AtomicLong(0);

    @Override
    public synchronized void insert(
        String scope,
        String target,
        String event,
        String payload,
        String senderPod,
        long expiresAt) {
      rows.add(new Row(seq.incrementAndGet(), scope, target, event, payload, senderPod, expiresAt));
    }

    // Insert with an explicit id to model rows becoming visible out of id order (commit ordering).
    synchronized void insertWithId(
        long id,
        String scope,
        String target,
        String event,
        String payload,
        String senderPod,
        long expiresAt) {
      rows.add(new Row(id, scope, target, event, payload, senderPod, expiresAt));
    }

    @Override
    public synchronized long maxId() {
      return rows.stream().mapToLong(Row::id).max().orElse(0);
    }

    @Override
    public synchronized List<RelayRow> fetchNewer(long from, String self, long now, int limit) {
      List<RelayRow> out = new ArrayList<>();
      for (Row r : rows) {
        if (r.id() > from && !r.senderPod().equals(self) && r.expiresAt() > now) {
          out.add(new RelayRow(r.id(), r.scope(), r.target(), r.event(), r.payload()));
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
        long id,
        String scope,
        String target,
        String event,
        String payload,
        String senderPod,
        long expiresAt) {}
  }
}
