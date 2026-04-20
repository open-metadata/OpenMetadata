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

package org.openmetadata.service.apps.bundles.rdf.distributed;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.rdf.RdfRepository;

class DistributedRdfIndexExecutorTest {

  @Test
  void executeReleasesCoordinatorStateWhenWorkerStartupFails() {
    CollectionDAO collectionDAO = org.mockito.Mockito.mock(CollectionDAO.class);
    DistributedRdfIndexCoordinator coordinator =
        org.mockito.Mockito.mock(DistributedRdfIndexCoordinator.class);

    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfiguration =
        new EventPublisherJob().withEntities(Set.of("table")).withConsumerThreads(1);
    RdfIndexJob job =
        RdfIndexJob.builder()
            .id(jobId)
            .status(
                org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus.READY)
            .jobConfiguration(jobConfiguration)
            .build();

    when(coordinator.getBlockingJob()).thenReturn(Optional.empty());
    when(coordinator.tryAcquireReindexLock(any(UUID.class))).thenReturn(true);
    when(coordinator.createJob(Set.of("table"), jobConfiguration, "admin")).thenReturn(job);
    when(coordinator.initializePartitions(jobId)).thenReturn(job);
    when(coordinator.transferReindexLock(any(UUID.class), any(UUID.class))).thenReturn(true);
    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(job);

    DistributedRdfIndexExecutor executor =
        new DistributedRdfIndexExecutor(collectionDAO, coordinator, "rdf-test-server");
    executor.createJob(Set.of("table"), jobConfiguration, "admin");

    try (MockedStatic<RdfRepository> rdfRepository = mockStatic(RdfRepository.class)) {
      rdfRepository.when(RdfRepository::getInstance).thenThrow(new IllegalStateException("boom"));

      assertThrows(IllegalStateException.class, () -> executor.execute(jobConfiguration));
    }

    verify(coordinator).releaseReindexLock(jobId);
    assertFalse(DistributedRdfIndexExecutor.isCoordinatingJob(jobId));
    verify(coordinator)
        .updateJobStatus(
            jobId,
            org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus.RUNNING,
            null);
  }

  @Test
  void stopAndCoordinatorCleanupOnlyTearDownLocalExecutionOnce() throws Exception {
    CollectionDAO collectionDAO = org.mockito.Mockito.mock(CollectionDAO.class);
    DistributedRdfIndexCoordinator coordinator =
        org.mockito.Mockito.mock(DistributedRdfIndexCoordinator.class);
    ExecutorService workerExecutor = org.mockito.Mockito.mock(ExecutorService.class);

    when(workerExecutor.awaitTermination(anyLong(), any(TimeUnit.class))).thenReturn(true);

    DistributedRdfIndexExecutor executor =
        new DistributedRdfIndexExecutor(collectionDAO, coordinator, "rdf-test-server");

    Thread lockRefreshThread = startSleepingThread("rdf-lock-refresh-test");
    Thread staleReclaimerThread = startSleepingThread("rdf-stale-reclaimer-test");

    setField(executor, "workerExecutor", workerExecutor);
    setField(executor, "lockRefreshThread", lockRefreshThread);
    setField(executor, "staleReclaimerThread", staleReclaimerThread);
    getField(executor, "localExecutionCleaned", AtomicBoolean.class).set(false);

    executor.stop();
    invokeCleanupCoordinatorExecution(executor);

    verify(workerExecutor).shutdownNow();
    verify(workerExecutor).awaitTermination(30, TimeUnit.SECONDS);
    assertFalse(lockRefreshThread.isAlive());
    assertFalse(staleReclaimerThread.isAlive());
    assertTrue(getField(executor, "localExecutionCleaned", AtomicBoolean.class).get());
  }

  private static Thread startSleepingThread(String name) {
    return Thread.ofPlatform()
        .name(name)
        .start(
            () -> {
              try {
                Thread.sleep(Long.MAX_VALUE);
              } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
              }
            });
  }

  private static void invokeCleanupCoordinatorExecution(DistributedRdfIndexExecutor executor)
      throws Exception {
    Method method =
        DistributedRdfIndexExecutor.class.getDeclaredMethod("cleanupCoordinatorExecution");
    method.setAccessible(true);
    method.invoke(executor);
  }

  private static void setField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }

  @SuppressWarnings("unchecked")
  private static <T> T getField(Object target, String fieldName, Class<T> type) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    return (T) field.get(target);
  }
}
