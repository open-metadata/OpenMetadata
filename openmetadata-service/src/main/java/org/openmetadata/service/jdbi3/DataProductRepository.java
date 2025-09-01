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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_ASSETS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.mergedInheritedEntityRefs;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.domains.DataProduct;
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
import org.openmetadata.service.resources.domains.DataProductResource;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.rules.RuleValidationException;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.LineageUtil;

@Slf4j
public class DataProductRepository extends EntityRepository<DataProduct> {
  private static final String UPDATE_FIELDS = "experts,assets"; // Domain field can't be updated

  public DataProductRepository() {
    super(
        DataProductResource.COLLECTION_PATH,
        Entity.DATA_PRODUCT,
        DataProduct.class,
        Entity.getCollectionDAO().dataProductDAO(),
        UPDATE_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put(FIELD_ASSETS, this::fetchAndSetAssets);
    fieldFetchers.put("experts", this::fetchAndSetExperts);
  }

  @Override
  public void setFields(DataProduct entity, Fields fields) {
    entity.withAssets(fields.contains(FIELD_ASSETS) ? getAssets(entity) : null);
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<DataProduct> entities) {
    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    for (DataProduct entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  // Individual field fetchers registered in constructor
  private void fetchAndSetAssets(List<DataProduct> dataProducts, Fields fields) {
    if (!fields.contains(FIELD_ASSETS) || dataProducts == null || dataProducts.isEmpty()) {
      return;
    }
    setFieldFromMap(true, dataProducts, batchFetchAssets(dataProducts), DataProduct::setAssets);
  }

  private void fetchAndSetExperts(List<DataProduct> dataProducts, Fields fields) {
    if (!fields.contains("experts") || dataProducts == null || dataProducts.isEmpty()) {
      return;
    }
    setFieldFromMap(true, dataProducts, batchFetchExperts(dataProducts), DataProduct::setExperts);
  }

  @Override
  public void clearFields(DataProduct entity, Fields fields) {
    entity.withAssets(fields.contains(FIELD_ASSETS) ? entity.getAssets() : null);
  }

  private List<EntityReference> getAssets(DataProduct entity) {
    return findTo(entity.getId(), Entity.DATA_PRODUCT, Relationship.HAS, null);
  }

  @Override
  public void prepare(DataProduct entity, boolean update) {
    // Parent, Experts, Owner, Assets are already validated
  }

  @Override
  public void storeEntity(DataProduct entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(DataProduct entity) {
    for (EntityReference domain : listOrEmpty(entity.getDomains())) {
      addRelationship(
          domain.getId(),
          entity.getId(),
          Entity.DOMAIN,
          Entity.DATA_PRODUCT,
          Relationship.CONTAINS);
    }
    for (EntityReference expert : listOrEmpty(entity.getExperts())) {
      addRelationship(
          entity.getId(), expert.getId(), Entity.DATA_PRODUCT, Entity.USER, Relationship.EXPERT);
    }
    for (EntityReference asset : listOrEmpty(entity.getAssets())) {
      addRelationship(
          entity.getId(), asset.getId(), Entity.DATA_PRODUCT, asset.getType(), Relationship.HAS);
    }
  }

  public final EntityReference getDomain(Domain domain) {
    return getFromEntityRef(domain.getId(), Relationship.CONTAINS, DOMAIN, false);
  }

  @Override
  public void setInheritedFields(DataProduct dataProduct, Fields fields) {
    // If dataProduct does not have owners and experts, inherit them from the domains
    List<EntityReference> domains =
        !nullOrEmpty(dataProduct.getDomains()) ? getDomains(dataProduct) : Collections.emptyList();
    if (!nullOrEmpty(domains)
        && (fields.contains(FIELD_EXPERTS) || fields.contains(FIELD_OWNERS))
        && (nullOrEmpty(dataProduct.getOwners()) || nullOrEmpty(dataProduct.getExperts()))) {
      List<EntityReference> owners = new ArrayList<>();
      List<EntityReference> experts = new ArrayList<>();

      for (EntityReference domainRef : domains) {
        Domain domain = Entity.getEntity(DOMAIN, domainRef.getId(), "owners,experts", ALL);
        owners = mergedInheritedEntityRefs(owners, domain.getOwners());
        experts = mergedInheritedEntityRefs(experts, domain.getExperts());
      }
      // inherit only if applicable and empty
      if (fields.contains(FIELD_OWNERS) && nullOrEmpty(dataProduct.getOwners())) {
        dataProduct.setOwners(owners);
      }
      if (fields.contains(FIELD_EXPERTS) && nullOrEmpty(dataProduct.getExperts())) {
        dataProduct.setExperts(experts);
      }
    }
  }

  @Override
  public EntityRepository<DataProduct>.EntityUpdater getUpdater(
      DataProduct original, DataProduct updated, Operation operation, ChangeSource changeSource) {
    return new DataProductUpdater(original, updated, operation);
  }

  public BulkOperationResult bulkAddAssets(String domainName, BulkAssets request) {
    DataProduct dataProduct = getByName(null, domainName, getFields("id"));
    BulkOperationResult result =
        bulkAssetsOperation(dataProduct.getId(), DATA_PRODUCT, Relationship.HAS, request, true);
    if (result.getStatus().equals(ApiStatus.SUCCESS)) {
      for (EntityReference ref : listOrEmpty(request.getAssets())) {
        LineageUtil.addDataProductsLineage(
            ref.getId(), ref.getType(), List.of(dataProduct.getEntityReference()));
      }
    }
    return result;
  }

  public BulkOperationResult bulkRemoveAssets(String domainName, BulkAssets request) {
    DataProduct dataProduct = getByName(null, domainName, getFields("id"));
    BulkOperationResult result =
        bulkAssetsOperation(dataProduct.getId(), DATA_PRODUCT, Relationship.HAS, request, false);
    if (result.getStatus().equals(ApiStatus.SUCCESS)) {
      for (EntityReference ref : listOrEmpty(request.getAssets())) {
        LineageUtil.removeDataProductsLineage(
            ref.getId(), ref.getType(), List.of(dataProduct.getEntityReference()));
      }
    }
    return result;
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
    List<BulkResponse> failed = new ArrayList<>();

    EntityUtil.populateEntityReferences(request.getAssets());

    // Get the data product reference for validation
    DataProduct dataProduct = find(entityId, ALL);
    EntityReference dataProductRef = dataProduct.getEntityReference();

    // Fetch all asset entities in bulk for validation
    List<EntityInterface> assetEntities = new ArrayList<>();
    if (isAdd && !request.getAssets().isEmpty()) {
      assetEntities = Entity.getEntities(request.getAssets(), "domains,dataProducts", ALL);
    }

    for (int i = 0; i < request.getAssets().size(); i++) {
      EntityReference ref = request.getAssets().get(i);
      result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);

      try {
        if (isAdd) {
          EntityInterface assetEntity = assetEntities.get(i);
          validateAssetDataProductAssignment(assetEntity, dataProductRef);
          addRelationship(entityId, ref.getId(), fromEntity, ref.getType(), relationship);
        } else {
          deleteRelationship(entityId, fromEntity, ref.getId(), ref.getType(), relationship);
        }

        success.add(new BulkResponse().withRequest(ref));
        result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);

        searchRepository.updateEntity(ref);
      } catch (RuleValidationException e) {
        LOG.warn(
            "Validation failed for asset {} in bulk operation: {}", ref.getId(), e.getMessage());
        failed.add(new BulkResponse().withRequest(ref).withMessage(e.getMessage()));
        result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
        result.setStatus(ApiStatus.PARTIAL_SUCCESS);
      } catch (Exception e) {
        LOG.error(
            "Unexpected error during bulk operation for asset {}: {}",
            ref.getId(),
            e.getMessage(),
            e);
        failed.add(
            new BulkResponse().withRequest(ref).withMessage("Internal error: " + e.getMessage()));
        result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
        result.setStatus(ApiStatus.PARTIAL_SUCCESS);
      }
    }

    result.withSuccessRequest(success).withFailedRequest(failed);

    // If all operations failed, mark as failure
    if (success.isEmpty() && !failed.isEmpty()) {
      result.setStatus(ApiStatus.FAILURE);
    }

    // Create a Change Event on successful operations
    if (!success.isEmpty()) {
      EntityInterface entityInterface = Entity.getEntity(fromEntity, entityId, "id", ALL);
      List<EntityReference> successfulAssets = new ArrayList<>();
      for (BulkResponse response : success) {
        successfulAssets.add((EntityReference) response.getRequest());
      }
      ChangeDescription change =
          addBulkAddRemoveChangeDescription(
              entityInterface.getVersion(), isAdd, successfulAssets, null);
      ChangeEvent changeEvent =
          getChangeEvent(entityInterface, change, fromEntity, entityInterface.getVersion());
      Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
    }

    return result;
  }

  /**
   * Validates that an asset can be assigned to a data product according to configured rules.
   * This method leverages the RuleEngine to validate domain matching rules that are enabled.
   *
   * @param assetEntity The asset entity interface (pre-fetched with domains,dataProducts)
   * @param dataProductRef The data product entity reference
   * @throws RuleValidationException if validation fails
   */
  private void validateAssetDataProductAssignment(
      EntityInterface assetEntity, EntityReference dataProductRef) {
    try {

      List<EntityReference> currentDataProducts = listOrEmpty(assetEntity.getDataProducts());
      List<EntityReference> updatedDataProducts = new ArrayList<>(currentDataProducts);
      updatedDataProducts.add(dataProductRef);

      assetEntity.setDataProducts(updatedDataProducts);
      RuleEngine.getInstance().evaluate(assetEntity, true, false);

    } catch (RuleValidationException e) {
      // Re-throw validation exceptions with context about the bulk operation
      throw new RuleValidationException(
          String.format(
              "Cannot assign asset '%s' (type: %s) to data product '%s': %s",
              assetEntity.getName(),
              assetEntity.getEntityReference().getType(),
              dataProductRef.getName(),
              e.getMessage()));
    } catch (Exception e) {
      LOG.warn(
          "Error during asset data product validation for asset {}: {}",
          assetEntity.getId(),
          e.getMessage());
    }
  }

  @Override
  public void restorePatchAttributes(DataProduct original, DataProduct updated) {
    super.restorePatchAttributes(original, updated);
    updated.withDomains(original.getDomains()); // Domain can't be changed
  }

  @Override
  protected void postUpdate(DataProduct original, DataProduct updated) {
    super.postUpdate(original, updated);
    Map<String, EntityReference> assetsMap = new HashMap<>();
    listOrEmpty(original.getAssets())
        .forEach(asset -> assetsMap.put(asset.getId().toString(), asset));
    listOrEmpty(updated.getAssets())
        .forEach(asset -> assetsMap.put(asset.getId().toString(), asset));
    for (EntityReference assetRef : assetsMap.values()) {
      EntityInterface asset = Entity.getEntity(assetRef, "*", Include.ALL);
      searchRepository.updateEntityIndex(asset);
    }
  }

  public class DataProductUpdater extends EntityUpdater {
    public DataProductUpdater(DataProduct original, DataProduct updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateAssets();
    }

    private void updateAssets() {
      List<EntityReference> origToRefs = listOrEmpty(original.getAssets());
      List<EntityReference> updatedToRefs = listOrEmpty(updated.getAssets());
      origToRefs.sort(EntityUtil.compareEntityReference);
      updatedToRefs.sort(EntityUtil.compareEntityReference);
      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();

      if (!recordListChange(
          FIELD_ASSETS, origToRefs, updatedToRefs, added, deleted, entityReferenceMatch)) {
        return; // No changes between original and updated.
      }
      // Remove assets that were deleted
      for (EntityReference asset : deleted) {
        deleteRelationship(
            original.getId(), DATA_PRODUCT, asset.getId(), asset.getType(), Relationship.HAS);
      }
      // Add new assets
      for (EntityReference asset : added) {
        addRelationship(
            original.getId(),
            asset.getId(),
            DATA_PRODUCT,
            asset.getType(),
            Relationship.HAS,
            false);
      }
    }
  }

  private Map<UUID, List<EntityReference>> batchFetchAssets(List<DataProduct> dataProducts) {
    Map<UUID, List<EntityReference>> assetsMap = new HashMap<>();
    if (dataProducts == null || dataProducts.isEmpty()) {
      return assetsMap;
    }

    // Initialize empty lists for all data products
    for (DataProduct dataProduct : dataProducts) {
      assetsMap.put(dataProduct.getId(), new ArrayList<>());
    }

    // Single batch query to get all assets for all data products
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findToBatchAllTypes(
                entityListToStrings(dataProducts), Relationship.HAS.ordinal(), Include.ALL);

    // Group assets by data product ID
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID dataProductId = UUID.fromString(record.getFromId());
      EntityReference assetRef =
          Entity.getEntityReferenceById(
              record.getToEntity(), UUID.fromString(record.getToId()), NON_DELETED);
      assetsMap.get(dataProductId).add(assetRef);
    }

    return assetsMap;
  }

  private Map<UUID, List<EntityReference>> batchFetchExperts(List<DataProduct> dataProducts) {
    Map<UUID, List<EntityReference>> expertsMap = new HashMap<>();
    if (dataProducts == null || dataProducts.isEmpty()) {
      return expertsMap;
    }

    // Initialize empty lists for all data products
    for (DataProduct dataProduct : dataProducts) {
      expertsMap.put(dataProduct.getId(), new ArrayList<>());
    }

    // Single batch query to get all expert relationships
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findToBatch(
                entityListToStrings(dataProducts), Relationship.EXPERT.ordinal(), Entity.USER);

    // Group experts by data product ID
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID dataProductId = UUID.fromString(record.getFromId());
      EntityReference expertRef =
          Entity.getEntityReferenceById(
              Entity.USER, UUID.fromString(record.getToId()), NON_DELETED);
      expertsMap.get(dataProductId).add(expertRef);
    }

    return expertsMap;
  }
}
