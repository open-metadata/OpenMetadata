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
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.StatusContext;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.TestDestinationStatus;
import org.openmetadata.schema.entity.events.authentication.WebhookBearerAuth;
import org.openmetadata.schema.entity.events.authentication.WebhookOAuth2Config;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.notifications.recipients.RecipientResolver;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.context.WebhookRecipient;
import org.openmetadata.service.security.SecurityUtil;

@Slf4j
public class SubscriptionUtil {
  private SubscriptionUtil() {
    /* Hidden constructor */
  }

  /*
      This Method Return a list of Admin Emails or Slack/MsTeams/Generic/GChat Webhook Urls for Admin User
      DataInsightReport and EmailPublisher need a list of Emails, while others need a webhook Endpoint.
  */
  public static Set<String> getAdminsData(SubscriptionDestination.SubscriptionType type) {
    Set<String> data = new HashSet<>();
    UserRepository userEntityRepository = (UserRepository) Entity.getEntityRepository(USER);
    ResultList<User> result;
    ListFilter listFilter = new ListFilter(Include.ALL);
    listFilter.addQueryParam("isAdmin", "true");
    String after = null;
    try {
      do {
        result =
            userEntityRepository.listAfter(
                null, userEntityRepository.getFields("email,profile"), listFilter, 50, after);
        data.addAll(getEmailOrWebhookEndpointForUsers(result.getData(), type));
        after = result.getPaging().getAfter();
      } while (after != null);
    } catch (Exception ex) {
      LOG.error("Failed in listing all Users , Reason", ex);
    }
    return data;
  }

  public static Set<String> getEmailOrWebhookEndpointForUsers(
      List<User> users, SubscriptionDestination.SubscriptionType type) {
    if (type == SubscriptionDestination.SubscriptionType.EMAIL) {
      return users.stream().map(User::getEmail).collect(Collectors.toSet());
    } else {
      return users.stream()
          .map(user -> getWebhookUrlFromProfile(user.getProfile(), user.getId(), USER, type))
          .filter(Optional::isPresent)
          .map(Optional::get)
          .collect(Collectors.toSet());
    }
  }

  public static Set<String> getEmailOrWebhookEndpointForTeams(
      List<Team> users, SubscriptionDestination.SubscriptionType type) {
    if (type == SubscriptionDestination.SubscriptionType.EMAIL) {
      return users.stream().map(Team::getEmail).collect(Collectors.toSet());
    } else {
      return users.stream()
          .map(team -> getWebhookUrlFromProfile(team.getProfile(), team.getId(), TEAM, type))
          .filter(Optional::isPresent)
          .map(Optional::get)
          .collect(Collectors.toSet());
    }
  }

  /*
      This Method Return a list of Owner/Follower Emails or Slack/MsTeams/Generic/GChat Webhook Urls for Owner/Follower User
      of an Entity.
      DataInsightReport and EmailPublisher need a list of Emails, while others need a webhook Endpoint.
  */

  public static Set<String> getOwnerOrFollowers(
      SubscriptionDestination.SubscriptionType type,
      CollectionDAO daoCollection,
      UUID entityId,
      String entityType,
      Relationship relationship) {
    Set<String> data = new HashSet<>();
    try {
      List<CollectionDAO.EntityRelationshipRecord> ownerOrFollowers =
          daoCollection.relationshipDAO().findFrom(entityId, entityType, relationship.ordinal());
      // Users
      List<User> users =
          ownerOrFollowers.stream()
              .filter(e -> USER.equals(e.getType()))
              .map(user -> (User) Entity.getEntity(USER, user.getId(), "", Include.NON_DELETED))
              .toList();
      data.addAll(getEmailOrWebhookEndpointForUsers(users, type));

      // Teams
      List<Team> teams =
          ownerOrFollowers.stream()
              .filter(e -> TEAM.equals(e.getType()))
              .map(
                  team ->
                      (Team)
                          Entity.getEntity(
                              TEAM, team.getId(), "id,profile,email", Include.NON_DELETED))
              .toList();
      data.addAll(getEmailOrWebhookEndpointForTeams(teams, type));
    } catch (Exception ex) {
      LOG.error("Failed in listing all Owners/Followers, Reason : ", ex);
    }
    return data;
  }

  private static Optional<String> getWebhookUrlFromProfile(
      Profile profile, UUID id, String entityType, SubscriptionDestination.SubscriptionType type) {
    if (profile != null) {
      SubscriptionConfig subscriptionConfig = profile.getSubscription();
      if (subscriptionConfig != null) {
        Webhook webhookConfig =
            switch (type) {
              case SLACK -> profile.getSubscription().getSlack();
              case MS_TEAMS -> profile.getSubscription().getMsTeams();
              case G_CHAT -> profile.getSubscription().getgChat();
              case WEBHOOK -> profile.getSubscription().getGeneric();
              default -> null;
            };
        if (webhookConfig != null && !CommonUtil.nullOrEmpty(webhookConfig.getEndpoint())) {
          String endpointStr = webhookConfig.getEndpoint().toString();
          // Validate URL before returning
          try {
            URLValidator.validateURL(endpointStr);
            return Optional.of(endpointStr);
          } catch (Exception e) {
            LOG.warn(
                "[GetWebhookUrlsFromProfile] Invalid webhook URL for owner with id {} type {}: {}",
                id,
                entityType,
                e.getMessage());
            return Optional.empty();
          }
        } else {
          LOG.debug(
              "[GetWebhookUrlsFromProfile] Owner with id {} type {}, will not get any Notification as not webhook config is missing for type {}, webhookConfig {} ",
              id,
              entityType,
              type.value(),
              webhookConfig);
        }
      }
    }
    LOG.debug(
        "[GetWebhookUrlsFromProfile] Failed to Get Profile for Owner with ID : {} and type {} ",
        id,
        type);
    return Optional.empty();
  }

