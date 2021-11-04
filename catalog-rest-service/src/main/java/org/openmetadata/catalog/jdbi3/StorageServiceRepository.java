/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.EntityUtil.Fields;

public class StorageServiceRepository extends EntityRepository<StorageService> {
    private final CollectionDAO dao;
    
    public StorageServiceRepository(CollectionDAO dao) {
        super(StorageService.class, dao.storageServiceDAO(), dao, Fields.EMPTY_FIELDS, Fields.EMPTY_FIELDS);
        this.dao = dao;
    }
    
    public StorageService update(UUID id, String description)
            throws IOException {
        StorageService storageService = dao.storageServiceDAO().findEntityById(id);
        // Update fields
        storageService.withDescription(description);
        dao.storageServiceDAO().update(id, JsonUtils.pojoToJson(storageService));
        return storageService;
    }

    @Transaction
    public void delete(UUID id) {
        if (dao.storageServiceDAO().delete(id) <= 0) {
            throw EntityNotFoundException.byMessage(entityNotFound(Entity.STORAGE_SERVICE, id));
        }
        dao.relationshipDAO().deleteAll(id.toString());
    }
    
    @Override
    public StorageService setFields(StorageService entity, Fields fields) throws IOException, ParseException {
        return entity;
    }
    
    @Override
    public void restorePatchAttributes(StorageService original, StorageService updated) throws IOException,
            ParseException {
    }
    
    @Override
    public EntityInterface<StorageService> getEntityInterface(StorageService entity) {
        return new StorageServiceRepository.StorageServiceEntityInterface(entity);
    }

    @Override
    public void validate(StorageService entity) throws IOException {
    }


    @Override
    public void store(StorageService entity, boolean update) throws IOException {
        dao.storageServiceDAO().insert(entity);
        // TODO other cleanup
    }

    @Override
    public void storeRelationships(StorageService entity) throws IOException {
    }
    public static class StorageServiceEntityInterface implements EntityInterface<StorageService> {
        private final StorageService entity;

        public StorageServiceEntityInterface(StorageService entity) {
            this.entity = entity;
        }

        @Override
        public UUID getId() { return entity.getId(); }

        @Override
        public String getDescription() {
            return entity.getDescription();
        }

        @Override
        public String getDisplayName() {
            return entity.getDisplayName();
        }

        @Override
        public EntityReference getOwner() { return null; }

        @Override
        public String getFullyQualifiedName() { return entity.getName(); }

        @Override
        public List<TagLabel> getTags() { return null; }

        @Override
        public Double getVersion() { return entity.getVersion(); }

        @Override
        public String getUpdatedBy() { return entity.getUpdatedBy(); }

        @Override
        public Date getUpdatedAt() { return entity.getUpdatedAt(); }

        @Override
        public URI getHref() { return entity.getHref(); }

        @Override
        public List<EntityReference> getFollowers() {
            throw new UnsupportedOperationException("Storage service does not support followers");
        }

        @Override
        public ChangeDescription getChangeDescription() { return entity.getChangeDescription(); }

        @Override
        public EntityReference getEntityReference() {
            return new EntityReference().withId(getId()).withName(getFullyQualifiedName())
                    .withDescription(getDescription()).withDisplayName(getDisplayName())
                    .withType(Entity.STORAGE_SERVICE);
        }

        @Override
        public StorageService getEntity() { return entity; }

        @Override
        public void setId(UUID id) { entity.setId(id); }

        @Override
        public void setDescription(String description) {
            entity.setDescription(description);
        }

        @Override
        public void setDisplayName(String displayName) {
            entity.setDisplayName(displayName);
        }

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
        public void setOwner(EntityReference owner) {

        }

        @Override
        public void setTags(List<TagLabel> tags) { }
    }
}