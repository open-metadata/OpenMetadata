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
import static org.openmetadata.service.util.EntityUtil.objectMatch;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerting.AlertDiagnostics;
import org.openmetadata.service.alerting.channel.DestinationSecrets;
import org.openmetadata.service.events.consumer.Consumers;
import org.openmetadata.service.events.scheduled.AlertJobs;
import org.openmetadata.service.events.subscription.AlertDefinitionPolicy;
import org.openmetadata.service.events.subscription.DestinationValidation;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
public class EventSubscriptionRepository extends EntityRepository<EventSubscription> {
  static final String ALERT_PATCH_FIELDS =
      "trigger,enabled,batchSize,notificationTemplate,destinations";
  static final String ALERT_UPDATE_FIELDS =
      "trigger,enabled,batchSize,input,filteringRules,notificationTemplate,destinations";
  private static final String FIELD_ENABLED = "enabled";

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
  public void setFields(
      EventSubscription entity, Fields fields, RelationIncludes relationIncludes) {
    if (fields.contains("statusDetails") && !entity.getDestinations().isEmpty()) {
      entity.withDestinations(new ArrayList<>(AlertDiagnostics.destinationsWithStatus(entity)));
    }
    entity.setNotificationTemplate(templateOf(entity.getId()));
  }

  @Override
  public void clearFields(EventSubscription entity, Fields fields) {}

  // Every save path converges through these hooks, after its commit, so a saved alert and its
  // job cannot drift apart, whoever saved it.
  @Override
  protected void postCreate(EventSubscription entity) {
    super.postCreate(entity);
    AlertJobs.convergeAfterCommit(entity.getId());
  }

  @Override
  protected void postCreate(List<EventSubscription> entities) {
    super.postCreate(entities);
    entities.forEach(entity -> AlertJobs.convergeAfterCommit(entity.getId()));
  }

  @Override
  protected void postUpdate(EventSubscription original, EventSubscription updated) {
    super.postUpdate(original, updated);
    // Before the job is back, so its first tick already starts from now.
    if (switchedOn(updated)) {
      AlertRecord.skipBacklog(updated.getId());
    }
    AlertJobs.convergeAfterCommit(updated.getId());
  }

  /**
   * An alert switched back on sends what happens from then on, not what happened while it was off.
   * Read from this save's own change: when the save is merged into the user's session, {@code
   * original} is the version from before that session.
   */
  private static boolean switchedOn(EventSubscription updated) {
    ChangeDescription change = updated.getIncrementalChangeDescription();
    return !Boolean.FALSE.equals(updated.getEnabled())
        && change != null
        && Stream.concat(
                listOrEmpty(change.getFieldsUpdated()).stream(),
                listOrEmpty(change.getFieldsDeleted()).stream())
            .anyMatch(
                field ->
                    FIELD_ENABLED.equals(field.getName())
                        && Boolean.FALSE.equals(field.getOldValue()));
  }

  // Every hard delete reaches this, inside the delete's own transaction, including deleteInternal,
  // which skips postDelete. The job goes once the row is gone.
  @Override
  protected void entitySpecificCleanup(EventSubscription entity) {
    retire(entity.getId());
  }

  // A cascade from a parent calls this outside any transaction and before the rows are deleted,
  // and postDelete once they are gone, so the alert is retired there.
  @Override
  protected void bulkEntitySpecificCleanup(List<EventSubscription> entities, String deletedBy) {}

  // An alert cannot be soft deleted, so every delete that reaches here removed the row.
  @Override
  protected void postDelete(EventSubscription entity, boolean hardDelete) {
    super.postDelete(entity, hardDelete);
    retire(entity.getId());
  }

  private static void retire(UUID alertId) {
    AlertRecord.forget(alertId);
    AlertJobs.convergeAfterCommit(alertId);
  }

  @Override
  public void setInheritedFields(EventSubscription entity, Fields fields) {
    entity.setNotificationTemplate(templateOf(entity.getId()));
  }

