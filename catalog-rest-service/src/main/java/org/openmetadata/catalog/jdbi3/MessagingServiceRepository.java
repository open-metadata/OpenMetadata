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

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.resources.services.messaging.MessagingServiceResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;

public class MessagingServiceRepository extends EntityRepository<MessagingService> {

  public MessagingServiceRepository(CollectionDAO dao) {
    super(
        MessagingServiceResource.COLLECTION_PATH,
        Entity.MESSAGING_SERVICE,
        MessagingService.class,
        dao.messagingServiceDAO(),
        dao,
        Fields.EMPTY_FIELDS,
        Fields.EMPTY_FIELDS,
        false,
        false,
        false);
  }

  @Override
  public MessagingService setFields(MessagingService entity, Fields fields) {
    return entity;
  }

  @Override
  public void restorePatchAttributes(MessagingService original, MessagingService updated) {
    /* Nothing to do */
  }

  @Override
  public EntityInterface<MessagingService> getEntityInterface(MessagingService entity) {
    return new MessagingServiceEntityInterface(entity);
  }

  @Override
  public void prepare(MessagingService entity) {
    EntityUtil.validateIngestionSchedule(entity.getIngestionSchedule());
  }

  @Override
  public void storeEntity(MessagingService service, boolean update) throws IOException {
    service.withHref(null);
    store(service.getId(), service, update);
  }

  @Override
  public void storeRelationships(MessagingService entity) {
    /* Nothing to do */
  }

  @Override
  public EntityUpdater getUpdater(MessagingService original, MessagingService updated, Operation operation) {
    return new MessagingServiceUpdater(original, updated, operation);
  }

  public static class MessagingServiceEntityInterface implements EntityInterface<MessagingService> {
    private final MessagingService entity;

    public MessagingServiceEntityInterface(MessagingService entity) {
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
      return entity.getDisplayName();
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
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.MESSAGING_SERVICE);
    }

    @Override
    public MessagingService getEntity() {
      return entity;
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
      entity.setDisplayName(displayName);
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
    public MessagingService withHref(URI href) {
      return entity.withHref(href);
    }
  }

  public class MessagingServiceUpdater extends EntityUpdater {
    public MessagingServiceUpdater(MessagingService original, MessagingService updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      MessagingService origService = original.getEntity();
      MessagingService updatedService = updated.getEntity();
      recordChange("schemaRegistry", origService.getSchemaRegistry(), updatedService.getSchemaRegistry());
      recordChange(
          "ingestionSchedule", origService.getIngestionSchedule(), updatedService.getIngestionSchedule(), true);
      updateBrokers();
    }

    private void updateBrokers() throws JsonProcessingException {
      List<String> origBrokers = original.getEntity().getBrokers();
      List<String> updatedBrokers = updated.getEntity().getBrokers();

      List<String> addedBrokers = new ArrayList<>();
      List<String> deletedBrokers = new ArrayList<>();
      recordListChange("brokers", origBrokers, updatedBrokers, addedBrokers, deletedBrokers, EntityUtil.stringMatch);
    }
  }
}
