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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
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
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class APICollectionRepository extends EntityRepository<APICollection> {

  public APICollectionRepository() {
    super(
        APICollectionResource.COLLECTION_PATH,
        Entity.API_COLLECTION,
        APICollection.class,
        Entity.getCollectionDAO().apiCollectionDAO(),
        "",
        "");
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(APICollection apiCollection) {
    apiCollection.setFullyQualifiedName(
        FullyQualifiedName.add(
            apiCollection.getService().getFullyQualifiedName(), apiCollection.getName()));
  }

  @Override
  public void prepare(APICollection apiCollection, boolean update) {
    populateService(apiCollection);
  }

  @Override
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service");
  }

  @Override
  public void storeEntity(APICollection apiCollection, boolean update) {
    store(apiCollection, update);
  }

  @Override
  public void storeEntities(List<APICollection> entities) {
    storeMany(entities);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<APICollection> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(APICollection::getId).toList();
    deleteToMany(ids, entityType, Relationship.CONTAINS, null);
  }

  @Override
  public void storeRelationships(APICollection apiCollection) {
    addServiceRelationship(apiCollection, apiCollection.getService());
  }

  @Override
  protected void storeEntitySpecificRelationshipsForMany(List<APICollection> entities) {
    List<CollectionDAO.EntityRelationshipObject> relationships = new ArrayList<>();
    for (APICollection apiCollection : entities) {
      EntityReference service = apiCollection.getService();
      if (service == null || service.getId() == null) {
        continue;
      }
      relationships.add(
          newRelationship(
              service.getId(),
              apiCollection.getId(),
              service.getType(),
              entityType,
              Relationship.CONTAINS));
    }
    bulkInsertRelationships(relationships);
  }

  private List<EntityReference> getAPIEndpoints(APICollection apiCollection) {
    return apiCollection == null
        ? null
        : findTo(
            apiCollection.getId(),
            Entity.API_COLLECTION,
            Relationship.CONTAINS,
            Entity.API_ENDPOINT);
  }

  @Override
  protected EntityReference getParentReference(APICollection entity) {
    return entity.getService();
  }

  @Override
  public EntityInterface getParentEntity(APICollection entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  @Override
  public void setFields(
      APICollection apiCollection, Fields fields, RelationIncludes relationIncludes) {
    if (apiCollection.getService() == null) {
      apiCollection.setService(getContainer(apiCollection.getId()));
    }
    apiCollection.setApiEndpoints(
        fields.contains("apiEndpoints")
            ? getAPIEndpoints(apiCollection)
            : apiCollection.getApiEndpoints());
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<APICollection> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    // Bulk fetch and set service for all API collections first
    fetchAndSetServices(entities);

    // Then call parent's implementation which handles standard fields
    super.setFieldsInBulk(fields, entities);
  }

  private void fetchAndSetServices(List<APICollection> apiCollections) {
    if (apiCollections == null || apiCollections.isEmpty()) {
      return;
    }

    List<APICollection> collectionsMissingService =
        apiCollections.stream().filter(collection -> collection.getService() == null).toList();
    if (collectionsMissingService.isEmpty()) {
      return;
    }

    // Batch fetch service references for all API collections
    Map<UUID, EntityReference> serviceRefs = batchFetchServices(collectionsMissingService);

    // Set service field for all API collections
    for (APICollection apiCollection : collectionsMissingService) {
      EntityReference serviceRef = serviceRefs.get(apiCollection.getId());
      if (serviceRef != null) {
        apiCollection.withService(serviceRef);
      }
    }
  }

  private Map<UUID, EntityReference> batchFetchServices(List<APICollection> apiCollections) {
    Map<UUID, EntityReference> serviceMap = new HashMap<>();
    if (apiCollections == null || apiCollections.isEmpty()) {
      return serviceMap;
    }

    // Batch query to get all services that contain these API collections
    // findFromBatch finds relationships where the provided IDs are in the "to" position
    // So this finds: API_SERVICE (from) -> CONTAINS -> API_COLLECTION (to)
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(apiCollections),
                Relationship.CONTAINS.ordinal(),
                Entity.API_SERVICE,
                Include.ALL);

    if (records.isEmpty()) {
      return serviceMap;
    }

    List<UUID> serviceIds =
        records.stream().map(record -> UUID.fromString(record.getFromId())).distinct().toList();

    Map<UUID, EntityReference> serviceRefMap =
        Entity.getEntityReferencesByIds(Entity.API_SERVICE, serviceIds, Include.ALL).stream()
            .collect(Collectors.toMap(EntityReference::getId, ref -> ref));

    for (CollectionDAO.EntityRelationshipObject record : records) {
      // We're looking for records where API Service contains API Collection
      UUID apiCollectionId = UUID.fromString(record.getToId());
      UUID serviceId = UUID.fromString(record.getFromId());
      EntityReference serviceRef = serviceRefMap.get(serviceId);
      if (serviceRef != null) {
        serviceMap.put(apiCollectionId, serviceRef);
      }
    }

    return serviceMap;
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
    var service =
        (ApiService) getCachedParentOrLoad(apiCollection.getService(), "", Include.NON_DELETED);
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
      compareAndUpdate(
          "sourceHash",
          () -> {
            recordChange(
                "sourceHash",
                original.getSourceHash(),
                updated.getSourceHash(),
                false,
                EntityUtil.objectMatch,
                false);
          });
    }
  }
}
