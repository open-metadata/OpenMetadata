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

package org.openmetadata.service.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.core.server.DefaultServerFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jetty.ConnectorFactory;
import io.dropwizard.jetty.HttpConnectorFactory;
import io.dropwizard.util.DataSize;
import jakarta.validation.Validation;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.eclipse.jetty.http.HttpStatus;
import org.eclipse.jetty.server.HttpConfiguration;
import org.eclipse.jetty.server.HttpConnectionFactory;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.eclipse.jetty.util.Callback;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.events.AuditExcludeFilterFactory;
import org.openmetadata.service.events.AuditOnlyFilterFactory;
import org.openmetadata.service.logging.SwitchableAccessLayoutFactory;
import org.openmetadata.service.logging.SwitchableEventLayoutFactory;

/**
 * Regression guard for <a
 * href="https://github.com/open-metadata/OpenMetadata/issues/28223">issue #28223</a>: SSO callbacks
 * returning HTTP 414 on {@code /badMessage} when the user belongs to 60+ AD groups.
 *
 * <p>OIDC providers (Azure AD, Okta) inline every group claim into the {@code id_token} JWT and
 * redirect to {@code /callback?code=...&id_token=...}. Jetty's request line (URI) and headers
 * share the {@code maxRequestHeaderSize} buffer, so an undersized default rejects the callback
 * before any servlet runs. This test pins the YAML default high enough to accommodate that flow
 * and demonstrates the original 8KiB default reproduces the bug.
 */
class HttpHeaderSizeYamlTest {

  /**
   * Lower bound for the request header buffer. The id_token JWT typically runs 4–8 KiB; with 60+
   * AD groups (the issue reporter's load) it routinely exceeds 30 KiB once URL-encoded into the
   * query string, on top of cookies and standard headers. 64 KiB leaves comfortable headroom.
   */
  private static final long MIN_REQUEST_HEADER_BYTES = 64L * 1024L;

  private static final List<String> CONFIG_PATHS =
      List.of(
          "../conf/openmetadata.yaml",
          "../conf/openmetadata-h2-test.yaml",
          "../docker/development/distributed-test/local/server1.yaml",
          "../docker/development/distributed-test/local/server2.yaml",
          "../docker/development/distributed-test/local/server3.yaml");

  @Test
  void allConfigsAllowLargeOidcCallbacks() throws Exception {
    for (String path : CONFIG_PATHS) {
      OpenMetadataApplicationConfig config = parse(path);
      assertTrue(
          config.getServerFactory() instanceof DefaultServerFactory,
          path + ": expected DefaultServerFactory");
      DefaultServerFactory serverFactory = (DefaultServerFactory) config.getServerFactory();
      assertHasLargeHeaderBuffer(serverFactory.getApplicationConnectors(), path);
    }
  }

  /**
   * Reproduces the issue: a Jetty connector sized at the original 8 KiB default rejects an OIDC
   * callback URI carrying 60+ Azure AD group GUIDs with HTTP 431 / 414 / 400 (Jetty's
   * {@code /badMessage} path), before any servlet handler runs. Then the same request succeeds
   * once the buffer is bumped to the new 64 KiB default.
   */
  @Test
  void reproducesAndFixesLargeUriRejection() throws Exception {
    String oversizedCallback = buildSimulatedOidcCallback(60);
    assertTrue(
        oversizedCallback.length() > 8 * 1024,
        "Simulated callback must exceed the old 8KiB default to reproduce the bug; got "
            + oversizedCallback.length()
            + " bytes");
    assertTrue(
        oversizedCallback.length() < MIN_REQUEST_HEADER_BYTES,
        "Simulated callback must fit inside the new 64KiB default; got "
            + oversizedCallback.length()
            + " bytes");

    int rejectedStatus = sendGetWithHeaderBuffer(oversizedCallback, 8 * 1024);
    assertTrue(
        rejectedStatus != HttpStatus.OK_200 && isRejectionStatus(rejectedStatus),
        "Original 8KiB default should reject the OIDC callback at the Jetty layer, but got HTTP "
            + rejectedStatus);

    int acceptedStatus = sendGetWithHeaderBuffer(oversizedCallback, (int) MIN_REQUEST_HEADER_BYTES);
    assertEquals(
        HttpStatus.OK_200,
        acceptedStatus,
        "New 64KiB default should let the OIDC callback reach the handler");
  }

