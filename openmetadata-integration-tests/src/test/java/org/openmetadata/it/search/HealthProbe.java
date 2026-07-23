package org.openmetadata.it.search;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLongArray;
import org.openmetadata.it.server.ServerHandle;

/**
 * Hammers an OM endpoint (default {@code /api/v1/system/version}) at a fixed QPS and
 * records success rate + latency histogram. Used by #14 ReindexCpuHeadroomIT to prove
 * the Jetty request handler stays responsive while reindex is hot.
 *
 * <p>k8s liveness probes have ~1 s budget; if any probe in the window exceeds it the
 * pod gets restarted in prod. The test asserts {@link Stats#latencyP99Ms} stays under
 * a configured ceiling and {@link Stats#successRatio} stays at 1.0.
 */
public final class HealthProbe {

  private static final int DEFAULT_CAPACITY = 16_384;

  private final HttpClient http;
  private final URI url;
  private final int qps;
  private final AtomicLongArray latenciesMicros;
  private final AtomicInteger writeIndex = new AtomicInteger();
  private final AtomicInteger successes = new AtomicInteger();
  private final AtomicInteger failures = new AtomicInteger();
  private volatile ExecutorService executor;
  private volatile boolean running;

  public HealthProbe(final ServerHandle server, final int qps) {
    this(server, qps, "/v1/system/version");
  }

  public HealthProbe(final ServerHandle server, final int qps, final String path) {
    this.qps = qps;
    this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    final String base = server.baseUrl().toString();
    this.url = URI.create(base.replaceAll("/api$", "") + "/api" + path);
    this.latenciesMicros = new AtomicLongArray(DEFAULT_CAPACITY);
  }

  public void start() {
    if (running) {
      return;
    }
    running = true;
    executor =
        Executors.newFixedThreadPool(
            Math.max(2, qps / 2),
            r -> {
              final Thread t = new Thread(r, "health-probe");
              t.setDaemon(true);
              return t;
            });
    final long intervalNanos = 1_000_000_000L / Math.max(1, qps);
    executor.submit(() -> probeLoop(intervalNanos));
  }

  public void stop() {
    running = false;
    if (executor != null) {
      executor.shutdownNow();
      executor = null;
    }
  }

  public Stats stats() {
    final int collected = Math.min(writeIndex.get(), latenciesMicros.length());
    final long[] copy = new long[collected];
    for (int i = 0; i < collected; i++) {
      copy[i] = latenciesMicros.get(i);
    }
    Arrays.sort(copy);
    final long total = (long) successes.get() + failures.get();
    final double ratio = total == 0 ? 1.0 : (double) successes.get() / total;
    return new Stats(
        successes.get(),
        failures.get(),
        ratio,
        copy.length == 0 ? 0 : copy[copy.length - 1] / 1000.0,
        copy.length == 0 ? 0 : percentile(copy, 0.99) / 1000.0,
        copy.length == 0 ? 0 : percentile(copy, 0.50) / 1000.0);
  }

  private void probeLoop(final long intervalNanos) {
    long next = System.nanoTime();
    while (running) {
      executor.submit(this::issueOne);
      next += intervalNanos;
      final long sleep = next - System.nanoTime();
      if (sleep > 0) {
        try {
          Thread.sleep(sleep / 1_000_000L, (int) (sleep % 1_000_000L));
        } catch (final InterruptedException e) {
          Thread.currentThread().interrupt();
          return;
        }
      }
    }
  }

  private void issueOne() {
    final long start = System.nanoTime();
    try {
      final HttpResponse<Void> resp =
          http.send(
              HttpRequest.newBuilder(url).timeout(Duration.ofSeconds(5)).GET().build(),
              HttpResponse.BodyHandlers.discarding());
      if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
        recordSuccess(start);
      } else {
        failures.incrementAndGet();
      }
    } catch (final Exception e) {
      failures.incrementAndGet();
    }
  }

  private void recordSuccess(final long startNanos) {
    successes.incrementAndGet();
    final long elapsedMicros = (System.nanoTime() - startNanos) / 1000L;
    final int slot = writeIndex.getAndIncrement() % latenciesMicros.length();
    latenciesMicros.set(slot, elapsedMicros);
  }

  private static long percentile(final long[] sorted, final double p) {
    if (sorted.length == 0) {
      return 0L;
    }
    final int idx = (int) Math.min(sorted.length - 1L, Math.floor(p * sorted.length));
    return sorted[idx];
  }

  /** Immutable snapshot of probe results. Latencies are milliseconds. */
  public record Stats(
      int successes,
      int failures,
      double successRatio,
      double latencyMaxMs,
      double latencyP99Ms,
      double latencyP50Ms) {}
}
