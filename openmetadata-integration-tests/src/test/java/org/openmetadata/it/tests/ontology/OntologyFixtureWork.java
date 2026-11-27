package org.openmetadata.it.tests.ontology;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.openmetadata.service.util.AsyncService;

/** Keeps post-commit callbacks on the fixture's database and surfaces their failures to JUnit. */
final class OntologyFixtureWork implements AutoCloseable {
  private static final long DRAIN_TIMEOUT_SECONDS = 20;
  private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
  private final Queue<Future<?>> pending = new ConcurrentLinkedQueue<>();
  private final AsyncService previous;

  OntologyFixtureWork() {
    AsyncService scoped =
        mock(
            AsyncService.class,
            call -> {
              throw new AssertionError("Unexpected fixture async operation: " + call.getMethod());
            });
    doAnswer(
            call -> {
              pending.add(executor.submit(call.getArgument(0, Runnable.class)));
              return null;
            })
        .when(scoped)
        .execute(any(Runnable.class));
    previous = swapService(scoped);
  }

  @Override
  public void close() {
    try {
      awaitSubmittedWork();
    } finally {
      try {
        stopExecutor();
      } finally {
        swapService(previous);
      }
    }
  }

  private void awaitSubmittedWork() {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(DRAIN_TIMEOUT_SECONDS);
    List<Throwable> failures = new ArrayList<>();
    // A parent future completes after it has queued any child work.
    for (Future<?> task; (task = pending.poll()) != null; ) {
      awaitTask(task, deadline, failures);
    }
    if (!failures.isEmpty()) {
      AssertionError failure =
          new AssertionError("Ontology fixture background work failed", failures.getFirst());
      failures.stream().skip(1).forEach(failure::addSuppressed);
      throw failure;
    }
  }

  private static void awaitTask(Future<?> task, long deadline, List<Throwable> failures) {
    try {
      task.get(Math.max(0, deadline - System.nanoTime()), TimeUnit.NANOSECONDS);
    } catch (ExecutionException e) {
      failures.add(e.getCause());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new AssertionError("Interrupted while waiting for ontology fixture work", e);
    } catch (TimeoutException e) {
      throw new AssertionError("Timed out waiting for ontology fixture work", e);
    }
  }

  private void stopExecutor() {
    executor.shutdownNow();
    if (!Thread.currentThread().isInterrupted()) {
      try {
        if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
          throw new AssertionError("Ontology fixture workers did not stop");
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new AssertionError("Interrupted while stopping ontology fixture workers", e);
      }
    }
  }

  private static AsyncService swapService(AsyncService replacement) {
    synchronized (AsyncService.class) {
      try {
        Field field = AsyncService.class.getDeclaredField("instance");
        field.setAccessible(true);
        AsyncService original = (AsyncService) field.get(null);
        field.set(null, replacement);
        return original;
      } catch (ReflectiveOperationException e) {
        throw new AssertionError("Cannot bind the ontology fixture async service", e);
      }
    }
  }
}
