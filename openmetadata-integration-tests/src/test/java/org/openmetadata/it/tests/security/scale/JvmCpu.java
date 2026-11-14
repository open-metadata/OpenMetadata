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

package org.openmetadata.it.tests.security.scale;

import com.sun.management.OperatingSystemMXBean;
import java.lang.management.ManagementFactory;

/**
 * CPU of this JVM. The benchmark client and the server share it, so this is the one limiter figure
 * the harness has: a cell that uses most of the cores is bound by the JVM, not by the server.
 */
final class JvmCpu {
  private static final double SATURATED_SHARE = 0.85;
  private static final OperatingSystemMXBean OS =
      (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();

  private JvmCpu() {}

  static long processCpuNanos() {
    return OS.getProcessCpuTime();
  }

  static int cores() {
    return Runtime.getRuntime().availableProcessors();
  }

  /** True when {@code cpuCores} busy cores is most of what the JVM may use. */
  static boolean saturated(double cpuCores) {
    return cpuCores >= SATURATED_SHARE * cores();
  }

  /** One-minute load average of the whole machine, or -1 where unreported. */
  static double machineLoad() {
    return OS.getSystemLoadAverage();
  }
}
