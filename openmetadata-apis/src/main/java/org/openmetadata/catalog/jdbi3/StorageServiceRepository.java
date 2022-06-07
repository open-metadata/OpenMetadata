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

import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.util.EntityUtil.Fields;

import java.io.IOException;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.resources.services.storage.StorageServiceResource;
import org.openmetadata.catalog.type.EntityReference;

public class StorageServiceRepository extends EntityRepository<StorageService> {
  private static final String UPDATE_FIELDS = "owner";

  public StorageServiceRepository(CollectionDAO dao) {
    super(
        StorageServiceResource.COLLECTION_PATH,
        Entity.STORAGE_SERVICE,
        StorageService.class,
        dao.storageServiceDAO(),
        dao,
        "",
        UPDATE_FIELDS);
    this.allowEdits = true;
  }

  @Override
  public StorageService setFields(StorageService entity, Fields fields) throws IOException {
    entity.setOwner(fields.contains(FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  @Override
  public void prepare(StorageService entity) throws IOException {
    setFullyQualifiedName(entity);
    // Check if owner is valid and set the relationship
    entity.setOwner(Entity.getEntityReference(entity.getOwner()));
  }

  @Override
  public void storeEntity(StorageService service, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = service.getOwner();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    service.withOwner(null).withHref(null);

    store(service.getId(), service, update);

    // Restore the relationships
    service.withOwner(owner);
  }

  @Override
  public void storeRelationships(StorageService entity) {
    // Add owner relationship
    storeOwner(entity, entity.getOwner());
  }
}
