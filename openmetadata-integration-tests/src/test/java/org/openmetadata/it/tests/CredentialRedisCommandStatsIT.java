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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Test;

class CredentialRedisCommandStatsIT {
  private static final String INFO =
      "# Commandstats\r\n"
          + "cmdstat_get:calls=12,usec=30,usec_per_call=2.50,rejected_calls=0,failed_calls=0\r\n"
          + "cmdstat_info:calls=3,usec=90,usec_per_call=30.00,rejected_calls=0,failed_calls=0\r\n"
          + "cmdstat_set:calls=5,usec=10,usec_per_call=2.00,rejected_calls=0,failed_calls=0\r\n";

  @Test
  void parsesCallsPerCommandAndLeavesOutInfo() {
    assertEquals(Map.of("get", 12L, "set", 5L), RedisCommandStats.parse(INFO));
  }

  @Test
  void sinceKeepsOnlyCommandsThatGained() {
    Map<String, Long> before = Map.of("get", 12L, "set", 5L);
    Map<String, Long> after = Map.of("get", 14L, "set", 5L, "del", 1L);

    assertEquals(Map.of("get", 2L, "del", 1L), RedisCommandStats.since(before, after));
  }
}
