/*
 *  Copyright 2024 Collate.
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

package org.openmetadata.it.util;

import io.socket.client.IO;
import io.socket.client.Socket;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.awaitility.Awaitility;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Socket.IO test client for observing search index job progress updates broadcast by
 * {@code WebSocketManager.SEARCH_INDEX_JOB_BROADCAST_CHANNEL}.
 *
 * <p>Connects to {@code /api/v1/push/feed} using the {@code io.socket:socket.io-client} library
 * (same library used by the server), enforcing WebSocket transport only to avoid polling fallback.
 *
 * <p>Usage:
 *
 * <pre>{@code
 * try (SearchIndexWebSocketClient ws =
 *     SearchIndexWebSocketClient.connect(SdkClients.getServerUrl(), "admin")) {
 *   triggerApp(config);
 *   ws.awaitMinRecords(2, Duration.ofSeconds(60));
 *   List<AppRunRecord> records = ws.getReceivedRecords();
 *   assertThat(records).hasSizeGreaterThanOrEqualTo(2);
 * }
 * }</pre>
 */
@Slf4j
public class SearchIndexWebSocketClient implements AutoCloseable {

  private static final String SEARCH_INDEX_JOB_CHANNEL = "searchIndexJobStatus";
  private static final String SOCKET_PATH = "/api/v1/push/feed";
  private static final long CONNECT_TIMEOUT_MS = 10_000;

  private final Socket socket;
  private final List<AppRunRecord> records = Collections.synchronizedList(new ArrayList<>());
  private final AtomicBoolean connected = new AtomicBoolean(false);

  private SearchIndexWebSocketClient(String baseUrl, String userId) throws Exception {
    IO.Options opts = new IO.Options();
    opts.path = SOCKET_PATH;
    opts.transports = new String[] {"websocket"};
    opts.query = "userId=" + userId;

    socket = IO.socket(URI.create(baseUrl), opts);

    socket.on(
        Socket.EVENT_CONNECT,
        args -> {
          connected.set(true);
          LOG.debug("[ws-client] Connected to {}", baseUrl);
        });

    socket.on(Socket.EVENT_DISCONNECT, args -> LOG.debug("[ws-client] Disconnected"));

    socket.on(
        Socket.EVENT_CONNECT_ERROR,
        args -> LOG.warn("[ws-client] Connection error: {}", args.length > 0 ? args[0] : ""));

    socket.on(
        SEARCH_INDEX_JOB_CHANNEL,
        args -> {
          if (args.length > 0 && args[0] instanceof String data) {
            try {
              AppRunRecord record = JsonUtils.readValue(data, AppRunRecord.class);
              records.add(record);
              LOG.debug("[ws-client] Received record status={}", record.getStatus());
            } catch (Exception e) {
              LOG.warn("[ws-client] Failed to parse AppRunRecord: {}", e.getMessage());
            }
          }
        });

    CountDownLatch latch = new CountDownLatch(1);
    socket.once(Socket.EVENT_CONNECT, args -> latch.countDown());
    socket.connect();

    if (!latch.await(CONNECT_TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
      socket.close();
      throw new IllegalStateException(
          "WebSocket failed to connect within " + CONNECT_TIMEOUT_MS + "ms to " + baseUrl);
    }
  }

  /**
   * Connect to the OpenMetadata Socket.IO server.
   *
   * @param baseUrl the server base URL (e.g., {@code http://localhost:8585})
   * @param userId the user ID to pass as a query parameter (used for server-side routing only)
   */
  public static SearchIndexWebSocketClient connect(String baseUrl, String userId) throws Exception {
    return new SearchIndexWebSocketClient(baseUrl, userId);
  }

  /** Returns an immutable snapshot of all {@link AppRunRecord}s received so far. */
  public List<AppRunRecord> getReceivedRecords() {
    return Collections.unmodifiableList(new ArrayList<>(records));
  }

  /**
   * Block until at least {@code minCount} records have been received or the timeout elapses.
   * Throws an assertion error if the condition is not met.
   */
  public void awaitMinRecords(int minCount, Duration timeout) {
    Awaitility.await()
        .atMost(timeout)
        .pollInterval(Duration.ofMillis(500))
        .failFast("WebSocket connection lost", () -> !connected.get())
        .until(() -> records.size() >= minCount);
  }

  /** Clears the list of received records (useful between test phases). */
  public void clearRecords() {
    records.clear();
  }

  /** Returns true if the connection is currently active. */
  public boolean isConnected() {
    return connected.get() && socket.connected();
  }

  @Override
  public void close() {
    connected.set(false);
    socket.disconnect();
    socket.close();
  }
}
