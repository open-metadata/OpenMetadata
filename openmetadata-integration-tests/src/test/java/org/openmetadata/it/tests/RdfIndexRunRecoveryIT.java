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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.rdf.RdfIndexRunRecovery;
import org.openmetadata.service.apps.bundles.rdf.RdfReindexRunLock;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;

/**
 * A server starting up must end the RDF index runs whose server stopped, and leave alone a run
 * still executing elsewhere, on MySQL and Postgres. Each test uses its own app name and lock key,
 * so real runs and the concurrent tests sharing this database are unaffected. The recheck a live
 * run schedules is run by hand, so no test waits for a lock to expire.
 */
@Execution(ExecutionMode.CONCURRENT)
public class RdfIndexRunRecoveryIT {
  private static final String STATUS = AppExtension.ExtensionType.STATUS.toString();
  private static final long STARTUP = 2_000L;

  private final UUID appId = UUID.randomUUID();
  private final String appName = "RdfIndexRunRecoveryIT-" + appId;
  private final String lockKey = "RdfIndexRunRecoveryIT-" + appId;
  private final Deque<Runnable> checks = new ArrayDeque<>();
  private final Deque<Long> checkDelays = new ArrayDeque<>();
  private CollectionDAO.AppExtensionTimeSeries runs;
  private RdfReindexLockDAO locks;
  private RdfIndexRunRecovery recovery;

  @BeforeEach
  void connect() {
    runs = Entity.getCollectionDAO().appExtensionTimeSeriesDao();
    locks = Entity.getCollectionDAO().rdfReindexLockDAO();
    recovery =
        new RdfIndexRunRecovery(
            runs,
            locks,
            appName,
            lockKey,
            System::currentTimeMillis,
            (delayMs, check) -> {
              checkDelays.add(delayMs);
              checks.add(check);
            });
  }

  @AfterEach
  void cleanUp() {
    runs.deleteAllByAppId(appId.toString());
    locks.delete(lockKey);
  }

  @Test
  void runIsEndedAtOnceWhenNoLiveRunHoldsTheLock() {
    insert(run(1_000L, AppRunRecord.Status.RUNNING));
    final long longAgo = System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(10);
    locks.insertIfNotExists(
        lockKey, "run-1", "server-a", longAgo, longAgo, longAgo + RdfReindexRunLock.EXPIRY_MS);

    recovery.recover(STARTUP);

    final AppRunRecord ended = read(1_000L);
    assertEquals(AppRunRecord.Status.FAILED, ended.getStatus());
    assertTrue(failureOf(ended).contains("Still running when server"), failureOf(ended));
    assertTrue(checks.isEmpty());
  }

  @Test
  void runHoldingTheLockIsLeftRunningAndEndedOnceItsServerStopsRenewing() {
    insert(run(1_000L, AppRunRecord.Status.RUNNING));
    holdLiveLock("run-1", "server-a");

    recovery.recover(STARTUP);

    final AppRunRecord live = read(1_000L);
    assertEquals(AppRunRecord.Status.RUNNING, live.getStatus());
    assertNull(live.getEndTime());
    assertEquals(1, checks.size());
    final long untilExpiry = locks.findByKey(lockKey).expiresAt() - System.currentTimeMillis();
    assertTrue(checkDelays.getFirst() > untilExpiry, "the recheck waits for the lock to expire");

    expireLock("run-1", "server-a");
    runNextCheck();

    final AppRunRecord ended = read(1_000L);
    assertEquals(AppRunRecord.Status.FAILED, ended.getStatus());
    assertTrue(
        failureOf(ended).contains("server 'server-a' stopped renewing the lock"), failureOf(ended));
    assertTrue(checks.isEmpty());
  }

  @Test
  void runThatKeepsRenewingIsLeftToReportItsOwnStatus() {
    insert(run(1_000L, AppRunRecord.Status.RUNNING));
    holdLiveLock("run-1", "server-a");
    recovery.recover(STARTUP);

    runNextCheck();

    assertEquals(AppRunRecord.Status.RUNNING, read(1_000L).getStatus());
    assertEquals(1, checks.size());

    runs.update(
        appId.toString(),
        JsonUtils.pojoToJson(run(1_000L, AppRunRecord.Status.SUCCESS)),
        1_000L,
        STATUS);
    locks.releaseLock(lockKey, "run-1");
    runNextCheck();

    assertEquals(AppRunRecord.Status.SUCCESS, read(1_000L).getStatus());
    assertTrue(checks.isEmpty());
  }

  @Test
  void runThatTookTheLockOverAfterStartupIsLeftAlone() {
    insert(run(1_000L, AppRunRecord.Status.RUNNING));
    holdLiveLock("run-1", "server-a");
    recovery.recover(STARTUP);

    locks.delete(lockKey);
    holdLiveLock("run-2", "server-b");
    insert(run(3_000L, AppRunRecord.Status.RUNNING));
    runNextCheck();

    assertEquals(AppRunRecord.Status.FAILED, read(1_000L).getStatus());
    assertEquals(AppRunRecord.Status.RUNNING, read(3_000L).getStatus());
    assertTrue(checks.isEmpty());
  }

  private void holdLiveLock(final String runId, final String serverId) {
    final long now = System.currentTimeMillis();
    locks.insertIfNotExists(lockKey, runId, serverId, now, now, now + RdfReindexRunLock.EXPIRY_MS);
  }

  private void expireLock(final String runId, final String serverId) {
    locks.delete(lockKey);
    final long longAgo = System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(10);
    locks.insertIfNotExists(
        lockKey, runId, serverId, longAgo, longAgo, longAgo + RdfReindexRunLock.EXPIRY_MS);
  }

  private void runNextCheck() {
    checkDelays.removeFirst();
    checks.removeFirst().run();
  }

  private AppRunRecord run(final long timestamp, final AppRunRecord.Status status) {
    return new AppRunRecord()
        .withAppId(appId)
        .withAppName(appName)
        .withTimestamp(timestamp)
        .withStartTime(timestamp)
        .withStatus(status);
  }

  private void insert(final AppRunRecord run) {
    runs.insert(JsonUtils.pojoToJson(run), STATUS);
  }

  private AppRunRecord read(final long timestamp) {
    final List<String> found =
        runs.listAppExtensionInWindowByName(appName, 1, 0, timestamp, timestamp + 1, STATUS);
    assertEquals(1, found.size(), appName + " run at " + timestamp);
    return JsonUtils.readValue(found.getFirst(), AppRunRecord.class);
  }

  private static String failureOf(final AppRunRecord run) {
    return run.getFailureContext().getFailure().getMessage();
  }
}
