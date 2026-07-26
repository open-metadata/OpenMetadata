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
package org.openmetadata.service.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;

class GenericBackgroundWorkerTest {

  @Test
  void configuredWorkerCountControlsAvailableSlots() {
    GenericBackgroundWorker worker =
        new GenericBackgroundWorker(mock(JobDAO.class), mock(JobHandlerRegistry.class), 5);

    assertEquals(5, worker.getWorkerPoolSize());
    assertEquals(5, worker.getAvailableWorkerSlots());
  }
}
