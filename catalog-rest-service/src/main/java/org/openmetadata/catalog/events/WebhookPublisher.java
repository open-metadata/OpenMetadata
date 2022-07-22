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

package org.openmetadata.catalog.events;

import com.lmax.disruptor.BatchEventProcessor;
import java.io.IOException;
import java.net.UnknownHostException;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.events.errors.EventPublisherException;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.jdbi3.WebhookRepository;
import org.openmetadata.catalog.jdbi3.WebhookRepository.WebhookUpdater;
import org.openmetadata.catalog.resources.events.EventResource;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.FailureDetails;
import org.openmetadata.catalog.type.Webhook;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.common.utils.CommonUtil;

/**
 * WebhookPublisher publishes events to the webhook endpoint using POST http requests. There is one instance of
 * WebhookPublisher per webhook subscription. Each WebhookPublish is an EventHandler that runs in a separate thread and
 * receives events from LMAX Disruptor {@link EventPubSub} through {@link BatchEventProcessor}.
 *
 * <p>The failures during callback to Webhook endpoints are handled in this class as follows:
 *
 * <ul>
 *   <li>Webhook with unresolvable URLs are marked as "failed" and no further attempt is made to deliver the events
 *   <li>Webhook callbacks that return 3xx are marked as "failed" and no further attempt is made to deliver the events
 *   <li>Webhook callbacks that return 4xx, 5xx, or timeout are marked as "awaitingRetry" and 5 retry attempts are made
 *       to deliver the events with the following backoff - 3 seconds, 30 seconds, 5 minutes, 1 hours, and 24 hour. When
 *       all the 5 delivery attempts fail, the webhook state is marked as "retryLimitReached" and no further attempt is
 *       made to deliver the events.
 * </ul>
 */
@Slf4j
public class WebhookPublisher extends AbstractEventPublisher {
  private final CountDownLatch shutdownLatch = new CountDownLatch(1);
  private final Webhook webhook;
  private BatchEventProcessor<EventPubSub.ChangeEventHolder> processor;
  private Client client;
  private CollectionDAO daoCollection;

  private WebhookRepository webhookRepository;

  public WebhookPublisher(Webhook webhook, CollectionDAO dao) {
    super(webhook.getBatchSize(), webhook.getEventFilters());
    this.webhook = webhook;
    this.daoCollection = dao;
    this.webhookRepository = new WebhookRepository(dao);
  }

  @Override
  public void onStart() {
    createClient();
    webhook.withFailureDetails(new FailureDetails());
    LOG.info("Webhook-lifecycle-onStart {}", webhook.getName());
  }

  @Override
  public void onShutdown() {
    currentBackoffTime = BACKOFF_NORMAL;
    client.close();
    client = null;
    shutdownLatch.countDown();
    LOG.info("Webhook-lifecycle-onShutdown {}", webhook.getName());
  }

  public synchronized Webhook getWebhook() {
    return webhook;
  }

  public synchronized void updateWebhook(Webhook updatedWebhook) {
    currentBackoffTime = BACKOFF_NORMAL;
    webhook.setTimeout(updatedWebhook.getTimeout());
    webhook.setBatchSize(updatedWebhook.getBatchSize());
    webhook.setEndpoint(updatedWebhook.getEndpoint());
    webhook.setEventFilters(updatedWebhook.getEventFilters());
    updateFilter();
    createClient();
  }

  private void updateFilter() {
    filter.clear();
    webhook.getEventFilters().forEach(f -> filter.put(f.getEventType(), f.getEntities()));
  }

  private void setErrorStatus(Long attemptTime, Integer statusCode, String reason) throws IOException {
    if (!attemptTime.equals(webhook.getFailureDetails().getLastFailedAt())) {
      setStatus(Webhook.Status.FAILED, attemptTime, statusCode, reason, null);
    }
    throw new RuntimeException(reason);
  }

