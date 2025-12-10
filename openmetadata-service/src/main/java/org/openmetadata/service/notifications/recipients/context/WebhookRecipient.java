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
import java.util.Map;
import java.util.Objects;
import lombok.Getter;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
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

  public WebhookRecipient(Webhook webhook) {
    this.webhook = Objects.requireNonNull(webhook, "webhook cannot be null");
  }

  /**
   * Create a webhook recipient from a user.
   *
   * @param user the user to create a recipient from
   * @param notificationType the webhook notification type
   * @return a WebhookRecipient instance, or null if webhook is not configured
   */
  public static WebhookRecipient fromUser(
      User user, SubscriptionDestination.SubscriptionType notificationType) {
    Webhook webhook = extractWebhookConfig(user.getProfile(), notificationType);
    if (webhook == null) {
      return null;
    }
    return new WebhookRecipient(webhook);
  }

  /**
   * Create a webhook recipient from a team.
   *
   * @param team the team to create a recipient from
   * @param notificationType the webhook notification type
   * @return a WebhookRecipient instance, or null if webhook is not configured
   */
  public static WebhookRecipient fromTeam(
      Team team, SubscriptionDestination.SubscriptionType notificationType) {
    Webhook webhook = extractWebhookConfig(team.getProfile(), notificationType);
    if (webhook == null) {
      return null;
    }
    return new WebhookRecipient(webhook);
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (!(o instanceof WebhookRecipient that)) {
      return false;
    }
    return Objects.equals(webhook.getEndpoint(), that.webhook.getEndpoint());
  }

  @Override
  public int hashCode() {
    return Objects.hash(webhook.getEndpoint());
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
    prepareWebhookHeaders(requestBuilder, webhook, payload);

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

  private static void prepareWebhookHeaders(
      Builder requestBuilder, Webhook webhook, String payload) {
    // Add HMAC signature if secret key is configured
    if (!CommonUtil.nullOrEmpty(webhook.getSecretKey())) {
      String hmac =
          "sha256="
              + CommonUtil.calculateHMAC(
                  SubscriptionUtil.decryptWebhookSecretKey(webhook.getSecretKey()), payload);
      requestBuilder.header("X-OM-Signature", hmac);
    }

    // Add custom headers from webhook configuration
    if (webhook.getHeaders() != null && !webhook.getHeaders().isEmpty()) {
      webhook.getHeaders().forEach(requestBuilder::header);
    }
  }

  private static Webhook extractWebhookConfig(
      Profile profile, SubscriptionDestination.SubscriptionType type) {
    if (profile == null || profile.getSubscription() == null) {
      return null;
    }

    SubscriptionConfig subscription = profile.getSubscription();
    Webhook webhook;

    switch (type) {
      case SLACK:
        webhook = subscription.getSlack();
        break;
      case MS_TEAMS:
        webhook = subscription.getMsTeams();
        break;
      case G_CHAT:
        webhook = subscription.getgChat();
        break;
      case WEBHOOK:
        webhook = subscription.getGeneric();
        break;
      default:
        return null;
    }

    if (webhook == null || webhook.getEndpoint() == null) {
      return null;
    }

    try {
      URLValidator.validateURL(webhook.getEndpoint().toString());
      return webhook;
    } catch (Exception e) {
      LOG.error("Failed to validate webhook endpoint: {}", e.getMessage());
      return null;
    }
  }
}
