package org.openmetadata.service.alerts;

import static org.openmetadata.schema.type.Relationship.CONTAINS;
import static org.openmetadata.service.Entity.ALERT;
import static org.openmetadata.service.Entity.ALERT_ACTION;

import com.lmax.disruptor.BatchEventProcessor;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.alerts.Alert;
import org.openmetadata.schema.entity.alerts.AlertAction;
import org.openmetadata.schema.entity.alerts.AlertActionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.EventPubSub;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class AlertsPublisherManager {
  // Alert is mapped to different publisher
  private static CollectionDAO daoCollection;
  private static AlertsPublisherManager INSTANCE;
  private static volatile boolean INITIALIZED = false;
  // <Alert,  <AlertAction, Publisher>>
  private static final ConcurrentHashMap<UUID, Map<UUID, AlertsActionPublisher>> alertPublisherMap =
      new ConcurrentHashMap<>();

  public static void initialize(CollectionDAO dao) {
    if (!INITIALIZED) {
      daoCollection = dao;
      INSTANCE = new AlertsPublisherManager();
      INITIALIZED = true;
    } else {
      INITIALIZED = false;
      LOG.info("Email Util is already initialized");
    }
  }

  public static AlertsPublisherManager getInstance() {
    return INSTANCE;
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
      AlertActionStatus status =
          new AlertActionStatus()
              .withStatus(AlertActionStatus.Status.DISABLED)
              .withTimestamp(System.currentTimeMillis())
              .withFailureDetails(null);
      setStatus(alert.getId(), alertAction.getId(), status);
      alertAction.setStatusDetails(status);
      return;
    }

    // Activity Feed AlertAction Cannot be Created
    if (alertAction.getAlertActionType() == AlertAction.AlertActionType.ACTIVITY_FEED) {
      LOG.info("Activity Feed Alert Action cannot be created.");
      return;
    }
    // Create AlertAction Publisher
    AlertsActionPublisher publisher = AlertUtil.getAlertPublisher(alert, alertAction, daoCollection);
    BatchEventProcessor<EventPubSub.ChangeEventHolder> processor = EventPubSub.addEventHandler(publisher);
    publisher.setProcessor(processor);
    LOG.info("Alert publisher started for {}", alert.getName());

    Map<UUID, AlertsActionPublisher> alertsActionPublisherMap =
        alertPublisherMap.get(alert.getId()) == null ? new HashMap<>() : alertPublisherMap.get(alert.getId());
    alertsActionPublisherMap.put(alertAction.getId(), publisher);
    alertPublisherMap.put(alert.getId(), alertsActionPublisherMap);
  }

  public void removeAlertStatus(UUID alertId, UUID alertActionId) {
    daoCollection.entityExtensionTimeSeriesDao().delete(alertId.toString(), alertActionId.toString());
  }

  public void removeAllAlertStatus(UUID alertId) {
    daoCollection.entityExtensionTimeSeriesDao().deleteAll(alertId.toString());
  }

  public void setStatus(UUID alertId, UUID alertActionId, AlertActionStatus status) throws IOException {
    daoCollection
        .entityExtensionTimeSeriesDao()
        .insert(alertId.toString(), alertActionId.toString(), "alertActionStatus", JsonUtils.pojoToJson(status));
  }

  @SneakyThrows
  public void updateAlertActionPublishers(Alert alert) {
    // Delete existing alert action publisher and create with the updated Alert
    // if some alerts are removed or added
    deleteAlertAllPublishers(alert.getId());
    addAlertActionPublishers(alert);
  }

  @SneakyThrows
  public void updateAllAlertUsingAlertAction(AlertAction alertAction) {
    List<CollectionDAO.EntityRelationshipRecord> records =
        daoCollection
            .relationshipDAO()
            .findFrom(alertAction.getId().toString(), ALERT_ACTION, CONTAINS.ordinal(), ALERT);
    EntityRepository<Alert> alertEntityRepository = Entity.getEntityRepository(ALERT);
    for (CollectionDAO.EntityRelationshipRecord record : records) {
      deleteAlertAllPublishers(record.getId());
      Alert alert = alertEntityRepository.get(null, record.getId(), alertEntityRepository.getFields("*"));
      addAlertActionPublisher(alert, alertAction);
    }
  }

  @SneakyThrows
  public void deleteAlertActionFromAllAlertPublisher(AlertAction alertAction) {
    List<CollectionDAO.EntityRelationshipRecord> records =
        daoCollection
            .relationshipDAO()
            .findFrom(alertAction.getId().toString(), ALERT_ACTION, CONTAINS.ordinal(), ALERT);
    for (CollectionDAO.EntityRelationshipRecord record : records) {
      deleteAlertActionPublisher(record.getId(), alertAction);
    }
  }

  public void deleteAlertActionPublisher(UUID alertId, AlertAction action) throws InterruptedException {
    Map<UUID, AlertsActionPublisher> alertActionPublishers = alertPublisherMap.get(alertId);
    if (alertActionPublishers != null) {
      AlertsActionPublisher alertsActionPublisher = alertActionPublishers.get(action.getId());
      if (alertsActionPublisher != null) {
        alertsActionPublisher.getProcessor().halt();
        alertsActionPublisher.awaitShutdown();
        EventPubSub.removeProcessor(alertsActionPublisher.getProcessor());
        LOG.info("Alert publisher deleted for {}", alertsActionPublisher.getAlert().getName());

        alertActionPublishers.remove(action.getId());
        removeAlertStatus(alertId, action.getId());
        alertPublisherMap.put(alertId, alertActionPublishers);
      }
    }
  }

  public void deleteAlertAllPublishers(UUID alertId) throws InterruptedException {
    Map<UUID, AlertsActionPublisher> alertPublishers = alertPublisherMap.get(alertId);
    if (alertPublishers != null) {
      for (AlertsActionPublisher publisher : alertPublishers.values()) {
        publisher.getProcessor().halt();
        publisher.awaitShutdown();
        EventPubSub.removeProcessor(publisher.getProcessor());
        LOG.info("Alert publisher deleted for {}", publisher.getAlert().getName());
      }
      alertPublisherMap.remove(alertId);
      removeAllAlertStatus(alertId);
    }
  }
}
