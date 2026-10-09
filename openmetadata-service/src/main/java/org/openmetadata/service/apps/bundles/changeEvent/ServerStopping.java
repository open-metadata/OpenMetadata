package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Set as soon as the JVM is asked to stop. The scheduler's own shutdown runs much later and only
 * waits for running ticks, so without this a tick would go on through its whole batch and be
 * killed in the middle of it when the grace period ends.
 */
public final class ServerStopping {

  private static final AtomicBoolean STOPPING = new AtomicBoolean();
  private static final AtomicBoolean HOOK_REGISTERED = new AtomicBoolean();

  private ServerStopping() {}

  public static boolean isSet() {
    return STOPPING.get();
  }

  public static void set(boolean stopping) {
    STOPPING.set(stopping);
  }

  public static void registerShutdownHook() {
    if (HOOK_REGISTERED.compareAndSet(false, true)) {
      Runtime.getRuntime()
          .addShutdownHook(new Thread(() -> STOPPING.set(true), "alert-ticks-stop-early"));
    }
  }
}
