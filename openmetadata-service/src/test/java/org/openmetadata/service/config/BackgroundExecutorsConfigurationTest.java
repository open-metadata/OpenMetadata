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
package org.openmetadata.service.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationConfig;

class BackgroundExecutorsConfigurationTest {

  @Test
  void defaultsPreserveExistingExecutorLimits() {
    BackgroundExecutorsConfiguration config = new BackgroundExecutorsConfiguration();

    assertEquals(20, config.getChangeEventParallelism());
    assertEquals(0, config.getLifecycleLanes());
    assertEquals(10, config.getUserActivityDbPermits());
    assertEquals(3, config.getBackgroundJobWorkers());
    assertEquals(25, new AsyncOperationsConfiguration().getMaxConcurrentDbTasks());
  }

  @Test
  void applicationConfigProvidesStableDefaultsWhenBlocksAreAbsent() {
    OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();

    assertSame(
        config.getBackgroundExecutorsConfiguration(), config.getBackgroundExecutorsConfiguration());
    assertSame(config.getAsyncOperationsConfiguration(), config.getAsyncOperationsConfiguration());
  }
}
