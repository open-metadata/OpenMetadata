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
package org.openmetadata.service.monitoring;

import io.dropwizard.core.setup.Environment;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.server.handler.QoSHandler;
import org.openmetadata.service.config.QoSConfiguration;

@Slf4j
public class JettyQoSIntegration {

  public static void registerQoSHandler(Environment environment, QoSConfiguration config) {
    if (!config.isEnabled()) {
      LOG.info("QoS handler is disabled");
      return;
    }
    try {
      QoSHandler qosHandler = new QoSHandler();
      qosHandler.setMaxRequestCount(config.getMaxRequestCount());
      qosHandler.setMaxSuspendedRequestCount(config.getMaxSuspendedRequestCount());
      qosHandler.setMaxSuspend(Duration.ofSeconds(config.getMaxSuspendSeconds()));

      environment.getApplicationContext().insertHandler(qosHandler);

      LOG.info(
          "QoS handler registered: maxRequests={}, maxSuspended={}, maxSuspendTimeout={}s",
          config.getMaxRequestCount(),
          config.getMaxSuspendedRequestCount(),
          config.getMaxSuspendSeconds());
    } catch (Exception e) {
      LOG.error("Failed to register QoS handler", e);
    }
  }
}
