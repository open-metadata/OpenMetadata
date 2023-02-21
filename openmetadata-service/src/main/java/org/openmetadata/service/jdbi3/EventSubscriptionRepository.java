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
import org.openmetadata.schema.type.EntityReference;
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
  static final String ALERT_PATCH_FIELDS = "owner,filteringRules";
  static final String ALERT_UPDATE_FIELDS = "owner,filteringRules";

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
  public EventSubscription setFields(EventSubscription entity, Fields fields) throws IOException {
    return entity; // No fields to set
  }

  @Override
  public void prepare(EventSubscription entity) throws IOException {
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
    EntityReference owner = entity.getOwner();
    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    entity.withOwner(null).withHref(null);
    store(entity, update);

    // Restore the relationships
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(EventSubscription entity) {
    // store owner
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
    if (Boolean.FALSE.equals(
        eventSubscription.getEnabled())) { // Only add webhook that is enabled for publishing events
      SubscriptionStatus details =
          new SubscriptionStatus()
              .withStatus(SubscriptionStatus.Status.DISABLED)
              .withTimestamp(System.currentTimeMillis());
      eventSubscription.setStatusDetails(details);
      return;
    }

    SubscriptionPublisher publisher = AlertUtil.getAlertPublisher(eventSubscription, daoCollection);
    BatchEventProcessor<EventPubSub.ChangeEventHolder> processor = EventPubSub.addEventHandler(publisher);
    publisher.setProcessor(processor);
    subscriptionPublisherMap.put(eventSubscription.getId(), publisher);
    LOG.info("Webhook publisher subscription started for {}", eventSubscription.getName());
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
      deleteEventSubscriptionPublisher(eventSubscription.getId());
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
    throw new RuntimeException("Publisher for Given Id does not exist");
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
      //      recordChange("status", original.g(), updated.getStatus());
      //      recordChange("endPoint", original.getEndpoint(), updated.getEndpoint());
      //      updateEventFilters();
      //      if (fieldsChanged()) {
      //        // If updating the other fields, opportunistically use it to capture failure details
      //        SubscriptionPublisher publisher = EventSubscriptionRepository.this.getPublisher(original.getId());
      //        if (publisher != null && updated != publisher.getEventSubscription()) {
      //          updated
      //              .withStatus(publisher.getWebhook().getStatus())
      //              .withFailureDetails(publisher.getWebhook().getFailureDetails());
      //          if (Boolean.FALSE.equals(updated.getEnabled())) {
      //            updated.setStatusDetails(new SubscriptionStatus().withStatus(SubscriptionStatus.Status.DISABLED));
      //          }
      //        }
      //        recordChange(
      //            "failureDetails", original.getFailureDetails(), updated.getFailureDetails(), true,
      // failureDetailsMatch);
    }
  }

  //    private void updateEventFilters() throws JsonProcessingException {
  //      List<EventFilter> origFilter = original.getEventFilters();
  //      List<EventFilter> updatedFilter = updated.getEventFilters();
  //      List<EventFilter> added = new ArrayList<>();
  //      List<EventFilter> deleted = new ArrayList<>();
  //      recordListChange("eventFilters", origFilter, updatedFilter, added, deleted, eventFilterMatch);
  //    }
}
