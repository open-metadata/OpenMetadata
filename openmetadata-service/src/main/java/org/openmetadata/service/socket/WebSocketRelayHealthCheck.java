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

import com.codahale.metrics.health.HealthCheck;

/**
 * Surfaces a degraded cross-pod relay instead of failing the pod. When Redis is the configured
 * transport but the relay is not connected (e.g. Redis was unreachable at startup and is still
 * being retried), this reports unhealthy so operators see the degraded delivery via
 * {@code /healthcheck} and metrics. The pod stays up — only cross-pod WebSocket delivery is
 * affected, and {@link RedisWebSocketRelay} reconnects on its own once Redis is reachable.
 */
public class WebSocketRelayHealthCheck extends HealthCheck {
  private final WebSocketRelay relay;
  private final boolean redisConfigured;

  public WebSocketRelayHealthCheck(WebSocketRelay relay, boolean redisConfigured) {
    this.relay = relay;
    this.redisConfigured = redisConfigured;
  }

  @Override
  protected Result check() {
    if (!redisConfigured || relay.isRunning()) {
      return Result.healthy();
    }
    return Result.unhealthy(
        "Redis WebSocket relay is not connected; cross-pod notification delivery is degraded "
            + "until Redis is reachable. The relay is retrying automatically.");
  }
}
