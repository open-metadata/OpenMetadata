package org.openmetadata.service.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.jobs.BackgroundJob;

class GenericBackgroundWorkerTest {
  @ParameterizedTest
  @ValueSource(strings = {"CONTEXT_MEMORY_EXTRACTION", "MEMORY_GLOSSARY_DERIVATION"})
  void memoryJobLeavesWorkerCapacityForOtherJobs(String firstType) throws InterruptedException {
    JobDAO jobDao = mock(JobDAO.class);
    CountDownLatch firstMemoryStarted = new CountDownLatch(1);
    CountDownLatch releaseFirstMemory = new CountDownLatch(1);
    CountDownLatch secondMemoryStarted = new CountDownLatch(1);
    CountDownLatch exportStarted = new CountDownLatch(1);
    AtomicBoolean firstOffered = new AtomicBoolean();
    AtomicBoolean secondOffered = new AtomicBoolean();
    AtomicBoolean exportOffered = new AtomicBoolean();
    BackgroundJob firstMemory = job(1L, firstType);
    BackgroundJob secondMemory = job(2L, BackgroundJobTypes.CONTEXT_MEMORY_EXTRACTION);
    BackgroundJob export = job(3L, BackgroundJobTypes.CSV_EXPORT);

    when(jobDao.fetchPendingJob(anyBoolean()))
        .thenAnswer(
            invocation -> {
              boolean includeMemory = invocation.getArgument(0);
              if (includeMemory && firstOffered.compareAndSet(false, true)) {
                return Optional.of(firstMemory);
              }
              if (includeMemory && secondOffered.compareAndSet(false, true)) {
                return Optional.of(secondMemory);
              }
              if (exportOffered.compareAndSet(false, true)) {
                return Optional.of(export);
              }
              return Optional.empty();
            });
    when(jobDao.claimPendingJob(anyLong())).thenReturn(1);
    when(jobDao.fetchJobById(anyLong())).thenReturn(Optional.empty());
    JobHandlerRegistry registry = new JobHandlerRegistry();
    registry.register(
        "test",
        new JobHandler() {
          @Override
          public void runJob(BackgroundJob job) {
            if (job.getId().equals(firstMemory.getId())) {
              firstMemoryStarted.countDown();
              try {
                releaseFirstMemory.await();
              } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
              }
            } else if (job.getId().equals(secondMemory.getId())) {
              secondMemoryStarted.countDown();
            } else {
              exportStarted.countDown();
            }
          }

          @Override
          public boolean sendStatusToWebSocket() {
            return false;
          }
        });

    GenericBackgroundWorker worker = new GenericBackgroundWorker(jobDao, registry);
    worker.start();
    try {
      assertTrue(firstMemoryStarted.await(5, TimeUnit.SECONDS));
      assertTrue(exportStarted.await(5, TimeUnit.SECONDS));
      assertFalse(secondOffered.get());
      assertEquals(1L, secondMemoryStarted.getCount());
    } finally {
      releaseFirstMemory.countDown();
      worker.stop();
    }
  }

  @Test
  void runsAJobTypeOpenMetadataDoesNotDefineWithItsRegisteredHandler() throws InterruptedException {
    JobDAO jobDao = mock(JobDAO.class);
    BackgroundJob downstreamJob = job(4L, "DOWNSTREAM_REINDEX");
    AtomicBoolean offered = new AtomicBoolean();
    when(jobDao.fetchPendingJob(anyBoolean()))
        .thenAnswer(
            invocation ->
                offered.compareAndSet(false, true) ? Optional.of(downstreamJob) : Optional.empty());
    when(jobDao.claimPendingJob(anyLong())).thenReturn(1);
    when(jobDao.fetchJobById(anyLong())).thenReturn(Optional.empty());
    CountDownLatch ran = new CountDownLatch(1);
    AtomicReference<String> ranType = new AtomicReference<>();
    JobHandlerRegistry registry = new JobHandlerRegistry();
    registry.register(
        "test",
        new JobHandler() {
          @Override
          public void runJob(BackgroundJob job) {
            ranType.set(job.getJobType());
            ran.countDown();
          }

          @Override
          public boolean sendStatusToWebSocket() {
            return false;
          }
        });

    GenericBackgroundWorker worker = new GenericBackgroundWorker(jobDao, registry);
    worker.start();
    try {
      assertTrue(ran.await(5, TimeUnit.SECONDS));
      assertEquals("DOWNSTREAM_REINDEX", ranType.get());
      verify(jobDao, timeout(5_000)).updateJobStatus(4L, BackgroundJob.Status.COMPLETED);
    } finally {
      worker.stop();
    }
  }

  private BackgroundJob job(long id, String type) {
    BackgroundJob job = new BackgroundJob();
    job.setId(id);
    job.setJobType(type);
    job.setMethodName("test");
    return job;
  }
}
