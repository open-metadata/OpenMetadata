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
package org.openmetadata.service.socket;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.codahale.metrics.health.HealthCheck;
import org.junit.jupiter.api.Test;

class WebSocketRelayHealthCheckTest {

  private static WebSocketRelay relay(boolean running) {
    return new WebSocketRelay() {
      @Override
      public void publish(String scope, String target, String event, String message) {}

      @Override
      public boolean isRunning() {
        return running;
      }
    };
  }

  @Test
  void healthyWhenRedisIsNotTheConfiguredTransport() throws Exception {
    // DB relay path (redisConfigured=false): never reports the Redis degradation.
    assertTrue(new WebSocketRelayHealthCheck(relay(false), false).execute().isHealthy());
  }

  @Test
  void healthyWhenRedisRelayIsConnected() throws Exception {
    assertTrue(new WebSocketRelayHealthCheck(relay(true), true).execute().isHealthy());
  }

  @Test
  void unhealthyWhenRedisConfiguredButRelayNotConnected() throws Exception {
    // The pod stays up; the health check is how the degraded state is surfaced.
    HealthCheck.Result result = new WebSocketRelayHealthCheck(relay(false), true).execute();
    assertFalse(result.isHealthy());
    assertTrue(result.getMessage().contains("degraded"));
  }
}
