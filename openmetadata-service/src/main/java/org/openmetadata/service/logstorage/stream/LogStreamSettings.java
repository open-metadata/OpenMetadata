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
package org.openmetadata.service.logstorage.stream;

/**
 * Bounds every live log stream. Each value caps a resource that would otherwise grow with the size
 * of a run's log, the number of viewers, or the lifetime of a browser tab left open.
 *
 * <p>Two units are in play. {@code maxPendingBytesPerClient} is charged in encoded UTF-8 bytes,
 * because it bounds what has been handed to the container on its way to a socket. The chunk-level
 * counters — {@code maxBytesPerTick}, {@code maxStreamBytes} and {@code maxReplayBytes} — are
 * charged in characters, which is exact for the ASCII that log output overwhelmingly is and is the
 * closer proxy for {@code maxReplayBytes}, whose subject is heap held in UTF-16 strings rather than
 * bytes on the wire. For non-ASCII content those three admit up to three times their nominal value
 * before tripping; they are safety ceilings, so erring long is acceptable, and counting bytes on
 * every access would mean re-scanning each chunk on a hot path.
 *
 * @param pollSeconds delay between two reads of one run. The same delay serves every viewer of that
 *     run, so viewer count never multiplies backend load.
 * @param linesPerRead lines pulled per storage read. Caps the page held in heap at any moment.
 * @param maxReadsPerTick reads issued in one poll while catching up on a backlog. Bounds the burst
 *     of calls a single tick can make against S3 or Airflow.
 * @param maxBytesPerTick log bytes emitted in one poll. Stops a huge backlog from being pushed at a
 *     client faster than it can drain.
 * @param maxStreamBytes total bytes one stream may deliver before it ends with {@code maxBytes} and
 *     asks the client to use the download endpoint instead.
 * @param maxStreamSeconds absolute lifetime of a stream, so a forgotten tab cannot poll forever.
 * @param maxIdleSeconds silence after which a stream ends even though the run never reported a
 *     terminal state — the backstop for runs that die without writing a status.
 * @param finishGraceSeconds silence required after the run reached a terminal state before the
 *     stream closes, so the last flush of a just-finished run is still delivered.
 * @param unknownRunGraceSeconds silence required before closing a stream whose run has no status
 *     row at all. Longer than {@code finishGraceSeconds} because that also describes a run
 *     triggered moments ago, which needs time to start writing before it is declared over.
 * @param runProbeSeconds minimum delay between two run-state lookups. Bounds database reads.
 * @param maxReplayBytes buffer of recently streamed content kept per run so a viewer that joins an
 *     already-running stream still sees the immediate backlog without a second backend read.
 * @param maxPendingBytesPerClient unacknowledged bytes tolerated for one viewer before it is
 *     dropped. Bounds the memory a slow or stalled browser can pin.
 * @param maxActiveRuns runs tailed concurrently by one server.
 * @param maxActiveConnections viewers connected concurrently across all runs.
 */
public record LogStreamSettings(
    int pollSeconds,
    int linesPerRead,
    int maxReadsPerTick,
    int maxBytesPerTick,
    long maxStreamBytes,
    int maxStreamSeconds,
    int maxIdleSeconds,
    int finishGraceSeconds,
    int unknownRunGraceSeconds,
    int runProbeSeconds,
    int maxReplayBytes,
    int maxPendingBytesPerClient,
    int maxActiveRuns,
    int maxActiveConnections) {

  private static final LogStreamSettings DEFAULTS =
      new LogStreamSettings(
          2, 1000, 20, 1_048_576, 33_554_432L, 3600, 300, 10, 60, 10, 262_144, 4_194_304, 200, 500);

  public static LogStreamSettings defaults() {
    return DEFAULTS;
  }
}
