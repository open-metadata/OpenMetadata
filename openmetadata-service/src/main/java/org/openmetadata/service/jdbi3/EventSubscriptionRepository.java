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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.api.events.CreateEventSubscription.SubscriptionType.ACTIVITY_FEED;

import com.lmax.disruptor.BatchEventProcessor;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.EventPubSub;
import org.openmetadata.service.events.scheduled.ReportsHandler;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.SubscriptionPublisher;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.quartz.SchedulerException;

@Slf4j
public class EventSubscriptionRepository extends EntityRepository<EventSubscription> {
  private static final String INVALID_ALERT = "Invalid Alert Type";
  private static final ConcurrentHashMap<UUID, SubscriptionPublisher> subscriptionPublisherMap =
      new ConcurrentHashMap<>();
  static final String ALERT_PATCH_FIELDS = "trigger,enabled,batchSize,timeout";
  static final String ALERT_UPDATE_FIELDS = "trigger,enabled,batchSize,timeout,filteringRules";

  public EventSubscriptionRepository() {
    super(
        EventSubscriptionResource.COLLECTION_PATH,
        Entity.EVENT_SUBSCRIPTION,
        EventSubscription.class,
        Entity.getCollectionDAO().eventSubscriptionDAO(),
        ALERT_PATCH_FIELDS,
        ALERT_UPDATE_FIELDS);
  }

  @Override
  public EventSubscription setFields(EventSubscription entity, Fields fields) {
    if (entity.getStatusDetails() == null) {
      entity.withStatusDetails(fields.contains("statusDetails") ? getStatusForEventSubscription(entity.getId()) : null);
    }
    return entity;
  }

  @Override
  public EventSubscription clearFields(EventSubscription entity, Fields fields) {
    return entity.withStatusDetails(fields.contains("statusDetails") ? entity.getStatusDetails() : null);
  }

  @Override
  public void prepare(EventSubscription entity, boolean update) {
    validateFilterRules(entity);
  }

  private void validateFilterRules(EventSubscription entity) {
    // Resolve JSON blobs into Rule object and perform schema based validation
    if (entity.getFilteringRules() != null) {
      List<EventFilterRule> rules = entity.getFilteringRules().getRules();
      // Validate all the expressions in the rule
      for (EventFilterRule rule : rules) {
        AlertUtil.validateExpression(rule.getCondition(), Boolean.class);
      }
      rules.sort(Comparator.comparing(EventFilterRule::getName));
    }
  }

