package org.openmetadata.service.socket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import java.util.HashMap;
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
      new Jetty12WebSocketHandler(
          mock(EngineIoServer.class), new HandshakeIdentity("user-uuid", "session-id"));
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

  /**
   * WebSocketManager reads the first value of UserId/SessionId, so a field the handshake did not
   * establish must be absent — never the client's own value, under any header-name casing.
   */
  @Test
  void clientIdentityHeadersAreDroppedBeforeStamping() {
    Jetty12WebSocketHandler stamped =
        new Jetty12WebSocketHandler(
            mock(EngineIoServer.class), new HandshakeIdentity("user-uuid", null));
    Map<String, List<String>> forged = new HashMap<>();
    forged.put("userid", List.of("victim-uuid", "other-uuid"));
    forged.put("SESSIONID", List.of("victim-session"));
    forged.put("SessionId", List.of("victim-session-2"));
    forged.put("Cookie", List.of("OM_SESSION=abc"));

    stamped.onOpen(upgradeSession(Map.of(), forged));

    Map<String, List<String>> headers = stamped.getConnectionHeaders();
    assertEquals(List.of("user-uuid"), headers.get("UserId"));
    assertEquals(
        List.of("Cookie", "UserId"),
        headers.keySet().stream().sorted().toList(),
        "only the validated identity may survive next to unrelated headers");
  }

  /** The handshake query carries the bearer token, so no log line may contain it at any level. */
  @Test
  void handshakeTokenNeverReachesTheLog() {
    Level previous = handlerLogger.getLevel();
    handlerLogger.setLevel(Level.TRACE);
    try {
      handler.onOpen(
          upgradeSession(
              Map.of("token", List.of("secret-token"), "userId", List.of("user-uuid")),
              Map.of("Cookie", List.of("OM_SESSION=abc"))));
    } finally {
      handlerLogger.setLevel(previous);
    }

    List<String> leaking =
        appender.list.stream()
            .map(ILoggingEvent::getFormattedMessage)
            .filter(message -> message.contains("secret-token"))
            .toList();
    assertEquals(List.of(), leaking);
    assertTrue(
        appender.list.stream()
            .map(ILoggingEvent::getFormattedMessage)
            .anyMatch(message -> message.contains("user-uuid")),
        "the open is still logged with the validated user id");
  }

  private static org.eclipse.jetty.websocket.api.Session upgradeSession(
      Map<String, List<String>> parameters, Map<String, List<String>> headers) {
    org.eclipse.jetty.websocket.api.Session session =
        mock(org.eclipse.jetty.websocket.api.Session.class);
    org.eclipse.jetty.websocket.api.UpgradeRequest upgradeRequest =
        mock(org.eclipse.jetty.websocket.api.UpgradeRequest.class);
    when(session.getUpgradeRequest()).thenReturn(upgradeRequest);
    when(upgradeRequest.getParameterMap()).thenReturn(parameters);
    when(upgradeRequest.getHeaders()).thenReturn(headers);
    when(upgradeRequest.getRequestURI())
        .thenReturn(java.net.URI.create("ws://localhost/api/v1/push/feed/?token=secret-token"));
    return session;
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
