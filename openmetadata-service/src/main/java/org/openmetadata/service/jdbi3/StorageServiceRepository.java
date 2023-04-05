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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.util.EntityUtil.Fields;

import java.io.IOException;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.storage.StorageServiceResource;

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
  }

  @Override
  public StorageService setFields(StorageService entity, Fields fields) {
    return entity;
  }

  @Override
  public void prepare(StorageService entity) {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(StorageService service, boolean update) throws IOException {
    store(service, update);
  }

  @Override
  public void storeRelationships(StorageService entity) {
    // Add owner relationship
    storeOwner(entity, entity.getOwner());
  }
}
