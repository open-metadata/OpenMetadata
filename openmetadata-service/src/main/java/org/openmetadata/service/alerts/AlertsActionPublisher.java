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

package org.openmetadata.service.alerts;

import com.lmax.disruptor.BatchEventProcessor;
import java.io.IOException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javax.ws.rs.core.Response;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.alerts.Alert;
import org.openmetadata.schema.entity.alerts.AlertAction;
import org.openmetadata.schema.entity.alerts.AlertActionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.FailureDetails;
import org.openmetadata.service.events.EventPubSub;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.AlertRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.events.EventResource;

/**
 * AlertsPublisher publishes events to the alert endpoint using POST http requests/ Email. There is one instance of
 * AlertsPublisher per alert subscription. Each AlertsPublisher is an EventHandler that runs in a separate thread and
 * receives events from LMAX Disruptor {@link EventPubSub} through {@link BatchEventProcessor}.
 *
 * <p>The failures during callback to Alert are handled in this class as follows:
 *
 * <ul>
 *   <li>Alerts with unresolvable URLs are marked as "failed" and no further attempt is made to deliver the events
 *   <li>Alerts callbacks that return 3xx are marked as "failed" and no further attempt is made to deliver the events
 *   <li>Alerts callbacks that return 4xx, 5xx, or timeout are marked as "awaitingRetry" and 5 retry attempts are made
 *       to deliver the events with the following backoff - 3 seconds, 30 seconds, 5 minutes, 1 hours, and 24 hour. When
 *       all the 5 delivery attempts fail, the alerts state is marked as "retryLimitReached" and no further attempt is
 *       made to deliver the events.
 * </ul>
 */
@Slf4j
public class AlertsActionPublisher extends AbstractAlertPublisher {
  private final CountDownLatch shutdownLatch = new CountDownLatch(1);
  private BatchEventProcessor<EventPubSub.ChangeEventHolder> processor;
  private final AlertRepository alertRepository;

  public AlertsActionPublisher(Alert alert, AlertAction alertAction, CollectionDAO dao) {
    super(alert, alertAction);
    this.alertRepository = new AlertRepository(dao);
  }

  @SneakyThrows
  @Override
  public void onStart() {
    AlertActionStatus currentStatus =
        new AlertActionStatus()
            .withStatus(AlertActionStatus.Status.ACTIVE)
            .withFailureDetails(new FailureDetails())
            .withTimestamp(System.currentTimeMillis());
    setStatus(currentStatus);
    onStartDelegate();
    LOG.info("Alert-lifecycle-onStart {}", alert.getName());
  }

  @Override
  public void onShutdown() {
    currentBackoffTime = BACKOFF_NORMAL;
    shutdownLatch.countDown();
    onShutdownDelegate();
    LOG.info("Alert-lifecycle-onShutdown {}", alert.getName());
  }

  public synchronized Alert getAlert() {
    return alert;
  }

  public synchronized AlertAction getAlertAction() {
    return alertAction;
  }

  public synchronized void updateAlertWithAlertAction(Alert updatedAlert, AlertAction updatedAlertAction) {
    currentBackoffTime = BACKOFF_NORMAL;
    // Alert Update
    alert.setDescription(updatedAlert.getDescription());
    updateTriggerConfig(updatedAlert);
    alert.setFilteringRules(updatedAlert.getFilteringRules());
    alert.setAlertActions(updatedAlert.getAlertActions());

    // AlertAction Update
    alertAction.setDescription(updatedAlertAction.getDescription());
    alertAction.setReadTimeout(updatedAlertAction.getReadTimeout());
    alertAction.setTimeout(updatedAlertAction.getTimeout());
    alertAction.setBatchSize(updatedAlertAction.getBatchSize());
  }

  public synchronized void updateTriggerConfig(Alert updatedAlert) {
    // Update Trigger Config and Filtering
    alert.setTriggerConfig(updatedAlert.getTriggerConfig());
    filter.clear();
    updateFilter(alert.getTriggerConfig().getEventFilters());
  }

  protected void setErrorStatus(Long attemptTime, Integer statusCode, String reason)
      throws IOException, InterruptedException {
    if (!attemptTime.equals(alertAction.getStatusDetails().getFailureDetails().getLastFailedAt())) {
      setStatus(AlertActionStatus.Status.FAILED, attemptTime, statusCode, reason, null);
    }
    alertRepository.deleteAlertActionPublisher(alert.getId(), alertAction);
    throw new RuntimeException(reason);
  }

  protected void setAwaitingRetry(Long attemptTime, int statusCode, String reason) throws IOException {
    if (!attemptTime.equals(alertAction.getStatusDetails().getFailureDetails().getLastFailedAt())) {
      setStatus(
          AlertActionStatus.Status.AWAITING_RETRY, attemptTime, statusCode, reason, attemptTime + currentBackoffTime);
    }
  }

  protected void setStatus(
      AlertActionStatus.Status status, Long attemptTime, Integer statusCode, String reason, Long timestamp)
      throws IOException {
    FailureDetails details =
        alertAction.getStatusDetails().getFailureDetails() != null
            ? alertAction.getStatusDetails().getFailureDetails()
            : new FailureDetails();
    details
        .withLastFailedAt(attemptTime)
        .withLastFailedStatusCode(statusCode)
        .withLastFailedReason(reason)
        .withNextAttempt(timestamp);
    AlertActionStatus currentStatus =
        alertRepository.setStatus(alert.getId(), alertAction.getId(), status, details).withTimestamp(attemptTime);
    alertAction.setStatusDetails(currentStatus);
  }

  protected void setStatus(AlertActionStatus status) throws IOException {
    alertRepository.setStatus(alert.getId(), alertAction.getId(), status);
    alertAction.setStatusDetails(status);
  }

  public void awaitShutdown() throws InterruptedException {
    LOG.info("Awaiting shutdown alertActionPublisher-lifecycle {}", alert.getName());
    shutdownLatch.await(5, TimeUnit.SECONDS);
  }

  public void setProcessor(BatchEventProcessor<EventPubSub.ChangeEventHolder> processor) {
    this.processor = processor;
  }

  public BatchEventProcessor<EventPubSub.ChangeEventHolder> getProcessor() {
    return processor;
  }

  protected void sendAlert(ChangeEvent event) throws IOException, InterruptedException {}

  protected void onStartDelegate() {}

  protected void onShutdownDelegate() {}

  @Override
  public void publish(EventResource.ChangeEventList list)
      throws EventPublisherException, IOException, InterruptedException {
    for (ChangeEvent event : list.getData()) {
      // Publish to the given Alert Actions
      try {
        LOG.info("Sending Alert {}:{}:{}", alert.getName(), alertAction.getStatusDetails().getStatus(), batch.size());
        sendAlert(event);
        // Successfully sent Alert, update Status
        alertAction.getStatusDetails().getFailureDetails().setLastSuccessfulAt(System.currentTimeMillis());
        if (alertAction.getStatusDetails().getStatus() != AlertActionStatus.Status.ACTIVE) {
          setStatus(AlertActionStatus.Status.ACTIVE, System.currentTimeMillis(), null, null, null);
        }
      } catch (Exception ex) {
        LOG.warn("Invalid Exception in Alert {}", alert.getName());
        setErrorStatus(
            System.currentTimeMillis(), Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(), ex.getMessage());
      }
    }
  }
}
