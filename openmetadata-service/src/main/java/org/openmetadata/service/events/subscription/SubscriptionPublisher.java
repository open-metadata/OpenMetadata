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

package org.openmetadata.service.events.subscription;

import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.ACTIVE;
import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.AWAITING_RETRY;
import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.FAILED;

import com.lmax.disruptor.BatchEventProcessor;
import java.io.IOException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.service.events.EventPubSub;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.resources.events.EventResource;

/**
 * SubscriptionPublisher publishes events to the alert ndpoint using POST http requests/ Email. There is one instance of
 * SubscriptionPublisher per alert subscription. Each SubscriptionPublisher is an EventHandler that runs in a separate
 * thread and receives events from LMAX Disruptor {@link EventPubSub} through {@link BatchEventProcessor}.
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
public class SubscriptionPublisher extends AbstractEventSubscriptionPublisher {
  private final CountDownLatch shutdownLatch = new CountDownLatch(1);
  @Getter private BatchEventProcessor<EventPubSub.ChangeEventHolder> processor;
  private final CollectionDAO daoCollection;
  private final EventSubscriptionRepository eventSubscriptionRepository;

  public SubscriptionPublisher(EventSubscription eventSub, CollectionDAO dao) {
    super(eventSub);
    this.daoCollection = dao;
    this.eventSubscriptionRepository = new EventSubscriptionRepository(dao);
  }

  @SneakyThrows
  @Override
  public void onStart() {
    setSuccessStatus(System.currentTimeMillis());
    onStartDelegate();
    LOG.info("Alert-lifecycle-onStart {}", eventSubscribed.getName());
  }

  @Override
  public void onShutdown() {
    currentBackoffTime = BACKOFF_NORMAL;
    shutdownLatch.countDown();
    onShutdownDelegate();
    LOG.info("Alert-lifecycle-onShutdown {}", eventSubscribed.getName());
  }

  public synchronized EventSubscription getEventSubscription() {
    return eventSubscribed;
  }

  public synchronized void updateEventSubscription(EventSubscription updatedEventSub) {
    currentBackoffTime = BACKOFF_NORMAL;
    eventSubscribed.setDescription(updatedEventSub.getDescription());
    eventSubscribed.setTimeout(updatedEventSub.getTimeout());
    eventSubscribed.setBatchSize(updatedEventSub.getBatchSize());
    eventSubscribed.setFilteringRules(updatedEventSub.getFilteringRules());
    eventSubscribed.setSubscriptionType(updatedEventSub.getSubscriptionType());
    eventSubscribed.setSubscriptionConfig(updatedEventSub.getSubscriptionConfig());
  }

  protected void setErrorStatus(Long attemptTime, Integer statusCode, String reason)
      throws IOException, InterruptedException {
    if (!attemptTime.equals(eventSubscribed.getStatusDetails().getLastFailedAt())) {
      setStatus(FAILED, attemptTime, statusCode, reason, null);
    }
    eventSubscriptionRepository.deleteEventSubscriptionPublisher(eventSubscribed.getId());
    throw new RuntimeException(reason);
  }

  protected void setAwaitingRetry(Long attemptTime, int statusCode, String reason) throws IOException {
    if (!attemptTime.equals(eventSubscribed.getStatusDetails().getLastFailedAt())) {
      setStatus(AWAITING_RETRY, attemptTime, statusCode, reason, attemptTime + currentBackoffTime);
    }
  }

  protected void setStatus(
      SubscriptionStatus.Status status, Long attemptTime, Integer statusCode, String reason, Long timestamp)
      throws IOException {
    EventSubscription stored = daoCollection.eventSubscriptionDAO().findEntityById(eventSubscribed.getId());
    SubscriptionStatus subStatus =
        new SubscriptionStatus()
            .withStatus(status)
            .withLastFailedAt(attemptTime)
            .withLastFailedStatusCode(statusCode)
            .withLastFailedReason(reason)
            .withNextAttempt(timestamp)
            .withTimestamp(attemptTime);
    stored.setStatusDetails(subStatus);

    // Update
    EventSubscriptionRepository.EventSubscriptionUpdater updater =
        eventSubscriptionRepository.getUpdater(stored, stored, EntityRepository.Operation.PUT);
    updater.update();
  }

  protected void setSuccessStatus(Long updateTime) {
    SubscriptionStatus status =
        new SubscriptionStatus().withStatus(ACTIVE).withLastSuccessfulAt(updateTime).withTimestamp(updateTime);

    // TODO: Fix
    eventSubscribed.setStatusDetails(status);
  }

  public void awaitShutdown() throws InterruptedException {
    LOG.info("Awaiting shutdown alertActionPublisher-lifecycle {}", eventSubscribed.getName());
    shutdownLatch.await(5, TimeUnit.SECONDS);
  }

  public void setProcessor(BatchEventProcessor<EventPubSub.ChangeEventHolder> processor) {
    this.processor = processor;
  }

  protected void sendAlert(EventResource.ChangeEventList list) throws IOException, InterruptedException {}

  protected void onStartDelegate() {}

  protected void onShutdownDelegate() {}

  @Override
  public void publish(EventResource.ChangeEventList list) throws EventPublisherException {
    // Publish to the given Alert Actions
    try {
      LOG.info(
          "Sending Alert {}:{}:{}",
          eventSubscribed.getName(),
          eventSubscribed.getStatusDetails().getStatus(),
          batch.size());
      sendAlert(list);
    } catch (Exception ex) {
      LOG.warn("Invalid Exception in Alert {}", eventSubscribed.getName());
    }
  }
}
