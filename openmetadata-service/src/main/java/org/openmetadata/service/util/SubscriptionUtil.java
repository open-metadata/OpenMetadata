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

package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.USER;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.events.StatusContext;
import org.openmetadata.schema.entity.events.TestDestinationStatus;
import org.openmetadata.schema.entity.events.authentication.WebhookBearerAuth;
import org.openmetadata.schema.entity.events.authentication.WebhookOAuth2Config;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.SecurityUtil;

@Slf4j
public class SubscriptionUtil {
  private SubscriptionUtil() {
    /* Hidden constructor */
  }

  /** The email of every admin user. */
  public static Set<String> getAdminEmails() {
    Set<String> emails = new HashSet<>();
    UserRepository users = (UserRepository) Entity.getEntityRepository(USER);
    ListFilter admins = new ListFilter(Include.ALL);
    admins.addQueryParam("isAdmin", "true");
    String after = null;
    try {
      do {
        ResultList<User> page = users.listAfter(null, users.getFields("email"), admins, 50, after);
        page.getData().stream().map(User::getEmail).forEach(emails::add);
        after = page.getPaging().getAfter();
      } while (after != null);
    } catch (Exception ex) {
      LOG.error("Failed in listing all Users , Reason", ex);
    }
    return emails;
  }

  public static void prepareWebhookHeaders(
      Invocation.Builder target, Webhook webhook, String json) {
    boolean oauth2Active = false;

    if (webhook.getAuthType() instanceof Map<?, ?> authMap) {
      String authType = (String) authMap.get("type");

      if (WebhookBearerAuth.Type.BEARER.value().equals(authType)) {
        WebhookBearerAuth bearerAuth =
            JsonUtils.convertValue(webhook.getAuthType(), WebhookBearerAuth.class);
        if (bearerAuth != null && !nullOrEmpty(bearerAuth.getSecretKey())) {
          String hmac =
              "sha256="
                  + CommonUtil.calculateHMAC(
                      decryptWebhookSecretKey(bearerAuth.getSecretKey()), json);
          target.header("X-OM-Signature", hmac);
        }
      } else if (WebhookOAuth2Config.Type.OAUTH_2.value().equals(authType)) {
        WebhookOAuth2Config oauth2Config =
            JsonUtils.convertValue(webhook.getAuthType(), WebhookOAuth2Config.class);
        if (oauth2Config != null) {
          String accessToken = OAuth2TokenManager.getInstance().getAccessToken(oauth2Config);
          target.header("Authorization", "Bearer " + accessToken);
          oauth2Active = true;
        }
      }
    }

    if (webhook.getHeaders() != null && !webhook.getHeaders().isEmpty()) {
      for (Map.Entry<String, String> entry : webhook.getHeaders().entrySet()) {
        if (oauth2Active && "Authorization".equalsIgnoreCase(entry.getKey())) {
          continue;
        }
        target.header(entry.getKey(), entry.getValue());
      }
    }
  }

  public static String decryptWebhookSecretKey(String encryptedSecretkey) {
    if (Fernet.getInstance().isKeyDefined()) {
      encryptedSecretkey = Fernet.getInstance().decryptIfApplies(encryptedSecretkey);
    }
    return encryptedSecretkey;
  }

  public static void postWebhookMessage(
      Destination<ChangeEvent> destination, Invocation.Builder target, Object message)
      throws EventPublisherException {
    postWebhookMessage(destination, target, message, Webhook.HttpMethod.POST);
  }

