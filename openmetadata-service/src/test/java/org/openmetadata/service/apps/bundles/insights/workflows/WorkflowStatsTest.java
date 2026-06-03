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
    stats.getWorkflowStats().setVectorSuccessRecords(4);
    stats.getWorkflowStats().setVectorFailedRecords(1);
    stats.getWorkflowStats().setTotalTimeMs(50L);
    stats.getWorkflowStats().setReaderTimeMs(10L);
    stats.getWorkflowStats().setProcessTimeMs(20L);
    stats.getWorkflowStats().setSinkTimeMs(15L);
    stats.getWorkflowStats().setVectorTimeMs(5L);

    stats.reset();

    assertFalse(stats.hasFailed());
    assertTrue(stats.getFailures().isEmpty());
    assertTrue(stats.getWorkflowStepStats().isEmpty());
    assertEquals(0, stats.getWorkflowStats().getTotalRecords());
    assertEquals(0, stats.getWorkflowStats().getSuccessRecords());
    assertEquals(0, stats.getWorkflowStats().getFailedRecords());
    assertEquals(0, stats.getWorkflowStats().getWarningRecords());
    assertEquals(0, stats.getWorkflowStats().getVectorSuccessRecords());
    assertEquals(0, stats.getWorkflowStats().getVectorFailedRecords());
    assertEquals(0L, stats.getWorkflowStats().getTotalTimeMs());
    assertEquals(0L, stats.getWorkflowStats().getReaderTimeMs());
    assertEquals(0L, stats.getWorkflowStats().getProcessTimeMs());
    assertEquals(0L, stats.getWorkflowStats().getSinkTimeMs());
    assertEquals(0L, stats.getWorkflowStats().getVectorTimeMs());
  }

  @Test
  void mergeAggregatesFailuresStepStatsAndCountersWithoutOverwritingDuplicateSteps() {
    WorkflowStats target = new WorkflowStats("mergedWorkflow");
    target.getWorkflowStats().setTotalRecords(4);
    target.getWorkflowStats().setSuccessRecords(3);
    target.getWorkflowStats().setFailedRecords(1);
    target.getWorkflowStats().setWarningRecords(1);
    target.getWorkflowStats().setVectorSuccessRecords(2);
    target.getWorkflowStats().setVectorFailedRecords(1);
    target.getWorkflowStats().setTotalTimeMs(10L);
    target.getWorkflowStats().setReaderTimeMs(2L);
    target.getWorkflowStats().setProcessTimeMs(3L);
    target.getWorkflowStats().setSinkTimeMs(4L);
    target.getWorkflowStats().setVectorTimeMs(5L);
    target.updateWorkflowStepStats(
        "existingStep",
        new StepStats()
            .withTotalRecords(4)
            .withSuccessRecords(3)
            .withFailedRecords(1)
            .withWarningRecords(1)
            .withVectorSuccessRecords(2)
            .withVectorFailedRecords(1)
            .withTotalTimeMs(10L)
            .withReaderTimeMs(2L)
            .withProcessTimeMs(3L)
            .withSinkTimeMs(4L)
            .withVectorTimeMs(5L));

    WorkflowStats source = new WorkflowStats("sourceWorkflow");
    source.addFailure("source failure");
    source.getWorkflowStats().setTotalRecords(6);
    source.getWorkflowStats().setSuccessRecords(5);
    source.getWorkflowStats().setFailedRecords(1);
    source.getWorkflowStats().setWarningRecords(2);
    source.getWorkflowStats().setVectorSuccessRecords(4);
    source.getWorkflowStats().setVectorFailedRecords(2);
    source.getWorkflowStats().setTotalTimeMs(20L);
    source.getWorkflowStats().setReaderTimeMs(3L);
    source.getWorkflowStats().setProcessTimeMs(4L);
    source.getWorkflowStats().setSinkTimeMs(5L);
    source.getWorkflowStats().setVectorTimeMs(6L);
    source.updateWorkflowStepStats(
        "existingStep",
        new StepStats()
            .withTotalRecords(6)
            .withSuccessRecords(5)
            .withFailedRecords(1)
            .withWarningRecords(2)
            .withVectorSuccessRecords(4)
            .withVectorFailedRecords(2)
            .withTotalTimeMs(20L)
            .withReaderTimeMs(3L)
            .withProcessTimeMs(4L)
            .withSinkTimeMs(5L)
            .withVectorTimeMs(6L));

    target.merge(source);

    assertTrue(target.hasFailed());
    assertEquals("source failure", target.getFailures().get(0));
    assertTrue(target.getWorkflowStepStats().containsKey("existingStep"));
    assertEquals(10, target.getWorkflowStats().getTotalRecords());
    assertEquals(8, target.getWorkflowStats().getSuccessRecords());
    assertEquals(2, target.getWorkflowStats().getFailedRecords());
    assertEquals(3, target.getWorkflowStats().getWarningRecords());
    assertEquals(6, target.getWorkflowStats().getVectorSuccessRecords());
    assertEquals(3, target.getWorkflowStats().getVectorFailedRecords());
    assertEquals(30L, target.getWorkflowStats().getTotalTimeMs());
    assertEquals(5L, target.getWorkflowStats().getReaderTimeMs());
    assertEquals(7L, target.getWorkflowStats().getProcessTimeMs());
    assertEquals(9L, target.getWorkflowStats().getSinkTimeMs());
    assertEquals(11L, target.getWorkflowStats().getVectorTimeMs());

    StepStats mergedStep = target.getWorkflowStepStats().get("existingStep");
    assertEquals(10, mergedStep.getTotalRecords());
    assertEquals(8, mergedStep.getSuccessRecords());
    assertEquals(2, mergedStep.getFailedRecords());
    assertEquals(3, mergedStep.getWarningRecords());
    assertEquals(6, mergedStep.getVectorSuccessRecords());
    assertEquals(3, mergedStep.getVectorFailedRecords());
    assertEquals(30L, mergedStep.getTotalTimeMs());
    assertEquals(5L, mergedStep.getReaderTimeMs());
    assertEquals(7L, mergedStep.getProcessTimeMs());
    assertEquals(9L, mergedStep.getSinkTimeMs());
    assertEquals(11L, mergedStep.getVectorTimeMs());
  }
}
