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
 * Exercises the DB-relay dispatch against an in-memory DAO that honours the real keyset semantics
 * (senderPod &lt;&gt; self, {@code (createdAt, id)} &gt; the page cursor). Two relay instances sharing
 * one store model two pods. Each relay uses overlap == ttl, so the trailing floor is 0 and every
 * dispatch keyset-pages the whole table, delivering every unseen peer frame.
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
    DbWebSocketRelay podA = relay(dao, "podA", capA);
    DbWebSocketRelay podB = relay(dao, "podB", capB);
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
    DbWebSocketRelay podA = relay(dao, "podA", new Capture());
    DbWebSocketRelay podB = relay(dao, "podB", capB);
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
    DbWebSocketRelay podA = relay(dao, "podA", new Capture());
    DbWebSocketRelay podB = relay(dao, "podB", capB);
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
  void moreFramesThanThePageSizeAreAllDelivered() {
    // The starvation case: with a fixed LIMIT and no cursor a poll would only ever return the
    // oldest
    // page. The keyset cursor pages until a short page, so a burst larger than one page is fully
    // drained in a single dispatch.
    InMemoryDao dao = new InMemoryDao();
    Capture capB = new Capture();
    DbWebSocketRelay podA = relay(dao, "podA", new Capture());
    DbWebSocketRelay podB = relay(dao, "podB", capB);
    podA.start();
    podB.start();

    int count = 2500; // > FETCH_LIMIT (1000)
    for (int i = 0; i < count; i++) {
      podA.publishToUser(UUID.randomUUID(), "e", "m" + i);
    }
    podA.flushQueue();

    podB.dispatchOnce();
    assertEquals(count, capB.rows.size(), "every frame past the page size must still be delivered");

    podA.stop();
    podB.stop();
  }

  @Test
  void aFrameIsDeliveredOnlyOnce() {
    InMemoryDao dao = new InMemoryDao();
    Capture capB = new Capture();
    DbWebSocketRelay podA = relay(dao, "podA", new Capture());
    DbWebSocketRelay podB = relay(dao, "podB", capB);
    podA.start();
    podB.start();

    podA.publishToUser(UUID.randomUUID(), "e", "m");
    podA.flushQueue();
    podB.dispatchOnce();
    podB.dispatchOnce(); // frame is re-read in the overlap, but the dedupe set skips it

    assertEquals(1, capB.rows.size());

    podA.stop();
    podB.stop();
  }

  @Test
  void aFrameVisibleOutOfInsertOrderIsStillDelivered() {
    // A row can become visible with a lower createdAt after a higher one (commit ordering). The
    // trailing overlap re-reads it, so it is still delivered.
    InMemoryDao dao = new InMemoryDao();
    Capture capB = new Capture();
    DbWebSocketRelay podB = relay(dao, "podB", capB);
    podB.start();

    dao.insertWithId(
        2, 2, WebSocketRelay.SCOPE_USER, UUID.randomUUID().toString(), "e", "second", "podA");
    podB.dispatchOnce(); // delivers (id=2, createdAt=2)

    dao.insertWithId(
        1, 1, WebSocketRelay.SCOPE_USER, UUID.randomUUID().toString(), "e", "first", "podA");
    podB.dispatchOnce(); // (createdAt=1) is below the cursor but inside the overlap -> delivered

    assertEquals(2, capB.rows.size(), "the out-of-order lower row must not be lost");
    assertTrue(capB.rows.stream().anyMatch(d -> "first".equals(d.payload())));
    assertTrue(capB.rows.stream().anyMatch(d -> "second".equals(d.payload())));

    podB.stop();
  }

  @Test
  void preStartFramesAreNotReplayed() {
    InMemoryDao dao = new InMemoryDao();
    // A frame already exists before podB starts.
    dao.seed(WebSocketRelay.SCOPE_USER, UUID.randomUUID().toString(), "e", "m", "someOtherPod");
    Capture capB = new Capture();
    DbWebSocketRelay podB = relay(dao, "podB", capB);
    podB.start(); // seeds the cursor at the tail and the dedupe set with the overlap

    podB.dispatchOnce();

    assertTrue(capB.rows.isEmpty(), "frames predating start must not be replayed");
    podB.stop();
  }

  @Test
  void oldFramesAreReapedByTtl() {
    InMemoryDao dao = new InMemoryDao();
    dao.insertWithId(1, 100, WebSocketRelay.SCOPE_USER, "u", "e", "old", "podA");
    dao.insertWithId(2, 5000, WebSocketRelay.SCOPE_USER, "u", "e", "new", "podA");

    assertEquals(1, dao.deleteOlderThan(1000), "rows older than the floor are reaped");
    List<WsRelayDAO.RelayRow> remaining = dao.fetchAfter("podB", 0, 0, 10);
    assertEquals(1, remaining.size(), "only the recent frame remains");
    assertEquals("new", remaining.get(0).payload());
  }

  private DbWebSocketRelay relay(InMemoryDao dao, String id, Capture capture) {
    Consumer<WsRelayDAO.RelayRow> deliver = capture.rows::add;
    // NEVER flush/poll in the background; tests drive flushQueue()/dispatchOnce(). overlap == ttl
    // (HOUR) keeps the trailing floor at 0, so dispatch pages every unseen peer frame.
    return new DbWebSocketRelay(dao, id, NEVER, HOUR, NEVER, NEVER, HOUR, deliver);
  }

  private static final class Capture {
    private final List<WsRelayDAO.RelayRow> rows = new CopyOnWriteArrayList<>();
  }

  /** In-memory stand-in for ws_relay_message that applies the real keyset predicates. */
  private static final class InMemoryDao implements WsRelayDAO {
    private final List<Row> rows = new ArrayList<>();
    private final AtomicLong seq = new AtomicLong(0);
    // Track batched inserts so a test can assert N frames collapse into one round-trip.
    private final List<Integer> batchSizes = new CopyOnWriteArrayList<>();

    @Override
    public synchronized void insertBatch(List<Frame> frames) {
      batchSizes.add(frames.size());
      for (Frame f : frames) {
        long c = seq.incrementAndGet(); // id == createdAt, monotonic, like a DB-stamped insert
        rows.add(
            new Row(
                c, f.getScope(), f.getTarget(), f.getEvent(), f.getPayload(), f.getSenderPod(), c));
      }
    }

    // Append a pre-existing row (bypasses the relay) to model a frame that predates a pod's start.
    synchronized void seed(
        String scope, String target, String event, String payload, String senderPod) {
      long c = seq.incrementAndGet();
      rows.add(new Row(c, scope, target, event, payload, senderPod, c));
    }

    // Insert with explicit id and createdAt to model out-of-order visibility / specific ages.
    synchronized void insertWithId(
        long id,
        long createdAt,
        String scope,
        String target,
        String event,
        String payload,
        String senderPod) {
      rows.add(new Row(id, scope, target, event, payload, senderPod, createdAt));
    }

    @Override
    public synchronized long maxCreatedAt() {
      return rows.stream().mapToLong(Row::createdAt).max().orElse(0);
    }

    @Override
    public synchronized List<RelayRow> fetchAfter(
        String self, long afterCreatedAt, long afterId, int limit) {
      return rows.stream()
          .filter(r -> !r.senderPod().equals(self))
          .filter(
              r ->
                  r.createdAt() > afterCreatedAt
                      || (r.createdAt() == afterCreatedAt && r.id() > afterId))
          .sorted(Comparator.comparingLong(Row::createdAt).thenComparingLong(Row::id))
          .limit(limit)
          .map(
              r ->
                  new RelayRow(
                      r.id(), r.scope(), r.target(), r.event(), r.payload(), r.createdAt()))
          .toList();
    }

    @Override
    public synchronized int deleteOlderThan(long floor) {
      int before = rows.size();
      rows.removeIf(r -> r.createdAt() < floor);
      return before - rows.size();
    }

    private record Row(
        long id,
        String scope,
        String target,
        String event,
        String payload,
        String senderPod,
        long createdAt) {}
  }
}