  public static void postWebhookMessage(
      Destination<ChangeEvent> destination,
      Invocation.Builder target,
      Object message,
      Webhook.HttpMethod httpMethod)
      throws EventPublisherException {
    long attemptTime = System.currentTimeMillis();
    Response response =
        (httpMethod == Webhook.HttpMethod.PUT)
            ? target.put(
                jakarta.ws.rs.client.Entity.entity(message, MediaType.APPLICATION_JSON_TYPE))
            : target.post(
                jakarta.ws.rs.client.Entity.entity(message, MediaType.APPLICATION_JSON_TYPE));

    LOG.debug(
        "Subscription Destination HTTP Operation {}:{} received response {}",
        httpMethod,
        destination.getSubscriptionDestination().getId(),
        response.getStatusInfo());

    StatusContext statusContext = createStatusContext(response);
    handleStatus(destination, attemptTime, statusContext);

    // Throw exception for non-2xx responses to ensure proper error handling
    int statusCode = statusContext.getStatusCode();
    if (statusCode < 200 || statusCode >= 300) {
      String errorMessage =
          String.format(
              "Webhook delivery failed with HTTP %d: %s",
              statusCode, statusContext.getStatusInfo());
      throw new EventPublisherException(errorMessage);
    }
  }

  public static void deliverTestWebhookMessage(
      Destination<ChangeEvent> destination, Invocation.Builder target, Object message) {
    deliverTestWebhookMessage(destination, target, message, Webhook.HttpMethod.POST);
  }

  public static void deliverTestWebhookMessage(
      Destination<ChangeEvent> destination,
      Invocation.Builder target,
      Object message,
      Webhook.HttpMethod httpMethod) {
    Response response =
        (httpMethod == Webhook.HttpMethod.PUT)
            ? target.put(
                jakarta.ws.rs.client.Entity.entity(message, MediaType.APPLICATION_JSON_TYPE))
            : target.post(
                jakarta.ws.rs.client.Entity.entity(message, MediaType.APPLICATION_JSON_TYPE));

    StatusContext statusContext = createStatusContext(response);
    handleTestDestinationStatus(destination, statusContext);
  }

  private static void handleTestDestinationStatus(
      Destination<ChangeEvent> destination, StatusContext statusContext) {
    int statusCode = statusContext.getStatusCode();
    TestDestinationStatus.Status testStatus =
        (statusCode >= 200 && statusCode < 300)
            ? TestDestinationStatus.Status.SUCCESS
            : TestDestinationStatus.Status.FAILED;

    destination.setStatusForTestDestination(testStatus, statusContext);
  }

  private static void handleStatus(
      Destination<ChangeEvent> destination, long attemptTime, StatusContext statusContext) {
    int statusCode = statusContext.getStatusCode();
    String statusInfo = statusContext.getStatusInfo();

    if (statusCode >= 200 && statusCode < 300) {
      // 2xx response codes are considered successful
      destination.setSuccessStatus(System.currentTimeMillis());
    } else if (statusCode >= 300 && statusCode < 400) {
      // 3xx response/redirection is not allowed for callback. Set the webhook state as in error
      destination.setErrorStatus(attemptTime, statusCode, statusInfo);
    } else {
      // 4xx, 5xx response retry delivering events after timeout
      destination.setAwaitingRetry(attemptTime, statusCode, statusInfo);
    }
  }

  private static StatusContext createStatusContext(Response response) {
    return new StatusContext()
        .withStatusCode(response.getStatus())
        .withStatusInfo(response.getStatusInfo().getReasonPhrase())
        .withHeaders(response.getStringHeaders())
        .withEntity(response.hasEntity() ? response.readEntity(String.class) : StringUtils.EMPTY)
        .withMediaType(
            response.getMediaType() != null
                ? response.getMediaType().toString()
                : StringUtils.EMPTY)
        .withLocation(
            response.getLocation() != null ? response.getLocation().toString() : StringUtils.EMPTY)
        .withTimestamp(System.currentTimeMillis());
  }

  public static Invocation.Builder getTarget(Client client, Webhook webhook, String json) {
    Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
    WebTarget target = client.target(webhook.getEndpoint());
    target = addQueryParams(target, webhook.getQueryParams());
    Invocation.Builder result = SecurityUtil.addHeaders(target, authHeaders);
    prepareWebhookHeaders(result, webhook, json);
    return result;
  }

  public static WebTarget addQueryParams(WebTarget target, Map<String, String> queryParams) {
    if (!CommonUtil.nullOrEmpty(queryParams)) {
      for (Map.Entry<String, String> entry : queryParams.entrySet()) {
        target = target.queryParam(entry.getKey(), entry.getValue());
      }
    }
    return target;
  }
}
