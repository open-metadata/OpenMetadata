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

package org.openmetadata.service.bench;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.sun.management.ThreadMXBean;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.IntPredicate;

/**
 * A small hand-written microbenchmark harness for operations that answer accept or reject. It
 * stands in for JMH, which the build does not carry, and keeps the parts of JMH's method that make a
 * number trustworthy: discarded warm-up samples, many operations per sample, results folded into a
 * consumed value so the JIT cannot drop the work, and a hard check that every call accepted.
 *
 * <p>A case runs on 1 or N platform threads that begin each sample together at a barrier. A sample
 * is timed per thread; the sample's ns/op is its slowest thread's elapsed time divided by the
 * operations per thread, which is the latency one caller sees under that contention. Aggregate ops/s
 * divides all threads' operations by the sum of the samples' slowest-thread times. Allocation is
 * read on the worker threads themselves, inside the timed region only.
 */
public final class BenchSession {
  private static final ObjectMapper MAPPER =
      new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
  private static final long BARRIER_TIMEOUT_SECONDS = 120;
  private static volatile long sink;

  /** Samples are {@code opsPerSample} calls of the operation on every thread. */
  public record Config(int warmupSamples, int measuredSamples, int opsPerSample) {}

  /** Load average is -1 where the platform does not report one. */
  public record MachineState(
      String javaVersion, String os, int processors, double loadBefore, double loadAfter) {}

  public record Result(
      String name,
      int threads,
      Config config,
      long invocations,
      long accepted,
      double medianNsPerOp,
      double p10NsPerOp,
      double p90NsPerOp,
      double minNsPerOp,
      double maxNsPerOp,
      double opsPerSecond,
      double allocatedBytesPerOp,
      MachineState machine) {}

  private record Document(
      String run, double loadAtSessionStart, double loadAtSessionEnd, List<Result> cases) {}

  private final String runName;
  private final List<Result> results = new ArrayList<>();
  private final double loadAtStart = loadAverage();

  public BenchSession(String runName) {
    this.runName = runName;
  }

  /**
   * Runs one case. {@code operation} receives the worker's index (0 to threads-1) and returns
   * whether the call accepted; the case fails unless every call accepted.
   */
  public Result run(String name, int threads, Config config, IntPredicate operation) {
    double loadBefore = loadAverage();
    Worker[] workers = startWorkers(threads, config, operation);
    joinAll(workers);
    Result result = summarize(name, threads, config, workers, loadBefore);
    results.add(result);
    return result;
  }

  /** Writes the JSON file for this session and returns the Markdown table of its cases. */
  public String finish() throws IOException {
    Path dir = Path.of("target", "credential-bench");
    Files.createDirectories(dir);
    String stamp = Instant.now().toString().replace(':', '-');
    Document document = new Document(runName, loadAtStart, loadAverage(), results);
    MAPPER.writeValue(dir.resolve(runName + "-" + stamp + ".json").toFile(), document);
    return markdown(results);
  }

  static String markdown(List<Result> cases) {
    StringBuilder table = new StringBuilder();
    table.append(
        "| case | threads | ns/op median | p10 | p90 | min | max | ops/s | B/op | accepted/invoked (warm-up included)"
            + " | load before/after |\n|---|---|---|---|---|---|---|---|---|---|---|\n");
    for (Result r : cases) {
      table.append(
          String.format(
              Locale.ROOT,
              "| %s | %d | %.1f | %.1f | %.1f | %.1f | %.1f | %.0f | %.1f | %d/%d | %.2f/%.2f |%n",
              r.name(),
              r.threads(),
              r.medianNsPerOp(),
              r.p10NsPerOp(),
              r.p90NsPerOp(),
              r.minNsPerOp(),
              r.maxNsPerOp(),
              r.opsPerSecond(),
              r.allocatedBytesPerOp(),
              r.accepted(),
              r.invocations(),
              r.machine().loadBefore(),
              r.machine().loadAfter()));
    }
    return table.toString();
  }

  private static Worker[] startWorkers(int threads, Config config, IntPredicate operation) {
    CyclicBarrier barrier = new CyclicBarrier(threads);
    AtomicReference<Throwable> failure = new AtomicReference<>();
    Worker[] workers = new Worker[threads];
    for (int i = 0; i < threads; i++) {
      workers[i] = new Worker(i, config, barrier, operation, failure);
      workers[i].thread = Thread.ofPlatform().name("bench-worker-" + i).start(workers[i]);
    }
    return workers;
  }

