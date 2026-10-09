package org.openmetadata.service.apps.bundles.changeEvent;

import java.time.Duration;

/**
 * What one tick knows that a send must respect: how much of its budget is left. A tick runs on one
 * thread from start to end, so publishers reach it without every one of them being handed it, and
 * a thread that sends on the tick's behalf adopts it. Outside a tick a send gets the longest wait.
 */
public final class TickMemory {

  private static final ThreadLocal<TickMemory> OF_THIS_THREAD = new ThreadLocal<>();

  private static final Duration LONGEST_WAIT_WITHOUT_A_BUDGET = Duration.ofSeconds(30);

  private final TickStopSignal stopSignal;

  private TickMemory(TickStopSignal stopSignal) {
    this.stopSignal = stopSignal;
  }

  static void begin(TickStopSignal stopSignal) {
    OF_THIS_THREAD.set(new TickMemory(stopSignal));
  }

  /** The memory of the tick running on this thread, for a thread that sends on its behalf. */
  public static TickMemory current() {
    return OF_THIS_THREAD.get();
  }

  public static void adopt(TickMemory ofTheTick) {
    OF_THIS_THREAD.set(ofTheTick);
  }

  /** How long a send may still wait for an answer before the tick's budget is spent. */
  public static Duration timeLeft() {
    TickMemory memory = OF_THIS_THREAD.get();
    boolean budgeted = memory != null && memory.stopSignal != null;
    return budgeted
        ? memory.stopSignal.timeLeft(LONGEST_WAIT_WITHOUT_A_BUDGET)
        : LONGEST_WAIT_WITHOUT_A_BUDGET;
  }

  public static void end() {
    OF_THIS_THREAD.remove();
  }
}
