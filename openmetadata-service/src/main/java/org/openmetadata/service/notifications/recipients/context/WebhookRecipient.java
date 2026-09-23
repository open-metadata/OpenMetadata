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

package org.openmetadata.service.notifications.recipients.context;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Invocation.Builder;
import jakarta.ws.rs.client.WebTarget;
import java.net.URI;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import lombok.Getter;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.SubscriptionUtil;
import org.openmetadata.service.util.URLValidator;

/**
 * Webhook recipient with webhook endpoint and configuration.
 *
 * Represents a recipient that should receive notifications via webhook (Slack, MS Teams, Google
 * Chat, or generic webhook). Two WebhookRecipient instances are equal if they have the same
 * webhook endpoint URL.
 */
@Slf4j
@Getter
@ToString
public final class WebhookRecipient extends Recipient {
  private final Webhook webhook;

  private record Identity(URI endpoint, Map<String, String> queryParams) {}

  public WebhookRecipient(Webhook webhook) {
    this(webhook, CONFIGURED);
  }

  public WebhookRecipient(Webhook webhook, String name) {
    super(name);
    this.webhook = Objects.requireNonNull(webhook, "webhook cannot be null");
  }

  /**
   * The endpoint as written, with the query parameters its configuration adds, which some
   * endpoints route by. Nothing else is normalised, so no two endpoints that get separate
   * messages today become one.
   */
  @Override
  public Object identity() {
    Map<String, String> queryParams =
        CommonUtil.nullOrEmpty(webhook.getQueryParams()) ? Map.of() : webhook.getQueryParams();
    return new Identity(webhook.getEndpoint(), Map.copyOf(queryParams));
  }

  /**
   * The webhook a profile keeps for one channel, which the channel picks out of the profile's
   * subscriptions. Null when there is none or its endpoint is not an allowed URL.
   */
  public static WebhookRecipient ofProfile(
      String name, Profile profile, Function<SubscriptionConfig, Webhook> ofTheChannel) {
    boolean hasSubscriptions = profile != null && profile.getSubscription() != null;
    Webhook webhook = hasSubscriptions ? ofTheChannel.apply(profile.getSubscription()) : null;
    return isUsable(webhook) ? new WebhookRecipient(webhook, name) : null;
  }

  /**
   * Build a configured HTTP request for this webhook recipient.
   *
   * Applies all webhook configuration including query parameters, authentication headers, custom
   * headers, and HMAC signature.
   *
   * @param client the JAX-RS client for making HTTP requests
   * @param payload the JSON payload to be sent (used for HMAC calculation)
   * @return a configured Invocation.Builder ready to send the request
   */
  public Builder getConfiguredRequest(Client client, String payload) {
    String endpoint = webhook.getEndpoint().toString();

    // Build the request target with query parameters
    WebTarget target = client.target(endpoint);
    target = addQueryParameters(target, webhook.getQueryParams());

    // Add authentication headers
    Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
    Builder requestBuilder = SecurityUtil.addHeaders(target, authHeaders);

    // Add webhook-specific headers (custom headers + HMAC signature)
    SubscriptionUtil.prepareWebhookHeaders(requestBuilder, webhook, payload);

    return requestBuilder;
  }

  private static WebTarget addQueryParameters(WebTarget target, Map<String, String> queryParams) {
    if (CommonUtil.nullOrEmpty(queryParams)) {
      return target;
    }

    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    return target;
  }

  private static boolean isUsable(Webhook webhook) {
    boolean usable = webhook != null && webhook.getEndpoint() != null;
    if (usable) {
      try {
        URLValidator.validateURL(webhook.getEndpoint().toString());
      } catch (Exception e) {
        LOG.error("Failed to validate webhook endpoint: {}", e.getMessage());
        usable = false;
      }
    }
    return usable;
  }
}
