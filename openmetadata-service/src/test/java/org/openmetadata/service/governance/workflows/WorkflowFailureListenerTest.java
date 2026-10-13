package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import org.flowable.engine.delegate.event.FlowableCancelledEvent;
import org.flowable.engine.delegate.event.impl.FlowableEventBuilder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

class WorkflowFailureListenerTest {

  private static final String PROCESS_INSTANCE_ID = "process-instance";

  private final WorkflowFailureListener listener = new WorkflowFailureListener();
  private final Logger listenerLogger =
      (Logger) LoggerFactory.getLogger(WorkflowFailureListener.class);
  private final ListAppender<ILoggingEvent> appender = new ListAppender<>();

  @BeforeEach
  void attachAppender() {
    appender.start();
    listenerLogger.addAppender(appender);
  }

  @AfterEach
  void detachAppender() {
    listenerLogger.detachAppender(appender);
  }

  @Test
  void adminTerminationIsTreatedAsIntentional() {
    listener.onEvent(cancelledEvent(Workflow.TERMINATED_BY_ADMIN));

    assertEquals(List.of(), warnings());
  }

  @Test
  void unexpectedCancellationIsReportedAsAFailure() {
    listener.onEvent(cancelledEvent("Cancelled for an unknown reason"));

    assertTrue(warnings().stream().anyMatch(message -> message.contains("PROCESS_CANCELLED")));
  }

  private List<String> warnings() {
    return appender.list.stream()
        .filter(event -> event.getLevel() == Level.WARN)
        .map(ILoggingEvent::getFormattedMessage)
        .toList();
  }

  private static FlowableCancelledEvent cancelledEvent(String cause) {
    return FlowableEventBuilder.createCancelledEvent(
        PROCESS_INSTANCE_ID, PROCESS_INSTANCE_ID, "trigger:1:1", cause);
  }
}
