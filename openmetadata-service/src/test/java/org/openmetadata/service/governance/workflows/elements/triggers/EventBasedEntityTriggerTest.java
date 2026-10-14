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

package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.StartEvent;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.elements.triggers.Config;
import org.openmetadata.schema.governance.workflows.elements.triggers.Event;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;

class EventBasedEntityTriggerTest {

  @Test
  void everyChangeEventStartEventLeavesAsynchronously() {
    BpmnModel model = new BpmnModel();

    new EventBasedEntityTrigger(
            "MetricApprovalWorkflow", "MetricApprovalTrigger", metricAndGlossaryTermTrigger())
        .addToWorkflow(model);

    List<StartEvent> startEvents = startEventsOf(model);
    assertEquals(4, startEvents.size());
    startEvents.forEach(
        startEvent ->
            assertTrue(
                startEvent.isAsynchronousLeave(),
                String.format(
                    "Start event '%s' must leave asynchronously so the signal sender returns once"
                        + " the instance is committed",
                    startEvent.getId())));
  }

  @Test
  void changeRequestStartEventStaysSynchronous() {
    // Delivery of a change request is complete once the signal returns, and it retries a review
    // run that fails, so that run must still reach its first wait state on the delivering thread.
    BpmnModel model = new BpmnModel();

    new EventBasedEntityTrigger(
            "MetricApprovalWorkflow",
            "MetricApprovalTrigger",
            metricAndGlossaryTermTrigger(),
            true,
            Set.of())
        .addToWorkflow(model);

    List<StartEvent> startEvents = startEventsOf(model);
    assertEquals(2, startEvents.size());
    startEvents.forEach(startEvent -> assertFalse(startEvent.isAsynchronousLeave()));
  }

  private static EventBasedEntityTriggerDefinition metricAndGlossaryTermTrigger() {
    return new EventBasedEntityTriggerDefinition()
        .withConfig(
            new Config()
                .withEntityTypes(Set.of("metric", "glossaryTerm"))
                .withEvents(Set.of(Event.CREATED, Event.UPDATED)));
  }

  private static List<StartEvent> startEventsOf(BpmnModel model) {
    return model
        .getProcessById("MetricApprovalTrigger")
        .findFlowElementsOfType(StartEvent.class, false);
  }
}
