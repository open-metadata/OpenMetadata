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
package org.openmetadata.service.governance.approval;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import java.util.concurrent.atomic.AtomicLong;
import org.openmetadata.schema.governance.changeRequest.LifecycleEventType;

/** Operational metrics for approval-gated change requests. */
public final class ChangeRequestMetrics {
  private static final String ADMISSION = "change_request_admission";
  private static final String ADMISSION_LATENCY = "change_request_admission_latency";
  private static final String LIFECYCLE = "change_request_lifecycle";
  private static final String DELIVERY = "change_request_delivery";
  private static final AtomicLong PENDING =
      Metrics.gauge("change_request_pending", new AtomicLong());

  private ChangeRequestMetrics() {}

  /** An edit that touched gated fields: held for review, or only recorded under shadow mode. */
  public static void admission(String entityType, boolean shadow) {
    Metrics.counter(ADMISSION, "entityType", entityType, "outcome", shadow ? "shadow" : "held")
        .increment();
  }

  public static Timer.Sample startAdmission() {
    return Timer.start(Metrics.globalRegistry);
  }

  public static void stopAdmission(Timer.Sample sample, String entityType) {
    sample.stop(Metrics.timer(ADMISSION_LATENCY, "entityType", entityType));
  }

  public static void lifecycle(String entityType, LifecycleEventType eventType) {
    Metrics.counter(LIFECYCLE, "entityType", entityType, "event", eventType.value()).increment();
  }

  /** Delivery attempt outcomes: delivered, retrying or attentionRequired. */
  public static void delivery(String result) {
    Metrics.counter(DELIVERY, "result", result).increment();
  }

  public static void pending(long count) {
    PENDING.set(count);
  }
}
