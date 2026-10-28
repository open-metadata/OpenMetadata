package org.openmetadata.service.socket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.socket.engineio.server.EngineIoServer;
import java.io.IOException;
import java.nio.channels.ClosedChannelException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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

  /**
   * The servlet filter chain never sees the upgrade, so the identity the upgrade creator validated
   * must be stamped into the engine.io handshake headers here — this is what WebSocketManager keys
   * the socket under, and what collate's chat namespace reads back.
   */
  @Test
  void validatedIdentityIsStampedIntoConnectionHeadersOnOpen() {
    EngineIoServer server = mock(EngineIoServer.class);
    Jetty12WebSocketHandler stamped =
        new Jetty12WebSocketHandler(server, new HandshakeIdentity("user-uuid", "session-id"));
    org.eclipse.jetty.websocket.api.Session session =
        mock(org.eclipse.jetty.websocket.api.Session.class);
    org.eclipse.jetty.websocket.api.UpgradeRequest upgradeRequest =
        mock(org.eclipse.jetty.websocket.api.UpgradeRequest.class);
    when(session.getUpgradeRequest()).thenReturn(upgradeRequest);
    when(upgradeRequest.getParameterMap()).thenReturn(Map.of("userId", List.of("user-uuid")));
    when(upgradeRequest.getHeaders()).thenReturn(Map.of("Cookie", List.of("OM_SESSION=abc")));

    stamped.onOpen(session);

    assertEquals("user-uuid", stamped.getConnectionHeaders().get("UserId").get(0));
    assertEquals("session-id", stamped.getConnectionHeaders().get("SessionId").get(0));
    assertEquals(Map.of("userId", "user-uuid"), stamped.getQuery());
    verify(server).handleWebSocket(stamped);
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
