package org.openmetadata.it.tests.alerts;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.util.DIContainer;

/**
 * An alert consumer a test can hold in the middle of a tick, named through the alert's className.
 * It behaves exactly like the default consumer until a test arms a gate for one alert.
 */
public class LatchedConsumer extends AlertPublisher {

  static final class Gate {
    private final CountDownLatch reached = new CountDownLatch(1);
    private final CountDownLatch release = new CountDownLatch(1);
    private final AtomicInteger callsBeforeHolding;

    private Gate(int holdAtCall) {
      this.callsBeforeHolding = new AtomicInteger(holdAtCall);
    }

    boolean awaitReached() throws InterruptedException {
      return reached.await(60, TimeUnit.SECONDS);
    }

    void open() {
      release.countDown();
    }
  }

  private static final Map<UUID, Gate> GATES = new ConcurrentHashMap<>();

  public LatchedConsumer(DIContainer dependencies) {
    super(dependencies);
  }

  /** Holds the alert's tick the first time it is about to send. */
  static Gate arm(UUID alertId) {
    return arm(alertId, 1);
  }

  /** Holds the alert's tick when it is about to send for the given time. */
  static Gate arm(UUID alertId, int holdAtCall) {
    Gate gate = new Gate(holdAtCall);
    GATES.put(alertId, gate);
    return gate;
  }

  static void disarm(UUID alertId) {
    Gate gate = GATES.remove(alertId);
    if (gate != null) {
      gate.open();
    }
  }

  @Override
  public void publishEvents(Map<ChangeEvent, Set<UUID>> events) {
    Gate gate = GATES.get(getEventSubscription().getId());
    if (gate != null && gate.callsBeforeHolding.decrementAndGet() == 0) {
      hold(gate);
    }
    super.publishEvents(events);
  }

  private static void hold(Gate gate) {
    gate.reached.countDown();
    try {
      gate.release.await(60, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
