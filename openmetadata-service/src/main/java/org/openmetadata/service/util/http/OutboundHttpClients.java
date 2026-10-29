/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.util.http;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.client.ClientConfig;
import org.glassfish.jersey.client.ClientProperties;
import org.glassfish.jersey.client.HttpUrlConnectorProvider;
import org.openmetadata.service.util.OutboundUrlPolicyFilter;

/** HTTP clients for requests the server makes to URLs users configure. */
@Slf4j
public final class OutboundHttpClients {
  private OutboundHttpClients() {}

  public static Client newClient(int connectTimeout, int readTimeout) {
    // Cap timeouts to prevent runaway webhook destinations from exhausting resources
    // Minimum 5 seconds to allow reasonable connection establishment
    // Maximum 30 seconds for connect, 120 seconds for read to prevent indefinite waits
    int effectiveConnectTimeout = Math.min(Math.max(connectTimeout, 5), 30);
    int effectiveReadTimeout = Math.min(Math.max(readTimeout, 10), 120);

    if (connectTimeout != effectiveConnectTimeout) {
      LOG.debug(
          "Connect timeout {} clamped to {} (valid range: 5-30 seconds)",
          connectTimeout,
          effectiveConnectTimeout);
    }
    if (readTimeout != effectiveReadTimeout) {
      LOG.debug(
          "Read timeout {} clamped to {} (valid range: 10-120 seconds)",
          readTimeout,
          effectiveReadTimeout);
    }

    // One exchange may take at most its two timeouts together, however the receiver behaves.
    return newClient(
        effectiveConnectTimeout,
        effectiveReadTimeout,
        Duration.ofSeconds((long) effectiveConnectTimeout + effectiveReadTimeout));
  }

  static Client newClient(
      int effectiveConnectTimeout, int effectiveReadTimeout, Duration deadline) {
    ClientConfig config =
        new ClientConfig()
            .connectorProvider(
                (client, configuration) ->
                    new DeadlineConnector(
                        new HttpUrlConnectorProvider().getConnector(client, configuration),
                        deadline));
    ClientBuilder clientBuilder = ClientBuilder.newBuilder().withConfig(config);
    clientBuilder.connectTimeout(effectiveConnectTimeout, TimeUnit.SECONDS);
    clientBuilder.readTimeout(effectiveReadTimeout, TimeUnit.SECONDS);
    // A redirect is a failure for a callback, and following one would skip the policy check below
    clientBuilder.property(ClientProperties.FOLLOW_REDIRECTS, false);
    clientBuilder.register(new OutboundUrlPolicyFilter());
    return clientBuilder.build();
  }
}
