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

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.platform.launcher.LauncherSession;
import org.junit.platform.launcher.LauncherSessionListener;
import org.openmetadata.it.bench.ApiLatencyRecorder.RecorderCounters;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Publishes what {@link ApiLatencyRecorder} saw as {@code target/benchmark/api-latency-<suite>.json}
 * when the test JVM's launcher session closes — the same directory the nightly already uploads.
 *
 * <p>Registered after {@code TestSuiteBootstrap} in {@code META-INF/services}. JUnit closes session
 * listeners in reverse order, so this runs while the embedded stack is still up.
 *
 * <p>Name the series with {@code -Djpw.bench.suite=<label>}: the nightly gives each job a stable
 * label so its numbers line up night over night. Without one, the file is suffixed with the pid,
 * because the default profiles run two failsafe executions in sequence and the second would
 * otherwise overwrite the first.
 */
public final class ApiLatencyReportListener implements LauncherSessionListener {

  static final String BENCHMARK_ID = "api-latency";

  private static final Logger LOG = LoggerFactory.getLogger(ApiLatencyReportListener.class);
  private static final String SUITE_PROPERTY = "jpw.bench.suite";
  private static final String UNLABELLED_SUITE = "it";
  private static final String EXTERNAL_MODE = "external";
  private static final String EMBEDDED_MODE = "embedded";

  @Override
  public void launcherSessionClosed(final LauncherSession session) {
    final ApiLatencyRecorder recorder = ApiLatencyRecorder.global();
    if (!ApiLatencyRecorder.isEnabled() || recorder.isEmpty()) {
      return;
    }
    try {
      BenchmarkMetrics.publish(report(recorder), fileName());
    } catch (IOException e) {
      LOG.warn("Could not publish the API latency report", e);
    }
  }

  private static BenchmarkReport report(final ApiLatencyRecorder recorder) {
    return BenchmarkMetrics.report(
        serverVersion(), BENCHMARK_ID, params(), recorder.latencies(), counters(recorder));
  }

  static String suite() {
    final String label = System.getProperty(SUITE_PROPERTY);
    return (label == null || label.isBlank()) ? UNLABELLED_SUITE : label.trim();
  }

  static String fileName() {
    final boolean labelled = System.getProperty(SUITE_PROPERTY) != null;
    final String stem = BENCHMARK_ID + "-" + suite();
    return (labelled ? stem : stem + "-" + ProcessHandle.current().pid()) + ".json";
  }

  private static Map<String, Object> params() {
    final Map<String, Object> params = new LinkedHashMap<>();
    params.put("suite", suite());
    final boolean external = OssTestServer.isExternalMode();
    params.put("mode", external ? EXTERNAL_MODE : EMBEDDED_MODE);
    if (!external) {
      params.put("databaseType", System.getProperty("databaseType", BenchmarkMetrics.UNKNOWN));
      params.put("searchType", System.getProperty("searchType", BenchmarkMetrics.UNKNOWN));
    }
    return params;
  }

  private static Map<String, Object> counters(final ApiLatencyRecorder recorder) {
    final RecorderCounters totals = recorder.counters();
    final Map<String, Object> counters = new LinkedHashMap<>();
    counters.put("requests", totals.requests());
    counters.put("failedRequests", totals.failedRequests());
    counters.put("routes", totals.routes());
    counters.put("overflowRequests", totals.overflowRequests());
    return counters;
  }

  /**
   * Only asked of an external cluster. In embedded and UI modes, building a client here could start
   * a server the run never needed just to read its version.
   */
  private static String serverVersion() {
    return OssTestServer.isExternalMode()
        ? BenchmarkMetrics.serverVersion(SdkClients.adminClient())
        : BenchmarkMetrics.UNKNOWN;
  }
}
