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
  void exposesAllReleaseGateMetricsWithBoundedTags() {
    OntologyMetrics.recordRdfQueueDepth(7);
    OntologyMetrics.recordRdfQueueDrop();
    OntologyMetrics.recordRdfQueueLag(Duration.ofMillis(12));
    OntologyMetrics.recordQueryRejection();
    OntologyMetrics.recordGraphRebuildStarted();
    OntologyMetrics.recordGraphRebuildCompleted();
    OntologyMetrics.recordGraphRebuildFailed();
    OntologyMetrics.recordShaclValidation(true, true);
    OntologyMetrics.recordShaclValidation(true, false);
    OntologyMetrics.recordShaclValidation(false, true);
    OntologyMetrics.recordInferenceRun(true);
    OntologyMetrics.recordInferenceRun(false);
    OntologyMetrics.recordLockContention();
    OntologyMetrics.recordPackImport(true);
    OntologyMetrics.recordPackImport(false);
    OntologyMetrics.recordAiRequest(true);
    OntologyMetrics.recordAiRequest(false);
    OntologyMetrics.recordAiDisabled();

    assertEquals(7, registry.get("ontology.rdf.queue.pending").gauge().value());
    assertEquals(1, registry.get("ontology.rdf.queue.dropped").counter().count());
    assertEquals(1, registry.get("ontology.rdf.queue.lag").timer().count());
    assertEquals(1, registry.get("ontology.query.rejected").counter().count());
    assertResultCount("ontology.rdf.rebuild", "completed", 1);
    assertResultCount("ontology.shacl.validation", "violates", 1);
    assertResultCount("ontology.inference.run", "failed", 1);
    assertEquals(1, registry.get("ontology.lock.contention").counter().count());
    assertResultCount("ontology.pack.import", "completed", 1);
    assertResultCount("ontology.ai.request", "disabled", 1);
  }

  private void assertResultCount(
      final String metricName, final String result, final double expectedCount) {
    assertEquals(expectedCount, registry.get(metricName).tag("result", result).counter().count());
  }
}
