package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.HashSet;
import java.util.Set;

/**
 * What one tick remembers and the next must not: the targets whose connection failed. A tick runs
 * on one thread from start to end, so publishers reach the memory of the tick they are part of
 * without every one of them being handed it. Outside a tick nothing is remembered.
 */
public final class TickMemory {

  private static final ThreadLocal<TickMemory> OF_THIS_THREAD = new ThreadLocal<>();

  private final Set<Object> unreachableTargets = new HashSet<>();

  private TickMemory() {}

  static void begin() {
    OF_THIS_THREAD.set(new TickMemory());
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
