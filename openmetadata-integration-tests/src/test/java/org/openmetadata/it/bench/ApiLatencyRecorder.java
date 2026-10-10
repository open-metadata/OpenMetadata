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

package org.openmetadata.it.bench;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Request;
import java.net.URI;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.LongAdder;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.network.CompletedRequest;
import org.openmetadata.sdk.network.RequestListener;

/**
 * Records the latency of every OpenMetadata API call a test JVM makes, from two vantage points:
 * the Java SDK ({@link #onRequestCompleted}) and the browser in Playwright UI tests ({@link
 * #attach}). {@link ApiLatencyReportListener} publishes the result once the run ends, so every
 * suite reports per-API p95s without a line of benchmark code.
 *
 * <p>Keys are {@code "<source> <route>"}, e.g. {@code "ui GET /v1/lineage/scene?band=ASSET"}. The
 * same route seen from the SDK and from the browser stays separate: the browser figure includes
 * what the page waits for, and the two answer different questions.
 *
 * <p>Memory is bounded by construction: at most {@link #MAX_ROUTES} distinct routes are tracked,
 * each in a fixed-size {@link LatencyHistogram}. Calls on any further route are counted into one
 * overflow entry per source, so a normalization miss shows up as a growing overflow count rather
 * than as an unbounded map.
 */
public final class ApiLatencyRecorder implements RequestListener {

  static final int MAX_ROUTES = 400;
  static final String OVERFLOW_ROUTE = "(other routes)";
  static final String SDK_SOURCE = "sdk";
  static final String UI_SOURCE = "ui";

  private static final String ENABLED_PROPERTY = "jpw.bench.apiLatency";
  private static final ApiLatencyRecorder GLOBAL = new ApiLatencyRecorder(MAX_ROUTES);

  private final int maxRoutes;
  private final Map<String, LatencyHistogram> routes = new ConcurrentHashMap<>();
  private final LongAdder failedRequests = new LongAdder();
  private final LongAdder overflowRequests = new LongAdder();

  ApiLatencyRecorder(final int maxRoutes) {
    this.maxRoutes = maxRoutes;
  }

  public static ApiLatencyRecorder global() {
    return GLOBAL;
  }

  /** On unless {@code -Djpw.bench.apiLatency=false}. */
  public static boolean isEnabled() {
    return !Boolean.FALSE.toString().equalsIgnoreCase(System.getProperty(ENABLED_PROPERTY));
  }

  /** Registers the global recorder on a client being built, when recording is enabled. */
  public static OpenMetadataConfig.Builder instrument(final OpenMetadataConfig.Builder builder) {
    return isEnabled() ? builder.requestListener(GLOBAL) : builder;
  }

  @Override
  public void onRequestCompleted(final CompletedRequest request) {
    if (request.statusCode() == CompletedRequest.NO_RESPONSE) {
      // No response means no server latency to report; a refused or timed-out call would only
      // drag the percentiles towards the client's timeout.
      failedRequests.increment();
      return;
    }
    if (request.failed()) {
      failedRequests.increment();
    }
    record(
        SDK_SOURCE,
        ApiRoutes.routeOf(request.method(), request.path(), request.query()),
        request.durationNanos());
  }

  /**
   * Records every API call the pages of {@code context} make. {@code timing().responseEnd} is the
   * full request time as the page saw it; Playwright reports -1 when it has no timing, and those
   * calls are skipped rather than recorded as zero.
   */
  public void attach(final BrowserContext context) {
    if (!isEnabled()) {
      return;
    }
    context.onRequestFinished(this::recordBrowserRequest);
    context.onRequestFailed(this::recordBrowserFailure);
  }

  void record(final String source, final String route, final long durationNanos) {
    histogramFor(source, route).record(durationNanos);
  }

  /** Per-route latencies, sorted by key so two runs' reports diff cleanly. */
  public Map<String, Latency> latencies() {
    final Map<String, Latency> latencies = new TreeMap<>();
    routes.forEach(
        (key, histogram) -> {
          if (histogram.count() > 0) {
            latencies.put(key, histogram.toLatency());
          }
        });
    return latencies;
  }

  public RecorderCounters counters() {
    return new RecorderCounters(
        routes.values().stream().mapToLong(LatencyHistogram::count).sum(),
        failedRequests.sum(),
        routes.size(),
        overflowRequests.sum());
  }

  public boolean isEmpty() {
    return routes.isEmpty();
  }

  private LatencyHistogram histogramFor(final String source, final String route) {
    final String key = source + " " + route;
    final LatencyHistogram existing = routes.get(key);
    if (existing != null) {
      return existing;
    }
    if (routes.size() >= maxRoutes) {
      overflowRequests.increment();
      return routes.computeIfAbsent(
          source + " " + OVERFLOW_ROUTE, ignored -> new LatencyHistogram());
    }
    return routes.computeIfAbsent(key, ignored -> new LatencyHistogram());
  }

  private void recordBrowserRequest(final Request request) {
    final URI uri = apiUriOrNull(request.url());
    final double responseEndMillis = request.timing().responseEnd;
    if (uri == null || responseEndMillis < 0) {
      return;
    }
    record(
        UI_SOURCE,
        ApiRoutes.routeOf(request.method(), uri.getRawPath(), uri.getRawQuery()),
        (long) (responseEndMillis * TimeUnit.MILLISECONDS.toNanos(1)));
  }

  private void recordBrowserFailure(final Request request) {
    if (apiUriOrNull(request.url()) != null) {
      failedRequests.increment();
    }
  }

  /** {@code null} for anything that is not an API call, including URLs that do not parse. */
  static URI apiUriOrNull(final String url) {
    try {
      final URI uri = URI.create(url);
      return ApiRoutes.isApiPath(uri.getRawPath()) ? uri : null;
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  /** Run-level totals published next to the per-route latencies. */
  public record RecorderCounters(
      long requests, long failedRequests, int routes, long overflowRequests) {}
}
