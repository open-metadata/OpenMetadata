package org.openmetadata.service.governance.workflows.flowable.builders;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.flowable.bpmn.model.EventDefinition;
import org.flowable.bpmn.model.IntermediateCatchEvent;
import org.flowable.bpmn.model.MessageEventDefinition;
import org.junit.jupiter.api.Test;

class IntermediateCatchEventBuilderTest {

  @Test
  void testBuildSetsIdAndMessageExpression() {
    IntermediateCatchEvent event =
        new IntermediateCatchEventBuilder()
            .id("waitForStatus")
            .messageExpression("${taskId}")
            .build();

    assertEquals("waitForStatus", event.getId());
    assertEquals("waitForStatus", event.getName());
    assertEquals(1, event.getEventDefinitions().size());

    EventDefinition def = event.getEventDefinitions().get(0);
    assertTrue(def instanceof MessageEventDefinition);
    assertEquals("${taskId}", ((MessageEventDefinition) def).getMessageExpression());
  }

  @Test
  void testBuildThrowsWhenMessageExpressionNotSet() {
    IntermediateCatchEventBuilder builder = new IntermediateCatchEventBuilder().id("waitForStatus");

    IllegalStateException exception = assertThrows(IllegalStateException.class, builder::build);
    assertTrue(exception.getMessage().contains("messageExpression"));
  }

  @Test
  void testBuildThrowsWhenMessageExpressionIsEmpty() {
    IntermediateCatchEventBuilder builder =
        new IntermediateCatchEventBuilder().id("waitForStatus").messageExpression("");

    assertThrows(IllegalStateException.class, builder::build);
  }
}