  public static Set<String> buildReceiversListFromActions(
      SubscriptionAction action,
      SubscriptionDestination.SubscriptionCategory category,
      SubscriptionDestination.SubscriptionType type,
      CollectionDAO daoCollection,
      UUID entityId,
      String entityType) {
    Set<String> receiverList = new HashSet<>();

    if (category.equals(SubscriptionDestination.SubscriptionCategory.USERS)) {
      if (action.getReceivers() == null || action.getReceivers().isEmpty()) {
        throw new IllegalArgumentException(
            "Email Alert Invoked with Illegal Type and Settings. Empty or Null Users Recipients List");
      }
      List<User> users =
          action.getReceivers().stream()
              .map(user -> (User) Entity.getEntityByName(USER, user, "", Include.NON_DELETED))
              .toList();
      receiverList.addAll(getEmailOrWebhookEndpointForUsers(users, type));
    } else if (category.equals(SubscriptionDestination.SubscriptionCategory.TEAMS)) {
      if (action.getReceivers() == null || action.getReceivers().isEmpty()) {
        throw new IllegalArgumentException(
            "Email Alert Invoked with Illegal Type and Settings. Empty or Null Teams Recipients List");
      }
      List<Team> teams =
          action.getReceivers().stream()
              .map(team -> (Team) Entity.getEntityByName(TEAM, team, "", Include.NON_DELETED))
              .toList();
      receiverList.addAll(getEmailOrWebhookEndpointForTeams(teams, type));
    } else {
      receiverList =
          action.getReceivers() == null ? receiverList : new HashSet<>(action.getReceivers());
    }

    // Send to Admins
    if (Boolean.TRUE.equals(action.getSendToAdmins())) {
      receiverList.addAll(getAdminsData(type));
    }

    // Send To Owners
    if (Boolean.TRUE.equals(action.getSendToOwners())) {
      receiverList.addAll(
          getOwnerOrFollowers(type, daoCollection, entityId, entityType, Relationship.OWNS));
    }

    // Send To Followers
    if (Boolean.TRUE.equals(action.getSendToFollowers())) {
      receiverList.addAll(
          getOwnerOrFollowers(type, daoCollection, entityId, entityType, Relationship.FOLLOWS));
    }

    return receiverList;
  }

  public static Set<String> getTargetsForAlert(
      SubscriptionAction action, SubscriptionDestination destination, ChangeEvent event) {
    SubscriptionDestination effectiveDestination = destination;
    if (effectiveDestination.getConfig() == null && action != null) {
      effectiveDestination =
          JsonUtils.convertValue(destination, SubscriptionDestination.class).withConfig(action);
    }
    return new RecipientResolver()
        .resolveRecipients(event, List.of(effectiveDestination)).stream()
            .map(SubscriptionUtil::recipientTarget)
            .collect(Collectors.toSet());
  }

  private static String recipientTarget(Recipient recipient) {
    return switch (recipient) {
      case EmailRecipient emailRecipient -> emailRecipient.getEmail();
      case WebhookRecipient webhookRecipient -> webhookRecipient
          .getWebhook()
          .getEndpoint()
          .toString();
    };
  }

  public static List<Invocation.Builder> getTargetsForWebhookAlert(
      Webhook webhook,
      SubscriptionDestination destination,
      Client client,
      ChangeEvent event,
      String outgoingMessage) {
    List<Invocation.Builder> targets = new ArrayList<>();
    for (String url : getTargetsForAlert(webhook, destination, event)) {
      targets.add(appendHeadersAndQueryParamsToTarget(client, url, webhook, outgoingMessage));
    }
    return targets;
  }

  public static Invocation.Builder appendHeadersAndQueryParamsToTarget(
      Client client, String uri, Webhook webhook, String json) {
    // Validate the URI to prevent SSRF attacks
    URLValidator.validateURL(uri);

    Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
    WebTarget target = client.target(uri);

    // Add query parameters if they exist
    if (webhook.getQueryParams() != null && !webhook.getQueryParams().isEmpty()) {
      for (Map.Entry<String, String> entry : webhook.getQueryParams().entrySet()) {
        target = target.queryParam(entry.getKey(), entry.getValue());
      }
    }

    Invocation.Builder result = SecurityUtil.addHeaders(target, authHeaders);
    // Prepare webhook headers, including HMAC signature if secret key is provided
    prepareWebhookHeaders(result, webhook, json);
    return result;
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

  public static Client getClient(int connectTimeout, int readTimeout) {
    // Cap timeouts to prevent runaway webhook destinations from exhausting resources
    // Minimum 5 seconds to allow reasonable connection establishment
    // Maximum 30 seconds for connect, 120 seconds for read to prevent indefinite waits
    int effectiveConnectTimeout = Math.min(Math.max(connectTimeout, 5), 30);
    int effectiveReadTimeout = Math.min(Math.max(readTimeout, 10), 120);

    if (connectTimeout != effectiveConnectTimeout) {
      LOG.debug(
          "Connect timeout {} clamped to {} (valid range: 5-30 seconds)",
          connectTimeout,
          effectiveConnectTimeout);
    }
    if (readTimeout != effectiveReadTimeout) {
      LOG.debug(
          "Read timeout {} clamped to {} (valid range: 10-120 seconds)",
          readTimeout,
          effectiveReadTimeout);
    }

    ClientBuilder clientBuilder = ClientBuilder.newBuilder();
    clientBuilder.connectTimeout(effectiveConnectTimeout, TimeUnit.SECONDS);
    clientBuilder.readTimeout(effectiveReadTimeout, TimeUnit.SECONDS);
    return clientBuilder.build();
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
