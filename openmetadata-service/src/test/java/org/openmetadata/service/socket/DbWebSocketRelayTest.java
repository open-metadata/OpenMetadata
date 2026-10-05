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
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;

/**
 * Exercises the DB-relay dispatch against an in-memory DAO that honours the same WHERE semantics as
 * the real SQL (senderPod &lt;&gt; self, expiresAt within the rescan window). Two relay instances
 * sharing one store model two pods. The relay is generic over scope/target, so both targeted (USER)
 * and broadcast (ALL) frames flow through the same table. Each relay uses rescanWindow == ttl, so the
 * window floor is "now" and the dispatch sees every non-expired peer frame it has not yet delivered.
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
    podA.flushQueue();

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
    podA.flushQueue();
    podB.dispatchOnce();

    assertEquals(1, capB.rows.size());
    assertEquals(WebSocketRelay.SCOPE_ALL, capB.rows.get(0).scope());
    assertNull(capB.rows.get(0).target(), "a broadcast frame has no single target");
    assertEquals("maintenance at 9pm", capB.rows.get(0).payload());

    podA.stop();
    podB.stop();
  }

  @Test
  void manyFramesAreWrittenInaSingleBatch() {
    InMemoryDao dao = new InMemoryDao();
    Capture capB = new Capture();
    DbWebSocketRelay podA = relay(dao, "podA", HOUR, new Capture());
    DbWebSocketRelay podB = relay(dao, "podB", HOUR, capB);
    podA.start();
    podB.start();

    for (int i = 0; i < 5; i++) {
      podA.publishToUser(UUID.randomUUID(), "e", "m" + i);
    }
    podA.flushQueue(); // one drain

    assertEquals(
        List.of(5), dao.batchSizes, "5 queued frames must be one insert of 5, not 5 inserts");
    podB.dispatchOnce();
    assertEquals(5, capB.rows.size(), "all batched frames are delivered");

    podA.stop();
    podB.stop();
  }

  @Test
  void aFrameIsDeliveredOnlyOnce() {
    InMemoryDao dao = new InMemoryDao();
    Capture capB = new Capture();
    DbWebSocketRelay podA = relay(dao, "podA", HOUR, new Capture());
    DbWebSocketRelay podB = relay(dao, "podB", HOUR, capB);
    podA.start();
    podB.start();

    podA.publishToUser(UUID.randomUUID(), "e", "m");
    podA.flushQueue();
    podB.dispatchOnce();
    podB.dispatchOnce(); // frame still in the window, but the dedupe set skips it

    assertEquals(1, capB.rows.size());

    podA.stop();
    podB.stop();
  }

  @Test
  void aFrameVisibleOutOfInsertOrderIsStillDelivered() {
    // Ids are assigned at INSERT but visible at COMMIT, so a lower id can surface after a higher
    // one.
    // The time window does not rely on id order, so both are delivered while recent.
    InMemoryDao dao = new InMemoryDao();
    Capture capB = new Capture();
    DbWebSocketRelay podB = relay(dao, "podB", HOUR, capB);
    podB.start();

    long later = System.currentTimeMillis() + HOUR;
    dao.insertWithId(
        2, WebSocketRelay.SCOPE_USER, UUID.randomUUID().toString(), "e", "second", "podA", later);
    podB.dispatchOnce(); // delivers id 2

    dao.insertWithId(
        1, WebSocketRelay.SCOPE_USER, UUID.randomUUID().toString(), "e", "first", "podA", later);
    podB.dispatchOnce(); // id 1 becomes visible after id 2 -> still within the window, delivered

    assertEquals(2, capB.rows.size(), "the out-of-order lower id must not be lost");
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
    podA.flushQueue();
    podB.dispatchOnce();

    assertTrue(capB.rows.isEmpty(), "expired frame must be filtered out");

    podA.stop();
    podB.stop();
  }

  @Test
  void preStartFramesAreNotReplayed() {
    InMemoryDao dao = new InMemoryDao();
    // A frame already exists before podB starts.
    dao.seed(
        WebSocketRelay.SCOPE_USER,
        UUID.randomUUID().toString(),
        "e",
        "m",
        "someOtherPod",
        System.currentTimeMillis() + HOUR);
    Capture capB = new Capture();
    DbWebSocketRelay podB = relay(dao, "podB", HOUR, capB);
    podB.start(); // start seeds the dedupe set with in-window frames

    podB.dispatchOnce();

    assertTrue(capB.rows.isEmpty(), "frames predating start must not be replayed");
    podB.stop();
  }

  private DbWebSocketRelay relay(InMemoryDao dao, String id, long ttlMs, Capture capture) {
    Consumer<WsRelayDAO.RelayRow> deliver = capture.rows::add;
    // NEVER flush/poll in the background; tests drive flushQueue()/dispatchOnce(). rescanWindow ==
    // ttl
    // makes the window floor "now", so dispatch sees every non-expired peer frame not yet
    // delivered.
    return new DbWebSocketRelay(dao, id, NEVER, ttlMs, NEVER, NEVER, ttlMs, deliver);
  }

  private static final class Capture {
    private final List<WsRelayDAO.RelayRow> rows = new CopyOnWriteArrayList<>();
  }

  /** In-memory stand-in for ws_relay_message that applies the real query predicates. */
  private static final class InMemoryDao implements WsRelayDAO {
    private final List<Row> rows = new ArrayList<>();
    private final AtomicLong seq = new AtomicLong(0);
    // Track batched inserts so a test can assert N frames collapse into one round-trip.
    private final List<Integer> batchSizes = new CopyOnWriteArrayList<>();

    @Override
    public synchronized void insertBatch(List<Frame> frames) {
      batchSizes.add(frames.size());
      for (Frame f : frames) {
        rows.add(
            new Row(
                seq.incrementAndGet(),
                f.getScope(),
                f.getTarget(),
                f.getEvent(),
                f.getPayload(),
                f.getSenderPod(),
                f.getExpiresAt()));
      }
    }

    // Append a pre-existing row (bypasses the relay) to model a frame that predates a pod's start.
    synchronized void seed(
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
    public synchronized List<RelayRow> fetchRecent(String self, long recentFloor, int limit) {
      return rows.stream()
          .filter(r -> !r.senderPod().equals(self) && r.expiresAt() > recentFloor)
          .sorted(Comparator.comparingLong(Row::expiresAt).thenComparingLong(Row::id))
          .limit(limit)
          .map(r -> new RelayRow(r.id(), r.scope(), r.target(), r.event(), r.payload()))
          .toList();
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
