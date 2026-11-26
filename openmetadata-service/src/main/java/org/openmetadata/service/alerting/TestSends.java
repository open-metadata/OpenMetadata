package org.openmetadata.service.alerting;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import org.openmetadata.schema.entity.events.SubscriptionDestination;

/**
 * Test sends a user starts from an alert or template form. They run on the request thread's
 * behalf, so they are bounded: the destinations of one request are sent to together, the request
 * answers within {@link #DEADLINE} however its destinations behave, and only {@link #AT_ONCE}
 * requests send at a time across the server. A destination not finished by the deadline gets the
 * caller's timed-out result, and its send is interrupted.
 */
public final class TestSends {

  public static final Duration DEADLINE = Duration.ofSeconds(30);
  static final int AT_ONCE = 8;

  private static final Semaphore SENDING = new Semaphore(AT_ONCE);

  private TestSends() {}

  public static <T> List<T> toEach(
      List<SubscriptionDestination> destinations,
      Function<SubscriptionDestination, T> send,
      Function<SubscriptionDestination, T> timedOut) {
    AlertLimits.requireTestSendWithin(destinations);
    return within(SENDING, DEADLINE, destinations, send, timedOut);
  }

  static <T> List<T> within(
      Semaphore sending,
      Duration deadline,
      List<SubscriptionDestination> destinations,
      Function<SubscriptionDestination, T> send,
      Function<SubscriptionDestination, T> timedOut) {
    if (!sending.tryAcquire()) {
      throw new WebApplicationException(
          "Too many test sends are running; try again shortly", Response.Status.TOO_MANY_REQUESTS);
    }
    ExecutorService sends = Executors.newVirtualThreadPerTaskExecutor();
    try {
      List<Future<T>> answers =
          sends.invokeAll(tasks(destinations, send), deadline.toMillis(), TimeUnit.MILLISECONDS);
      return results(destinations, answers, timedOut);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new WebApplicationException("Interrupted while sending test messages", e);
    } finally {
      // Never waits: a send past the deadline was interrupted and ends on its own.
      sends.shutdownNow();
      sending.release();
    }
  }

  private static <T> List<Callable<T>> tasks(
      List<SubscriptionDestination> destinations, Function<SubscriptionDestination, T> send) {
    List<Callable<T>> tasks = new ArrayList<>();
    for (SubscriptionDestination destination : destinations) {
      tasks.add(() -> send.apply(destination));
    }
    return tasks;
  }

  private static <T> List<T> results(
      List<SubscriptionDestination> destinations,
      List<Future<T>> answers,
      Function<SubscriptionDestination, T> timedOut) {
    List<T> results = new ArrayList<>();
    for (int index = 0; index < destinations.size(); index++) {
      Future<T> answer = answers.get(index);
      results.add(answer.isCancelled() ? timedOut.apply(destinations.get(index)) : done(answer));
    }
    return Collections.unmodifiableList(results);
  }

  private static <T> T done(Future<T> answer) {
    try {
      return answer.get();
    } catch (ExecutionException e) {
      if (e.getCause() instanceof Error error) {
        throw error;
      }
      throw e.getCause() instanceof RuntimeException cause
          ? cause
          : new WebApplicationException(e.getCause());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new WebApplicationException("Interrupted while sending test messages", e);
    }
  }
}
