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

import com.lmax.disruptor.BatchEventProcessor;
import java.io.IOException;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.EventPubSub;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.SubscriptionPublisher;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class EventSubscriptionRepository extends EntityRepository<EventSubscription> {
  private static final ConcurrentHashMap<UUID, SubscriptionPublisher> subscriptionPublisherMap =
      new ConcurrentHashMap<>();
  static final String ALERT_PATCH_FIELDS = "owner,enabled,batchSize,timeout";
  static final String ALERT_UPDATE_FIELDS =
      "owner,enabled,batchSize,timeout,filteringRules,subscriptionType,subscriptionConfig";

  public EventSubscriptionRepository(CollectionDAO dao) {
    super(
        EventSubscriptionResource.COLLECTION_PATH,
        Entity.EVENT_SUBSCRIPTION,
        EventSubscription.class,
        dao.eventSubscriptionDAO(),
        dao,
        ALERT_PATCH_FIELDS,
        ALERT_UPDATE_FIELDS);
  }

  @Override
  public EventSubscription setFields(EventSubscription entity, Fields fields) {
    entity.setStatusDetails(fields.contains("statusDetails") ? getStatusForEventSubscription(entity.getId()) : null);
    return entity; // No fields to set
  }

  @Override
  public void prepare(EventSubscription entity) {
    //    validateAlertActions(entity.getAlertActions());
    validateFilterRules(entity);
  }

  private void validateFilterRules(EventSubscription entity) {
    // Resolve JSON blobs into Rule object and perform schema based validation
    List<EventFilterRule> rules = entity.getFilteringRules().getRules();
    // Validate all the expressions in the rule
    for (EventFilterRule rule : rules) {
      AlertUtil.validateExpression(rule.getCondition(), Boolean.class);
    }
    rules.sort(Comparator.comparing(EventFilterRule::getName));
  }

  @Override
  public void storeEntity(EventSubscription entity, boolean update) throws IOException {
    store(entity, update);
  }

  @Override
  public void storeRelationships(EventSubscription entity) {
    storeOwner(entity, entity.getOwner());
  }

  @Override
  public void restorePatchAttributes(EventSubscription original, EventSubscription updated) {
    updated.withId(original.getId()).withName(original.getName());
  }

  private SubscriptionPublisher getPublisher(UUID id) {
    return subscriptionPublisherMap.get(id);
  }

  public void addSubscriptionPublisher(EventSubscription eventSubscription) {
    SubscriptionPublisher publisher = AlertUtil.getAlertPublisher(eventSubscription, daoCollection);
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
  }

  private SubscriptionStatus getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status status) {
    return new SubscriptionStatus().withStatus(status).withTimestamp(System.currentTimeMillis());
  }

  @SneakyThrows
  public void updateWebhookPublisher(EventSubscription eventSubscription) {
    if (Boolean.TRUE.equals(eventSubscription.getEnabled())) { // Only add webhook that is enabled for publishing
      // If there was a previous webhook either in disabled state or stopped due
      // to errors, update it and restart publishing
      SubscriptionPublisher previousPublisher = getPublisher(eventSubscription.getId());
      if (previousPublisher == null) {
        addSubscriptionPublisher(eventSubscription);
        return;
      }

      // Update the existing publisher
      SubscriptionStatus.Status status = previousPublisher.getEventSubscription().getStatusDetails().getStatus();
      previousPublisher.updateEventSubscription(eventSubscription);
      if (status != SubscriptionStatus.Status.ACTIVE && status != SubscriptionStatus.Status.AWAITING_RETRY) {
        // Restart the previously stopped publisher (in states notStarted, error, retryLimitReached)
        BatchEventProcessor<EventPubSub.ChangeEventHolder> processor = EventPubSub.addEventHandler(previousPublisher);
        previousPublisher.setProcessor(processor);
        LOG.info("Webhook publisher restarted for {}", eventSubscription.getName());
      }
    } else {
      // Remove the webhook publisher
      removeProcessorForEventSubscription(
          eventSubscription.getId(), getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status.DISABLED));
    }
  }

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

  public void deleteEventSubscriptionPublisher(UUID id) throws InterruptedException {
    SubscriptionPublisher publisher = subscriptionPublisherMap.remove(id);
    if (publisher != null) {
      publisher.getProcessor().halt();
      publisher.awaitShutdown();
      EventPubSub.removeProcessor(publisher.getProcessor());
      LOG.info("Webhook publisher deleted for {}", publisher.getEventSubscription().getName());
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
    public void entitySpecificUpdate() throws IOException {
      recordChange("enabled", original.getEnabled(), updated.getEnabled());
      recordChange("batchSize", original.getBatchSize(), updated.getBatchSize());
      recordChange("timeout", original.getTimeout(), updated.getTimeout());
      recordChange("filteringRules", original.getFilteringRules(), updated.getFilteringRules());
      recordChange("subscriptionType", original.getSubscriptionType(), updated.getSubscriptionType());
      recordChange("subscriptionConfig", original.getSubscriptionConfig(), updated.getSubscriptionConfig());
    }
  }
}
