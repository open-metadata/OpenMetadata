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
            .withFailureDetails(null)
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

  protected void setErrorStatus(Long updateTime, Integer statusCode, String reason)
      throws IOException, InterruptedException {
    setStatus(AlertActionStatus.Status.FAILED, updateTime, statusCode, reason, null);
    AlertsPublisherManager.getInstance().deleteAlertActionPublisher(alert.getId(), alertAction);
    throw new RuntimeException(reason);
  }

  protected void setAwaitingRetry(Long updateTime, int statusCode, String reason) throws IOException {
    setStatus(AlertActionStatus.Status.AWAITING_RETRY, updateTime, statusCode, reason, updateTime + currentBackoffTime);
  }

  protected void setSuccessStatus(Long updateTime) throws IOException {
    setStatus(AlertActionStatus.Status.ACTIVE, updateTime, 200, null, null);
  }

  protected void setStatus(
      AlertActionStatus.Status status, Long updateTime, Integer statusCode, String reason, Long nextAttemptTime)
      throws IOException {
    FailureDetails details = null;
    if (status != AlertActionStatus.Status.ACTIVE) {
      details = new FailureDetails();
      details
          .withLastFailedAt(updateTime)
          .withLastFailedStatusCode(statusCode)
          .withLastFailedReason(reason)
          .withNextAttempt(nextAttemptTime);
    }

    AlertActionStatus currentStatus =
        AlertsPublisherManager.getInstance().setStatus(alert.getId(), alertAction.getId(), status, details, updateTime);
    alertAction.setStatusDetails(currentStatus);
  }

  protected void setStatus(AlertActionStatus status) throws IOException {
    AlertsPublisherManager.getInstance().setStatus(alert.getId(), alertAction.getId(), status);
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
      } catch (Exception ex) {
        LOG.warn("Invalid Exception in Alert {}", alert.getName());
        setErrorStatus(
            System.currentTimeMillis(), Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(), ex.getMessage());
      }
    }
  }
}
