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

import static org.junit.jupiter.api.Assertions.assertSame;

import io.dropwizard.core.server.DefaultServerFactory;
import io.dropwizard.http2.Http2CConnectorFactory;
import io.dropwizard.http2.Http2ConnectorFactory;
import java.util.List;
import org.eclipse.jetty.http.UriCompliance;
import org.junit.jupiter.api.Test;

class OpenMetadataApplicationTest {
  @Test
  void configuresUnsafeUriComplianceForHttp2Connectors() {
    Http2ConnectorFactory applicationConnector = new Http2ConnectorFactory();
    Http2CConnectorFactory adminConnector = new Http2CConnectorFactory();
    DefaultServerFactory serverFactory = new DefaultServerFactory();
    serverFactory.setApplicationConnectors(List.of(applicationConnector));
    serverFactory.setAdminConnectors(List.of(adminConnector));
    OpenMetadataApplicationConfig configuration = new OpenMetadataApplicationConfig();
    configuration.setServerFactory(serverFactory);

    new OpenMetadataApplication().configureUriCompliance(configuration);

    assertSame(UriCompliance.UNSAFE, applicationConnector.getUriCompliance());
    assertSame(UriCompliance.UNSAFE, adminConnector.getUriCompliance());
  }
}
