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

package org.openmetadata.service.events.subscription.channels.builtin;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.subscription.channels.Transport;
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.util.SubscriptionUtil;

/**
 * Posts to HTTP endpoints for every channel that does. It owns the HTTP clients: one per distinct
 * pair of clamped timeouts, shared by every destination that asks for that pair, and closed when
 * the server shuts down. A destination with a huge timeout would pin a worker thread, so connect
 * timeouts are kept within 5 to 30 seconds and read timeouts within 10 to 120.
 */
@Slf4j
public final class HttpWebhookTransport implements Transport {
  private static final HttpWebhookTransport SHARED = new HttpWebhookTransport();
  static final int MIN_CONNECT_SECONDS = 5;
  static final int MAX_CONNECT_SECONDS = 30;
  static final int MIN_READ_SECONDS = 10;
  static final int MAX_READ_SECONDS = 120;
  private static final int FIRST_STATUS_THAT_IS_NOT_A_SUCCESS = 300;

  private record Timeouts(int connectSeconds, int readSeconds) {}

  private final Map<Timeouts, Client> clients = new ConcurrentHashMap<>();

  HttpWebhookTransport() {}

  public static HttpWebhookTransport shared() {
    return SHARED;
  }

  /** The shared client for these timeouts. Callers never close it. */
  public Client clientFor(int connectSeconds, int readSeconds) {
    Timeouts clamped =
        new Timeouts(
            clamp(connectSeconds, MIN_CONNECT_SECONDS, MAX_CONNECT_SECONDS),
            clamp(readSeconds, MIN_READ_SECONDS, MAX_READ_SECONDS));
    return clients.computeIfAbsent(clamped, HttpWebhookTransport::build);
  }

  @Override
  public void deliver(NotificationMessage message, SubscriptionDestination destination) {
    Webhook webhook = JsonUtils.convertValue(destination.getConfig(), Webhook.class);
    String json = JsonUtils.pojoToJsonIgnoreNull(message);
    Client client = clientFor(destination.getTimeout(), destination.getReadTimeout());
    Invocation.Builder target = SubscriptionUtil.getTarget(client, webhook, json);
    try (Response response = target.post(Entity.entity(json, MediaType.APPLICATION_JSON_TYPE))) {
      if (response.getStatus() >= FIRST_STATUS_THAT_IS_NOT_A_SUCCESS) {
        throw new IllegalStateException("Webhook failed with status: " + response.getStatus());
      }
    }
  }

  public void close() {
    clients.values().forEach(Client::close);
    clients.clear();
    LOG.info("Closed the HTTP clients of the webhook transport");
  }

  int openClients() {
    return clients.size();
  }

  private static Client build(Timeouts timeouts) {
    return ClientBuilder.newBuilder()
        .connectTimeout(timeouts.connectSeconds(), TimeUnit.SECONDS)
        .readTimeout(timeouts.readSeconds(), TimeUnit.SECONDS)
        .build();
  }

  private static int clamp(int value, int min, int max) {
    return Math.min(Math.max(value, min), max);
  }
}
