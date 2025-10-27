/*
 *  Copyright 2025 OpenMetadata
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

package org.openmetadata.service.clients;

import io.dropwizard.lifecycle.Managed;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.config.ThirdEyeConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Managed service for ThirdEye client lifecycle.
 * 
 * This service handles the initialization and cleanup of the ThirdEye client
 * connection, ensuring proper resource management.
 */
@Slf4j
public class ThirdEyeService implements Managed {
  
  private static final Logger log = LoggerFactory.getLogger(ThirdEyeService.class);
  
  private final ThirdEyeClient thirdEyeClient;
  private final ThirdEyeConfiguration config;

  public ThirdEyeService(ThirdEyeConfiguration config) {
    this.config = config;
    this.thirdEyeClient = new ThirdEyeClient(config);
  }

  @Override
  public void start() throws Exception {
    if (!config.isEnabled()) {
      log.info("ThirdEye service is disabled");
      return;
    }

    log.info("Starting ThirdEye service connection to {}:{}", config.getHost(), config.getPort());
    
    // Test connection
    try {
      boolean isHealthy = thirdEyeClient.healthCheck().get();
      if (isHealthy) {
        log.info("ThirdEye service is healthy and ready");
      } else {
        log.warn("ThirdEye service is not healthy");
      }
    } catch (Exception e) {
      log.warn("Failed to connect to ThirdEye service: {}", e.getMessage());
      log.debug("ThirdEye connection error details", e);
    }
  }

  @Override
  public void stop() throws Exception {
    if (!config.isEnabled()) {
      return;
    }

    log.info("Stopping ThirdEye service connection");
    // No explicit cleanup needed for HTTP client
  }

  /**
   * Get the ThirdEye client instance
   */
  public ThirdEyeClient getClient() {
    return thirdEyeClient;
  }

  /**
   * Check if ThirdEye service is available
   */
  public boolean isAvailable() {
    if (!config.isEnabled()) {
      return false;
    }
    
    return thirdEyeClient.isAvailable();
  }
}
