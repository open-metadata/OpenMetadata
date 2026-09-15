package org.openmetadata.service.entity.bulk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.base.Ticker;
import jakarta.ws.rs.WebApplicationException;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;

class EntityBulkJobsTest {
  @Test
  void admissionRemainsBoundedAndCompletionReleasesCapacity() {
    final Fixture fixture = new Fixture(2, 10);
    final EntityBulkJobs.Job first = fixture.submit();
    final EntityBulkJobs.Job second = fixture.submit();
    assertEquals(ApiStatus.RUNNING, fixture.jobs.status(first.id()).orElseThrow().getStatus());
    final WebApplicationException rejected =
        assertThrows(WebApplicationException.class, fixture::submit);
    assertEquals(429, rejected.getResponse().getStatus());
    assertEquals("Too many concurrent bulk jobs (max 2). Retry later.", rejected.getMessage());
    fixture.runNext();
    assertSame(fixture.result, first.result().join());
    assertSame(fixture.result, fixture.jobs.status(first.id()).orElseThrow());
    assertFalse(second.result().isDone());
    fixture.submit();
    assertEquals(2, fixture.work.size());
  }

  @Test
  void completedHistoryIsBoundedWhileActiveJobsRemainAvailable() {
    final Fixture fixture = new Fixture(2, 1);
    final EntityBulkJobs.Job active = fixture.submit();
    final Runnable pending = fixture.work.remove();
    final EntityBulkJobs.Job first = fixture.submit();
    fixture.runNext();
    final EntityBulkJobs.Job second = fixture.submit();
    fixture.runNext();
    assertTrue(fixture.jobs.status(first.id()).isEmpty());
    assertSame(fixture.result, fixture.jobs.status(second.id()).orElseThrow());
    assertEquals(ApiStatus.RUNNING, fixture.jobs.status(active.id()).orElseThrow().getStatus());
    assertFalse(active.result().isDone());
    pending.run();
    assertSame(fixture.result, active.result().join());
    assertSame(fixture.result, first.result().join());
  }

  @Test
  void expiryStartsAtCompletionAndNeverExpiresRunningWork() {
    final Fixture fixture = new Fixture(1, 10);
    final EntityBulkJobs.Job job = fixture.submit();
    fixture.elapsed = Duration.ofHours(1).toNanos();
    assertEquals(ApiStatus.RUNNING, fixture.jobs.status(job.id()).orElseThrow().getStatus());
    fixture.runNext();
    fixture.elapsed += Duration.ofMinutes(5).toNanos() - 1;
    assertSame(fixture.result, fixture.jobs.status(job.id()).orElseThrow());
    fixture.elapsed++;
    assertTrue(fixture.jobs.status(job.id()).isEmpty());
    assertSame(fixture.result, job.result().join());
    assertTrue(fixture.jobs.status("unknown").isEmpty());
  }

  @Test
  void partialAuthorizationFailuresAreMergedIntoTheCompletedResult() {
    final Fixture fixture = new Fixture(1, 10);
    final BulkResponse existing = new BulkResponse().withRequest("failed").withStatus(400);
    final BulkResponse denied = new BulkResponse().withRequest("denied").withStatus(403);
    fixture
        .result
        .withNumberOfRowsPassed(2)
        .withNumberOfRowsFailed(1)
        .withFailedRequest(new ArrayList<>(List.of(existing)));
    final EntityBulkJobs.Job job =
        fixture.jobs.submit(
            List.of(1, 2, 3),
            () -> fixture.result,
            new EntityBulkJobs.Authorization(List.of(denied), 4));
    fixture.runNext();
    final BulkOperationResult result = job.result().join();
    assertEquals(4, result.getNumberOfRowsProcessed());
    assertEquals(2, result.getNumberOfRowsFailed());
    assertEquals(2, result.getNumberOfRowsPassed());
    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
    assertEquals(List.of(existing, denied), result.getFailedRequest());
  }

  @Test
  void failedWorkRetainsItsFailureCountsAndAuthorizationFailures() {
    final Fixture fixture = new Fixture(1, 10);
    final BulkResponse denied = new BulkResponse().withRequest("denied").withStatus(403);
    final EntityBulkJobs.Job job =
        fixture.jobs.submit(
            List.of(1, 2),
            () -> {
              throw new IllegalStateException("Injected bulk failure");
            },
            new EntityBulkJobs.Authorization(List.of(denied), 3));
    fixture.runNext();
    final BulkOperationResult result = job.result().join();
    assertEquals(ApiStatus.FAILURE, result.getStatus());
    assertEquals(3, result.getNumberOfRowsFailed());
    assertEquals(0, result.getNumberOfRowsPassed());
    assertEquals(3, result.getNumberOfRowsProcessed());
    assertEquals(List.of(denied), result.getFailedRequest());
    fixture.submit();
  }

  @Test
  void schedulingRejectionReleasesAdmissionCapacity() {
    final Fixture fixture = new Fixture(1, 10);
    fixture.reject = true;
    assertThrows(RejectedExecutionException.class, fixture::submit);
    fixture.reject = false;
    fixture.submit();
    assertEquals(1, fixture.work.size());
  }

