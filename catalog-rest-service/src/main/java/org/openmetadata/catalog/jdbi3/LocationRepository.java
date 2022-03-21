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
import static org.openmetadata.catalog.Entity.STORAGE_SERVICE;

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Location;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.locations.LocationResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

public class LocationRepository extends EntityRepository<Location> {
  // Location fields that can be patched in a PATCH request
  private static final Fields LOCATION_PATCH_FIELDS = new Fields(LocationResource.ALLOWED_FIELDS, "owner,tags");
  // Location fields that can be updated in a PUT request
  private static final Fields LOCATION_UPDATE_FIELDS = new Fields(LocationResource.ALLOWED_FIELDS, "owner,tags");

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
  public Location setFields(Location location, Fields fields) throws IOException, ParseException {
    location.setService(getService(location));
    location.setOwner(fields.contains(FIELD_OWNER) ? getOwner(location) : null);
    location.setFollowers(fields.contains("followers") ? getFollowers(location) : null);
    location.setTags(fields.contains("tags") ? getTags(location.getFullyQualifiedName()) : null);
    return location;
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
      throws IOException, ParseException {
    String service = fqn.split("\\.")[0];
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
      entities.add(setFields(JsonUtils.readValue(json, Location.class), fields));
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
      beforeCursor = getFullyQualifiedName(entities.get(0));
    }
    afterCursor = getFullyQualifiedName(entities.get(entities.size() - 1));
    return getResultList(entities, beforeCursor, afterCursor, total);
  }

  @Transaction
  public final ResultList<Location> listPrefixesAfter(Fields fields, String fqn, int limitParam, String after)
      throws IOException, ParseException {
    String service = fqn.split("\\.")[0];
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
      entities.add(setFields(JsonUtils.readValue(json, Location.class), fields));
    }
    int total =
        daoCollection
            .locationDAO()
            .listPrefixesCount(
                daoCollection.locationDAO().getTableName(), daoCollection.locationDAO().getNameColumn(), fqn, service);

    String beforeCursor;
    String afterCursor = null;
    beforeCursor = after == null ? null : getFullyQualifiedName(entities.get(0));
    if (entities.size() > limitParam) { // If extra result exists, then next page exists - return after cursor
      entities.remove(limitParam);
      afterCursor = getFullyQualifiedName(entities.get(limitParam - 1));
    }
    return getResultList(entities, beforeCursor, afterCursor, total);
  }

  @Override
  public EntityInterface<Location> getEntityInterface(Location entity) {
    return new LocationEntityInterface(entity);
  }

  public static String getFQN(Location location) {
    return (location != null && location.getService() != null)
        ? (location.getService().getName() + "." + location.getName())
        : null;
  }

  @Transaction
  public EntityReference getOwnerReference(Location location) throws IOException {
    return EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), location.getOwner());
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
    EntityUtil.escapeReservedChars(getEntityInterface(location));
    StorageService storageService = getService(location.getService().getId(), location.getService().getType());
    location.setService(
        new StorageServiceRepository.StorageServiceEntityInterface(storageService).getEntityReference());
    location.setServiceType(storageService.getServiceType());
    location.setFullyQualifiedName(getFQN(location));
    EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), location.getOwner()); // Validate owner
    location.setTags(addDerivedTags(location.getTags()));
  }

  @Override
  public void storeEntity(Location location, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = location.getOwner();
    EntityReference service = location.getService();
    List<TagLabel> tags = location.getTags();

    // Don't store owner, href and tags as JSON. Build it on the fly based on relationships
    location.withOwner(null).withService(null).withHref(null).withTags(null);

    store(location.getId(), location, update);

    // Restore the relationships
    location.withOwner(owner).withService(service).withTags(tags);
  }

  @Override
  public void storeRelationships(Location location) {
    // Add location owner relationship
    setOwner(location.getId(), Entity.LOCATION, location.getOwner());
    EntityReference service = location.getService();
    addRelationship(service.getId(), location.getId(), service.getType(), Entity.LOCATION, Relationship.CONTAINS);

    // Add tag to location relationship
    applyTags(location);
  }

  @Override
  public EntityUpdater getUpdater(Location original, Location updated, Operation operation) {
    return new LocationUpdater(original, updated, operation);
  }

  private EntityReference getService(Location location) throws IOException {
    return getContainer(location.getId(), Entity.LOCATION);
  }

  private EntityReference getService(EntityReference service) throws IOException {
    if (service.getType().equalsIgnoreCase(Entity.STORAGE_SERVICE)) {
      return daoCollection.storageServiceDAO().findEntityReferenceById(service.getId());
    }
    throw new IllegalArgumentException(
        CatalogExceptionMessage.invalidServiceEntity(service.getType(), Entity.LOCATION, STORAGE_SERVICE));
  }

  public void setService(Location location, EntityReference service) throws IOException {
    if (service != null && location != null) {
      getService(service); // Populate service details
      addRelationship(service.getId(), location.getId(), service.getType(), Entity.LOCATION, Relationship.CONTAINS);
      location.setService(service);
    }
  }

  public static class LocationEntityInterface implements EntityInterface<Location> {
    private final Location entity;

    public LocationEntityInterface(Location entity) {
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
    public String getName() {
      return entity.getName();
    }

    @Override
    public Boolean isDeleted() {
      return entity.getDeleted();
    }

    @Override
    public EntityReference getOwner() {
      return entity.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getFullyQualifiedName() != null
          ? entity.getFullyQualifiedName()
          : LocationRepository.getFQN(entity);
    }

    @Override
    public List<TagLabel> getTags() {
      return entity.getTags();
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
          .withType(Entity.LOCATION)
          .withDeleted(isDeleted());
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public List<EntityReference> getFollowers() {
      return entity.getFollowers();
    }

    @Override
    public Location getEntity() {
      return entity;
    }

    @Override
    public EntityReference getContainer() {
      return entity.getService();
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
      entity.setDisplayName(displayName);
    }

    @Override
    public void setName(String name) {
      entity.setName(name);
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
    public void setOwner(EntityReference owner) {
      entity.setOwner(owner);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public Location withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class LocationUpdater extends EntityUpdater {
    public LocationUpdater(Location original, Location updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("locationType", original.getEntity().getLocationType(), updated.getEntity().getLocationType());
    }
  }
}
