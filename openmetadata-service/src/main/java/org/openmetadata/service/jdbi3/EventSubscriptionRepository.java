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

import java.util.Comparator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class EventSubscriptionRepository extends EntityRepository<EventSubscription> {
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
  public void setFields(EventSubscription entity, Fields fields) {
    if (entity.getStatusDetails() == null) {
      entity.withStatusDetails(
          fields.contains("statusDetails")
              ? EventSubscriptionScheduler.getInstance()
                  .getStatusForEventSubscription(entity.getId())
              : null);
    }
  }

  @Override
  public void clearFields(EventSubscription entity, Fields fields) {
    entity.withStatusDetails(fields.contains("statusDetails") ? entity.getStatusDetails() : null);
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

  @Override
  public EventSubscriptionUpdater getUpdater(
      EventSubscription original, EventSubscription updated, Operation operation) {
    return new EventSubscriptionUpdater(original, updated, operation);
  }

  public class EventSubscriptionUpdater extends EntityUpdater {
    public EventSubscriptionUpdater(
        EventSubscription original, EventSubscription updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() {
      recordChange("enabled", original.getEnabled(), updated.getEnabled());
      recordChange("batchSize", original.getBatchSize(), updated.getBatchSize());
      recordChange("timeout", original.getTimeout(), updated.getTimeout());
      recordChange(
          "filteringRules", original.getFilteringRules(), updated.getFilteringRules(), true);
      recordChange(
          "subscriptionType", original.getSubscriptionType(), updated.getSubscriptionType());
      recordChange(
          "subscriptionConfig",
          original.getSubscriptionConfig(),
          updated.getSubscriptionConfig(),
          true);
      recordChange("trigger", original.getTrigger(), updated.getTrigger(), true);
    }
  }
}
