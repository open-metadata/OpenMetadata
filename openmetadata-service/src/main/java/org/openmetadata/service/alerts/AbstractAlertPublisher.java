package org.openmetadata.service.alerts;

import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.alerts.Alert;
import org.openmetadata.schema.entity.alerts.AlertAction;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.EventPubSub;
import org.openmetadata.service.events.EventPublisher;
import org.openmetadata.service.events.errors.RetriableException;
import org.openmetadata.service.resources.events.EventResource.ChangeEventList;

@Slf4j
public abstract class AbstractAlertPublisher implements EventPublisher {
  // Backoff timeout in seconds. Delivering events is retried 5 times.
  protected static final int BACKOFF_NORMAL = 0;
  protected static final int BACKOFF_3_SECONDS = 3 * 1000;
  protected static final int BACKOFF_30_SECONDS = 30 * 1000;
  protected static final int BACKOFF_5_MINUTES = 5 * 60 * 1000;
  protected static final int BACKOFF_1_HOUR = 60 * 60 * 1000;
  protected static final int BACKOFF_24_HOUR = 24 * 60 * 60 * 1000;
  protected int currentBackoffTime = BACKOFF_NORMAL;
  protected final List<ChangeEvent> batch = new ArrayList<>();

  protected final Alert alert;

  protected final AlertAction alertAction;
  private final int batchSize;

  protected AbstractAlertPublisher(Alert alert, AlertAction alertAction) {
    this.alert = alert;
    this.alertAction = alertAction;
    this.batchSize = alertAction.getBatchSize();
  }

  @Override
  public void onEvent(EventPubSub.ChangeEventHolder changeEventHolder, long sequence, boolean endOfBatch)
      throws Exception {
    // Ignore events that don't match the webhook event filters
    ChangeEvent changeEvent = changeEventHolder.getEvent();

    // Evaluate Alert Trigger Config
    if (!AlertUtil.shouldTriggerAlert(changeEvent.getEntityType(), alert.getTriggerConfig())) {
      return;
    }

    // Evaluate ChangeEvent Alert Filtering
    if (!AlertUtil.evaluateAlertConditions(changeEvent, alert.getFilteringRules())) {
      return;
    }

    // Batch until either the batch has ended or batch size has reached the max size
    batch.add(changeEventHolder.getEvent());
    if (!endOfBatch && batch.size() < batchSize) {
      return;
    }

    ChangeEventList list = new ChangeEventList(batch, null, null, batch.size());
    try {
      publish(list);
      batch.clear();
    } catch (RetriableException ex) {
      setNextBackOff();
      LOG.error("Failed to publish event in batch {} due to {}, will try again in {} ms", list, ex, currentBackoffTime);
      Thread.sleep(currentBackoffTime);
    } catch (Exception e) {
      LOG.error("[AbstractAlertPublisher] error {}", e.getMessage(), e);
    }
  }

  protected void setNextBackOff() {
    if (currentBackoffTime == BACKOFF_NORMAL) {
      currentBackoffTime = BACKOFF_3_SECONDS;
    } else if (currentBackoffTime == BACKOFF_3_SECONDS) {
      currentBackoffTime = BACKOFF_30_SECONDS;
    } else if (currentBackoffTime == BACKOFF_30_SECONDS) {
      currentBackoffTime = BACKOFF_5_MINUTES;
    } else if (currentBackoffTime == BACKOFF_5_MINUTES) {
      currentBackoffTime = BACKOFF_1_HOUR;
    } else if (currentBackoffTime == BACKOFF_1_HOUR) {
      currentBackoffTime = BACKOFF_24_HOUR;
    }
  }
}
