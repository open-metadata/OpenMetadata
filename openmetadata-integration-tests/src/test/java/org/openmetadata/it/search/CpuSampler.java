package org.openmetadata.it.search;

import java.lang.management.ManagementFactory;
import java.lang.management.OperatingSystemMXBean;
import java.time.Duration;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReferenceArray;

/**
 * Samples the embedded OM JVM's process CPU load at a configurable interval and
 * exposes percentiles + max over the captured window. Used by scale tests
 * (#14 ReindexCpuHeadroomIT, #12 Scale100kEntitiesIT) to assert reindex doesn't
 * starve the Jetty request handler.
 *
 * <p>Reads {@code com.sun.management.OperatingSystemMXBean.getProcessCpuLoad()},
 * which returns CPU usage of THIS JVM normalized to the number of available CPUs
 * (0..1). For containerized scale runs that need the OM container's CPU rather
 * than the test JVM's, swap the impl for the testcontainer's stats stream.
 */
public final class CpuSampler {

  private static final int DEFAULT_CAPACITY = 1024;

  private final OperatingSystemMXBean osBean;
  private final Duration interval;
  private final AtomicReferenceArray<Double> samples;
  private final AtomicInteger index = new AtomicInteger();
  private final AtomicLong startMillis = new AtomicLong();
  private volatile ExecutorService executor;
  private volatile boolean running;

  public CpuSampler() {
    this(Duration.ofSeconds(1));
  }

  public CpuSampler(final Duration interval) {
    this.osBean = ManagementFactory.getOperatingSystemMXBean();
    this.interval = interval;
    this.samples = new AtomicReferenceArray<>(DEFAULT_CAPACITY);
  }

  public void start() {
    if (running) {
      return;
    }
    running = true;
    startMillis.set(System.currentTimeMillis());
    executor =
        Executors.newSingleThreadExecutor(
            r -> {
              final Thread t = new Thread(r, "cpu-sampler");
              t.setDaemon(true);
              return t;
            });
    executor.submit(this::sampleLoop);
  }

  public void stop() {
    running = false;
    if (executor != null) {
      executor.shutdownNow();
      executor = null;
    }
  }

  public Stats stats() {
    final int collected = Math.min(index.get(), samples.length());
    final double[] copy = new double[collected];
    for (int i = 0; i < collected; i++) {
      final Double sample = samples.get(i);
      copy[i] = sample == null ? 0.0 : sample;
    }
    Arrays.sort(copy);
    if (copy.length == 0) {
      return new Stats(0, 0, 0, 0, 0);
    }
    final double sum = Arrays.stream(copy).sum();
    return new Stats(
        copy.length, copy[0], copy[copy.length - 1], sum / copy.length, percentile(copy, 0.95));
  }

  private void sampleLoop() {
    while (running) {
      try {
        final double load = readCpuLoad();
        final int slot = index.getAndIncrement() % samples.length();
        samples.set(slot, load);
        Thread.sleep(interval.toMillis());
      } catch (final InterruptedException e) {
        Thread.currentThread().interrupt();
        return;
      }
    }
  }

  private double readCpuLoad() {
    if (osBean instanceof com.sun.management.OperatingSystemMXBean sunBean) {
      return Math.max(0.0, sunBean.getProcessCpuLoad());
    }
    return Math.max(0.0, osBean.getSystemLoadAverage())
        / Math.max(1, osBean.getAvailableProcessors());
  }

  private static double percentile(final double[] sorted, final double p) {
    if (sorted.length == 0) {
      return 0.0;
    }
    // Index off (length - 1), not length: floor(p * length) returns the max for many small
    // n (e.g. n=20, p=0.95 -> idx 19), overstating p95 and making headroom asserts flaky.
    final int idx = (int) Math.min(sorted.length - 1L, Math.round(p * (sorted.length - 1)));
    return sorted[idx];
  }

  /** Immutable snapshot of CPU usage over the sample window. Values are 0..1. */
  public record Stats(int samples, double min, double max, double avg, double p95) {}
}
