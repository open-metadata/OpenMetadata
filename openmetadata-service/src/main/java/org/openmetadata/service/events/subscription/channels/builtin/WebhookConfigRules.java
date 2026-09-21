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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.Map;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.authentication.WebhookOAuth2Config;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.subscription.channels.ConfigRules;
import org.openmetadata.service.util.URLValidator;

/** The rules of every channel that posts to an HTTP endpoint. */
class WebhookConfigRules implements ConfigRules {
  @Override
  public void validate(SubscriptionDestination destination) {
    Webhook webhook = read(destination.getConfig());
    if (webhook.getEndpoint() == null) {
      throw new BadRequestException("Webhook destination requires an 'endpoint' URL");
    }
    String endpoint = webhook.getEndpoint().toString();
    if (endpoint.trim().isEmpty()) {
      throw new BadRequestException("Webhook endpoint URL cannot be empty");
    }
    requireAllowedUrl(endpoint, "Invalid webhook endpoint URL: %s");
    if (usesOAuth2(webhook)) {
      validateOAuth2(webhook);
    }
  }

  @Override
  public SubscriptionAction receiversOf(SubscriptionDestination destination) {
    return JsonUtils.convertValue(destination.getConfig(), Webhook.class);
  }

  private static Webhook read(Object config) {
    try {
      return JsonUtils.convertValue(config, Webhook.class);
    } catch (Exception e) {
      throw new BadRequestException("Invalid webhook configuration: " + e.getMessage());
    }
  }

  private static boolean usesOAuth2(Webhook webhook) {
    return webhook.getAuthType() instanceof Map<?, ?> authMap
        && WebhookOAuth2Config.Type.OAUTH_2.value().equals(authMap.get("type"));
  }

  private static void validateOAuth2(Webhook webhook) {
    WebhookOAuth2Config oauth2 =
        JsonUtils.convertValue(webhook.getAuthType(), WebhookOAuth2Config.class);
    boolean complete =
        oauth2 != null
            && oauth2.getTokenUrl() != null
            && !nullOrEmpty(oauth2.getTokenUrl().toString())
            && !nullOrEmpty(oauth2.getClientId())
            && !nullOrEmpty(oauth2.getClientSecret());
    if (!complete) {
      throw new BadRequestException(
          "OAuth2 configuration requires tokenUrl, clientId, and clientSecret");
    }
    requireAllowedUrl(oauth2.getTokenUrl().toString(), "Invalid OAuth2 token URL: %s");
  }

  private static void requireAllowedUrl(String url, String message) {
    try {
      URLValidator.validateURL(url);
    } catch (Exception e) {
      throw new BadRequestException(String.format(message, e.getMessage()));
    }
  }
}
