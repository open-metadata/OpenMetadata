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

package org.openmetadata.service.apps.scheduler;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class AppTriggerRetryTest {
  @Test
  void aBusyAppIsRetriedWithBackoffUntilItAcceptsTheRun() {
    AtomicInteger calls = new AtomicInteger();
    List<Long> pauses = new ArrayList<>();

    boolean triggered =
        AppTriggerRetry.trigger(
            "DataInsightsApplication",
            () -> {
              if (calls.incrementAndGet() <= 2) {
                throw new AppAlreadyRunningException();
              }
            },
            pauses::add);

    assertTrue(triggered);
    assertEquals(3, calls.get());
    assertEquals(List.of(10_000L, 20_000L), pauses);
  }
}