  private void setAwaitingRetry(Long attemptTime, int statusCode, String reason) throws IOException {
    if (!attemptTime.equals(webhook.getFailureDetails().getLastFailedAt())) {
      setStatus(Webhook.Status.AWAITING_RETRY, attemptTime, statusCode, reason, attemptTime + currentBackoffTime);
    }
  }

  private void setStatus(Webhook.Status status, Long attemptTime, Integer statusCode, String reason, Long timestamp)
      throws IOException {
    Webhook stored = daoCollection.webhookDAO().findEntityById(webhook.getId());
    webhook.setStatus(status);
    webhook
        .getFailureDetails()
        .withLastFailedAt(attemptTime)
        .withLastFailedStatusCode(statusCode)
        .withLastFailedReason(reason)
        .withNextAttempt(timestamp);

    // TODO: Fix this
    WebhookUpdater updater = webhookRepository.getUpdater(stored, webhook, EntityRepository.Operation.PUT);
    updater.update();
  }

  private synchronized void createClient() {
    if (client != null) {
      client.close();
      client = null;
    }
    ClientBuilder clientBuilder = ClientBuilder.newBuilder();
    clientBuilder.connectTimeout(10, TimeUnit.SECONDS);
    clientBuilder.readTimeout(12, TimeUnit.SECONDS);
    client = clientBuilder.build();
  }

  public void awaitShutdown() throws InterruptedException {
    LOG.info("Awaiting shutdown webhook-lifecycle {}", webhook.getName());
    shutdownLatch.await(5, TimeUnit.SECONDS);
  }

  public void setProcessor(BatchEventProcessor<EventPubSub.ChangeEventHolder> processor) {
    this.processor = processor;
  }

  public BatchEventProcessor<EventPubSub.ChangeEventHolder> getProcessor() {
    return processor;
  }

  private Invocation.Builder getTarget() {
    Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
    return SecurityUtil.addHeaders(client.target(webhook.getEndpoint()), authHeaders);
  }

  @Override
  public void publish(EventResource.ChangeEventList list) throws EventPublisherException, IOException {
    long attemptTime = System.currentTimeMillis();
    try {
      String json = JsonUtils.pojoToJson(list);
      Response response;
      if (webhook.getSecretKey() != null && !webhook.getSecretKey().isEmpty()) {
        String hmac = "sha256=" + CommonUtil.calculateHMAC(webhook.getSecretKey(), json);
        response = getTarget().header(RestUtil.SIGNATURE_HEADER, hmac).post(javax.ws.rs.client.Entity.json(json));
      } else {
        response = getTarget().post(javax.ws.rs.client.Entity.json(json));
      }
      LOG.info(
          "Webhook {}:{}:{} received response {}",
          webhook.getName(),
          webhook.getStatus(),
          batch.size(),
          response.getStatusInfo());
      // 2xx response means call back is successful
      if (response.getStatus() >= 200 && response.getStatus() < 300) { // All 2xx responses
        webhook.getFailureDetails().setLastSuccessfulAt(batch.get(batch.size() - 1).getTimestamp());
        batch.clear();
        if (webhook.getStatus() != Webhook.Status.ACTIVE) {
          setStatus(Webhook.Status.ACTIVE, null, null, null, null);
        }
        // 3xx response/redirection is not allowed for callback. Set the webhook state as in error
      } else if (response.getStatus() >= 300 && response.getStatus() < 400) {
        setErrorStatus(attemptTime, response.getStatus(), response.getStatusInfo().getReasonPhrase());
        // 4xx, 5xx response retry delivering events after timeout
      } else if (response.getStatus() >= 300 && response.getStatus() < 600) {
        setNextBackOff();
        setAwaitingRetry(attemptTime, response.getStatus(), response.getStatusInfo().getReasonPhrase());
        Thread.sleep(currentBackoffTime);
      }
    } catch (Exception ex) {
      Throwable cause = ex.getCause();
      if (cause.getClass() == UnknownHostException.class) {
        LOG.warn("Invalid webhook {} endpoint {}", webhook.getName(), webhook.getEndpoint());
        setErrorStatus(attemptTime, null, "UnknownHostException");
      }
    }
  }
}
