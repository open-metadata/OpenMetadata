/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.it.bootstrap;

import java.util.concurrent.TimeUnit;
import org.openmetadata.service.OpenMetadataApplication;

/**
 * Entry point of a forked server. It ends the process when the test JVM that started it is gone, so
 * a suite JVM that is killed outright (no shutdown hook runs) does not leave a server holding
 * database connections and ports. Then it runs the application's own {@code main}.
 */
public final class ForkedServerLauncher {
  /** System property naming the pid of the test JVM to follow. */
  static final String PARENT_PID = "forked.parent.pid";

  private static final long POLL_MILLIS = 1000;

  private ForkedServerLauncher() {}

  public static void main(String[] args) throws Exception {
    long parentPid = Long.parseLong(System.getProperty(PARENT_PID));
    Thread watcher = new Thread(() -> haltWhenGone(parentPid), "forked-parent-watcher");
    watcher.setDaemon(true);
    watcher.start();
    OpenMetadataApplication.main(args);
  }

  private static void haltWhenGone(long parentPid) {
    try {
      while (ProcessHandle.of(parentPid).map(ProcessHandle::isAlive).orElse(false)) {
        TimeUnit.MILLISECONDS.sleep(POLL_MILLIS);
      }
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
    }
    Runtime.getRuntime().halt(1);
  }
}
