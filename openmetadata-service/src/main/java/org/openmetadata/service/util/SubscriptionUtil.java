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

import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.events.subscription.AlertsRuleEvaluator.getEntity;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.TriggerConfig;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.quartz.CronScheduleBuilder;

@Slf4j
public class SubscriptionUtil {
  private SubscriptionUtil() {
    /* Hidden constructor */
  }

  /*
      This Method Return a list of Admin Emails or Slack/MsTeams/Generic/GChat Webhook Urls for Admin User
      DataInsightReport and EmailPublisher need a list of Emails, while others need a webhook Endpoint.
  */
  public static Set<String> getAdminsData(CreateEventSubscription.SubscriptionType type) {
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
        result
            .getData()
            .forEach(
                user -> {
                  if (type == CreateEventSubscription.SubscriptionType.EMAIL
                      || type == CreateEventSubscription.SubscriptionType.DATA_INSIGHT) {
                    data.add(user.getEmail());
                  } else {
                    Profile userProfile = user.getProfile();
                    data.addAll(getWebhookUrlsFromProfile(userProfile, user.getId(), USER, type));
                  }
                });
        after = result.getPaging().getAfter();
      } while (after != null);
    } catch (Exception ex) {
      LOG.error("Failed in listing all Users , Reason", ex);
    }
    return data;
  }

  /*
      This Method Return a list of Owner/Follower Emails or Slack/MsTeams/Generic/GChat Webhook Urls for Owner/Follower User
      of an Entity.
      DataInsightReport and EmailPublisher need a list of Emails, while others need a webhook Endpoint.
  */

  public static Set<String> getOwnerOrFollowers(
      CreateEventSubscription.SubscriptionType type,
      CollectionDAO daoCollection,
      UUID entityId,
      String entityType,
      Relationship relationship) {
    Set<String> data = new HashSet<>();
    try {
      List<CollectionDAO.EntityRelationshipRecord> ownerOrFollowers =
          daoCollection.relationshipDAO().findFrom(entityId, entityType, relationship.ordinal());
      ownerOrFollowers.forEach(
          owner -> {
            if (type == CreateEventSubscription.SubscriptionType.EMAIL
                || type == CreateEventSubscription.SubscriptionType.DATA_INSIGHT) {
              if (USER.equals(owner.getType())) {
                User user = Entity.getEntity(USER, owner.getId(), "", Include.NON_DELETED);
                data.add(user.getEmail());
              } else {
                Team team = Entity.getEntity(TEAM, owner.getId(), "", Include.NON_DELETED);
                data.add(team.getEmail());
              }
            } else {
              Profile profile = null;
              if (USER.equals(owner.getType())) {
                User user = Entity.getEntity(USER, owner.getId(), "", Include.NON_DELETED);
                profile = user.getProfile();
              } else if (TEAM.equals(owner.getType())) {
                Team team = Entity.getEntity(Entity.TEAM, owner.getId(), "", Include.NON_DELETED);
                profile = team.getProfile();
              }
              data.addAll(getWebhookUrlsFromProfile(profile, owner.getId(), owner.getType(), type));
            }
          });
    } catch (Exception ex) {
      LOG.error("Failed in listing all Owners/Followers, Reason : ", ex);
    }
    return data;
  }

  private static Set<String> getWebhookUrlsFromProfile(
      Profile profile, UUID id, String entityType, CreateEventSubscription.SubscriptionType type) {
    Set<String> webhookUrls = new HashSet<>();
    if (profile != null) {
      Webhook webhookConfig =
          switch (type) {
            case SLACK_WEBHOOK -> profile.getSubscription().getSlack();
            case MS_TEAMS_WEBHOOK -> profile.getSubscription().getMsTeams();
            case G_CHAT_WEBHOOK -> profile.getSubscription().getgChat();
            case GENERIC_WEBHOOK -> profile.getSubscription().getGeneric();
            default -> null;
          };
      if (webhookConfig != null && !CommonUtil.nullOrEmpty(webhookConfig.getEndpoint())) {
        webhookUrls.add(webhookConfig.getEndpoint().toString());
      } else {
        LOG.debug(
            "[GetWebhookUrlsFromProfile] Owner with id {} type {}, will not get any Notification as not webhook config is invalid for type {}, webhookConfig {} ",
            id,
            entityType,
            type.value(),
            webhookConfig);
      }
    } else {
      LOG.debug(
          "[GetWebhookUrlsFromProfile] Failed to Get Profile for Owner with ID : {} and type {} ",
          id,
          type);
    }
    return webhookUrls;
  }

  public static Set<String> buildReceiversListFromActions(
      SubscriptionAction action,
      CreateEventSubscription.SubscriptionType type,
      CollectionDAO daoCollection,
      UUID entityId,
      String entityType) {
    Set<String> receiverList = new HashSet<>();
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

  public static List<Invocation.Builder> getTargetsForWebhook(
      SubscriptionAction action,
      CreateEventSubscription.SubscriptionType type,
      Client client,
      ChangeEvent event) {
    EntityInterface entityInterface = getEntity(event);
    List<Invocation.Builder> targets = new ArrayList<>();
    Set<String> receiversUrls =
        buildReceiversListFromActions(
            action,
            type,
            Entity.getCollectionDAO(),
            entityInterface.getId(),
            event.getEntityType());
    for (String url : receiversUrls) {
      targets.add(client.target(url).request());
    }
    return targets;
  }

  public static void postWebhookMessage(
      AbstractEventConsumer publisher, Invocation.Builder target, Object message) {
    long attemptTime = System.currentTimeMillis();
    Response response =
        target.post(javax.ws.rs.client.Entity.entity(message, MediaType.APPLICATION_JSON_TYPE));
    LOG.debug(
        "Subscription Publisher Posted Message {}:{} received response {}",
        publisher.getEventSubscription().getName(),
        publisher.getEventSubscription().getBatchSize(),
        response.getStatusInfo());
    if (response.getStatus() >= 300 && response.getStatus() < 400) {
      // 3xx response/redirection is not allowed for callback. Set the webhook state as in error
      publisher.setErrorStatus(
          attemptTime, response.getStatus(), response.getStatusInfo().getReasonPhrase());
    } else if (response.getStatus() >= 400 && response.getStatus() < 600) {
      // 4xx, 5xx response retry delivering events after timeout
      publisher.setAwaitingRetry(
          attemptTime, response.getStatus(), response.getStatusInfo().getReasonPhrase());
    } else if (response.getStatus() == 200) {
      publisher.setSuccessStatus(System.currentTimeMillis());
    }
  }

  public static Client getClient(int connectTimeout, int readTimeout) {
    ClientBuilder clientBuilder = ClientBuilder.newBuilder();
    clientBuilder.connectTimeout(connectTimeout, TimeUnit.SECONDS);
    clientBuilder.readTimeout(readTimeout, TimeUnit.SECONDS);
    return clientBuilder.build();
  }

  public static CronScheduleBuilder getCronSchedule(TriggerConfig trigger) {
    if (trigger.getTriggerType() == TriggerConfig.TriggerType.SCHEDULED) {
      TriggerConfig.ScheduleInfo scheduleInfo = trigger.getScheduleInfo();
      switch (scheduleInfo) {
        case DAILY:
          return CronScheduleBuilder.dailyAtHourAndMinute(0, 0);
        case WEEKLY:
          return CronScheduleBuilder.weeklyOnDayAndHourAndMinute(7, 0, 0);
        case MONTHLY:
          return CronScheduleBuilder.monthlyOnDayAndHourAndMinute(1, 0, 0);
        case CUSTOM:
          if (!CommonUtil.nullOrEmpty(trigger.getCronExpression())) {
            return CronScheduleBuilder.cronSchedule(trigger.getCronExpression());
          } else {
            throw new IllegalArgumentException("Missing Cron Expression for Custom Schedule.");
          }
      }
    }
    throw new IllegalArgumentException("Invalid Trigger Type, Can only be Scheduled.");
  }
}
