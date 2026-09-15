/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.codahale.metrics.MetricRegistry;
import io.dropwizard.core.server.DefaultServerFactory;
import io.dropwizard.http2.Http2CConnectorFactory;
import io.dropwizard.jetty.ConnectorFactory;
import java.net.URI;
import java.util.List;
import org.eclipse.jetty.client.ContentResponse;
import org.eclipse.jetty.client.HttpClient;
import org.eclipse.jetty.http.HttpStatus;
import org.eclipse.jetty.http.HttpVersion;
import org.eclipse.jetty.http.UriCompliance;
import org.eclipse.jetty.http2.client.HTTP2Client;
import org.eclipse.jetty.http2.client.transport.HttpClientTransportOverHTTP2;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.eclipse.jetty.util.Callback;
import org.junit.jupiter.api.Test;

class OpenMetadataApplicationTest {
  @Test
  void acceptsEncodedPercentOverHttp2() throws Exception {
    final Http2CConnectorFactory applicationConnector = new Http2CConnectorFactory();
    applicationConnector.setPort(0);

    // Mirror the production sequence: run() configures the connector beans, Dropwizard then builds
    // the connectors, and the server-started listener reconfigures the built connection factories.
    final OpenMetadataApplication application = new OpenMetadataApplication();
    application.configureUriCompliance(configurationWith(applicationConnector));
    assertEquals(UriCompliance.UNSAFE, applicationConnector.getUriCompliance());

    final Server server = new Server();
    final ServerConnector connector =
        (ServerConnector)
            applicationConnector.build(
                server, new MetricRegistry(), "http2-test", server.getThreadPool());
    server.addConnector(connector);
    server.setHandler(new OkHandler());

    server.start();
    application.configureUriCompliance(server.getConnectors());
    final HTTP2Client http2Client = new HTTP2Client();
    try (final HttpClient client = new HttpClient(new HttpClientTransportOverHTTP2(http2Client))) {
      client.start();
      final URI uri =
          URI.create(
              "http://127.0.0.1:"
                  + connector.getLocalPort()
                  + "/api/v1/tables/name/service.database.table%25name");
      final ContentResponse response = client.GET(uri);

      assertEquals(HttpVersion.HTTP_2, response.getVersion());
      assertEquals(HttpStatus.OK_200, response.getStatus());
    } finally {
      server.stop();
    }
  }

  private static OpenMetadataApplicationConfig configurationWith(final ConnectorFactory connector) {
    final DefaultServerFactory serverFactory = new DefaultServerFactory();
    serverFactory.setApplicationConnectors(List.of(connector));
    final OpenMetadataApplicationConfig configuration = new OpenMetadataApplicationConfig();
    configuration.setServerFactory(serverFactory);

    return configuration;
  }

  private static final class OkHandler extends Handler.Abstract {
    @Override
    public boolean handle(final Request request, final Response response, final Callback callback) {
      response.setStatus(HttpStatus.OK_200);
      callback.succeeded();
      return true;
    }
  }
}
