/*
 *  Copyright 2022 Collate
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
package org.openmetadata.catalog.airflow;

import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.URI;
import java.net.URISyntaxException;
import org.apache.http.client.utils.URIBuilder;
import org.junit.jupiter.api.extension.AfterAllCallback;
import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ExtensionContext;

public class HttpServerExtension implements BeforeAllCallback, AfterAllCallback {

  private static final int PORT;
  static {
    try (ServerSocket socket = new ServerSocket(0)) {
      socket.setReuseAddress(true);
      PORT = socket.getLocalPort();
    } catch (IOException ex) {
      throw new RuntimeException("Could not find a free port for testing");
    }
  }
  private static final String HOST = "localhost";
  private static final String SCHEME = "http";
  private static final String DEFAULT_CONTEXT = "/";

  private com.sun.net.httpserver.HttpServer server;

  @Override
  public void afterAll(ExtensionContext extensionContext) throws Exception {
    if (server != null) {
      server.stop(0);
    }
  }

  @Override
  public void beforeAll(ExtensionContext extensionContext) throws Exception {
    server = HttpServer.create(new InetSocketAddress(PORT), 0);
    server.setExecutor(null);
    server.start();
    server.createContext(DEFAULT_CONTEXT);
  }

  public static URI getUriFor(String path) throws URISyntaxException {
    return new URIBuilder().setScheme(SCHEME).setHost(HOST).setPort(PORT).setPath(path).build();
  }

  public void registerHandler(String uriToHandle, HttpHandler httpHandler) {
    server.createContext(uriToHandle, httpHandler);
  }

  public void unregisterHandler() {
    server.removeContext(DEFAULT_CONTEXT);
  }
}
