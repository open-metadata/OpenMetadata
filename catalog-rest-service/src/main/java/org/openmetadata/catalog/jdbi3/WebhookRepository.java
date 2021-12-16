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

import com.lmax.disruptor.BatchEventProcessor;
import com.lmax.disruptor.EventHandler;
import com.lmax.disruptor.LifecycleAware;
import java.io.IOException;
import java.net.URI;
import java.net.UnknownHostException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javax.ws.rs.ProcessingException;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Invocation.Builder;
import javax.ws.rs.core.MediaType;
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
import org.openmetadata.catalog.type.FailureDetails;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.Webhook;
import org.openmetadata.catalog.type.Webhook.Status;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.common.utils.CommonUtil;

public class WebhookRepository extends EntityRepository<Webhook> {
  private final CollectionDAO dao;
  private static final List<WebhookPublisher> webhookPublisherList = new ArrayList<>();

  public WebhookRepository(CollectionDAO dao) {
    super(
        WebhookResource.COLLECTION_PATH,
        Entity.WEBHOOK,
        Webhook.class,
        dao.webhookDAO(),
        dao,
        Fields.EMPTY_FIELDS,
        Fields.EMPTY_FIELDS);
    this.dao = dao;
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
    if (update) {
      dao.webhookDAO().update(entity.getId(), JsonUtils.pojoToJson(entity));
    } else {
      dao.webhookDAO().insert(entity);
    }
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
    return super.getUpdater(original, updated, patchOperation);
  }

  public void addWebhook(Webhook webhook) {
    WebhookPublisher publisher = new WebhookPublisher(webhook);
    BatchEventProcessor<ChangeEventHolder> processor = EventPubSub.addEventHandler(publisher);
    publisher.setProcessor(processor);
    webhookPublisherList.add(publisher);
    publisher.test();
    LOG.info("Webhook added for {}", webhook);
  }

  public static void deleteWebhook(UUID id) throws InterruptedException {
    Iterator<WebhookPublisher> iterator = webhookPublisherList.iterator();
    while (iterator.hasNext()) {
      WebhookPublisher publisher = iterator.next();
      if (publisher.getWebhook().getId().equals(id)) {
        iterator.remove();
        publisher.getProcessor().halt();
        publisher.awaitShutdown();
        EventPubSub.removeProcessor(publisher.getProcessor());
        LOG.info("Webhook deleted {}", publisher.getWebhook());
      }
    }
  }

