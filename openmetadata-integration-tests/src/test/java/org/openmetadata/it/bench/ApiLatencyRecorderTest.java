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

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.openmetadata.sdk.network.CompletedRequest;

class ApiLatencyRecorderTest {

  private static final long TEN_MILLIS = TimeUnit.MILLISECONDS.toNanos(10);

  @Test
  void aggregatesSdkCallsPerRouteNotPerEntity() {
    final ApiLatencyRecorder recorder = new ApiLatencyRecorder(ApiLatencyRecorder.MAX_ROUTES);

    recorder.onRequestCompleted(completed("GET", "/api/v1/tables/name/svc.db.sc.a", 200));
    recorder.onRequestCompleted(completed("GET", "/api/v1/tables/name/svc.db.sc.b", 200));

    assertThat(recorder.latencies())
        .containsOnlyKeys("sdk GET /v1/tables/name/{fqn}")
        .extractingByKey("sdk GET /v1/tables/name/{fqn}")
        .extracting(Latency::sampleCount)
        .isEqualTo(2);
  }

  @Test
  void countsErrorResponsesAndKeepsTheirLatency() {
    final ApiLatencyRecorder recorder = new ApiLatencyRecorder(ApiLatencyRecorder.MAX_ROUTES);

    recorder.onRequestCompleted(completed("GET", "/api/v1/tables", 500));

    assertThat(recorder.counters().failedRequests()).isEqualTo(1);
    assertThat(recorder.latencies()).containsKey("sdk GET /v1/tables");
  }

  @Test
  void countsCallsThatGotNoResponseWithoutRecordingALatency() {
    final ApiLatencyRecorder recorder = new ApiLatencyRecorder(ApiLatencyRecorder.MAX_ROUTES);

    recorder.onRequestCompleted(completed("GET", "/api/v1/tables", CompletedRequest.NO_RESPONSE));

    assertThat(recorder.counters().failedRequests()).isEqualTo(1);
    assertThat(recorder.isEmpty()).isTrue();
  }

  @Test
  void foldsRoutesBeyondTheCapIntoOneOverflowEntry() {
    final ApiLatencyRecorder recorder = new ApiLatencyRecorder(2);

    recorder.record(ApiLatencyRecorder.SDK_SOURCE, "GET /v1/a", TEN_MILLIS);
    recorder.record(ApiLatencyRecorder.SDK_SOURCE, "GET /v1/b", TEN_MILLIS);
    recorder.record(ApiLatencyRecorder.SDK_SOURCE, "GET /v1/c", TEN_MILLIS);
    recorder.record(ApiLatencyRecorder.SDK_SOURCE, "GET /v1/d", TEN_MILLIS);

    assertThat(recorder.latencies())
        .containsOnlyKeys(
            "sdk GET /v1/a", "sdk GET /v1/b", "sdk " + ApiLatencyRecorder.OVERFLOW_ROUTE);
    assertThat(recorder.counters().overflowRequests()).isEqualTo(2);
  }

  @Test
  void keepsTheBrowserAndTheSdkViewsOfOneRouteApart() {
    final ApiLatencyRecorder recorder = new ApiLatencyRecorder(ApiLatencyRecorder.MAX_ROUTES);

    recorder.record(ApiLatencyRecorder.SDK_SOURCE, "GET /v1/lineage/scene", TEN_MILLIS);
    recorder.record(ApiLatencyRecorder.UI_SOURCE, "GET /v1/lineage/scene", TEN_MILLIS);

    assertThat(recorder.latencies())
        .containsOnlyKeys("sdk GET /v1/lineage/scene", "ui GET /v1/lineage/scene");
  }

  @Test
  void acceptsOnlyParseableApiUrlsFromTheBrowser() {
    assertThat(ApiLatencyRecorder.apiUriOrNull("http://localhost:8585/api/v1/tables?limit=1"))
        .isNotNull();
    assertThat(ApiLatencyRecorder.apiUriOrNull("http://localhost:8585/assets/app.js")).isNull();
    assertThat(ApiLatencyRecorder.apiUriOrNull("data:image/png;base64,AAAA")).isNull();
    assertThat(ApiLatencyRecorder.apiUriOrNull("http://host/api/v1/search?q={broken")).isNull();
  }

  private static CompletedRequest completed(
      final String method, final String path, final int status) {
    return new CompletedRequest(method, path, null, status, TEN_MILLIS);
  }
}
