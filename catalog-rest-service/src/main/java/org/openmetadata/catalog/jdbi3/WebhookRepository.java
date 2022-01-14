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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.util.EntityUtil.failureDetailsMatch;

import com.lmax.disruptor.BatchEventProcessor;
import com.lmax.disruptor.EventHandler;
import com.lmax.disruptor.LifecycleAware;
import java.io.IOException;
import java.net.URI;
import java.net.UnknownHostException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javax.ws.rs.ProcessingException;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Invocation.Builder;
import javax.ws.rs.core.Response;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.events.EventPubSub;
import org.openmetadata.catalog.events.EventPubSub.ChangeEventHolder;
import org.openmetadata.catalog.resources.events.EventResource.ChangeEventList;
import org.openmetadata.catalog.resources.events.WebhookResource;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FailureDetails;
import org.openmetadata.catalog.type.Webhook;
import org.openmetadata.catalog.type.Webhook.Status;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.common.utils.CommonUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class WebhookRepository extends EntityRepository<Webhook> {
  public static final Logger LOG = LoggerFactory.getLogger(WebhookRepository.class);
  private static final ConcurrentHashMap<UUID, WebhookPublisher> webhookPublisherMap = new ConcurrentHashMap<>();

  public WebhookRepository(CollectionDAO dao) {
    super(
        WebhookResource.COLLECTION_PATH,
        Entity.WEBHOOK,
        Webhook.class,
        dao.webhookDAO(),
        dao,
        Fields.EMPTY_FIELDS,
        Fields.EMPTY_FIELDS,
        false,
        false,
        false);
  }

  @Override
  public EntityInterface<Webhook> getEntityInterface(Webhook entity) {
    return new WebhookEntityInterface(entity);
  }

  @Override
  public Webhook setFields(Webhook entity, Fields fields) throws IOException, ParseException {
    return entity; // No fields to set
  }

  @Override
  public void prepare(Webhook entity) throws IOException {
    // Nothing to prepare
  }

  @Override
  public void storeEntity(Webhook entity, boolean update) throws IOException {
    entity.setHref(null);
    store(entity.getId(), entity, update);
  }

  @Override
  public void storeRelationships(Webhook entity) {
    // No relationship to store
  }

  @Override
  public void restorePatchAttributes(Webhook original, Webhook updated) {
    updated.withId(original.getId()).withName(original.getName());
  }

  @Override
  public EntityRepository<Webhook>.EntityUpdater getUpdater(Webhook original, Webhook updated, boolean patchOperation) {
    return new WebhookUpdater(original, updated, patchOperation);
  }

  private WebhookPublisher getPublisher(UUID id) {
    return webhookPublisherMap.get(id);
  }

  public void addWebhookPublisher(Webhook webhook) {
    if (Boolean.FALSE.equals(webhook.getEnabled())) { // Only add webhook that is enabled for publishing events
      webhook.setStatus(Status.NOT_STARTED);
      return;
    }
    WebhookPublisher publisher = new WebhookPublisher(webhook);
    BatchEventProcessor<ChangeEventHolder> processor = EventPubSub.addEventHandler(publisher);
    publisher.setProcessor(processor);
    webhookPublisherMap.put(webhook.getId(), publisher);
    LOG.info("Webhook subscription started for {}", webhook.getName());
  }

  public void updateWebhookPublisher(Webhook webhook) throws InterruptedException {
    if (Boolean.TRUE.equals(webhook.getEnabled())) { // Only add webhook that is enabled for publishing
      // If there was a previous webhook either in disabled state or stopped due
      // to errors, update it and restart publishing
      WebhookPublisher previousPublisher = getPublisher(webhook.getId());
      if (previousPublisher == null) {
        addWebhookPublisher(webhook);
        return;
      }

      // Update the existing publisher
      Status status = previousPublisher.getWebhook().getStatus();
      previousPublisher.updateWebhook(webhook);
      if (status != Status.STARTED && status != Status.AWAITING_RETRY) {
        // Restart the previously stopped publisher (in states notStarted, error, retryLimitReached)
        BatchEventProcessor<ChangeEventHolder> processor = EventPubSub.addEventHandler(previousPublisher);
        previousPublisher.setProcessor(processor);
        LOG.info("Webhook publisher restarted for {}", webhook.getName());
      }
    } else {
      // Remove the webhook publisher
      deleteWebhookPublisher(webhook.getId());
    }
  }

  public void deleteWebhookPublisher(UUID id) throws InterruptedException {
    WebhookPublisher publisher = webhookPublisherMap.get(id);
    if (publisher != null) {
      publisher.getProcessor().halt();
      publisher.awaitShutdown();
      EventPubSub.removeProcessor(publisher.getProcessor());
      LOG.info("Webhook publisher deleted for {}", publisher.getWebhook().getName());
    }
    webhookPublisherMap.remove(id);
  }

  @Transaction
  public boolean delete(String id) {
    return daoCollection.webhookDAO().delete(UUID.fromString(id)) > 0;
  }

  public static class WebhookEntityInterface implements EntityInterface<Webhook> {
    private final Webhook entity;

    public WebhookEntityInterface(Webhook entity) {
      this.entity = entity;
    }

    @Override
    public UUID getId() {
      return entity.getId();
    }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getName();
    }

    @Override
    public Boolean isDeleted() {
      return entity.getDeleted();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getName();
    }

    @Override
    public Double getVersion() {
      return entity.getVersion();
    }

    @Override
    public String getUpdatedBy() {
      return entity.getUpdatedBy();
    }

    @Override
    public long getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.WEBHOOK);
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public Webhook getEntity() {
      return entity;
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public void setId(UUID id) {
      entity.setId(id);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      /* No display name */
    }

    @Override
    public void setUpdateDetails(String updatedBy, long updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public Webhook withHref(URI href) {
      return entity.withHref(href);
    }
  }

  /**
   * WebhookPublisher publishes events to the webhook endpoint using POST http requests. There is one instance of
   * WebhookPublisher per webhook subscription. Each WebhookPublish is an EventHandler that runs in a separate thread
   * and receives events from LMAX Disruptor {@link EventPubSub} through {@link BatchEventProcessor}.
   *
   * <p>The failures during callback to Webhook endpoints are handled in this class as follows:
   *
   * <ul>
   *   <li>Webhook with unresolvable URLs are marked as "failed" and no further attempt is made to deliver the events
   *   <li>Webhook callbacks that return 3xx are marked as "failed" and no further attempt is made to deliver the events
   *   <li>Webhook callbacks that return 4xx, 5xx, or timeout are marked as "awaitingRetry" and 5 retry attempts are
   *       made to deliver the events with the following backoff - 3 seconds, 30 seconds, 5 minutes, 1 hours, and 24
   *       hour. When all the 5 delivery attempts fail, the webhook state is marked as "retryLimitReached" and no
   *       further attempt is made to deliver the events.
   * </ul>
   */
  public class WebhookPublisher implements EventHandler<ChangeEventHolder>, LifecycleAware {
    // Backoff timeout in seconds. Delivering events is retried 5 times.
    private static final int BACKOFF_NORMAL = 0;
    private static final int BACKOFF_3_SECONDS = 3 * 1000;
    private static final int BACKOFF_30_SECONDS = 30 * 1000;
    private static final int BACKOFF_5_MINUTES = 5 * 60 * 1000;
    private static final int BACKOFF_1_HOUR = 60 * 60 * 1000;
    private static final int BACKOFF_24_HOUR = 24 * 60 * 60 * 1000;

    private int currentBackoffTime = BACKOFF_NORMAL;
    private final CountDownLatch shutdownLatch = new CountDownLatch(1);
    private final Webhook webhook;
    private final List<ChangeEvent> batch = new ArrayList<>();
    private BatchEventProcessor<ChangeEventHolder> processor;
    private Client client;
    private final ConcurrentHashMap<EventType, List<String>> filter = new ConcurrentHashMap<>();

    public WebhookPublisher(Webhook webhook) {
      this.webhook = webhook;
      initFilter();
    }

    @Override
    public void onStart() {
      createClient();
      webhook.withFailureDetails(new FailureDetails());
      LOG.info("Webhook-lifecycle-onStart {}", webhook.getName());
    }

    @Override
    public void onEvent(ChangeEventHolder changeEventHolder, long sequence, boolean endOfBatch) throws Exception {
      // Ignore events that don't match the webhook event filters
      ChangeEvent changeEvent = changeEventHolder.get();
      List<String> entities = filter.get(changeEvent.getEventType());
      if (entities == null || (!entities.get(0).equals("*") && !entities.contains(changeEvent.getEntityType()))) {
        return;
      }

      // Batch until either the batch has ended or batch size has reached the max size
      batch.add(changeEventHolder.get());
      if (!endOfBatch && batch.size() < webhook.getBatchSize()) {
        return;
      }

      ChangeEventList list = new ChangeEventList(batch, null, null, batch.size());
      long attemptTime = System.currentTimeMillis();
      try {
        String json = JsonUtils.pojoToJson(list);
        Response response;
        if (webhook.getSecretKey() != null) {
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
          batch.clear();
          webhook.getFailureDetails().setLastSuccessfulAt(changeEventHolder.get().getTimestamp());
          if (webhook.getStatus() != Status.STARTED) {
            setStatus(Status.STARTED, null, null, null, null);
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
      } catch (ProcessingException ex) {
        Throwable cause = ex.getCause();
        if (cause.getClass() == UnknownHostException.class) {
          LOG.warn("Invalid webhook {} endpoint {}", webhook.getName(), webhook.getEndpoint());
          setErrorStatus(attemptTime, null, "UnknownHostException");
        }
      }
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
      initFilter();
      createClient();
    }

    private void initFilter() {
      filter.clear();
      webhook.getEventFilters().forEach(f -> filter.put(f.getEventType(), f.getEntities()));
    }

    private void setErrorStatus(Long attemptTime, Integer statusCode, String reason) throws IOException {
      if (!attemptTime.equals(webhook.getFailureDetails().getLastFailedAt())) {
        setStatus(Status.FAILED, attemptTime, statusCode, reason, null);
      }
      throw new RuntimeException(reason);
    }

    private void setAwaitingRetry(Long attemptTime, int statusCode, String reason) throws IOException {
      if (!attemptTime.equals(webhook.getFailureDetails().getLastFailedAt())) {
        setStatus(Status.AWAITING_RETRY, attemptTime, statusCode, reason, attemptTime + currentBackoffTime);
      }
    }

    private void setStatus(Status status, Long attemptTime, Integer statusCode, String reason, Long timestamp)
        throws IOException {
      Webhook stored = daoCollection.webhookDAO().findEntityById(webhook.getId());
      webhook.setStatus(status);
      webhook
          .getFailureDetails()
          .withLastFailedAt(attemptTime)
          .withLastFailedStatusCode(statusCode)
          .withLastFailedReason(reason)
          .withNextAttempt(timestamp);
      WebhookUpdater updater = new WebhookUpdater(stored, webhook, false);
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

    private void awaitShutdown() throws InterruptedException {
      LOG.info("Awaiting shutdown webhook-lifecycle {}", webhook.getName());
      shutdownLatch.await();
    }

    public void setProcessor(BatchEventProcessor<ChangeEventHolder> processor) {
      this.processor = processor;
    }

    public BatchEventProcessor<ChangeEventHolder> getProcessor() {
      return processor;
    }

    private void setNextBackOff() {
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

    private Builder getTarget() {
      Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
      return SecurityUtil.addHeaders(client.target(webhook.getEndpoint()), authHeaders);
    }
  }

  public class WebhookUpdater extends EntityUpdater {
    public WebhookUpdater(Webhook original, Webhook updated, boolean patchOperation) {
      super(original, updated, patchOperation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      Webhook origWebhook = original.getEntity();
      Webhook updatedWebhook = updated.getEntity();

      recordChange("enabled", origWebhook.getEnabled(), updatedWebhook.getEnabled());
      recordChange("status", origWebhook.getStatus(), updatedWebhook.getStatus());
      recordChange("endPoint", origWebhook.getEndpoint(), updatedWebhook.getEndpoint());
      recordChange("batchSize", origWebhook.getBatchSize(), updatedWebhook.getBatchSize());
      if (fieldsChanged()) {
        // If updating the other fields, opportunistically use it to capture failure details
        WebhookPublisher publisher = WebhookRepository.this.getPublisher(origWebhook.getId());
        if (publisher != null && updatedWebhook != publisher.getWebhook()) {
          updatedWebhook
              .withStatus(publisher.getWebhook().getStatus())
              .withFailureDetails(publisher.getWebhook().getFailureDetails());
          if (Boolean.FALSE.equals(updatedWebhook.getEnabled())) {
            updatedWebhook.setStatus(Status.NOT_STARTED);
          }
        }
        recordChange(
            "failureDetails",
            origWebhook.getFailureDetails(),
            updatedWebhook.getFailureDetails(),
            true,
            failureDetailsMatch);
      }
    }
  }
}
