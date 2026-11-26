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

package org.openmetadata.it.tests;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;

/**
 * The command counters of the suite's Redis container ({@code INFO commandstats}). Reading them is
 * itself an {@code info} command, which {@link #commands} leaves out so a reading does not count
 * itself.
 */
final class RedisCommandStats {
  private static final String PREFIX = "cmdstat_";
  private static final String CALLS = "calls=";

  private RedisCommandStats() {}

  /** Calls made so far, by command name, without {@code info}. */
  static Map<String, Long> commands() {
    try {
      String info =
          TestSuiteBootstrap.getRedisContainer()
              .execInContainer("redis-cli", "INFO", "commandstats")
              .getStdout();
      return parse(info);
    } catch (IOException failure) {
      throw new IllegalStateException("INFO commandstats failed", failure);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted reading INFO commandstats", interrupted);
    }
  }

  static Map<String, Long> parse(String info) {
    Map<String, Long> calls = new HashMap<>();
    for (String line : info.split("\r?\n")) {
      if (line.startsWith(PREFIX) && !line.startsWith(PREFIX + "info:")) {
        int colon = line.indexOf(':');
        int start = line.indexOf(CALLS) + CALLS.length();
        calls.put(
            line.substring(PREFIX.length(), colon),
            Long.parseLong(line.substring(start, line.indexOf(',', start))));
      }
    }
    return calls;
  }

  /** What each command gained between two readings; commands that did not change are left out. */
  static Map<String, Long> since(Map<String, Long> before, Map<String, Long> after) {
    Map<String, Long> gained = new HashMap<>();
    after.forEach(
        (command, count) -> {
          long gain = count - before.getOrDefault(command, 0L);
          if (gain != 0) {
            gained.put(command, gain);
          }
        });
    return gained;
  }
}
