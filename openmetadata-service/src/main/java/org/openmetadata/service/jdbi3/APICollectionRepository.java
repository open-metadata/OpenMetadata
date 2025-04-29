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

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.apis.APICollectionResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class APICollectionRepository extends EntityRepository<APICollection> {

  public APICollectionRepository() {
    super(
        APICollectionResource.COLLECTION_PATH,
        Entity.API_COLLCECTION,
        APICollection.class,
        Entity.getCollectionDAO().apiCollectionDAO(),
        "",
        "");
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(APICollection apiCollection) {
    apiCollection.setFullyQualifiedName(
        FullyQualifiedName.build(apiCollection.getService().getName(), apiCollection.getName()));
  }

  @Override
  public void prepare(APICollection apiCollection, boolean update) {
    populateService(apiCollection);
  }

  @Override
  public void storeEntity(APICollection apiCollection, boolean update) {
    // Relationships and fields such as service are not stored as part of json
    EntityReference service = apiCollection.getService();
    apiCollection.withService(null);
    store(apiCollection, update);
    apiCollection.withService(service);
  }

  @Override
  public void storeRelationships(APICollection apiCollection) {
    addServiceRelationship(apiCollection, apiCollection.getService());
  }

  private List<EntityReference> getAPIEndpoints(APICollection apiCollection) {
    return apiCollection == null
        ? null
        : findTo(
            apiCollection.getId(),
            Entity.API_COLLCECTION,
            Relationship.CONTAINS,
            Entity.API_ENDPOINT);
  }

  @Override
  public EntityInterface getParentEntity(APICollection entity, String fields) {
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  public void setFields(APICollection apiCollection, Fields fields) {
    apiCollection.setService(getContainer(apiCollection.getId()));
    apiCollection.setApiEndpoints(
        fields.contains("apiEndpoints")
            ? getAPIEndpoints(apiCollection)
            : apiCollection.getApiEndpoints());
  }

  public void clearFields(APICollection apiCollection, Fields fields) {
    apiCollection.setApiEndpoints(
        fields.contains("apiEndpoints") ? apiCollection.getApiEndpoints() : null);
  }

  @Override
  public void restorePatchAttributes(APICollection original, APICollection updated) {
    // Patch can't make changes to following fields. Ignore the changes
    super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  @Override
  public EntityRepository<APICollection>.EntityUpdater getUpdater(
      APICollection original,
      APICollection updated,
      Operation operation,
      ChangeSource changeSource) {
    return new APICollectionUpdater(original, updated, operation);
  }

  private void populateService(APICollection apiCollection) {
    ApiService service = Entity.getEntity(apiCollection.getService(), "", Include.NON_DELETED);
    apiCollection.setService(service.getEntityReference());
    apiCollection.setServiceType(service.getServiceType());
  }

  public class APICollectionUpdater extends EntityUpdater {
    public APICollectionUpdater(
        APICollection original, APICollection updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("sourceHash", original.getSourceHash(), updated.getSourceHash());
    }
  }
}
