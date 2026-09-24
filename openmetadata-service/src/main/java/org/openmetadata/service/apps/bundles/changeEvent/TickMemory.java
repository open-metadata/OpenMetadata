package org.openmetadata.service.apps.bundles.changeEvent;

import java.time.Duration;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * What one tick remembers and the next must not: the targets whose connection failed. A tick runs
 * on one thread from start to end, so publishers reach the memory of the tick they are part of
 * without every one of them being handed it. Outside a tick nothing is remembered.
 */
public final class TickMemory {

  private static final ThreadLocal<TickMemory> OF_THIS_THREAD = new ThreadLocal<>();

  private static final Duration LONGEST_WAIT_WITHOUT_A_BUDGET = Duration.ofSeconds(30);

  // Several of one event's targets may be sent to at the same time, each on a thread of its own.
  private final Set<Object> unreachableTargets = ConcurrentHashMap.newKeySet();
  private final TickStopSignal stopSignal;

  private TickMemory(TickStopSignal stopSignal) {
    this.stopSignal = stopSignal;
  }

  static void begin() {
    begin(null);
  }

  static void begin(TickStopSignal stopSignal) {
    OF_THIS_THREAD.set(new TickMemory(stopSignal));
  }

  /** The memory of the tick running on this thread, for a thread that sends on its behalf. */
  static TickMemory current() {
    return OF_THIS_THREAD.get();
  }

  static void adopt(TickMemory ofTheTick) {
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

  static void end() {
    OF_THIS_THREAD.remove();
  }

  static boolean isUnreachable(Object target) {
    TickMemory memory = OF_THIS_THREAD.get();
    return memory != null && memory.unreachableTargets.contains(target);
  }

  static void rememberUnreachable(Object target) {
    TickMemory memory = OF_THIS_THREAD.get();
    if (memory != null) {
      memory.unreachableTargets.add(target);
    }
  }
}
