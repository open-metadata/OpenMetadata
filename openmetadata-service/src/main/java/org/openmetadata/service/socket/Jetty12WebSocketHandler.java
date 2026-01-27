/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.socket;

import io.socket.engineio.server.EngineIoServer;
import io.socket.engineio.server.EngineIoWebSocket;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.websocket.api.Callback;
import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketClose;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketError;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketMessage;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketOpen;
import org.eclipse.jetty.websocket.api.annotations.WebSocket;

/**
 * Jetty 12 compatible WebSocket handler for Engine.IO. This replaces the JettyWebSocketHandler from
 * engine.io-server-jetty which is not compatible with Jetty 12's new WebSocket API.
 */
@Slf4j
@WebSocket(autoDemand = true)
public class Jetty12WebSocketHandler extends EngineIoWebSocket {

  private final EngineIoServer server;
  private Session session;
  private Map<String, String> query;
  private Map<String, List<String>> headers;

  public Jetty12WebSocketHandler(EngineIoServer server) {
    this.server = server;
  }

  @Override
  public Map<String, String> getQuery() {
    return query;
  }

  @Override
  public Map<String, List<String>> getConnectionHeaders() {
    return headers;
  }

  @Override
  public void write(String message) throws IOException {
    if (session != null && session.isOpen()) {
      session.sendText(message, Callback.NOOP);
    }
  }

  @Override
  public void write(byte[] message) throws IOException {
    if (session != null && session.isOpen()) {
      session.sendBinary(ByteBuffer.wrap(message), Callback.NOOP);
    }
  }

  @Override
  public void close() {
    if (session != null && session.isOpen()) {
      session.close();
    }
  }

  @OnWebSocketOpen
  public void onOpen(Session session) {
    this.session = session;
    LOG.info("WebSocket connection opened");

    // Parse query parameters from upgrade request
    this.query = new HashMap<>();
    var upgradeRequest = session.getUpgradeRequest();
    if (upgradeRequest != null) {
      LOG.debug("UpgradeRequest URI: {}", upgradeRequest.getRequestURI());
      var parameterMap = upgradeRequest.getParameterMap();
      if (parameterMap != null) {
        LOG.debug("Query parameters: {}", parameterMap);
        for (Map.Entry<String, List<String>> entry : parameterMap.entrySet()) {
          if (entry.getValue() != null && !entry.getValue().isEmpty()) {
            query.put(entry.getKey(), entry.getValue().get(0));
          }
        }
      }
      this.headers = upgradeRequest.getHeaders();
    } else {
      LOG.warn("UpgradeRequest is null - query parameters will be empty");
      this.headers = new HashMap<>();
    }

    LOG.info("Parsed query params for Engine.IO: {}", query);
    server.handleWebSocket(this);
  }

  @OnWebSocketMessage
  public void onTextMessage(Session session, String message) {
    emit("message", message);
  }

  @OnWebSocketMessage
  public void onBinaryMessage(Session session, ByteBuffer buffer, Callback callback) {
    byte[] message = new byte[buffer.remaining()];
    buffer.get(message);
    emit("message", message);
    callback.succeed();
  }

  @OnWebSocketClose
  public void onClose(int statusCode, String reason) {
    LOG.info("WebSocket closed: statusCode={}, reason={}", statusCode, reason);
    emit("close");
    this.session = null;
  }

  @OnWebSocketError
  public void onError(Throwable error) {
    LOG.error("WebSocket error: {}", error.getMessage(), error);
    emit("error", "websocket error", error.getMessage());
  }
}
