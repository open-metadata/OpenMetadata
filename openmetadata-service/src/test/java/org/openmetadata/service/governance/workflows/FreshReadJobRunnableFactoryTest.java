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

package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.util.FreshReadScope;

class FreshReadJobRunnableFactoryTest {

  @Test
  void jobRunsInsideFreshReadScopeAndLeavesItAfterwards() {
    AtomicBoolean scopeActiveDuringJob = new AtomicBoolean(false);

    FreshReadJobRunnableFactory.inFreshReadScope(
            () -> scopeActiveDuringJob.set(FreshReadScope.isActive()))
        .run();

    assertTrue(scopeActiveDuringJob.get());
    assertFalse(FreshReadScope.isActive());
  }

  @Test
  void failedJobStillLeavesTheScope() {
    Runnable failingJob =
        FreshReadJobRunnableFactory.inFreshReadScope(
            () -> {
              throw new IllegalStateException("job failed");
            });

    assertThrows(IllegalStateException.class, failingJob::run);
    assertFalse(FreshReadScope.isActive());
  }
}
