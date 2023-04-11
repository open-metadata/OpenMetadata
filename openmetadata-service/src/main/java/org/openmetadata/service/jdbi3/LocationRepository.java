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

import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.STORAGE_SERVICE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.data.Location;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.locations.LocationResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

public class LocationRepository extends EntityRepository<Location> {
  // Location fields that can be patched in a PATCH request
  private static final String LOCATION_PATCH_FIELDS = "owner,tags,path";
  // Location fields that can be updated in a PUT request
  private static final String LOCATION_UPDATE_FIELDS = "owner,tags,path";

  public LocationRepository(CollectionDAO dao) {
    super(
        LocationResource.COLLECTION_PATH,
        Entity.LOCATION,
        Location.class,
        dao.locationDAO(),
        dao,
        LOCATION_PATCH_FIELDS,
        LOCATION_UPDATE_FIELDS);
  }

  @Override
  public Location setFields(Location location, Fields fields) throws IOException {
    location.setService(getContainer(location.getId()));
    location.setPath(location.getPath());
    return location.withFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(location) : null);
  }

  @Override
  public void restorePatchAttributes(Location original, Location updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withName(original.getName())
        .withService(original.getService())
        .withId(original.getId());
  }

  @Transaction
  public final ResultList<Location> listPrefixesBefore(Fields fields, String fqn, int limitParam, String before)
      throws IOException {
    String service = FullyQualifiedName.getRoot(fqn);
    // Reverse scrolling - Get one extra result used for computing before cursor
    List<String> jsons =
        daoCollection
            .locationDAO()
            .listPrefixesBefore(
                daoCollection.locationDAO().getTableName(),
                daoCollection.locationDAO().getNameColumn(),
                fqn,
                service,
                limitParam + 1,
                RestUtil.decodeCursor(before));

    List<Location> entities = new ArrayList<>();
    for (String json : jsons) {
      entities.add(setFieldsInternal(JsonUtils.readValue(json, Location.class), fields));
    }
    int total =
        daoCollection
            .locationDAO()
            .listPrefixesCount(
                daoCollection.locationDAO().getTableName(), daoCollection.locationDAO().getNameColumn(), fqn, service);

    String beforeCursor = null;
    String afterCursor;
    if (entities.size() > limitParam) { // If extra result exists, then previous page exists - return before cursor
      entities.remove(0);
      beforeCursor = entities.get(0).getFullyQualifiedName();
    }
    afterCursor = entities.get(entities.size() - 1).getFullyQualifiedName();
    return getResultList(entities, beforeCursor, afterCursor, total);
  }

  @Transaction
  public final ResultList<Location> listPrefixesAfter(Fields fields, String fqn, int limitParam, String after)
      throws IOException {
    String service = FullyQualifiedName.getRoot(fqn);
    // forward scrolling, if after == null then first page is being asked
    List<String> jsons =
        daoCollection
            .locationDAO()
            .listPrefixesAfter(
                daoCollection.locationDAO().getTableName(),
                daoCollection.locationDAO().getNameColumn(),
                fqn,
                service,
                limitParam + 1,
                after == null ? "" : RestUtil.decodeCursor(after));

    List<Location> entities = new ArrayList<>();
    for (String json : jsons) {
      entities.add(setFieldsInternal(JsonUtils.readValue(json, Location.class), fields));
    }
    int total =
        daoCollection
            .locationDAO()
            .listPrefixesCount(
                daoCollection.locationDAO().getTableName(), daoCollection.locationDAO().getNameColumn(), fqn, service);

    String beforeCursor;
    String afterCursor = null;
    beforeCursor = after == null ? null : entities.get(0).getFullyQualifiedName();
    if (entities.size() > limitParam) { // If extra result exists, then next page exists - return after cursor
      entities.remove(limitParam);
      afterCursor = entities.get(limitParam - 1).getFullyQualifiedName();
    }
    return getResultList(entities, beforeCursor, afterCursor, total);
  }

  @Override
  public void setFullyQualifiedName(Location location) {
    location.setFullyQualifiedName(FullyQualifiedName.add(location.getService().getName(), location.getName()));
  }

  @Override
  public String getFullyQualifiedNameHash(Location location) {
    return FullyQualifiedName.buildHash(location.getFullyQualifiedName());
  }

  private StorageService getService(UUID serviceId, String entityType) throws IOException {
    if (entityType.equalsIgnoreCase(Entity.STORAGE_SERVICE)) {
      return daoCollection.storageServiceDAO().findEntityById(serviceId);
    }
    throw new IllegalArgumentException(
        CatalogExceptionMessage.invalidServiceEntity(entityType, Entity.LOCATION, STORAGE_SERVICE));
  }

  @Override
  public void prepare(Location location) throws IOException {
    StorageService storageService = getService(location.getService().getId(), location.getService().getType());
    location.setService(storageService.getEntityReference());
    location.setServiceType(storageService.getServiceType());
  }

  @Override
  public void storeEntity(Location location, boolean update) throws IOException {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference service = location.getService();
    location.withService(null);
    store(location, update);
    location.withService(service);
  }

  @Override
  public void storeRelationships(Location location) {
    // Add location owner relationship
    storeOwner(location, location.getOwner());
    EntityReference service = location.getService();
    addRelationship(service.getId(), location.getId(), service.getType(), Entity.LOCATION, Relationship.CONTAINS);

    // Add tag to location relationship
    applyTags(location);
  }

  @Override
  public EntityUpdater getUpdater(Location original, Location updated, Operation operation) {
    return new LocationUpdater(original, updated, operation);
  }

  private EntityReference getService(EntityReference service) throws IOException {
    if (service.getId() != null) {
      if (service.getType().equalsIgnoreCase(Entity.STORAGE_SERVICE)) {
        return daoCollection.storageServiceDAO().findEntityReferenceById(service.getId());
      }
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidServiceEntity(service.getType(), Entity.LOCATION, STORAGE_SERVICE));
    }
    return daoCollection.storageServiceDAO().findEntityReferenceByName(service.getFullyQualifiedName());
  }

  public List<EntityReference> getEntityDetails(String id) throws IOException {
    List<CollectionDAO.EntityRelationshipRecord> records = findFrom(id);
    return EntityUtil.getEntityReferences(records);
  }

  public void setService(Location location, EntityReference service) throws IOException {
    if (service != null && location != null) {
      service = getService(service); // Populate service details
      addRelationship(service.getId(), location.getId(), service.getType(), Entity.LOCATION, Relationship.CONTAINS);
      location.setService(service);
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class LocationUpdater extends EntityUpdater {
    public LocationUpdater(Location original, Location updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("locationType", original.getLocationType(), updated.getLocationType());
      recordChange("path", original.getPath(), updated.getPath());
    }
  }
}
