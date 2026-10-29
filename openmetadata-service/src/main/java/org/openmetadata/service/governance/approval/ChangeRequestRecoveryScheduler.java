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

import io.dropwizard.lifecycle.Managed;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;

/**
 * Drives change requests whose post-commit hand-off did not complete: redelivers review signals that
 * are due or whose lease expired, and re-applies Approved requests left unapplied by a crash. Safe on
 * every node: delivery claims are compare-and-set and application is unique per request.
 */
@Slf4j
public final class ChangeRequestRecoveryScheduler implements Managed {
  private static final long PERIOD_SECONDS = 60;
  private static final long APPROVED_IDLE_MILLIS = 120_000L;
  private static final int BATCH = 100;
  private ScheduledExecutorService executor;

  @Override
  public void start() {
    executor =
        Executors.newSingleThreadScheduledExecutor(
            runnable -> new Thread(runnable, "change-request-recovery"));
    executor.scheduleWithFixedDelay(
        ChangeRequestRecoveryScheduler::runSafely,
        PERIOD_SECONDS,
        PERIOD_SECONDS,
        TimeUnit.SECONDS);
  }

  @Override
  public void stop() {
    if (executor != null) {
      executor.shutdownNow();
    }
  }

  public static void runOnce() {
    long now = System.currentTimeMillis();
    ChangeRequestService.dao()
        .changeRequestDAO()
        .listDueForDelivery(now, BATCH)
        .forEach(id -> ChangeRequestDelivery.deliver(UUID.fromString(id)));
    ChangeRequestService.dao()
        .changeRequestDAO()
        .listApprovedBefore(now - APPROVED_IDLE_MILLIS, BATCH)
        .forEach(id -> ChangeApplyService.apply(UUID.fromString(id)));
    ChangeRequestMetrics.pending(
        ChangeRequestService.dao()
            .changeRequestDAO()
            .countByStatus(ChangeRequestStatus.PENDING.value()));
  }

  private static void runSafely() {
    try {
      runOnce();
    } catch (Exception e) {
      LOG.error("[ChangeRequest] Recovery scan failed", e);
    }
  }
}
