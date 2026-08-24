/*
 *  Copyright 2025 Collate.
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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

class OpenMetadataOperationsDeployPipelinesTest {

  private static final Duration PREVIOUS_FIXED_TIMEOUT = Duration.ofMinutes(2);

  private static List<String> row(String status) {
    return List.of("pipeline", "metadata", "service", status);
  }

  @Test
  void chunkDeadlineScalesWithChunkSize() {
    assertEquals(Duration.ofSeconds(600), OpenMetadataOperations.deployChunkTimeout(20, 30));
    assertEquals(Duration.ofSeconds(3000), OpenMetadataOperations.deployChunkTimeout(100, 30));
  }

  @Test
  void defaultChunkDeadlineExceedsThePreviousFixedTimeout() {
    Duration deadline = OpenMetadataOperations.deployChunkTimeout(20, 30);

    assertTrue(
        deadline.compareTo(PREVIOUS_FIXED_TIMEOUT) > 0,
        "a chunk of 20 sequential deploys needs more than the previous fixed 2 minute deadline");
  }

  @Test
  void chunkDeadlineNeverDropsBelowTheFloor() {
    assertEquals(PREVIOUS_FIXED_TIMEOUT, OpenMetadataOperations.deployChunkTimeout(1, 5));
    assertEquals(PREVIOUS_FIXED_TIMEOUT, OpenMetadataOperations.deployChunkTimeout(0, 30));
  }

  @Test
  void failedRowsAreDetected() {
    assertTrue(
        OpenMetadataOperations.hasDeployFailures(
            List.of(row("DEPLOYED"), row("FAILED - 500: airflow unreachable"))));
  }

  @Test
  void deployedRowsAreNotFailures() {
    assertFalse(
        OpenMetadataOperations.hasDeployFailures(List.of(row("DEPLOYED"), row("DEPLOYED"))));
  }
}