  private static void joinAll(Worker[] workers) {
    try {
      for (Worker worker : workers) {
        worker.thread.join();
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while waiting for benchmark workers", e);
    }
    Throwable failure = workers[0].failure.get();
    if (failure != null) {
      throw new IllegalStateException("Benchmark worker failed", failure);
    }
  }

  private static Result summarize(
      String name, int threads, Config config, Worker[] workers, double loadBefore) {
    long invocations = (long) threads * config.opsPerSample() * totalSamples(config);
    long accepted = Arrays.stream(workers).mapToLong(w -> w.accepted).sum();
    if (accepted != invocations) {
      throw new IllegalStateException(
          name + ": " + accepted + " calls accepted of " + invocations + " made");
    }
    sink += accepted;
    double[] perSample = sampleNsPerOp(workers, config);
    double[] sorted = perSample.clone();
    Arrays.sort(sorted);
    double measuredSeconds = Arrays.stream(perSample).sum() * config.opsPerSample() / 1e9;
    long measuredOps = (long) threads * config.opsPerSample() * config.measuredSamples();
    double allocated = Arrays.stream(workers).mapToLong(w -> w.allocatedBytes).sum();
    MachineState machine =
        new MachineState(
            Runtime.version().toString(),
            System.getProperty("os.name") + " " + System.getProperty("os.arch"),
            Runtime.getRuntime().availableProcessors(),
            loadBefore,
            loadAverage());
    return new Result(
        name,
        threads,
        config,
        invocations,
        accepted,
        percentile(sorted, 50),
        percentile(sorted, 10),
        percentile(sorted, 90),
        sorted[0],
        sorted[sorted.length - 1],
        measuredOps / measuredSeconds,
        allocated / measuredOps,
        machine);
  }

  private static double[] sampleNsPerOp(Worker[] workers, Config config) {
    double[] perSample = new double[config.measuredSamples()];
    for (int s = 0; s < perSample.length; s++) {
      long slowest = 0;
      for (Worker worker : workers) {
        slowest = Math.max(slowest, worker.elapsedNanos[s]);
      }
      perSample[s] = (double) slowest / config.opsPerSample();
    }
    return perSample;
  }

  private static double percentile(double[] sorted, int percent) {
    int rank = (int) Math.ceil(percent / 100.0 * sorted.length);
    return sorted[Math.max(0, rank - 1)];
  }

  private static int totalSamples(Config config) {
    return config.warmupSamples() + config.measuredSamples();
  }

  private static double loadAverage() {
    return ManagementFactory.getOperatingSystemMXBean().getSystemLoadAverage();
  }

  private static final class Worker implements Runnable {
    private final int index;
    private final Config config;
    private final CyclicBarrier barrier;
    private final IntPredicate operation;
    final AtomicReference<Throwable> failure;
    final long[] elapsedNanos;
    Thread thread;
    long accepted;
    long allocatedBytes;

    Worker(
        int index,
        Config config,
        CyclicBarrier barrier,
        IntPredicate operation,
        AtomicReference<Throwable> failure) {
      this.index = index;
      this.config = config;
      this.barrier = barrier;
      this.operation = operation;
      this.failure = failure;
      this.elapsedNanos = new long[config.measuredSamples()];
    }

    @Override
    public void run() {
      ThreadMXBean memory = (ThreadMXBean) ManagementFactory.getThreadMXBean();
      long threadId = Thread.currentThread().threadId();
      try {
        for (int s = 0; s < totalSamples(config); s++) {
          barrier.await(BARRIER_TIMEOUT_SECONDS, TimeUnit.SECONDS);
          sample(s, memory, threadId);
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        failure.compareAndSet(null, e);
      } catch (BrokenBarrierException e) {
        failure.compareAndSet(null, e);
      } catch (TimeoutException e) {
        // A peer died after the others passed the barrier; fail the run rather than wait forever.
        failure.compareAndSet(null, e);
        barrier.reset();
      } catch (RuntimeException | Error e) {
        failure.compareAndSet(null, e);
        barrier.reset();
      }
    }

    private void sample(int s, ThreadMXBean memory, long threadId) {
      long bytesBefore = memory.getThreadAllocatedBytes(threadId);
      long start = System.nanoTime();
      long ok = 0;
      for (int i = 0; i < config.opsPerSample(); i++) {
        ok += operation.test(index) ? 1 : 0;
      }
      long elapsed = System.nanoTime() - start;
      long bytes = memory.getThreadAllocatedBytes(threadId) - bytesBefore;
      accepted += ok;
      if (s >= config.warmupSamples()) {
        elapsedNanos[s - config.warmupSamples()] = elapsed;
        allocatedBytes += bytes;
      }
    }
  }
}
