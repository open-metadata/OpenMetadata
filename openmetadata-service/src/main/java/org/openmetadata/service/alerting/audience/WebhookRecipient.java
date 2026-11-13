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

package org.openmetadata.service.alerting.audience;

import java.net.URI;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
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
  /** Null only for a saved webhook that cannot be used, which is never sent to. */
  private final Webhook webhook;

  @Getter(AccessLevel.NONE)
  private final Object owner;

  @Getter(AccessLevel.NONE)
  private final String whyUnusable;

  private record Identity(URI endpoint, Map<String, String> queryParams) {}

  public WebhookRecipient(Webhook webhook) {
    this(webhook, CONFIGURED);
  }

  public WebhookRecipient(Webhook webhook, String name) {
    this(name, Objects.requireNonNull(webhook, "webhook cannot be null"), null, null);
  }

  private WebhookRecipient(String name, Webhook webhook, Object owner, String whyUnusable) {
    super(name);
    this.webhook = webhook;
    this.owner = owner;
    this.whyUnusable = whyUnusable;
  }

  /**
   * The webhook a user or a team saved, whose stored value cannot be used to send. It stays a
   * recipient, so the send to it fails with the reason and the alert reports it; nothing is sent.
   */
  public static WebhookRecipient unusable(String name, Object owner, String reason) {
    return new WebhookRecipient(name, null, Objects.requireNonNull(owner), reason);
  }

  /**
   * The endpoint as written, with the query parameters its configuration adds, which some
   * endpoints route by. Nothing else is normalised, so no two endpoints that get separate
   * messages today become one. A webhook that cannot be used is its owner's.
   */
  @Override
  public Object identity() {
    return webhook == null ? owner : endpointOf(webhook);
  }

  private static Identity endpointOf(Webhook webhook) {
    Map<String, String> queryParams =
        CommonUtil.nullOrEmpty(webhook.getQueryParams()) ? Map.of() : webhook.getQueryParams();
    return new Identity(webhook.getEndpoint(), Map.copyOf(queryParams));
  }

  @Override
  public Optional<String> unusableBecause() {
    return Optional.ofNullable(whyUnusable);
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
