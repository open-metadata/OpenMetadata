/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.clients.pipeline.k8s;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.service.clients.pipeline.k8s.K8sFailureDiagnostics.DiagnosticInfo;

class K8sFailureDiagnosticsTest {

  @Test
  void testDiagnosticInfoBuilder() {
    DiagnosticInfo diagnostics =
        DiagnosticInfo.builder()
            .podLogs("Test log line 1\nTest log line 2")
            .podDescription("Pod failed with exit code 1")
            .failureReason("ImagePullBackOff")
            .exitCode(1)
            .build();

    assertTrue(diagnostics.hasDiagnostics());
    assertTrue(diagnostics.getSummary().contains("logs (2 lines)"));
    assertTrue(diagnostics.getSummary().contains("pod description"));
    assertEquals(1, diagnostics.getExitCode());
    assertEquals("ImagePullBackOff", diagnostics.getFailureReason());
  }

  @Test
  void testDiagnosticInfoEmptyValues() {
    DiagnosticInfo diagnostics = DiagnosticInfo.builder().podLogs("").podDescription(null).build();

    assertFalse(diagnostics.hasDiagnostics());
    assertEquals("No diagnostics available", diagnostics.getSummary());
  }

  @Test
  void testDiagnosticInfoPartialData() {
    DiagnosticInfo diagnostics =
        DiagnosticInfo.builder().podLogs("Error: Connection failed").build();

    assertTrue(diagnostics.hasDiagnostics());
    assertTrue(diagnostics.getSummary().contains("logs (1 lines)"));
    assertFalse(diagnostics.getSummary().contains("pod description"));
  }

  private IngestionPipeline createTestPipeline() {
    IngestionPipeline pipeline = new IngestionPipeline();
    pipeline.setName("test-pipeline");
    pipeline.setFullyQualifiedName("test-service.test-pipeline");
    return pipeline;
  }
}
