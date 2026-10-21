package org.openmetadata.service.socket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.socket.engineio.server.EngineIoServer;
import java.io.IOException;
import java.nio.channels.ClosedChannelException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeoutException;
import java.util.stream.Stream;
import org.eclipse.jetty.io.EofException;
import org.eclipse.jetty.websocket.api.exceptions.WebSocketTimeoutException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.slf4j.LoggerFactory;

class Jetty12WebSocketHandlerTest {

  private final Jetty12WebSocketHandler handler =
      new Jetty12WebSocketHandler(mock(EngineIoServer.class));
  private final Logger handlerLogger =
      (Logger) LoggerFactory.getLogger(Jetty12WebSocketHandler.class);
  private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
  private final List<Object[]> emittedErrors = new ArrayList<>();

  @BeforeEach
  void setUp() {
    appender.start();
    handlerLogger.addAppender(appender);
    handler.on("error", emittedErrors::add);
  }

  @AfterEach
  void detachAppender() {
    handlerLogger.detachAppender(appender);
  }

  static Stream<Throwable> peerGoneErrors() {
    return Stream.of(
        new WebSocketTimeoutException(
            "Connection Idle Timeout", new TimeoutException("Idle timeout expired: 9078/1000 ms")),
        new EofException(new IOException("Connection reset by peer")),
        new ClosedChannelException());
  }

  @ParameterizedTest
  @MethodSource("peerGoneErrors")
  void peerGoneIsNotReportedAsAnError(Throwable error) {
    handler.onError(error);

    assertEquals(List.of(), errors());
    assertEquals(0, emittedErrors.size());
  }

  @Test
  void unexpectedErrorIsLoggedAndForwardedToEngineIo() {
    handler.onError(new IllegalStateException("boom"));

    assertEquals(List.of("WebSocket error: IllegalStateException - boom"), errors());
    assertEquals(1, emittedErrors.size());
  }

  private List<String> errors() {
    return appender.list.stream()
        .filter(event -> event.getLevel() == Level.ERROR)
        .map(ILoggingEvent::getFormattedMessage)
        .toList();
  }
}
