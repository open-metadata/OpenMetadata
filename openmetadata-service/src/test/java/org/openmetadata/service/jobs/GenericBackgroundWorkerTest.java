package org.openmetadata.service.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.service.events.consumer.ServerStopping;
import org.openmetadata.service.llm.LLMCompletionException;

class GenericBackgroundWorkerTest {
  @AfterEach
  void serverIsRunningAgain() {
    ServerStopping.set(false);
  }

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

  /** The handler reports the stop as a job failure; any other error takes the unexpected path. */
  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void stopDuringAMemoryJobLeavesItRunningForRecovery(boolean asJobFailure)
      throws InterruptedException {
    BackgroundJob job = job(1L, BackgroundJobTypes.CONTEXT_MEMORY_EXTRACTION);

    BackgroundJob.Status status =
        statusAfterStop(
            job,
            interrupt ->
                asJobFailure
                    ? new BackgroundJobException(
                        job.getId(), "Context memory extraction failed", interrupt)
                    : new IllegalStateException("Interrupted", interrupt));

    assertEquals(BackgroundJob.Status.RUNNING, status);
  }

  /** Nothing requeues these types, and a RUNNING Collate admin-ops job blocks new ones. */
  @ParameterizedTest
  @ValueSource(
      strings = {
        BackgroundJobTypes.CUSTOM_PROPERTY_ENUM_CLEANUP,
        BackgroundJobTypes.CSV_IMPORT,
        BackgroundJobTypes.CSV_EXPORT,
        BackgroundJobTypes.AUDIT_EXPORT,
        BackgroundJobTypes.ONTOLOGY_BULK,
        BackgroundJobTypes.ONTOLOGY_PACK_INSTALL,
        BackgroundJobTypes.MEMORY_GLOSSARY_DERIVATION,
        "DELETE_ENTITY",
        "ADMIN_OPS_REINDEX"
      })
  void stopDuringAnotherJobStillMarksItFailed(String type) throws InterruptedException {
    BackgroundJob job = job(1L, type);

    BackgroundJob.Status status =
        statusAfterStop(job, interrupt -> new IllegalStateException("Interrupted", interrupt));

    assertEquals(BackgroundJob.Status.FAILED, status);
  }

  @ParameterizedTest(name = "{0} interrupted={1} serverStopping={2} -> {3}")
  @CsvSource({
    "CONTEXT_MEMORY_EXTRACTION, true, false, true",
    "CONTEXT_MEMORY_EXTRACTION, false, true, true",
    "CONTEXT_MEMORY_EXTRACTION, false, false, false",
    "CUSTOM_PROPERTY_ENUM_CLEANUP, true, false, false",
    "CUSTOM_PROPERTY_ENUM_CLEANUP, false, true, false"
  })
  void onlyAMemoryJobCutShortByAStopIsLeftForRecovery(
      String type, boolean interrupted, boolean serverStopping, boolean expected) {
    ServerStopping.set(serverStopping);
    Throwable cause =
        interrupted
            ? new InterruptedException()
            : new LLMCompletionException("OpenAI API returned status 500");
    BackgroundJobException failure =
        new BackgroundJobException(1L, "Context memory extraction failed", cause);

    assertEquals(expected, GenericBackgroundWorker.isLeftForRecovery(job(1L, type), failure));
  }

  /** Left RUNNING, a real failure would be requeued by the stale-job reaper and retried forever. */
  @Test
  void aRealLlmFailureStillMarksFailed() throws InterruptedException {
    BackgroundJob job = job(1L, BackgroundJobTypes.CONTEXT_MEMORY_EXTRACTION);
    JobDAO jobDao = mock(JobDAO.class);
    CountDownLatch statusWritten = new CountDownLatch(1);
    Map<Long, BackgroundJob.Status> statuses = queue(jobDao, job, statusWritten);
    LLMCompletionException failure = new LLMCompletionException("OpenAI API returned status 500");
    GenericBackgroundWorker worker =
        new GenericBackgroundWorker(jobDao, registry(failingWith(failure)));

    worker.start();
    boolean written = statusWritten.await(5, TimeUnit.SECONDS);
    worker.stop();

    assertTrue(written);
    assertEquals(BackgroundJob.Status.FAILED, statuses.get(job.getId()));
  }

  /** Runs {@code job} until its handler blocks, stops the worker, and returns the stored status. */
  private BackgroundJob.Status statusAfterStop(
      BackgroundJob job, Function<InterruptedException, RuntimeException> failure)
      throws InterruptedException {
    JobDAO jobDao = mock(JobDAO.class);
    Map<Long, BackgroundJob.Status> statuses = queue(jobDao, job, new CountDownLatch(1));
    BlockingHandler handler = new BlockingHandler(failure);
    GenericBackgroundWorker worker = new GenericBackgroundWorker(jobDao, registry(handler));

    worker.start();
    boolean started = handler.started.await(5, TimeUnit.SECONDS);
    worker.stop();
    handler.release.countDown();

    assertTrue(started);
    assertTrue(handler.failed.await(5, TimeUnit.SECONDS));
    return statuses.get(job.getId());
  }

  /** Offers {@code job} once and keeps the status the worker claims or writes for it. */
  private static Map<Long, BackgroundJob.Status> queue(
      JobDAO jobDao, BackgroundJob job, CountDownLatch statusWritten) {
    Map<Long, BackgroundJob.Status> statuses = new ConcurrentHashMap<>();
    AtomicBoolean offered = new AtomicBoolean();
    when(jobDao.fetchPendingJob(anyBoolean()))
        .thenAnswer(
            ignored -> offered.compareAndSet(false, true) ? Optional.of(job) : Optional.empty());
    when(jobDao.claimPendingJob(job.getId()))
        .thenAnswer(
            ignored -> {
              statuses.put(job.getId(), BackgroundJob.Status.RUNNING);
              return 1;
            });
    doAnswer(
            invocation -> {
              statuses.put(invocation.getArgument(0), invocation.getArgument(1));
              statusWritten.countDown();
              return null;
            })
        .when(jobDao)
        .updateJobStatus(anyLong(), any());
    return statuses;
  }

  private static JobHandlerRegistry registry(JobHandler handler) {
    JobHandlerRegistry registry = new JobHandlerRegistry();
    registry.register("test", handler);
    return registry;
  }

  // Failures expected to mark FAILED are thrown unwrapped: the BackgroundJobException branch also
  // notifies the job's creator over the websocket, which needs a running server.
  private static JobHandler failingWith(RuntimeException failure) {
    return new JobHandler() {
      @Override
      public void runJob(BackgroundJob job) {
        throw failure;
      }

      @Override
      public boolean sendStatusToWebSocket() {
        return false;
      }
    };
  }

  /** Blocks until {@code stop()} interrupts it, then fails with the error {@code failure} builds. */
  private static final class BlockingHandler implements JobHandler {
    private final CountDownLatch started = new CountDownLatch(1);
    private final CountDownLatch release = new CountDownLatch(1);
    private final CountDownLatch failed = new CountDownLatch(1);
    private final Function<InterruptedException, RuntimeException> failure;

    private BlockingHandler(Function<InterruptedException, RuntimeException> failure) {
      this.failure = failure;
    }

    @Override
    public void runJob(BackgroundJob job) {
      started.countDown();
      try {
        release.await();
      } catch (InterruptedException interrupt) {
        Thread.currentThread().interrupt();
        failed.countDown();
        throw failure.apply(interrupt);
      }
    }

    @Override
    public boolean sendStatusToWebSocket() {
      return false;
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
