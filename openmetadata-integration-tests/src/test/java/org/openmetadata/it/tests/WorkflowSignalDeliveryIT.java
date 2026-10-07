package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.sql.SQLException;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.service.governance.workflows.WorkflowHandler;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class WorkflowSignalDeliveryIT {
  private static final ThreadLocal<AtomicInteger> DELIVERIES =
      ThreadLocal.withInitial(AtomicInteger::new);

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void retriesOnlyTheFailedSubscriber(final boolean waiting, final TestNamespace ns) {
    final WorkflowHandler handler = WorkflowHandler.getInstance();
    final var repository = handler.getRepositoryService();
    final var runtime = handler.getRuntimeService();
    final String suffix = waiting ? "-waiting" : "-start";
    final String signal = ns.prefix("retry-signal" + suffix);
    final String first = ns.prefix("first" + suffix);
    final String second = ns.prefix("second" + suffix);
    final String xml =
        """
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
          xmlns:flowable="http://flowable.org/bpmn" targetNamespace="signal-retry-test">
          <signal id="event" name="%s"/>
          %s
          %s
        </definitions>
        """
            .formatted(signal, process(first, waiting), process(second, waiting));
    final var deployment =
        repository.createDeployment().addString("retry.bpmn20.xml", xml).deploy();
    try {
      if (waiting) {
        runtime.startProcessInstanceByKey(first);
        runtime.startProcessInstanceByKey(second);
      }
      handler.triggerWithSignal(signal, Map.of("eventId", ns.prefix("event")));

      assertEquals(3, DELIVERIES.get().get());
      assertEquals(1, runtime.createProcessInstanceQuery().processDefinitionKey(first).count());
      assertEquals(1, runtime.createProcessInstanceQuery().processDefinitionKey(second).count());
      assertEquals(
          1,
          runtime
              .createExecutionQuery()
              .processDefinitionKey(first)
              .activityId(first + "_hold")
              .count());
      assertEquals(
          1,
          runtime
              .createExecutionQuery()
              .processDefinitionKey(second)
              .activityId(second + "_hold")
              .count());
    } finally {
      repository.deleteDeployment(deployment.getId(), true);
      DELIVERIES.remove();
    }
  }

  private static String process(final String key, final boolean waiting) {
    final String start =
        waiting
            ? """
              <startEvent id="%1$s_start"/>
              <sequenceFlow id="%1$s_toSignal" sourceRef="%1$s_start" targetRef="%1$s_receive"/>
              <intermediateCatchEvent id="%1$s_receive">
                <signalEventDefinition signalRef="event"/>
              </intermediateCatchEvent>
              """
                .formatted(key)
            : """
              <startEvent id="%s_receive"><signalEventDefinition signalRef="event"/></startEvent>
              """
                .formatted(key);
    return """
        <process id="%1$s" isExecutable="true">
          %2$s
          <sequenceFlow id="%1$s_toDelivery" sourceRef="%1$s_receive" targetRef="%1$s_delivery"/>
          <serviceTask id="%1$s_delivery" flowable:class="%3$s"/>
          <sequenceFlow id="%1$s_toHold" sourceRef="%1$s_delivery" targetRef="%1$s_hold"/>
          <userTask id="%1$s_hold" name="Delivered once"/>
        </process>
        """
        .formatted(key, start, FailSecondDeliveryOnce.class.getName());
  }

  public static class FailSecondDeliveryOnce implements JavaDelegate {
    @Override
    public void execute(final DelegateExecution execution) {
      if (DELIVERIES.get().incrementAndGet() == 2) {
        throw new IllegalStateException(
            "Injected deadlock", new SQLException("Deadlock", "40001", 1213));
      }
    }
  }
}