  @Override
  public void storeEntity(EventSubscription entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(EventSubscription entity) {
    // No relationships to store beyond what is stored in the super class
  }

  private SubscriptionPublisher getPublisher(UUID id) {
    return subscriptionPublisherMap.get(id);
  }

  @Transaction
  public void addSubscriptionPublisher(EventSubscription eventSubscription) {
    switch (eventSubscription.getAlertType()) {
      case CHANGE_EVENT:
        SubscriptionPublisher publisher = AlertUtil.getNotificationsPublisher(eventSubscription, daoCollection);
        if (Boolean.FALSE.equals(
            eventSubscription.getEnabled())) { // Only add webhook that is enabled for publishing events
          eventSubscription.setStatusDetails(getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status.DISABLED));
        } else {
          eventSubscription.setStatusDetails(getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status.ACTIVE));
          BatchEventProcessor<EventPubSub.ChangeEventHolder> processor = EventPubSub.addEventHandler(publisher);
          publisher.setProcessor(processor);
        }
        subscriptionPublisherMap.put(eventSubscription.getId(), publisher);
        LOG.info(
            "Webhook publisher subscription started as {} : status {}",
            eventSubscription.getName(),
            eventSubscription.getStatusDetails().getStatus());
        break;
      case DATA_INSIGHT_REPORT:
        if (Boolean.TRUE.equals(eventSubscription.getEnabled())) {
          ReportsHandler.getInstance().addDataReportConfig(eventSubscription);
        }
        break;
      default:
        throw new IllegalArgumentException(INVALID_ALERT);
    }
  }

  private SubscriptionStatus getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status status) {
    return new SubscriptionStatus().withStatus(status).withTimestamp(System.currentTimeMillis());
  }

  @Transaction
  @SneakyThrows
  public void updateEventSubscription(EventSubscription eventSubscription) {
    switch (eventSubscription.getAlertType()) {
      case CHANGE_EVENT:
        if (Boolean.TRUE.equals(eventSubscription.getEnabled())) { // Only add webhook that is enabled for publishing
          // If there was a previous webhook either in disabled state or stopped due
          // to errors, update it and restart publishing
          SubscriptionPublisher previousPublisher = getPublisher(eventSubscription.getId());
          if (previousPublisher == null) {
            if (!ACTIVITY_FEED.equals(eventSubscription.getSubscriptionType())) {
              addSubscriptionPublisher(eventSubscription);
            }
            return;
          }

          // Update the existing publisher
          deleteEventSubscriptionPublisher(eventSubscription);
          addSubscriptionPublisher(eventSubscription);
        } else {
          // Remove the webhook publisher
          removeProcessorForEventSubscription(
              eventSubscription.getId(), getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status.DISABLED));
        }
        break;
      case DATA_INSIGHT_REPORT:
        ReportsHandler.getInstance().updateDataReportConfig(eventSubscription);
        break;
      default:
        throw new IllegalArgumentException(INVALID_ALERT);
    }
  }

  @Transaction
  public void removeProcessorForEventSubscription(UUID id, SubscriptionStatus reasonForRemoval)
      throws InterruptedException {
    SubscriptionPublisher publisher = subscriptionPublisherMap.get(id);
    if (publisher != null) {
      publisher.getProcessor().halt();
      publisher.awaitShutdown();
      EventPubSub.removeProcessor(publisher.getProcessor());
      publisher.getEventSubscription().setStatusDetails(reasonForRemoval);
      LOG.info("Webhook publisher deleted for {}", publisher.getEventSubscription().getName());
    }
  }

  @Transaction
  public void deleteEventSubscriptionPublisher(EventSubscription deletedEntity)
      throws InterruptedException, SchedulerException {
    switch (deletedEntity.getAlertType()) {
      case CHANGE_EVENT:
        SubscriptionPublisher publisher = subscriptionPublisherMap.remove(deletedEntity.getId());
        if (publisher != null && publisher.getProcessor() != null) {
          publisher.getProcessor().halt();
          publisher.awaitShutdown();
          EventPubSub.removeProcessor(publisher.getProcessor());
          LOG.info("Webhook publisher deleted for {}", publisher.getEventSubscription().getName());
        }
        break;
      case DATA_INSIGHT_REPORT:
        ReportsHandler.getInstance().deleteDataReportConfig(deletedEntity);
        break;
      default:
        throw new IllegalArgumentException(INVALID_ALERT);
    }
  }

  public SubscriptionStatus getStatusForEventSubscription(UUID id) {
    SubscriptionPublisher publisher = subscriptionPublisherMap.get(id);
    if (publisher != null) {
      return publisher.getEventSubscription().getStatusDetails();
    }
    return null;
  }

  @Override
  public EventSubscriptionUpdater getUpdater(
      EventSubscription original, EventSubscription updated, Operation operation) {
    return new EventSubscriptionUpdater(original, updated, operation);
  }

  public class EventSubscriptionUpdater extends EntityUpdater {
    public EventSubscriptionUpdater(EventSubscription original, EventSubscription updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() {
      recordChange("enabled", original.getEnabled(), updated.getEnabled());
      recordChange("batchSize", original.getBatchSize(), updated.getBatchSize());
      recordChange("timeout", original.getTimeout(), updated.getTimeout());
      recordChange("filteringRules", original.getFilteringRules(), updated.getFilteringRules());
      recordChange("subscriptionType", original.getSubscriptionType(), updated.getSubscriptionType());
      recordChange("subscriptionConfig", original.getSubscriptionConfig(), updated.getSubscriptionConfig());
      recordChange("trigger", original.getTrigger(), updated.getTrigger());
    }
  }
}