  /** The notification template an alert uses, or null when it uses the system one. */
  public EntityReference templateOf(UUID alertId) {
    List<EntityReference> templateRefs =
        findTo(alertId, Entity.EVENT_SUBSCRIPTION, Relationship.USES, Entity.NOTIFICATION_TEMPLATE);

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

    // An update is validated by the updater, which knows what the alert looked like before.
    if (!update) {
      requireRegistered(entity);
      DestinationValidation.ofANewAlert(entity);
      AlertDefinitionPolicy.ofNew(entity).prepareNew(entity);
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
  }

  // A save naming a consumer this server does not have fails here, not at every tick.
  private static void requireRegistered(EventSubscription alert) {
    if (alert.getClassName() != null && Consumers.find(alert.getClassName()).isEmpty()) {
      throw new BadRequestException("No consumer is registered as " + alert.getClassName());
    }
  }

  private void ensureDestinationIds(EventSubscription entity) {
    // Ensure all destinations have unique IDs assigned before storage
    Optional.ofNullable(entity.getDestinations()).orElse(Collections.emptyList()).stream()
        .filter(destination -> nullOrEmpty(destination.getId()))
        .forEach(destination -> destination.withId(UUID.randomUUID()));
  }

  /**
   * Skips the backlog: the position and the watermark move to now. A tick that is running at this
   * moment loses its compare-and-set on the position and keeps the skip.
   */
  public EventSubscriptionOffset syncEventSubscriptionOffset(String eventSubscriptionName) {
    EventSubscription eventSubscription = getByName(null, eventSubscriptionName, getFields("*"));
    return AlertRecord.skipBacklog(eventSubscription.getId());
  }

  @Override
  public void storeEntity(EventSubscription entity, boolean update) {
    // Ensure all destinations have unique IDs before storage (handles all operations: POST, PUT,
    // PATCH)
    ensureDestinationIds(entity);
    store(entity, update);
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
    dao.insertMany(dao.getTableName(), dao.getNameHashColumn(), fqns, jsons);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<EventSubscription> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(EventSubscription::getId).toList();
    deleteFromMany(ids, Entity.EVENT_SUBSCRIPTION, Relationship.USES, Entity.NOTIFICATION_TEMPLATE);
  }

  @Override
  public void storeRelationships(EventSubscription entity) {
    EntityReference templateRef = entity.getNotificationTemplate();
    if (templateRef != null) {
      addRelationship(
          entity.getId(),
          templateRef.getId(),
          Entity.EVENT_SUBSCRIPTION,
          Entity.NOTIFICATION_TEMPLATE,
          Relationship.USES);
    }
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
      // Once, against the alert as it is stored, before any comparison: edits merged within the
      // session window are later compared with an older version, and only the final definition
      // may be judged.
      AlertDefinitionPolicy.ofUpdate(original, updated)
          .settle(original, updated, operation.isPut());
      DestinationValidation.ofWhatChanged(original, updated);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate("notificationTemplate", this::updateTemplateRelationship);

      compareAndUpdate(
          "input", () -> recordChange("input", original.getInput(), updated.getInput(), true));
      compareAndUpdate(
          "batchSize",
          () -> recordChange("batchSize", original.getBatchSize(), updated.getBatchSize()));
      if (!original.getAlertType().equals(CreateEventSubscription.AlertType.ACTIVITY_FEED)) {
        compareAndUpdate(
            "filteringRules",
            () ->
                recordChange(
                    "filteringRules",
                    original.getFilteringRules(),
                    updated.getFilteringRules(),
                    true));
        compareAndUpdate(
            FIELD_ENABLED,
            () -> recordChange(FIELD_ENABLED, original.getEnabled(), updated.getEnabled()));
        compareAndUpdate(
            "destinations",
            () ->
                recordChange(
                    "destinations",
                    original.getDestinations(),
                    DestinationSecrets.encrypt(updated.getDestinations()),
                    true,
                    objectMatch,
                    false));
        compareAndUpdate(
            "trigger",
            () -> recordChange("trigger", original.getTrigger(), updated.getTrigger(), true));
        compareAndUpdate(
            "config",
            () -> recordChange("config", original.getConfig(), updated.getConfig(), true));
      }
    }

    private void updateTemplateRelationship() {
      EntityReference origTemplate = original.getNotificationTemplate();
      EntityReference updatedTemplate = updated.getNotificationTemplate();

      // No change: both null or same template ID
      if (hasSameTemplate(origTemplate, updatedTemplate)) {
        return;
      }

      // Template removed: delete existing USES relationship
      if (updatedTemplate == null) {
        deleteRelationship(
            original.getId(),
            Entity.EVENT_SUBSCRIPTION,
            origTemplate.getId(),
            Entity.NOTIFICATION_TEMPLATE,
            Relationship.USES);
        recordChange("notificationTemplate", origTemplate, null);
        return;
      }

      // Template added: create new USES relationship
      if (origTemplate == null) {
        addRelationship(
            updated.getId(),
            updatedTemplate.getId(),
            Entity.EVENT_SUBSCRIPTION,
            Entity.NOTIFICATION_TEMPLATE,
            Relationship.USES);
        recordChange("notificationTemplate", null, updatedTemplate);
        return;
      }

      // Template changed: replace old relationship with new one
      deleteRelationship(
          original.getId(),
          Entity.EVENT_SUBSCRIPTION,
          origTemplate.getId(),
          Entity.NOTIFICATION_TEMPLATE,
          Relationship.USES);
      addRelationship(
          updated.getId(),
          updatedTemplate.getId(),
          Entity.EVENT_SUBSCRIPTION,
          Entity.NOTIFICATION_TEMPLATE,
          Relationship.USES);
      recordChange("notificationTemplate", origTemplate, updatedTemplate);
    }

    private boolean hasSameTemplate(EntityReference orig, EntityReference updated) {
      if (orig == null && updated == null) return true;
      if (orig == null || updated == null) return false;
      return orig.getId().equals(updated.getId());
    }
  }
}
