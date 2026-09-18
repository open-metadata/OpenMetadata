package org.openmetadata.service.apps.bundles.changeEvent;

import java.io.IOException;
import java.util.Collection;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.AlertTelemetry;
import org.openmetadata.service.events.subscription.AlertingSettings;

/** Attempts every target of one channel, so one failing endpoint cannot silence the rest. */
@Slf4j
public final class IsolatedSends {

  @FunctionalInterface
  public interface Send<T> {
    void to(T target) throws Exception;
  }

  private IsolatedSends() {}

  public static <T> void sendToEach(
      Collection<T> targets, Destination<ChangeEvent> destination, Send<T> send)
      throws EventPublisherException {
    final Failures failures = new Failures(destination);
    for (final T target : targets) {
      attempt(target, send, failures);
    }
    failures.throwIfAny(targets.size());
  }

  private static <T> void attempt(T target, Send<T> send, Failures failures) {
    if (givenUpForThisTick(target)) {
      failures.add(new IOException("Not attempted: unreachable earlier in this tick"));
    } else {
      try {
        send.to(target);
      } catch (Exception e) {
        // Cause-agnostic on purpose: whatever one target throws must not cost the others.
        failures.add(e);
        if (ConnectionFailures.neverReachedTheTarget(e)) {
          TickMemory.rememberUnreachable(target);
        }
      }
    }
  }

  private static boolean givenUpForThisTick(Object target) {
    boolean failedBefore = TickMemory.isUnreachable(target);
    boolean skip = failedBefore && AlertingSettings.current().skipUnreachableTargetWithinTick();
    if (failedBefore) {
      AlertTelemetry.attemptOnUnreachableTarget(skip);
    }
    return skip;
  }

  private static final class Failures {
    private final Destination<ChangeEvent> destination;
    private int count;
    private Exception first;
    private Object statusAtFirst;

    private Failures(Destination<ChangeEvent> destination) {
      this.destination = destination;
    }

    private void add(Exception failure) {
      count++;
      LOG.warn("Send to one recipient failed: {}", failure.getMessage());
      if (first == null) {
        first = failure;
        statusAtFirst = destination.getSubscriptionDestination().getStatusDetails();
      }
    }

    private void throwIfAny(int attempted) throws EventPublisherException {
      if (first != null) {
        // A later success would otherwise leave the destination reading Active.
        destination.getSubscriptionDestination().setStatusDetails(statusAtFirst);
        throw new EventPublisherException(
            String.format("%d of %d recipients failed: %s", count, attempted, first.getMessage()),
            first);
      }
    }
  }
}
