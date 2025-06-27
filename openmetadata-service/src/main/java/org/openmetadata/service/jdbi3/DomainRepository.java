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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_ASSETS;
import static org.openmetadata.service.Entity.getEntityReferenceById;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.EntityHierarchy;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.domains.DomainResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.LineageUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class DomainRepository extends EntityRepository<Domain> {
  private static final String UPDATE_FIELDS = "parent,children,experts";

  public DomainRepository() {
    super(
        DomainResource.COLLECTION_PATH,
        DOMAIN,
        Domain.class,
        Entity.getCollectionDAO().domainDAO(),
        UPDATE_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;
  }

  @Override
  public void setFields(Domain entity, Fields fields) {
    entity.withAssets(fields.contains(FIELD_ASSETS) ? getAssets(entity) : null);
    entity.withParent(getParent(entity));
  }

  @Override
  public void clearFields(Domain entity, Fields fields) {
    entity.withParent(fields.contains("parent") ? entity.getParent() : null);
  }

  @Override
  public void prepare(Domain entity, boolean update) {
    // Parent, Experts, Owner are already validated
  }

  @Override
  public void storeEntity(Domain entity, boolean update) {
    EntityReference parent = entity.getParent();
    entity.withParent(null);
    store(entity, update);
    entity.withParent(parent);
  }

  @Override
  public void storeRelationships(Domain entity) {
    if (entity.getParent() != null) {
      addRelationship(
          entity.getParent().getId(), entity.getId(), DOMAIN, DOMAIN, Relationship.CONTAINS);
    }
    for (EntityReference expert : listOrEmpty(entity.getExperts())) {
      addRelationship(entity.getId(), expert.getId(), DOMAIN, Entity.USER, Relationship.EXPERT);
    }
  }

  @Override
  public void setInheritedFields(Domain domain, Fields fields) {
    // If subdomain does not have owners and experts, then inherit it from parent domain
    EntityReference parentRef = domain.getParent() != null ? domain.getParent() : getParent(domain);
    if (parentRef != null) {
      Domain parent = Entity.getEntity(DOMAIN, parentRef.getId(), "owners,experts", ALL);
      inheritOwners(domain, fields, parent);
      inheritExperts(domain, fields, parent);
    }
  }

  private List<EntityReference> getAssets(Domain entity) {
    return findTo(entity.getId(), DOMAIN, Relationship.HAS, null);
  }

  public BulkOperationResult bulkAddAssets(String domainName, BulkAssets request) {
    Domain domain = getByName(null, domainName, getFields("id"));
    return bulkAssetsOperation(domain.getId(), DOMAIN, Relationship.HAS, request, true);
  }

  public BulkOperationResult bulkRemoveAssets(String domainName, BulkAssets request) {
    Domain domain = getByName(null, domainName, getFields("id"));
    return bulkAssetsOperation(domain.getId(), DOMAIN, Relationship.HAS, request, false);
  }

  @Transaction
  @Override
  protected BulkOperationResult bulkAssetsOperation(
      UUID entityId,
      String fromEntity,
      Relationship relationship,
      BulkAssets request,
      boolean isAdd) {
    BulkOperationResult result =
        new BulkOperationResult().withStatus(ApiStatus.SUCCESS).withDryRun(false);
    List<BulkResponse> success = new ArrayList<>();

    EntityUtil.populateEntityReferences(request.getAssets());

    for (EntityReference ref : request.getAssets()) {
      result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);

      cleanupOldDomain(ref, fromEntity, relationship);
      cleanupDataProducts(entityId, ref, relationship, isAdd);

      if (isAdd) {
        addRelationship(entityId, ref.getId(), fromEntity, ref.getType(), relationship);
        EntityReference domainRef = getEntityReferenceById(DOMAIN, entityId, ALL);
        LineageUtil.addDomainLineage(entityId, ref.getType(), domainRef);
      }

      success.add(new BulkResponse().withRequest(ref));
      result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);

      searchRepository.updateEntity(ref);
    }

    result.withSuccessRequest(success);

    // Create a Change Event on successful addition/removal of assets
    if (result.getStatus().equals(ApiStatus.SUCCESS)) {
      EntityInterface entityInterface = Entity.getEntity(fromEntity, entityId, "id", ALL);
      ChangeDescription change =
          addBulkAddRemoveChangeDescription(
              entityInterface.getVersion(), isAdd, request.getAssets(), null);
      ChangeEvent changeEvent =
          getChangeEvent(entityInterface, change, fromEntity, entityInterface.getVersion());
      Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
    }

    return result;
  }

  private void cleanupOldDomain(EntityReference ref, String fromEntity, Relationship relationship) {
    EntityReference oldDomain =
        getFromEntityRef(ref.getId(), ref.getType(), relationship, DOMAIN, false);
    deleteTo(ref.getId(), ref.getType(), relationship, fromEntity);
    LineageUtil.removeDomainLineage(ref.getId(), ref.getType(), oldDomain);
  }

  private void cleanupDataProducts(
      UUID entityId, EntityReference ref, Relationship relationship, boolean isAdd) {
    List<EntityReference> dataProducts = getDataProducts(ref.getId(), ref.getType());
    if (dataProducts.isEmpty()) return;

    // Map dataProduct -> domain
    Map<UUID, UUID> associatedDomains =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                dataProducts.stream().map(dp -> dp.getId().toString()).collect(Collectors.toList()),
                relationship.ordinal(),
                DOMAIN)
            .stream()
            .collect(
                Collectors.toMap(
                    rec -> UUID.fromString(rec.getToId()),
                    rec -> UUID.fromString(rec.getFromId())));

    // For isAdd, filter only those data products linked to a different domain.
    // For isRemove, delete all data products.
    List<EntityReference> dataProductsToDelete =
        isAdd
            ? dataProducts.stream()
                .filter(
                    dp -> {
                      UUID domainId = associatedDomains.get(dp.getId());
                      return domainId != null && !domainId.equals(entityId);
                    })
                .collect(Collectors.toList())
            : dataProducts;

    if (!dataProductsToDelete.isEmpty()) {
      daoCollection
          .relationshipDAO()
          .bulkRemoveFromRelationship(
              dataProductsToDelete.stream()
                  .map(EntityReference::getId)
                  .collect(Collectors.toList()),
              ref.getId(),
              DATA_PRODUCT,
              ref.getType(),
              relationship.ordinal());
      LineageUtil.removeDataProductsLineage(ref.getId(), ref.getType(), dataProductsToDelete);
    }
  }

  @Override
  public EntityRepository<Domain>.EntityUpdater getUpdater(
      Domain original, Domain updated, Operation operation, ChangeSource changeSource) {
    return new DomainUpdater(original, updated, operation);
  }

  @Override
  public void restorePatchAttributes(Domain original, Domain updated) {
    super.restorePatchAttributes(original, updated);
    updated.withParent(original.getParent()); // Parent can't be changed
    updated.withChildren(original.getChildren()); // Children can't be changed
  }

  @Override
  public void setFullyQualifiedName(Domain entity) {
    // Validate parent
    if (entity.getParent() == null) { // Top level domain
      entity.setFullyQualifiedName(FullyQualifiedName.build(entity.getName()));
    } else { // Sub domain
      EntityReference parent = entity.getParent();
      entity.setFullyQualifiedName(
          FullyQualifiedName.add(parent.getFullyQualifiedName(), entity.getName()));
    }
  }

  @Override
  public EntityInterface getParentEntity(Domain entity, String fields) {
    return entity.getParent() != null
        ? Entity.getEntity(entity.getParent(), fields, Include.NON_DELETED)
        : null;
  }

  public List<EntityHierarchy> buildHierarchy(String fieldsParam, int limit) {
    fieldsParam = EntityUtil.addField(fieldsParam, Entity.FIELD_PARENT);
    Fields fields = getFields(fieldsParam);
    ResultList<Domain> resultList = listAfter(null, fields, new ListFilter(null), limit, null);
    List<Domain> domains = resultList.getData();

    /*
      Maintaining hierarchy in terms of EntityHierarchy to get all other fields of Domain like style,
      which would have been restricted if built using hierarchy of Domain, as Domain.getChildren() returns List<EntityReference>
      and EntityReference does not support additional properties
    */
    List<EntityHierarchy> rootDomains = new ArrayList<>();

    Map<UUID, EntityHierarchy> entityHierarchyMap =
        domains.stream()
            .collect(
                Collectors.toMap(
                    Domain::getId,
                    domain -> {
                      EntityHierarchy entityHierarchy =
                          JsonUtils.readValue(JsonUtils.pojoToJson(domain), EntityHierarchy.class);
                      entityHierarchy.setChildren(new ArrayList<>());
                      return entityHierarchy;
                    }));

    for (Domain domain : domains) {
      EntityHierarchy entityHierarchy = entityHierarchyMap.get(domain.getId());

      if (domain.getParent() != null) {
        EntityHierarchy parentHierarchy = entityHierarchyMap.get(domain.getParent().getId());
        if (parentHierarchy != null) {
          parentHierarchy.getChildren().add(entityHierarchy);
        }
      } else {
        rootDomains.add(entityHierarchy);
      }
    }

    return rootDomains;
  }

  public class DomainUpdater extends EntityUpdater {
    public DomainUpdater(Domain original, Domain updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("domainType", original.getDomainType(), updated.getDomainType());
    }
  }
}
