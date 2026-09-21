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

import java.util.Map;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.authentication.WebhookBearerAuth;
import org.openmetadata.schema.entity.events.authentication.WebhookOAuth2Config;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;

/** A webhook whose authentication carries secrets, which are stored encrypted. */
final class SecretWebhookConfigRules extends WebhookConfigRules {
  private static final String AUTH_TYPE = "authType";

  @Override
  public void encryptSecrets(SubscriptionDestination destination) {
    Webhook webhook = JsonUtils.convertValue(destination.getConfig(), Webhook.class);
    if (webhook != null && webhook.getAuthType() instanceof Map<?, ?> authMap) {
      Object type = authMap.get("type");
      if (WebhookBearerAuth.Type.BEARER.value().equals(type)) {
        store(destination, encryptedBearer(webhook));
      } else if (WebhookOAuth2Config.Type.OAUTH_2.value().equals(type)) {
        store(destination, encryptedOAuth2(webhook));
      }
    }
  }

  private static Object encryptedBearer(Webhook webhook) {
    WebhookBearerAuth bearer =
        JsonUtils.convertValue(webhook.getAuthType(), WebhookBearerAuth.class);
    boolean hasSecret = bearer != null && !nullOrEmpty(bearer.getSecretKey());
    return hasSecret ? bearer.withSecretKey(encrypted(bearer.getSecretKey())) : null;
  }

  private static Object encryptedOAuth2(Webhook webhook) {
    WebhookOAuth2Config oauth2 =
        JsonUtils.convertValue(webhook.getAuthType(), WebhookOAuth2Config.class);
    if (oauth2 != null && !nullOrEmpty(oauth2.getClientId())) {
      oauth2.withClientId(encrypted(oauth2.getClientId()));
    }
    if (oauth2 != null && !nullOrEmpty(oauth2.getClientSecret())) {
      oauth2.withClientSecret(encrypted(oauth2.getClientSecret()));
    }
    return oauth2;
  }

  @SuppressWarnings("unchecked")
  private static void store(SubscriptionDestination destination, Object authentication) {
    Map<String, Object> config = (Map<String, Object>) destination.getConfig();
    if (authentication != null && config != null) {
      config.put(AUTH_TYPE, JsonUtils.convertValue(authentication, Map.class));
      destination.withConfig(config);
    }
  }

  private static String encrypted(String value) {
    return Fernet.getInstance().encryptIfApplies(value);
  }
}
