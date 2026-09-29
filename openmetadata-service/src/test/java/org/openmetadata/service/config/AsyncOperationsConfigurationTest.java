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

class AsyncOperationsConfigurationTest {

  @Test
  void defaultsReserveDatabaseCapacityForRequests() {
    AsyncOperationsConfiguration config = new AsyncOperationsConfiguration();

    assertEquals(25, config.getMaxConcurrentDbTasks());
    assertEquals(8, config.getMaxConcurrentRdfWrites());
    assertEquals(16, config.getDataInsightsMaxConcurrentDbTasks());
  }

  @Test
  void applicationConfigurationProvidesStableDefaultsWhenBlockIsAbsent() {
    OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();

    assertSame(config.getAsyncOperationsConfiguration(), config.getAsyncOperationsConfiguration());
  }
}
