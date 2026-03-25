/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.openmetadata.service.jdbi3.CollectionDAO;

class OrphanJobMonitorTest {

  private final CollectionDAO collectionDAO = mock(CollectionDAO.class);
  private final OrphanJobMonitor monitor = new OrphanJobMonitor(collectionDAO);

  @AfterEach
  void tearDown() {
    Thread.interrupted();
    monitor.shutdown();
  }

  @Test
  void testStartIsIdempotentWhileSchedulerIsActive() throws Exception {
    monitor.start();
    ScheduledExecutorService firstScheduler = getScheduler();

    monitor.start();

    assertNotNull(firstScheduler);
    assertSame(firstScheduler, getScheduler());
  }

  @Test
  void testShutdownForcesNowWhenSchedulerDoesNotTerminate() throws Exception {
    ScheduledExecutorService scheduler = mock(ScheduledExecutorService.class);
    when(scheduler.isShutdown()).thenReturn(false);
    when(scheduler.awaitTermination(5, TimeUnit.SECONDS)).thenReturn(false);
    setScheduler(scheduler);

    monitor.shutdown();

    verify(scheduler).shutdown();
    verify(scheduler).shutdownNow();
  }

  @Test
  void testShutdownPreservesInterruptWhenAwaitTerminationIsInterrupted() throws Exception {
    ScheduledExecutorService scheduler = mock(ScheduledExecutorService.class);
    when(scheduler.isShutdown()).thenReturn(false);
    doThrow(new InterruptedException("stop")).when(scheduler).awaitTermination(5, TimeUnit.SECONDS);
    setScheduler(scheduler);

    monitor.shutdown();

    verify(scheduler).shutdown();
    verify(scheduler).shutdownNow();
    assertTrue(Thread.currentThread().isInterrupted());
  }

  @Test
  void testCheckForOrphanedJobsTriggersRecoveryLoggingPath() throws Exception {
    try (MockedConstruction<JobRecoveryManager> recoveryConstruction =
        mockConstruction(
            JobRecoveryManager.class,
            (mock, context) ->
                when(mock.performStartupRecovery())
                    .thenReturn(
                        JobRecoveryManager.RecoveryResult.builder()
                            .orphanedJobsFound(2)
                            .incrementRecovered()
                            .incrementFailed()
                            .build()))) {

      invokeCheckForOrphanedJobs();

      verify(recoveryConstruction.constructed().get(0)).performStartupRecovery();
    }
  }

  @Test
  void testCheckForOrphanedJobsSwallowsRecoveryErrors() throws Exception {
    try (MockedConstruction<JobRecoveryManager> recoveryConstruction =
        mockConstruction(
            JobRecoveryManager.class,
            (mock, context) ->
                when(mock.performStartupRecovery()).thenThrow(new IllegalStateException("boom")))) {

      invokeCheckForOrphanedJobs();

      verify(recoveryConstruction.constructed().get(0)).performStartupRecovery();
    }
  }

  private void invokeCheckForOrphanedJobs() throws Exception {
    Method method = OrphanJobMonitor.class.getDeclaredMethod("checkForOrphanedJobs");
    method.setAccessible(true);
    method.invoke(monitor);
  }

  private ScheduledExecutorService getScheduler() throws Exception {
    Field field = OrphanJobMonitor.class.getDeclaredField("scheduler");
    field.setAccessible(true);
    return (ScheduledExecutorService) field.get(monitor);
  }

  private void setScheduler(ScheduledExecutorService scheduler) throws Exception {
    Field field = OrphanJobMonitor.class.getDeclaredField("scheduler");
    field.setAccessible(true);
    field.set(monitor, scheduler);
  }
}