  @Test
  void cancellingTheReturnedFutureDoesNotAdmitWorkBeforeItsAcceptedMutationFinishes() {
    final Fixture fixture = new Fixture(1, 10);
    final EntityBulkJobs.Job job = fixture.submit();
    assertTrue(job.result().cancel(false));
    assertThrows(WebApplicationException.class, fixture::submit);
    fixture.runNext();
    assertEquals(1, fixture.completedMutations);
    assertTrue(job.result().isCancelled());
    assertEquals(ApiStatus.RUNNING, fixture.jobs.status(job.id()).orElseThrow().getStatus());
    fixture.submit();
  }

  @Test
  void errorsRemainExceptionalAndStillReleaseCapacity() {
    final Fixture fixture = new Fixture(1, 10);
    final AssertionError error = new AssertionError("Injected fatal error");
    final EntityBulkJobs.Job job =
        fixture.jobs.submit(
            List.of(1),
            () -> {
              throw error;
            },
            fixture.authorization);
    fixture.runNext();
    assertSame(
        error, assertThrows(CompletionException.class, () -> job.result().join()).getCause());
    assertEquals(ApiStatus.RUNNING, fixture.jobs.status(job.id()).orElseThrow().getStatus());
    fixture.submit();
  }

  @Test
  void directExecutorsAndEmptyAuthorizationKeepTheOriginalResult() {
    final BulkOperationResult result =
        new BulkOperationResult().withStatus(ApiStatus.SUCCESS).withNumberOfRowsProcessed(8);
    final EntityBulkJobs jobs = new EntityBulkJobs(() -> Runnable::run);
    final EntityBulkJobs.Job job =
        jobs.submit(List.of(1), () -> result, new EntityBulkJobs.Authorization(List.of(), 20));
    assertSame(result, job.result().join());
    assertEquals(8, jobs.status(job.id()).orElseThrow().getNumberOfRowsProcessed());
  }

  @Test
  void policyRequiresFinitePositiveLimitsAndRetention() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new EntityBulkJobs.Policy(0, 1, Duration.ofMinutes(1)));
    assertThrows(
        IllegalArgumentException.class,
        () -> new EntityBulkJobs.Policy(1, 0, Duration.ofMinutes(1)));
    assertThrows(
        IllegalArgumentException.class, () -> new EntityBulkJobs.Policy(1, 1, Duration.ZERO));
    assertThrows(
        IllegalArgumentException.class,
        () -> new EntityBulkJobs.Policy(1, 1, Duration.ofMinutes(-1)));
  }

  @Test
  void concurrentSubmittersCannotExceedTheAdmissionLimit() throws Exception {
    final Queue<Runnable> work = new ConcurrentLinkedQueue<>();
    final EntityBulkJobs jobs =
        new EntityBulkJobs(
            () -> work::add,
            new EntityBulkJobs.Policy(4, 10, Duration.ofMinutes(5)),
            Ticker.systemTicker());
    final List<EntityBulkJobs.Job> admitted = new ArrayList<>();
    final CountDownLatch start = new CountDownLatch(1);
    try (var submitters = Executors.newVirtualThreadPerTaskExecutor()) {
      final List<Future<EntityBulkJobs.Job>> futures = new ArrayList<>();
      for (int index = 0; index < 32; index++) {
        futures.add(
            submitters.submit(
                () -> {
                  start.await();
                  try {
                    return jobs.submit(
                        List.of(1),
                        () -> new BulkOperationResult().withStatus(ApiStatus.SUCCESS),
                        new EntityBulkJobs.Authorization(List.of(), 1));
                  } catch (WebApplicationException rejected) {
                    assertEquals(429, rejected.getResponse().getStatus());
                    return null;
                  }
                }));
      }
      start.countDown();
      for (final Future<EntityBulkJobs.Job> future : futures) {
        final EntityBulkJobs.Job job = future.get();
        if (job != null) {
          admitted.add(job);
        }
      }
    }
    assertEquals(4, admitted.size());
    assertEquals(4, work.size());
    work.forEach(Runnable::run);
    admitted.forEach(job -> assertEquals(ApiStatus.SUCCESS, job.result().join().getStatus()));
  }

  private static final class Fixture {
    private final Queue<Runnable> work = new ArrayDeque<>();
    private final BulkOperationResult result =
        new BulkOperationResult().withStatus(ApiStatus.SUCCESS).withNumberOfRowsPassed(1);
    private final EntityBulkJobs.Authorization authorization =
        new EntityBulkJobs.Authorization(List.of(), 1);
    private final EntityBulkJobs jobs;
    private long elapsed;
    private boolean reject;
    private int completedMutations;

    private Fixture(final int active, final int completed) {
      final Executor executor =
          action -> {
            if (reject) {
              throw new RejectedExecutionException("Injected scheduler rejection");
            }
            work.add(action);
          };
      jobs =
          new EntityBulkJobs(
              () -> executor,
              new EntityBulkJobs.Policy(active, completed, Duration.ofMinutes(5)),
              new Ticker() {
                @Override
                public long read() {
                  return elapsed;
                }
              });
    }

    private EntityBulkJobs.Job submit() {
      return jobs.submit(
          List.of(1),
          () -> {
            completedMutations++;
            return result;
          },
          authorization);
    }

    private void runNext() {
      work.remove().run();
    }
  }
}
