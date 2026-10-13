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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import jdk.jfr.Recording;
import jdk.jfr.consumer.RecordedEvent;
import jdk.jfr.consumer.RecordedFrame;
import jdk.jfr.consumer.RecordingFile;
import org.jdbi.v3.core.ConnectionException;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * An on-demand DAO call made from a virtual thread must not pin that thread to its carrier while it
 * waits for a connection.
 *
 * <p>Jdbi 3.37.1 opened the handle inside a {@code synchronized} block, so every virtual thread that
 * parked in {@code HikariDataSource.getConnection} (an exhausted pool, or Hikari's leak detector
 * queueing on its scheduler lock) kept its carrier. Once all carriers were held that way, nothing
 * could run the virtual thread next in line for the lock, and the server's virtual-thread scheduler
 * stopped for good. That is the stall behind the integration-test lane timeouts. See
 * ADR:2026-10-13-jdbi-never-pins-virtual-threads-and-collate-runs-the-same-version.
 */
class JdbiVirtualThreadPinningTest {

  private static final String PINNED_EVENT = "jdk.VirtualThreadPinned";
  private static final String PROBE_THREAD_NAME = "jdbi-handle-open-probe";
  private static final Duration CONNECTION_WAIT = Duration.ofMillis(200);

  interface ProbeDao {
    @SqlQuery("SELECT 1")
    int selectOne();
  }

  @Test
  void waitingForAConnectionDoesNotPinTheVirtualThread(@TempDir Path recordingDir)
      throws Exception {
    Jdbi jdbi = Jdbi.create(JdbiVirtualThreadPinningTest::waitForUnavailableConnection);
    jdbi.installPlugin(new SqlObjectPlugin());
    ProbeDao probeDao = jdbi.onDemand(ProbeDao.class);
    AtomicReference<ConnectionException> daoFailure = new AtomicReference<>();

    List<RecordedEvent> pinnedEvents =
        recordPinnedEventsWhile(recordingDir, () -> daoFailure.set(callOnProbeThread(probeDao)));

    assertNotNull(daoFailure.get(), "the DAO call should have waited for a connection and failed");
    List<String> probePins =
        pinnedEvents.stream()
            .filter(JdbiVirtualThreadPinningTest::isOnProbeThread)
            .map(JdbiVirtualThreadPinningTest::describeStack)
            .toList();
    assertTrue(
        probePins.isEmpty(),
        "Opening a Jdbi handle pinned the virtual thread to its carrier:\n"
            + String.join("\n\n", probePins));
  }

  private static Connection waitForUnavailableConnection() throws SQLException {
    try {
      Thread.sleep(CONNECTION_WAIT);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
    throw new SQLException("Connection is not available, request timed out");
  }

  private static ConnectionException callOnProbeThread(ProbeDao probeDao)
      throws InterruptedException {
    AtomicReference<ConnectionException> failure = new AtomicReference<>();
    Thread probe =
        Thread.ofVirtual()
            .name(PROBE_THREAD_NAME)
            .start(
                () -> {
                  try {
                    probeDao.selectOne();
                  } catch (ConnectionException e) {
                    failure.set(e);
                  }
                });
    probe.join();
    return failure.get();
  }

  private static List<RecordedEvent> recordPinnedEventsWhile(Path recordingDir, ProbeAction action)
      throws Exception {
    Path dump = recordingDir.resolve("pinning.jfr");
    try (Recording recording = new Recording()) {
      recording.enable(PINNED_EVENT).withThreshold(Duration.ZERO).withStackTrace();
      recording.start();
      action.run();
      recording.stop();
      recording.dump(dump);
    }
    return RecordingFile.readAllEvents(dump).stream()
        .filter(event -> PINNED_EVENT.equals(event.getEventType().getName()))
        .toList();
  }

  private static boolean isOnProbeThread(RecordedEvent event) {
    return event.getThread() != null && PROBE_THREAD_NAME.equals(event.getThread().getJavaName());
  }

  private static String describeStack(RecordedEvent event) {
    return event.getStackTrace().getFrames().stream()
        .map(JdbiVirtualThreadPinningTest::describeFrame)
        .collect(Collectors.joining("\n  at ", "  at ", ""));
  }

  private static String describeFrame(RecordedFrame frame) {
    return frame.getMethod().getType().getName()
        + "."
        + frame.getMethod().getName()
        + ":"
        + frame.getLineNumber();
  }

  @FunctionalInterface
  private interface ProbeAction {
    void run() throws InterruptedException;
  }
}
