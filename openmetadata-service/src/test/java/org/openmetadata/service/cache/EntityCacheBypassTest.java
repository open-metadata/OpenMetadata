/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Behaviour tests for the reindex cache-bypass thread-local. Pins the contract used by
 * {@code PartitionWorker.processPartition}, {@code EntityReader.readKeysetBatches}, and
 * {@code SearchIndexExecutor} to opt their reader threads out of the entity cache.
 */
class EntityCacheBypassTest {

  @AfterEach
  void clearThreadLocal() {
    // Belt-and-suspenders: nested skip() correctness is the responsibility of the API itself,
    // but if a future test forgets to close a Handle this stops it from leaking across cases.
    while (EntityCacheBypass.isSkipped()) {
      // try-with-resources should always close, but in case a test forgot, drain.
      try (EntityCacheBypass.Handle h = EntityCacheBypass.skip()) {
        // noop — outer close restores false; if many were leaked, repeat.
        h.close();
      }
      // If still skipped after closing, break to avoid infinite loop on a bug in skip().
      if (EntityCacheBypass.isSkipped()) break;
    }
  }

  @Test
  @DisplayName("default: not skipped")
  void defaultIsNotSkipped() {
    assertFalse(EntityCacheBypass.isSkipped());
  }

  @Test
  @DisplayName("skip() flips the flag, close restores it")
  void skipFlipsAndRestores() {
    assertFalse(EntityCacheBypass.isSkipped());
    try (EntityCacheBypass.Handle h = EntityCacheBypass.skip()) {
      assertTrue(EntityCacheBypass.isSkipped());
    }
    assertFalse(EntityCacheBypass.isSkipped());
  }

  @Test
  @DisplayName("nested skip() preserves outer state on inner close")
  void nestingRestoresPreviousState() {
    try (EntityCacheBypass.Handle outer = EntityCacheBypass.skip()) {
      assertTrue(EntityCacheBypass.isSkipped());
      try (EntityCacheBypass.Handle inner = EntityCacheBypass.skip()) {
        assertTrue(EntityCacheBypass.isSkipped());
      }
      // Outer block must still see skipped=true after inner closes.
      assertTrue(EntityCacheBypass.isSkipped());
    }
    assertFalse(EntityCacheBypass.isSkipped());
  }

  @Test
  @DisplayName("flag is per-thread — siblings don't leak")
  void perThreadIsolation() throws Exception {
    AtomicBoolean siblingSawSkip = new AtomicBoolean(false);
    CountDownLatch latch = new CountDownLatch(1);
    Thread sibling =
        new Thread(
            () -> {
              siblingSawSkip.set(EntityCacheBypass.isSkipped());
              latch.countDown();
            });

    try (EntityCacheBypass.Handle ignored = EntityCacheBypass.skip()) {
      assertTrue(EntityCacheBypass.isSkipped());
      sibling.start();
      assertTrue(latch.await(2, TimeUnit.SECONDS));
    }
    sibling.join();

    // Sibling thread observed false even though the spawning thread had skip() active.
    assertFalse(siblingSawSkip.get());
    assertFalse(EntityCacheBypass.isSkipped());
  }
}
