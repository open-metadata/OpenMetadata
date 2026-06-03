/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.StepStats;

class WorkflowStatsTest {

  @Test
  void resetClearsFailuresStepStatsAndAggregateCounters() {
    WorkflowStats stats = new WorkflowStats("testWorkflow");
    stats.addFailure("previous failure");
    stats.updateWorkflowStepStats(
        "previousStep",
        new StepStats().withTotalRecords(5).withSuccessRecords(3).withFailedRecords(2));
    stats.getWorkflowStats().setTotalRecords(5);
    stats.getWorkflowStats().setSuccessRecords(3);
    stats.getWorkflowStats().setFailedRecords(2);
    stats.getWorkflowStats().setWarningRecords(1);

    stats.reset();

    assertFalse(stats.hasFailed());
    assertTrue(stats.getFailures().isEmpty());
    assertTrue(stats.getWorkflowStepStats().isEmpty());
    assertEquals(0, stats.getWorkflowStats().getTotalRecords());
    assertEquals(0, stats.getWorkflowStats().getSuccessRecords());
    assertEquals(0, stats.getWorkflowStats().getFailedRecords());
    assertEquals(0, stats.getWorkflowStats().getWarningRecords());
  }

  @Test
  void mergeAggregatesFailuresStepStatsAndCounters() {
    WorkflowStats target = new WorkflowStats("mergedWorkflow");
    target.getWorkflowStats().setTotalRecords(4);
    target.getWorkflowStats().setSuccessRecords(3);
    target.getWorkflowStats().setFailedRecords(1);
    target.updateWorkflowStepStats(
        "existingStep",
        new StepStats().withTotalRecords(4).withSuccessRecords(3).withFailedRecords(1));

    WorkflowStats source = new WorkflowStats("sourceWorkflow");
    source.addFailure("source failure");
    source.getWorkflowStats().setTotalRecords(6);
    source.getWorkflowStats().setSuccessRecords(5);
    source.getWorkflowStats().setFailedRecords(1);
    source.getWorkflowStats().setWarningRecords(2);
    source.updateWorkflowStepStats(
        "sourceStep",
        new StepStats()
            .withTotalRecords(6)
            .withSuccessRecords(5)
            .withFailedRecords(1)
            .withWarningRecords(2));

    target.merge(source);

    assertTrue(target.hasFailed());
    assertEquals("source failure", target.getFailures().get(0));
    assertTrue(target.getWorkflowStepStats().containsKey("existingStep"));
    assertTrue(target.getWorkflowStepStats().containsKey("sourceStep"));
    assertEquals(10, target.getWorkflowStats().getTotalRecords());
    assertEquals(8, target.getWorkflowStats().getSuccessRecords());
    assertEquals(2, target.getWorkflowStats().getFailedRecords());
    assertEquals(2, target.getWorkflowStats().getWarningRecords());
  }
}
