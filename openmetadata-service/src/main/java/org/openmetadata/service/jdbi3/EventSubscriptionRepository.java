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
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository()
public class EventSubscriptionRepository implements EntityPolicy<EventSubscription> {

  static final String ALERT_PATCH_FIELDS =
      "trigger,enabled,batchSize,notificationTemplate,destinations";

  static final String ALERT_UPDATE_FIELDS =
      "trigger,enabled,batchSize,input,filteringRules,notificationTemplate,destinations";

  public EventSubscriptionRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                EventSubscriptionResource.COLLECTION_PATH,
                Entity.EVENT_SUBSCRIPTION,
                EventSubscription.class,
                Entity.getCollectionDAO().eventSubscriptionDAO()),
            new EntityPolicyContext.WriteFields(ALERT_PATCH_FIELDS, ALERT_UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
  }

  @Override
  public void setFields(
      EventSubscription entity, Fields fields, RelationIncludes relationIncludes) {
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
    entity.setNotificationTemplate(getTemplateReference(entity));
  }

  @Override
  public void clearFields(EventSubscription entity, Fields fields) {}

  @Override
  public void setInheritedFields(EventSubscription entity, Fields fields) {
    entity.setNotificationTemplate(getTemplateReference(entity));
  }

  private EntityReference getTemplateReference(EventSubscription subscription) {
    List<EntityReference> templateRefs =
        relationships()
            .to(
                new EntityRelationshipReader.Selection(
                    subscription.getId(),
                    Entity.EVENT_SUBSCRIPTION,
                    Relationship.USES,
                    Entity.NOTIFICATION_TEMPLATE),
                Include.NON_DELETED);
    return templateRefs.isEmpty() ? null : templateRefs.get(0);
  }

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
    // Validate custom template if assigned
    EntityReference templateRef = entity.getNotificationTemplate();
    if (templateRef != null) {
      NotificationTemplate template =
          Entity.getEntity(
              Entity.NOTIFICATION_TEMPLATE, templateRef.getId(), "", Include.NON_DELETED);
      if (template.getProvider() == ProviderType.SYSTEM) {
        throw new IllegalArgumentException(
            "System templates cannot be assigned to EventSubscriptions. Please use a USER template or create a custom one.");
      }
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
      if (!rules.isEmpty()) {
        // Validate the combined condition too (each rule is validated above), so a bad
        // combination is caught here instead of when it is first compiled at runtime.
        AlertUtil.validateExpression(AlertUtil.buildCompleteCondition(rules), Boolean.class);
      }
    }
  }

  private void ensureDestinationIds(EventSubscription entity) {
    // Ensure all destinations have unique IDs assigned before storage
    Optional.ofNullable(entity.getDestinations()).orElse(Collections.emptyList()).stream()
        .filter(destination -> nullOrEmpty(destination.getId()))
        .forEach(destination -> destination.withId(UUID.randomUUID()));
  }

  public EventSubscriptionOffset syncEventSubscriptionOffset(String eventSubscriptionName) {
    EventSubscription eventSubscription =
        getByName(null, eventSubscriptionName, fieldPolicy().parse("*"));
    long latestOffset = context().dependencies().daos().changeEventDAO().getLatestOffset();
    long currentTime = System.currentTimeMillis();
    // Upsert Offset
    EventSubscriptionOffset eventSubscriptionOffset =
        new EventSubscriptionOffset()
            .withCurrentOffset(latestOffset)
            .withStartingOffset(latestOffset)
            .withStartingTimestamp(currentTime)
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
    // Ensure all destinations have unique IDs before storage (handles all operations: POST, PUT,
    // PATCH)
    ensureDestinationIds(entity);
    persistence().store(entity, update);
  }

  @Override
  public void storeEntities(List<EventSubscription> entities) {
    List<String> fqns = new ArrayList<>(entities.size());
    List<String> jsons = new ArrayList<>(entities.size());
    for (EventSubscription entity : entities) {
      ensureDestinationIds(entity);
      fqns.add(entity.getFullyQualifiedName());
      jsons.add(serializeForStorage(entity));
    }
    context()
        .schema()
        .dao()
        .insertMany(
            context().schema().dao().getTableName(),
            context().schema().dao().getNameHashColumn(),
            fqns,
            jsons);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<EventSubscription> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(EventSubscription::getId).toList();
    deleteFromMany(ids, Entity.EVENT_SUBSCRIPTION, Relationship.USES, Entity.NOTIFICATION_TEMPLATE);
  }

  @Override
  public void storeRelationships(EventSubscription entity) {
    EntityReference templateRef = entity.getNotificationTemplate();
    if (templateRef != null) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  entity.getId(),
                  templateRef.getId(),
                  Entity.EVENT_SUBSCRIPTION,
                  Entity.NOTIFICATION_TEMPLATE,
                  Relationship.USES),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  @Override
  public EntityUpdater<EventSubscription> getUpdater(
      EventSubscription original,
      EventSubscription updated,
      EntityOperation operation,
      ChangeSource changeSource) {
    return new EventSubscriptionUpdater(original, updated, operation).mutation();
  }

  public class EventSubscriptionUpdater implements EntitySpecificMutation<EventSubscription> {

    public EventSubscriptionUpdater(
        EventSubscription original, EventSubscription updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(
        EntityUpdater<EventSubscription> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate("notificationTemplate", this::updateTemplateRelationship);
      entityUpdate.compareAndUpdate(
          "input",
          () ->
              entityUpdate.recordChange(
                  "input",
                  entityUpdate.getOriginal().getInput(),
                  entityUpdate.getUpdated().getInput(),
                  true));
      entityUpdate.compareAndUpdate(
          "batchSize",
          () ->
              entityUpdate.recordChange(
                  "batchSize",
                  entityUpdate.getOriginal().getBatchSize(),
                  entityUpdate.getUpdated().getBatchSize()));
      if (!entityUpdate
          .getOriginal()
          .getAlertType()
          .equals(CreateEventSubscription.AlertType.ACTIVITY_FEED)) {
        entityUpdate.compareAndUpdate(
            "filteringRules",
            () ->
                entityUpdate.recordChange(
                    "filteringRules",
                    entityUpdate.getOriginal().getFilteringRules(),
                    entityUpdate.getUpdated().getFilteringRules(),
                    true));
        entityUpdate.compareAndUpdate(
            "enabled",
            () ->
                entityUpdate.recordChange(
                    "enabled",
                    entityUpdate.getOriginal().getEnabled(),
                    entityUpdate.getUpdated().getEnabled()));
        entityUpdate.compareAndUpdate(
            "destinations",
            () ->
                entityUpdate.recordChange(
                    "destinations",
                    entityUpdate.getOriginal().getDestinations(),
                    encryptWebhookSecretKey(entityUpdate.getUpdated().getDestinations()),
                    true,
                    objectMatch,
                    false));
        entityUpdate.compareAndUpdate(
            "trigger",
            () ->
                entityUpdate.recordChange(
                    "trigger",
                    entityUpdate.getOriginal().getTrigger(),
                    entityUpdate.getUpdated().getTrigger(),
                    true));
        entityUpdate.compareAndUpdate(
            "config",
            () ->
                entityUpdate.recordChange(
                    "config",
                    entityUpdate.getOriginal().getConfig(),
                    entityUpdate.getUpdated().getConfig(),
                    true));
      }
    }

    private void updateTemplateRelationship() {
      EntityReference origTemplate = entityUpdate.getOriginal().getNotificationTemplate();
      EntityReference updatedTemplate = entityUpdate.getUpdated().getNotificationTemplate();
      // No change: both null or same template ID
      if (hasSameTemplate(origTemplate, updatedTemplate)) {
        return;
      }
      // Template removed: delete existing USES relationship
      if (updatedTemplate == null) {
        relationshipWrites()
            .delete(
                new EntityRelationshipWriter.Edge(
                    entityUpdate.getOriginal().getId(),
                    origTemplate.getId(),
                    Entity.EVENT_SUBSCRIPTION,
                    Entity.NOTIFICATION_TEMPLATE,
                    Relationship.USES));
        entityUpdate.recordChange("notificationTemplate", origTemplate, null);
        return;
      }
      // Template added: create new USES relationship
      if (origTemplate == null) {
        relationshipWrites()
            .add(
                new EntityRelationshipWriter.Edge(
                    entityUpdate.getUpdated().getId(),
                    updatedTemplate.getId(),
                    Entity.EVENT_SUBSCRIPTION,
                    Entity.NOTIFICATION_TEMPLATE,
                    Relationship.USES),
                EntityRelationshipWriter.Value.EMPTY,
                false);
        entityUpdate.recordChange("notificationTemplate", null, updatedTemplate);
        return;
      }
      // Template changed: replace old relationship with new one
      relationshipWrites()
          .delete(
              new EntityRelationshipWriter.Edge(
                  entityUpdate.getOriginal().getId(),
                  origTemplate.getId(),
                  Entity.EVENT_SUBSCRIPTION,
                  Entity.NOTIFICATION_TEMPLATE,
                  Relationship.USES));
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  entityUpdate.getUpdated().getId(),
                  updatedTemplate.getId(),
                  Entity.EVENT_SUBSCRIPTION,
                  Entity.NOTIFICATION_TEMPLATE,
                  Relationship.USES),
              EntityRelationshipWriter.Value.EMPTY,
              false);
      entityUpdate.recordChange("notificationTemplate", origTemplate, updatedTemplate);
    }

    private boolean hasSameTemplate(EntityReference orig, EntityReference updated) {
      if (orig == null && updated == null) return true;
      if (orig == null || updated == null) return false;
      return orig.getId().equals(updated.getId());
    }

    private final EntityUpdater<EventSubscription> entityUpdate;

    public EntityUpdater<EventSubscription> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<EventSubscription> entityContext;

  @Override
  public final EntityPolicyContext<EventSubscription> context() {
    return entityContext;
  }
}