  @Transaction
  public boolean delete(String id) {
    return dao.webhookDAO().delete(UUID.fromString(id)) > 0;
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
    public EntityReference getOwner() {
      return null;
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getName();
    }

    @Override
    public List<TagLabel> getTags() {
      return null;
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
    public Date getUpdatedAt() {
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
    public List<EntityReference> getFollowers() {
      return null;
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
    public void setDisplayName(String displayName) {}

    @Override
    public void setUpdateDetails(String updatedBy, Date updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setOwner(EntityReference owner) {}

    @Override
    public Webhook withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public void setTags(List<TagLabel> tags) {}
  }

  /** One webhook call back per webhook subscription */
  public class WebhookPublisher implements EventHandler<ChangeEventHolder>, LifecycleAware {
    // Backoff timeout in seconds
    private static final int BACKOFF_NORMAL = 0;
    private static final int BACKOFF_3_SECONDS = 3;
    private static final int BACKOFF_5_MINUTES = 5 * 60;
    private static final int BACKOFF_1_HOUR = 60 * 60;
    private static final int BACKOFF_24_HOUR = 24 * 60 * 60;

    private int currentBackoffTime = BACKOFF_NORMAL;
    private final CountDownLatch shutdownLatch = new CountDownLatch(1);
    private final Webhook webhook;
    private final List<ChangeEvent> batch = new ArrayList<>();
    private BatchEventProcessor<ChangeEventHolder> processor;
    private Client client;
    private Builder target;

    public WebhookPublisher(Webhook webhook) {
      this.webhook = webhook;
    }

    public void test() {
      // TODO
    }

    public Webhook getWebhook() {
      return webhook;
    }

    public void cleanup() {
      // TODO
      client.close();
      client = null;
    }

    @Override
    public void onEvent(ChangeEventHolder changeEventHolder, long sequence, boolean endOfBatch) throws Exception {

      batch.add(changeEventHolder.get());
      // Batch until either the batch size has reached the max size
      if (!endOfBatch && batch.size() < webhook.getBatchSize()) {
        return;
      }

      // TODO send max batch size
      ChangeEventList list = new ChangeEventList(batch, null, null, batch.size());
      Date attemptTime = new Date();
      try {
        Response response = target.post(javax.ws.rs.client.Entity.entity(list, MediaType.APPLICATION_JSON));
        LOG.info(
            "Webhook {}:{}:{} received response {}",
            webhook.getName(),
            webhook.getStatus(),
            batch.size(),
            response.getStatusInfo());
        // 2xx response means call back is successful
        if (response.getStatus() >= 200 && response.getStatus() < 300) { // All 2xx responses
          batch.clear();
          if (webhook.getStatus() != Status.SUCCESS) {
            setStatus(Status.SUCCESS, null);
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
          LOG.warn("Invalid webhook endpoint {}", webhook.getEndPoint());
          setErrorStatus(attemptTime, null, "UnknownHostException");
        }
      }
    }

    private void setErrorStatus(Date attemptTime, Integer statusCode, String reason) throws IOException {
      if (webhook.getFailureDetails() == null || attemptTime != webhook.getFailureDetails().getLastFailedAttempt()) {
        setStatus(
            Status.ERROR,
            new FailureDetails()
                .withLastFailedAttempt(attemptTime)
                .withLastFailedStatusCode(statusCode)
                .withLastFailedReason(reason));
      }
      throw new RuntimeException(reason);
    }

    private void setAwaitingRetry(Date attemptTime, int statusCode, String reason) throws ParseException, IOException {
      if (webhook.getFailureDetails() == null || attemptTime != webhook.getFailureDetails().getLastFailedAttempt()) {
        setStatus(
            Status.AWAITING_RETRY,
            new FailureDetails()
                .withLastFailedAttempt(attemptTime)
                .withLastFailedStatusCode(statusCode)
                .withLastFailedReason(reason)
                .withNextAttempt(CommonUtil.getDateByOffsetSeconds(attemptTime, currentBackoffTime)));
      }
    }

    private void setStatus(Status status, FailureDetails details) throws IOException {
      webhook.setStatus(status);
      webhook.setFailureDetails(details);
      // TODO versioning
      storeEntity(webhook, true);
    }

    @Override
    public void onStart() {
      test();
      LOG.info("Webhook processor with webhook {} started", webhook);
      ClientBuilder clientBuilder = ClientBuilder.newBuilder();
      clientBuilder.connectTimeout(10, TimeUnit.SECONDS);
      clientBuilder.readTimeout(12, TimeUnit.SECONDS);
      client = clientBuilder.build();

      // TODO clean this up
      Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
      target = SecurityUtil.addHeaders(client.target(webhook.getEndPoint()), authHeaders);
    }

    @Override
    public void onShutdown() {
      cleanup();
      shutdownLatch.countDown();
      LOG.info("Cleaned up webhook {}", webhook);
    }

    public void awaitShutdown() throws InterruptedException {
      shutdownLatch.await();
    }

    public void setProcessor(BatchEventProcessor<ChangeEventHolder> processor) {
      this.processor = processor;
    }

    public BatchEventProcessor<ChangeEventHolder> getProcessor() {
      return processor;
    }

    public void setNextBackOff() {
      if (currentBackoffTime == BACKOFF_NORMAL) {
        currentBackoffTime = BACKOFF_3_SECONDS;
      } else if (currentBackoffTime == BACKOFF_3_SECONDS) {
        currentBackoffTime = BACKOFF_5_MINUTES;
      } else if (currentBackoffTime == BACKOFF_5_MINUTES) {
        currentBackoffTime = BACKOFF_1_HOUR;
      } else if (currentBackoffTime == BACKOFF_1_HOUR) {
        currentBackoffTime = BACKOFF_24_HOUR;
      }
    }
  }
}
