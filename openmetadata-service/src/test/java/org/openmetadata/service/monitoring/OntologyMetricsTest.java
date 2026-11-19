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

package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OntologyMetricsTest {
  private SimpleMeterRegistry registry;

  @BeforeEach
  void setUp() {
    registry = new SimpleMeterRegistry();
    OntologyMetrics.resetForTest();
    OntologyMetrics.initialize(registry);
  }

  @AfterEach
  void tearDown() {
    OntologyMetrics.resetForTest();
    registry.close();
  }

  @Test
  void timesCompactionsByResultAndKeepsTheLastSuccess() {
    OntologyMetrics.recordCompaction(false, Duration.ofSeconds(3));
    assertEquals(0, registry.get("ontology.rdf.compaction.last.success").gauge().value());

    OntologyMetrics.recordCompaction(true, Duration.ofSeconds(20));

    assertEquals(
        1, registry.get("ontology.rdf.compaction").tag("result", "completed").timer().count());
    assertEquals(
        1, registry.get("ontology.rdf.compaction").tag("result", "failed").timer().count());
    assertTrue(registry.get("ontology.rdf.compaction.last.success").gauge().value() > 0);
  }
}
