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

package org.openmetadata.service.governance.workflows.elements;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;

class EdgeTest {

  private static String buildConditionExpression(String from, String to, String condition) {
    EdgeDefinition definition =
        new EdgeDefinition().withFrom(from).withTo(to).withCondition(condition);
    Process process = new Process();
    new Edge(definition).addToWorkflow(new BpmnModel(), process);
    SequenceFlow flow = (SequenceFlow) process.getFlowElements().iterator().next();
    return flow.getConditionExpression();
  }

  @Test
  void buildsExpectedExpressionForLegitimateCondition() {
    String expression = buildConditionExpression("CheckApproval", "Approved", "approve");
    assertEquals("${CheckApproval_result == 'approve'}", expression);
  }

  @Test
  void rejectsConditionThatBreaksOutOfStringLiteral() {
    assertThrows(
        IllegalArgumentException.class,
        () -> buildConditionExpression("CheckApproval", "Owned", "' || ''=='"));
  }

  @Test
  void rejectsConditionWithJuelExpressionSyntax() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            buildConditionExpression(
                "CheckApproval",
                "Owned",
                "true'} ${T(java.lang.Runtime).getRuntime().exec('id')} ${'"));
  }

  @Test
  void rejectsUnsafeSourceNodeReference() {
    assertThrows(
        IllegalArgumentException.class,
        () -> buildConditionExpression("a' == 'a", "Owned", "approve"));
  }
}
