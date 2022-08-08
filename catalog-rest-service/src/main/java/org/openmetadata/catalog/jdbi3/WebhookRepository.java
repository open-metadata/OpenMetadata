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

import static org.openmetadata.catalog.util.EntityUtil.eventFilterMatch;
import static org.openmetadata.catalog.util.EntityUtil.failureDetailsMatch;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.lmax.disruptor.BatchEventProcessor;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.events.EventPubSub;
import org.openmetadata.catalog.events.EventPubSub.ChangeEventHolder;
import org.openmetadata.catalog.events.WebhookPublisher;
import org.openmetadata.catalog.resources.events.WebhookResource;
import org.openmetadata.catalog.slack.SlackWebhookEventPublisher;
import org.openmetadata.catalog.type.EventFilter;
import org.openmetadata.catalog.type.Webhook;
import org.openmetadata.catalog.type.Webhook.Status;
import org.openmetadata.catalog.util.EntityUtil.Fields;

@Slf4j
public class WebhookRepository extends EntityRepository<Webhook> {
  private static final ConcurrentHashMap<UUID, WebhookPublisher> webhookPublisherMap = new ConcurrentHashMap<>();

  public WebhookRepository(CollectionDAO dao) {
    super(WebhookResource.COLLECTION_PATH, Entity.WEBHOOK, Webhook.class, dao.webhookDAO(), dao, "", "");
  }

  @Override
  public Webhook setFields(Webhook entity, Fields fields) {
    return entity; // No fields to set
  }

  @Override
  public void prepare(Webhook entity) {
    setFullyQualifiedName(entity);
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
  public WebhookUpdater getUpdater(Webhook original, Webhook updated, Operation operation) {
    return new WebhookUpdater(original, updated, operation);
  }

  private WebhookPublisher getPublisher(UUID id) {
    return webhookPublisherMap.get(id);
  }

  public void addWebhookPublisher(Webhook webhook) {
    if (Boolean.FALSE.equals(webhook.getEnabled())) { // Only add webhook that is enabled for publishing events
      webhook.setStatus(Status.DISABLED);
      return;
    }

    WebhookPublisher publisher;
    if (webhook.getWebhookType() == Webhook.WebhookType.slack) {
      publisher = new SlackWebhookEventPublisher(webhook, daoCollection);
    } else {
      publisher = new WebhookPublisher(webhook, daoCollection);
    }
    BatchEventProcessor<ChangeEventHolder> processor = EventPubSub.addEventHandler(publisher);
    publisher.setProcessor(processor);
    webhookPublisherMap.put(webhook.getId(), publisher);
    LOG.info("Webhook subscription started for {}", webhook.getName());
  }

  @SneakyThrows
  public void updateWebhookPublisher(Webhook webhook) {
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
      if (status != Status.ACTIVE && status != Status.AWAITING_RETRY) {
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

  public class WebhookUpdater extends EntityUpdater {
    public WebhookUpdater(Webhook original, Webhook updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("enabled", original.getEnabled(), updated.getEnabled());
      recordChange("status", original.getStatus(), updated.getStatus());
      recordChange("endPoint", original.getEndpoint(), updated.getEndpoint());
      recordChange("batchSize", original.getBatchSize(), updated.getBatchSize());
      recordChange("timeout", original.getTimeout(), updated.getTimeout());
      updateEventFilters();
      if (fieldsChanged()) {
        // If updating the other fields, opportunistically use it to capture failure details
        WebhookPublisher publisher = WebhookRepository.this.getPublisher(original.getId());
        if (publisher != null && updated != publisher.getWebhook()) {
          updated
              .withStatus(publisher.getWebhook().getStatus())
              .withFailureDetails(publisher.getWebhook().getFailureDetails());
          if (Boolean.FALSE.equals(updated.getEnabled())) {
            updated.setStatus(Status.DISABLED);
          }
        }
        recordChange(
            "failureDetails", original.getFailureDetails(), updated.getFailureDetails(), true, failureDetailsMatch);
      }
    }

    private void updateEventFilters() throws JsonProcessingException {
      List<EventFilter> origFilter = original.getEventFilters();
      List<EventFilter> updatedFilter = updated.getEventFilters();
      List<EventFilter> added = new ArrayList<>();
      List<EventFilter> deleted = new ArrayList<>();
      recordListChange("eventFilters", origFilter, updatedFilter, added, deleted, eventFilterMatch);
    }
  }
}
