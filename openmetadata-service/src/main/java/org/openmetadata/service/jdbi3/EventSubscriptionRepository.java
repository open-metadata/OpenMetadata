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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer.OFFSET_EXTENSION;
import static org.openmetadata.service.events.subscription.AlertUtil.validateAndBuildFilteringConditions;
import static org.openmetadata.service.fernet.Fernet.encryptWebhookSecretKey;
import static org.openmetadata.service.util.EntityUtil.objectMatch;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class EventSubscriptionRepository extends EntityRepository<EventSubscription> {
  static final String ALERT_PATCH_FIELDS = "trigger,enabled,batchSize";
  static final String ALERT_UPDATE_FIELDS = "trigger,enabled,batchSize,input,filteringRules";

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
  public void setFields(EventSubscription entity, Fields fields) {
    if (fields.contains("statusDetails") && !entity.getDestinations().isEmpty()) {
      List<SubscriptionDestination> destinations = new ArrayList<>();
      entity
          .getDestinations()
          .forEach(
              destination ->
                  destinations.add(
                      destination.withStatusDetails(
                          EventSubscriptionScheduler.getInstance()
                              .getStatusForEventSubscription(
                                  entity.getId(), destination.getId()))));
      entity.withDestinations(destinations);
    }
  }

  @Override
  public void clearFields(EventSubscription entity, Fields fields) {}

  @Override
  public void prepare(EventSubscription entity, boolean update) {
    // Sort Filters and Actions
    if (entity.getInput() != null) {
      listOrEmpty(entity.getInput().getFilters())
          .sort(Comparator.comparing(ArgumentsInput::getName));
      listOrEmpty(entity.getInput().getActions())
          .sort(Comparator.comparing(ArgumentsInput::getName));

      // Sort Input Args
      listOrEmpty(entity.getInput().getFilters())
          .forEach(
              filter ->
                  listOrEmpty(filter.getArguments()).sort(Comparator.comparing(Argument::getName)));
      listOrEmpty(entity.getInput().getActions())
          .forEach(
              filter ->
                  listOrEmpty(filter.getArguments()).sort(Comparator.comparing(Argument::getName)));
    }

    if (update && !nullOrEmpty(entity.getFilteringRules())) {
      entity.setFilteringRules(
          validateAndBuildFilteringConditions(
              entity.getFilteringRules().getResources(), entity.getAlertType(), entity.getInput()));
    }

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

  public EventSubscriptionOffset syncEventSubscriptionOffset(String eventSubscriptionName) {
    EventSubscription eventSubscription = getByName(null, eventSubscriptionName, getFields("*"));
    long latestOffset = daoCollection.changeEventDAO().getLatestOffset();
    long currentTime = System.currentTimeMillis();
    // Upsert Offset
    EventSubscriptionOffset eventSubscriptionOffset =
        new EventSubscriptionOffset()
            .withCurrentOffset(latestOffset)
            .withStartingOffset(latestOffset)
            .withTimestamp(currentTime);

    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .upsertSubscriberExtension(
            eventSubscription.getId().toString(),
            OFFSET_EXTENSION,
            "eventSubscriptionOffset",
            JsonUtils.pojoToJson(eventSubscriptionOffset));

    EventSubscriptionScheduler.getInstance().updateEventSubscription(eventSubscription);
    return eventSubscriptionOffset;
  }

  @Override
  public void storeEntity(EventSubscription entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(EventSubscription entity) {
    // No relationships to store beyond what is stored in the super class
  }

  @Override
  public EntityRepository<EventSubscription>.EntityUpdater getUpdater(
      EventSubscription original,
      EventSubscription updated,
      Operation operation,
      ChangeSource changeSource) {
    return new EventSubscriptionUpdater(original, updated, operation);
  }

  public class EventSubscriptionUpdater extends EntityUpdater {
    public EventSubscriptionUpdater(
        EventSubscription original, EventSubscription updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("input", original.getInput(), updated.getInput(), true);
      recordChange("batchSize", original.getBatchSize(), updated.getBatchSize());
      if (!original.getAlertType().equals(CreateEventSubscription.AlertType.ACTIVITY_FEED)) {
        recordChange(
            "filteringRules", original.getFilteringRules(), updated.getFilteringRules(), true);
        recordChange("enabled", original.getEnabled(), updated.getEnabled());
        recordChange(
            "destinations",
            original.getDestinations(),
            encryptWebhookSecretKey(updated.getDestinations()),
            true,
            objectMatch,
            false);
        recordChange("trigger", original.getTrigger(), updated.getTrigger(), true);
        recordChange("config", original.getConfig(), updated.getConfig(), true);
      }
    }
  }
}
