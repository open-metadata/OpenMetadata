package org.openmetadata.service.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.jobs.BackgroundJob;

class GenericBackgroundWorkerTest {
  @ParameterizedTest
  @EnumSource(
      value = BackgroundJob.JobType.class,
      names = {"CONTEXT_MEMORY_EXTRACTION", "ONTOLOGY_MEMORY_DERIVATION"})
  void memoryJobLeavesWorkerCapacityForOtherJobs(BackgroundJob.JobType firstType)
      throws InterruptedException {
    JobDAO jobDao = mock(JobDAO.class);
    CountDownLatch firstMemoryStarted = new CountDownLatch(1);
    CountDownLatch releaseFirstMemory = new CountDownLatch(1);
    CountDownLatch secondMemoryStarted = new CountDownLatch(1);
    CountDownLatch exportStarted = new CountDownLatch(1);
    AtomicBoolean firstOffered = new AtomicBoolean();
    AtomicBoolean secondOffered = new AtomicBoolean();
    AtomicBoolean exportOffered = new AtomicBoolean();
    BackgroundJob firstMemory = job(1L, firstType);
    BackgroundJob secondMemory = job(2L, BackgroundJob.JobType.CONTEXT_MEMORY_EXTRACTION);
    BackgroundJob export = job(3L, BackgroundJob.JobType.CSV_EXPORT);

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

  private BackgroundJob job(long id, BackgroundJob.JobType type) {
    BackgroundJob job = new BackgroundJob();
    job.setId(id);
    job.setJobType(type);
    job.setMethodName("test");
    return job;
  }
}