  private void assertHasLargeHeaderBuffer(List<ConnectorFactory> connectors, String path) {
    assertNotNull(connectors, path + ": connectors must not be null");
    assertTrue(!connectors.isEmpty(), path + ": must define at least one application connector");
    for (ConnectorFactory connector : connectors) {
      assertTrue(
          connector instanceof HttpConnectorFactory,
          path + ": expected HttpConnectorFactory, got " + connector.getClass().getSimpleName());
      HttpConnectorFactory httpConnector = (HttpConnectorFactory) connector;
      DataSize requestSize = httpConnector.getMaxRequestHeaderSize();
      assertNotNull(requestSize, path + ": maxRequestHeaderSize must be set");
      assertTrue(
          requestSize.toBytes() >= MIN_REQUEST_HEADER_BYTES,
          path
              + ": maxRequestHeaderSize="
              + requestSize
              + " is too small for OIDC callbacks; must be >= 64KiB (see issue #28223)");
    }
  }

  /**
   * Status sentinel returned when Jetty closes the connection without writing a status line.
   * That is the behaviour the user observes as "/badMessage" with no usable response from the
   * server's perspective.
   */
  private static final int CONNECTION_CLOSED = -1;

  private static boolean isRejectionStatus(int status) {
    return status == CONNECTION_CLOSED
        || status == HttpStatus.URI_TOO_LONG_414
        || status == HttpStatus.BAD_REQUEST_400
        || status == HttpStatus.REQUEST_HEADER_FIELDS_TOO_LARGE_431;
  }

  /**
   * Builds a path of length {@code groups * 64} simulating the URL-encoded {@code id_token}
   * payload an OIDC provider produces for a user in {@code groups} AD groups. We use the path
   * (not the query string) so the bytes count toward the request line and trigger the same
   * Jetty rejection as a real callback.
   */
  private static String buildSimulatedOidcCallback(int groups) {
    StringBuilder sb = new StringBuilder("/callback/");
    String groupGuid = "00000000-0000-0000-0000-000000000000-".repeat(2);
    for (int i = 0; i < groups * 3; i++) {
      sb.append(groupGuid);
    }
    return sb.toString();
  }

  private static int sendGetWithHeaderBuffer(String path, int requestHeaderSizeBytes)
      throws Exception {
    Server server = new Server();
    HttpConfiguration httpConfig = new HttpConfiguration();
    httpConfig.setRequestHeaderSize(requestHeaderSizeBytes);
    httpConfig.setResponseHeaderSize(requestHeaderSizeBytes);
    ServerConnector connector = new ServerConnector(server, new HttpConnectionFactory(httpConfig));
    connector.setPort(0);
    server.addConnector(connector);
    server.setHandler(
        new org.eclipse.jetty.server.Handler.Abstract() {
          @Override
          public boolean handle(Request request, Response response, Callback callback) {
            response.setStatus(HttpStatus.OK_200);
            callback.succeeded();
            return true;
          }
        });
    server.start();
    try {
      return rawGetStatus("127.0.0.1", connector.getLocalPort(), path);
    } finally {
      server.stop();
    }
  }

  /**
   * Sends a raw HTTP/1.1 GET and returns either the parsed status code or {@link
   * #CONNECTION_CLOSED} if the server hung up without writing a status line — the symptom users
   * see in #28223. {@link java.net.HttpURLConnection} can't distinguish these cases (it just
   * times out), so we go straight to a socket.
   */
  private static int rawGetStatus(String host, int port, String path) throws Exception {
    try (Socket socket = new Socket(host, port)) {
      socket.setSoTimeout(5000);
      String request =
          "GET " + path + " HTTP/1.1\r\n" + "Host: " + host + "\r\n" + "Connection: close\r\n\r\n";
      OutputStream out = socket.getOutputStream();
      out.write(request.getBytes(StandardCharsets.ISO_8859_1));
      out.flush();
      BufferedReader reader =
          new BufferedReader(
              new InputStreamReader(socket.getInputStream(), StandardCharsets.ISO_8859_1));
      String statusLine = reader.readLine();
      if (statusLine == null || !statusLine.startsWith("HTTP/")) {
        return CONNECTION_CLOSED;
      }
      String[] parts = statusLine.split(" ", 3);
      return parts.length >= 2 ? Integer.parseInt(parts[1]) : CONNECTION_CLOSED;
    } catch (java.io.IOException eof) {
      return CONNECTION_CLOSED;
    }
  }

  private OpenMetadataApplicationConfig parse(String path) throws Exception {
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    objectMapper.registerSubtypes(
        AuditExcludeFilterFactory.class,
        AuditOnlyFilterFactory.class,
        SwitchableEventLayoutFactory.class,
        SwitchableAccessLayoutFactory.class);
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class,
            Validation.buildDefaultValidatorFactory().getValidator(),
            objectMapper,
            "dw");
    return factory.build(
        new SubstitutingSourceProvider(
            new FileConfigurationSourceProvider(), new EnvironmentVariableSubstitutor(false)),
        path);
  }
}
