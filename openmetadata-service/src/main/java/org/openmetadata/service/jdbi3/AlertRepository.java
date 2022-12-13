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

import static org.openmetadata.service.Entity.ALERT;
import static org.openmetadata.service.Entity.ALERT_ACTION;

import com.lmax.disruptor.BatchEventProcessor;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.alerts.Alert;
import org.openmetadata.schema.entity.alerts.AlertAction;
import org.openmetadata.schema.entity.alerts.AlertActionStatus;
import org.openmetadata.schema.entity.alerts.AlertFilterRule;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FailureDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerts.AlertUtil;
import org.openmetadata.service.alerts.AlertsActionPublisher;
import org.openmetadata.service.events.EventPubSub;
import org.openmetadata.service.resources.alerts.AlertResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class AlertRepository extends EntityRepository<Alert> {
  public static final String COLLECTION_PATH = "/v1/alerts";

  // Alert is mapped to different publisher
  private static final ConcurrentHashMap<UUID, List<AlertsActionPublisher>> alertPublisherMap =
      new ConcurrentHashMap<>();

  public AlertRepository(CollectionDAO dao) {
    super(AlertResource.COLLECTION_PATH, Entity.ALERT, Alert.class, dao.alertDAO(), dao, "", "");
  }

  @Override
  public Alert setFields(Alert entity, Fields fields) throws IOException {
    entity.setAlertActions(fields.contains("alertActions") ? getAlertActions(entity) : null);
    return entity; // No fields to set
  }

  @Override
  public void prepare(Alert entity) {
    validateFilterRules(entity);
  }

  private void validateFilterRules(Alert entity) {
    // Resolve JSON blobs into Rule object and perform schema based validation
    List<AlertFilterRule> rules = entity.getFilteringRules();
    // Validate all the expressions in the rule
    for (AlertFilterRule rule : rules) {
      AlertUtil.validateExpression(rule.getCondition(), Boolean.class);
    }
    rules.sort(Comparator.comparing(AlertFilterRule::getName));
  }

  @Override
  public void storeEntity(Alert entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();
    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    entity.withOwner(null).withHref(null);
    store(entity, update);

    // Restore the relationships
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(Alert entity) {
    storeOwner(entity, entity.getOwner());
    // Store Alert to AlertAction RelationShip
    for (EntityReference actionRef : entity.getAlertActions()) {
      addRelationship(entity.getId(), actionRef.getId(), ALERT, ALERT_ACTION, Relationship.CONTAINS);
    }
  }

  @Override
  public void restorePatchAttributes(Alert original, Alert updated) {
    updated.withId(original.getId()).withName(original.getName());
  }

  @Override
  public AlertUpdater getUpdater(Alert original, Alert updated, Operation operation) {
    return new AlertUpdater(original, updated, operation);
  }

  public void addAlertActionPublishers(Alert alert) throws IOException {
    EntityRepository<AlertAction> alertActionEntityRepository = Entity.getEntityRepository(ALERT_ACTION);
    for (EntityReference alertActionRef : alert.getAlertActions()) {
      AlertAction action =
          alertActionEntityRepository.get(null, alertActionRef.getId(), alertActionEntityRepository.getFields("*"));
      addAlertActionPublisher(alert, action);
    }
  }

  public void addAlertActionPublisher(Alert alert, AlertAction alertAction) throws IOException {
    if (Boolean.FALSE.equals(alertAction.getEnabled())) {
      // Only add alert that is enabled for publishing events
      setStatus(alert.getId(), alertAction.getId(), AlertActionStatus.Status.DISABLED, null);
      alertAction.setStatusDetails(new AlertActionStatus().withStatus(AlertActionStatus.Status.DISABLED));
      return;
    }

    // Create AlertAction Publisher
    AlertsActionPublisher publisher = AlertUtil.getAlertPublisher(alert, alertAction, daoCollection);
    BatchEventProcessor<EventPubSub.ChangeEventHolder> processor = EventPubSub.addEventHandler(publisher);
    publisher.setProcessor(processor);
    LOG.info("Alert publisher started for {}", alert.getName());

    List<AlertsActionPublisher> listPublisher =
        alertPublisherMap.get(alert.getId()) == null ? new ArrayList<>() : alertPublisherMap.get(alert.getId());
    listPublisher.add(publisher);
    alertPublisherMap.put(alert.getId(), listPublisher);
  }

  public AlertActionStatus setStatus(
      UUID alertId, UUID alertActionId, AlertActionStatus.Status status, FailureDetails failureDetails)
      throws IOException {
    AlertActionStatus currentStatus = new AlertActionStatus().withStatus(status).withFailureDetails(failureDetails);
    daoCollection
        .entityExtensionTimeSeriesDao()
        .insert(alertId.toString(), alertActionId.toString(), "alertActionStatus", JsonUtils.pojoToJson(currentStatus));
    return currentStatus;
  }

  public void setStatus(UUID alertId, UUID alertActionId, AlertActionStatus status) throws IOException {
    daoCollection
        .entityExtensionTimeSeriesDao()
        .insert(alertId.toString(), alertActionId.toString(), "alertActionStatus", JsonUtils.pojoToJson(status));
  }

  @SneakyThrows
  public void updateAlertActionPublishers(Alert alert) {
    // Delete existing alert action publisher and create with the updated Alert
    Alert storedAlert = get(null, alert.getId(), getFields("*"));
    if (alert.getAlertActions().equals(storedAlert.getAlertActions())) {
      EntityRepository<AlertAction> alertActionEntityRepository = Entity.getEntityRepository(ALERT_ACTION);
      for (EntityReference alertActionRef : alert.getAlertActions()) {
        AlertAction action =
            alertActionEntityRepository.get(null, alertActionRef.getId(), alertActionEntityRepository.getFields("*"));
        if (Boolean.TRUE.equals(action.getEnabled())) {
          // If there was a previous alert action either in disabled state or stopped due
          // to errors, update it and restart publishing
          AlertsActionPublisher previousPublisher = getAlertActionPublisher(alert.getId(), action);
          if (previousPublisher == null) {
            addAlertActionPublisher(alert, action);
            return;
          }

          // Update the existing publisher
          AlertActionStatus.Status status = previousPublisher.getAlertAction().getStatusDetails().getStatus();
          previousPublisher.updateAlertWithAlertAction(alert, action);
          if (status != AlertActionStatus.Status.ACTIVE && status != AlertActionStatus.Status.AWAITING_RETRY) {
            // Restart the previously stopped publisher (in states notStarted, error, retryLimitReached)
            BatchEventProcessor<EventPubSub.ChangeEventHolder> processor =
                EventPubSub.addEventHandler(previousPublisher);
            previousPublisher.setProcessor(processor);
            LOG.info("Webhook publisher restarted for {}", alert.getName());
          }
        } else {
          deleteAlertActionPublisher(alert.getId(), action);
        }
      }
    } else {
      // if some alerts are removed or added
      deleteAlertAllPublishers(alert.getId());
      addAlertActionPublishers(alert);
    }
  }

  public void deleteAlertActionPublisher(UUID alertId, AlertAction action) throws InterruptedException {
    List<AlertsActionPublisher> alertPublishers = alertPublisherMap.get(alertId);
    int position = -1;
    for (int i = 0; i < alertPublishers.size(); i++) {
      AlertsActionPublisher alertsActionPublisher = alertPublishers.get(i);
      if (alertsActionPublisher.getAlertAction().getId().equals(action.getId())) {
        alertsActionPublisher.getProcessor().halt();
        alertsActionPublisher.awaitShutdown();
        EventPubSub.removeProcessor(alertsActionPublisher.getProcessor());
        LOG.info("Alert publisher deleted for {}", alertsActionPublisher.getAlert().getName());
        position = i;
        break;
      }
    }
    if (position != -1) {
      alertPublishers.remove(position);
      alertPublisherMap.put(alertId, alertPublishers);
    }
  }

  public void deleteAlertAllPublishers(UUID alertId) throws InterruptedException {
    List<AlertsActionPublisher> alertPublishers = alertPublisherMap.get(alertId);
    for (AlertsActionPublisher alertsActionPublisher : alertPublishers) {
      if (alertsActionPublisher != null) {
        alertsActionPublisher.getProcessor().halt();
        alertsActionPublisher.awaitShutdown();
        EventPubSub.removeProcessor(alertsActionPublisher.getProcessor());
        LOG.info("Alert publisher deleted for {}", alertsActionPublisher.getAlert().getName());
      }
    }
    alertPublisherMap.clear();
  }

  private List<EntityReference> getAlertActions(Alert entity) throws IOException {
    List<CollectionDAO.EntityRelationshipRecord> testCases =
        findTo(entity.getId(), ALERT, Relationship.CONTAINS, ALERT_ACTION);
    return EntityUtil.getEntityReferences(testCases);
  }

  private AlertsActionPublisher getAlertActionPublisher(UUID alertID, AlertAction alertAction) {
    List<AlertsActionPublisher> publishers = alertPublisherMap.get(alertID);
    for (AlertsActionPublisher publisher : publishers) {
      if (alertAction.equals(publisher.getAlertAction())) {
        return publisher;
      }
    }
    return null;
  }

  public AlertActionStatus getAlertActionStatus(UUID alertID, UUID alertActionId) throws IOException {
    String alertStatusString =
        daoCollection.entityExtensionTimeSeriesDao().getLatestExtension(alertID.toString(), alertActionId.toString());
    return JsonUtils.readValue(alertStatusString, AlertActionStatus.class);
  }

  public class AlertUpdater extends EntityUpdater {
    public AlertUpdater(Alert original, Alert updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("triggerConfig", original.getTriggerConfig(), updated.getTriggerConfig());
      recordChange("filteringRules", original.getFilteringRules(), updated.getFilteringRules());
      updateToRelationships(
          "alertActions",
          ALERT,
          original.getId(),
          Relationship.CONTAINS,
          ALERT_ACTION,
          new ArrayList<>(original.getAlertActions()),
          new ArrayList<>(updated.getAlertActions()),
          false);
      if (!original.getAlertActions().equals(updated.getAlertActions())) {
        updateAlertActionPublishers(updated);
      }
    }
  }
}
