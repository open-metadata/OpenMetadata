package org.openmetadata.service.alerts;

import static org.openmetadata.service.Entity.ALERT_ACTION;

import com.lmax.disruptor.BatchEventProcessor;
import java.io.IOException;
import java.util.ArrayList;
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
import org.openmetadata.service.jdbi3.AlertActionRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;

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
    AlertActionRepository alertActionRepository = (AlertActionRepository) Entity.getEntityRepository(ALERT_ACTION);
    for (EntityReference alertActionRef : alert.getAlertActions()) {
      AlertAction action =
          alertActionRepository.get(null, alertActionRef.getId(), alertActionRepository.getFields("*"));
      addAlertActionPublisher(alert, action);
    }
  }

  public AlertActionStatus getStatus(UUID alertId, UUID actionID) {
    Map<UUID, AlertsActionPublisher> alertsActionPublisherMap = alertPublisherMap.get(alertId);
    if (alertsActionPublisherMap != null) {
      AlertsActionPublisher pub = alertsActionPublisherMap.get(actionID);
      if (pub != null) {
        return pub.getAlertAction().getStatusDetails();
      }
    }
    return null;
  }

  public void addAlertActionPublisher(Alert alert, AlertAction alertAction) {
    // Activity Feed AlertAction Cannot be Created
    if (alertAction.getAlertActionType() == AlertAction.AlertActionType.ACTIVITY_FEED) {
      LOG.info("Activity Feed Alert Action cannot be created.");
      return;
    }
    // Create AlertAction Publisher
    AlertsActionPublisher publisher = AlertUtil.getAlertPublisher(alert, alertAction, daoCollection);
    if (Boolean.TRUE.equals(alertAction.getEnabled())) {
      BatchEventProcessor<EventPubSub.ChangeEventHolder> processor = EventPubSub.addEventHandler(publisher);
      publisher.setProcessor(processor);
      LOG.info("Alert publisher started for {}", alert.getName());
    } else {
      // Only add alert that is enabled for publishing events
      AlertActionStatus status =
          new AlertActionStatus()
              .withStatus(AlertActionStatus.Status.DISABLED)
              .withTimestamp(System.currentTimeMillis())
              .withFailureDetails(null);
      alertAction.setStatusDetails(status);
    }

    Map<UUID, AlertsActionPublisher> alertsActionPublisherMap =
        alertPublisherMap.get(alert.getId()) == null ? new HashMap<>() : alertPublisherMap.get(alert.getId());
    alertsActionPublisherMap.put(alertAction.getId(), publisher);
    alertPublisherMap.put(alert.getId(), alertsActionPublisherMap);
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
    List<AlertsActionPublisher> publishers = getAlertPublisherFromAlertAction(alertAction.getId());
    // Avoid handling from DB
    if (publishers.size() != 0) {
      for (AlertsActionPublisher publisher : publishers) {
        Alert alert = publisher.getAlert();
        AlertAction action = publisher.getAlertAction();
        deleteAlertAllPublishers(alert.getId());
        if (action.getId().equals(alertAction.getId())) {
          addAlertActionPublisher(alert, alertAction);
        } else {
          addAlertActionPublisher(alert, action);
        }
      }
    }
  }

  public List<AlertsActionPublisher> getAlertPublisherFromAlertAction(UUID alertActionId) {
    List<AlertsActionPublisher> publisherManagers = new ArrayList<>();
    for (Map.Entry<UUID, Map<UUID, AlertsActionPublisher>> alertValues : alertPublisherMap.entrySet()) {
      if (alertValues.getValue().containsKey(alertActionId)) {
        publisherManagers.add(alertValues.getValue().get(alertActionId));
      }
    }
    return publisherManagers;
  }

  @SneakyThrows
  public void deleteAlertActionFromAllAlertPublisher(AlertAction alertAction) {
    List<AlertsActionPublisher> publishers = getAlertPublisherFromAlertAction(alertAction.getId());
    // Avoid handling from DB
    if (publishers.size() != 0) {
      for (AlertsActionPublisher alertsActionPublisher : publishers) {
        if (alertsActionPublisher != null) {
          deleteProcessorFromPubSub(alertsActionPublisher);
          UUID alertId = alertsActionPublisher.getAlert().getId();
          Map<UUID, AlertsActionPublisher> alertActionPublishersMap = alertPublisherMap.get(alertId);
          alertActionPublishersMap.remove(alertAction.getId());
          alertPublisherMap.put(alertId, alertActionPublishersMap);
        }
      }
    }
  }

  public void deleteProcessorFromPubSub(AlertsActionPublisher publisher) throws InterruptedException {
    BatchEventProcessor<EventPubSub.ChangeEventHolder> processor = publisher.getProcessor();
    if (processor != null) {
      processor.halt();
      publisher.awaitShutdown();
      EventPubSub.removeProcessor(publisher.getProcessor());
      LOG.info("Alert publisher deleted for {}", publisher.getAlert().getName());
    }
  }

  public void deleteAlertAllPublishers(UUID alertId) throws InterruptedException {
    Map<UUID, AlertsActionPublisher> alertPublishers = alertPublisherMap.get(alertId);
    if (alertPublishers != null) {
      for (AlertsActionPublisher publisher : alertPublishers.values()) {
        deleteProcessorFromPubSub(publisher);
      }
      alertPublisherMap.remove(alertId);
    }
  }
}
