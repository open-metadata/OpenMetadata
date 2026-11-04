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

package org.openmetadata.it.tests.security.scale;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.LongAdder;
import org.openmetadata.it.tests.CredentialFixtures;

/**
 * One closed-loop cell: {@code concurrency} virtual threads each send requests back to back with one
 * bearer token. Requests started in the warm-up are sent but not timed; the rest are timed from send
 * to the last body byte. Every response other than 200, and every transport failure, counts as an
 * error and voids the cell.
 *
 * <p>The client and the in-process server share one JVM, so {@link Result#cpuCores()} is the limiter
 * evidence: a cell near the core count is bound by the JVM, not by the server.
 */
final class LoadCell {
  private static final int INITIAL_SAMPLES = 1 << 14;
  private static final double MICROS = 1_000.0;

  private LoadCell() {}

  record Result(
      long sent,
      long measured,
      long errors,
      Map<Integer, Long> statuses,
      double p50Micros,
      double p95Micros,
      double p99Micros,
      double requestsPerSecond,
      double cpuCores,
      boolean jvmBound) {}

  /** Counters shared by the workers of one cell. */
  private static final class Tally {
    final LongAdder sent = new LongAdder();
    final LongAdder errors = new LongAdder();
    final Map<Integer, LongAdder> statuses = new ConcurrentHashMap<>();

    void record(int status) {
      sent.increment();
      statuses.computeIfAbsent(status, ignored -> new LongAdder()).increment();
      if (status != 200) {
        errors.increment();
      }
    }
  }

  /** Where the measured window opened, for the CPU figure. */
  private static final class WindowStart {
    final AtomicLong cpuNanos = new AtomicLong();
    final AtomicLong wallNanos = new AtomicLong();
  }

  static Result run(
      String path,
      String token,
      int concurrency,
      Duration warmUp,
      Duration measure,
      Runnable atStart)
      throws InterruptedException, ExecutionException {
    long measureStart = System.nanoTime() + warmUp.toNanos();
    long end = measureStart + measure.toNanos();
    Tally tally = new Tally();
    WindowStart window = new WindowStart();
    List<long[]> samples;
    try (ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor();
        ScheduledExecutorService clock = Executors.newSingleThreadScheduledExecutor()) {
      clock.schedule(() -> open(window, atStart), warmUp.toNanos(), TimeUnit.NANOSECONDS);
      List<Future<long[]>> workers = new ArrayList<>();
      for (int i = 0; i < concurrency; i++) {
        workers.add(pool.submit(() -> work(path, token, measureStart, end, tally)));
      }
      samples = collect(workers);
    }
    long cpu = JvmCpu.processCpuNanos() - window.cpuNanos.get();
    long wall = System.nanoTime() - window.wallNanos.get();
    return summarize(tally, samples, measure, cpu / (double) wall);
  }

  private static void open(WindowStart window, Runnable atStart) {
    window.cpuNanos.set(JvmCpu.processCpuNanos());
    window.wallNanos.set(System.nanoTime());
    atStart.run();
  }

  private static List<long[]> collect(List<Future<long[]>> workers)
      throws InterruptedException, ExecutionException {
    List<long[]> samples = new ArrayList<>();
    for (Future<long[]> worker : workers) {
      samples.add(worker.get());
    }
    return samples;
  }

  private static long[] work(String path, String token, long measureStart, long end, Tally tally) {
    long[] durations = new long[INITIAL_SAMPLES];
    int count = 0;
    for (long start = System.nanoTime(); start < end; start = System.nanoTime()) {
      int status = send(path, token);
      long elapsed = System.nanoTime() - start;
      tally.record(status);
      if (start >= measureStart) {
        durations = grow(durations, count);
        durations[count++] = elapsed;
      }
    }
    return Arrays.copyOf(durations, count);
  }

  private static long[] grow(long[] durations, int count) {
    return count < durations.length ? durations : Arrays.copyOf(durations, count * 2);
  }

  /** A transport failure is reported as status -1 so it is counted like any non-200. */
  private static int send(String path, String token) {
    int status;
    try {
      status = CredentialFixtures.get(path, token).statusCode();
    } catch (RuntimeException failure) {
      status = -1;
    }
    return status;
  }

  private static Result summarize(
      Tally tally, List<long[]> samples, Duration measure, double cpuCores) {
    double[] micros =
        samples.stream().flatMapToLong(Arrays::stream).mapToDouble(n -> n / MICROS).toArray();
    if (micros.length == 0) {
      throw new IllegalStateException("The cell timed no request; the measured window was empty");
    }
    Map<Integer, Long> statuses = new TreeMap<>();
    tally.statuses.forEach((status, count) -> statuses.put(status, count.sum()));
    return new Result(
        tally.sent.sum(),
        micros.length,
        tally.errors.sum(),
        statuses,
        Percentiles.of(micros, 50),
        Percentiles.of(micros, 95),
        Percentiles.of(micros, 99),
        micros.length / (measure.toNanos() / 1e9),
        cpuCores,
        JvmCpu.saturated(cpuCores));
  }
}
