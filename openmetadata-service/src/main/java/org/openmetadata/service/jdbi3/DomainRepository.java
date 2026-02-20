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
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.getEntityReferenceById;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNameAlreadyExists;

import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.domains.DomainResource;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.search.DefaultInheritedFieldEntitySearch;
import org.openmetadata.service.search.InheritedFieldEntitySearch;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldQuery;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldResult;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.LineageUtil;

@Slf4j
public class DomainRepository extends EntityRepository<Domain> {
  private static final String UPDATE_FIELDS = "parent,children,experts";

  private InheritedFieldEntitySearch inheritedFieldEntitySearch;

  public DomainRepository() {
    super(
        DomainResource.COLLECTION_PATH,
        DOMAIN,
        Domain.class,
        Entity.getCollectionDAO().domainDAO(),
        UPDATE_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;
    renameAllowed = true;

    // Initialize inherited field search
    if (searchRepository != null) {
      inheritedFieldEntitySearch = new DefaultInheritedFieldEntitySearch(searchRepository);
    }

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put("parent", this::fetchAndSetParents);
    fieldFetchers.put("experts", this::fetchAndSetExperts);
    fieldFetchers.put("childrenCount", this::fetchAndSetChildrenCount);
  }

  @Override
  public void setFields(Domain entity, Fields fields, RelationIncludes relationIncludes) {
    entity.withParent(getParent(entity));
    entity.withChildrenCount(
        fields.contains("childrenCount") ? getChildrenCount(entity) : entity.getChildrenCount());
  }

  private Integer getChildrenCount(Domain entity) {
    return daoCollection.domainDAO().countNestedDomains(entity.getFullyQualifiedName());
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Domain> entities) {
    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    entities.forEach(entity -> clearFieldsInternal(entity, fields));
  }

  private void fetchAndSetParents(List<Domain> domains, Fields fields) {
    if (!fields.contains("parent") || domains == null || domains.isEmpty()) {
      return;
    }
    setFieldFromMap(true, domains, batchFetchParents(domains), Domain::setParent);
  }

  private void fetchAndSetExperts(List<Domain> domains, Fields fields) {
    if (!fields.contains("experts") || domains == null || domains.isEmpty()) {
      return;
    }
    setFieldFromMap(true, domains, batchFetchExperts(domains), Domain::setExperts);
  }

  private void fetchAndSetChildrenCount(List<Domain> entities, Fields fields) {
    if (!fields.contains("childrenCount") || entities.isEmpty()) {
      return;
    }

    for (Domain entity : entities) {
      int count = daoCollection.domainDAO().countNestedDomains(entity.getFullyQualifiedName());
      entity.setChildrenCount(count);
    }
  }

  @Override
  public void clearFields(Domain entity, Fields fields) {
    entity.withParent(fields.contains("parent") ? entity.getParent() : null);
    entity.withChildrenCount(fields.contains("childrenCount") ? entity.getChildrenCount() : null);
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
  public void storeEntities(List<Domain> entities) {
    List<Domain> entitiesToStore = new ArrayList<>();
    Gson gson = new Gson();

    for (Domain entity : entities) {
      EntityReference parent = entity.getParent();

      entity.withParent(null);

      String jsonCopy = gson.toJson(entity);
      entitiesToStore.add(gson.fromJson(jsonCopy, Domain.class));

      entity.withParent(parent);
    }

    storeMany(entitiesToStore);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<Domain> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Domain::getId).toList();
    deleteToMany(ids, Entity.DOMAIN, Relationship.CONTAINS, Entity.DOMAIN);
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
    // If subdomain does not have owners and experts, then inherit it from parent
    // domain
    EntityReference parentRef = domain.getParent() != null ? domain.getParent() : getParent(domain);
    if (parentRef != null) {
      Domain parent = Entity.getEntity(DOMAIN, parentRef.getId(), "owners,experts", ALL);
      inheritOwners(domain, fields, parent);
      inheritExperts(domain, fields, parent);
    }
  }

  public BulkOperationResult bulkAddAssets(String domainName, BulkAssets request) {
    Domain domain = getByName(null, domainName, getFields("id"));
    return bulkAssetsOperation(domain.getId(), DOMAIN, Relationship.HAS, request, true);
  }

  public BulkOperationResult bulkRemoveAssets(String domainName, BulkAssets request) {
    Domain domain = getByName(null, domainName, getFields("id"));
    return bulkAssetsOperation(domain.getId(), DOMAIN, Relationship.HAS, request, false);
  }

  public ResultList<EntityReference> getDomainAssets(UUID domainId, int limit, int offset) {
    Domain domain = get(null, domainId, getFields("id,fullyQualifiedName"));

    if (inheritedFieldEntitySearch == null) {
      LOG.warn("Search is unavailable for domain assets. Returning empty list.");
      return new ResultList<>(new ArrayList<>(), null, null, 0);
    }

    // Use the forDomain helper method with pagination
    InheritedFieldQuery query =
        InheritedFieldQuery.forDomain(domain.getFullyQualifiedName(), offset, limit);

    InheritedFieldResult result =
        inheritedFieldEntitySearch.getEntitiesForField(
            query,
            () -> {
              LOG.warn(
                  "Search fallback for domain {} assets. Returning empty list.",
                  domain.getFullyQualifiedName());
              return new InheritedFieldResult(new ArrayList<>(), 0);
            });

    return new ResultList<>(result.entities(), null, null, result.total());
  }

  public ResultList<EntityReference> getDomainAssetsByName(
      String domainName, int limit, int offset) {
    Domain domain = getByName(null, domainName, getFields("id,fullyQualifiedName"));
    return getDomainAssets(domain.getId(), limit, offset);
  }

  public Map<String, Integer> getAllDomainsWithAssetsCount() {
    if (inheritedFieldEntitySearch == null) {
      LOG.warn("Search unavailable for domain asset counts");
      return new HashMap<>();
    }

    List<Domain> allDomains = listAll(getFields("fullyQualifiedName"), new ListFilter(null));
    Map<String, Integer> domainAssetCounts = new LinkedHashMap<>();

    for (Domain domain : allDomains) {
      InheritedFieldQuery query =
          InheritedFieldQuery.forDomain(domain.getFullyQualifiedName(), 0, 0);

      Integer count =
          inheritedFieldEntitySearch.getCountForField(
              query,
              () -> {
                LOG.warn(
                    "Search fallback for domain {} asset count. Returning 0.",
                    domain.getFullyQualifiedName());
                return 0;
              });

      domainAssetCounts.put(domain.getFullyQualifiedName(), count);
    }

    return domainAssetCounts;
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

  public ResultList<EntityHierarchy> buildHierarchy(
      String fieldsParam, int limit, String directChildrenOf, int offset) {
    fieldsParam = EntityUtil.addField(fieldsParam, Entity.FIELD_PARENT);
    Fields fields = getFields(fieldsParam);
    ListFilter filter = new ListFilter(null);
    filter.addQueryParam("directChildrenOf", directChildrenOf);
    filter.addQueryParam("offset", String.valueOf(offset));
    filter.addQueryParam("hierarchyFilter", "true"); // Enable hierarchy filtering
    ResultList<Domain> resultList = listAfter(null, fields, filter, limit, null);
    List<Domain> domains = resultList.getData();

    List<EntityHierarchy> hierarchyList =
        domains.stream()
            .map(domain -> JsonUtils.readValue(JsonUtils.pojoToJson(domain), EntityHierarchy.class))
            .collect(Collectors.toList());

    int total =
        resultList.getPaging() != null ? resultList.getPaging().getTotal() : hierarchyList.size();
    return new ResultList<>(hierarchyList, null, null, total);
  }

  public class DomainUpdater extends EntityUpdater {
    private boolean renameProcessed = false;

    public DomainUpdater(Domain original, Domain updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateName(updated);
      recordChange("domainType", original.getDomainType(), updated.getDomainType());
    }

    private void updateName(Domain updated) {
      // Use getOriginalFqn() which was captured at EntityUpdater construction time.
      // This is reliable even after revert() reassigns 'original' to 'previous'.
      String oldFqn = getOriginalFqn();
      setFullyQualifiedName(updated);
      String newFqn = updated.getFullyQualifiedName();

      if (oldFqn.equals(newFqn)) {
        return;
      }

      // Only process the rename once per update operation.
      // entitySpecificUpdate is called multiple times during the update flow
      // (incrementalChange, revert, final updateInternal).
      if (renameProcessed) {
        return;
      }
      renameProcessed = true;

      Domain existing = findByNameOrNull(updated.getName(), ALL);
      if (existing != null && !existing.getId().equals(updated.getId())) {
        throw new IllegalArgumentException(entityNameAlreadyExists(DOMAIN, updated.getName()));
      }

      LOG.info("Domain FQN changed from {} to {}", oldFqn, newFqn);

      // Update all child domains' FQNs and FQN hashes
      daoCollection.domainDAO().updateFqn(oldFqn, newFqn);

      // Update data products' FQNs under this domain
      daoCollection.dataProductDAO().updateFqn(oldFqn, newFqn);

      recordChange("name", FullyQualifiedName.unquoteName(oldFqn), updated.getName());
      updateEntityLinks(oldFqn, newFqn, updated);
      updateSearchIndexes(oldFqn, newFqn, updated);
      updateTagUsage(oldFqn, newFqn);
    }

    private void updateEntityLinks(String oldFqn, String newFqn, Domain updated) {
      // Update field relationships for feed
      daoCollection.fieldRelationshipDAO().renameByToFQN(oldFqn, newFqn);

      // Update feed entity links for the domain
      EntityLink newAbout = new EntityLink(DOMAIN, newFqn);
      daoCollection
          .feedDAO()
          .updateByEntityId(newAbout.getLinkString(), updated.getId().toString());

      // Update feed entity links for all child domains
      List<Domain> childDomains = getNestedDomains(updated);
      for (Domain child : childDomains) {
        EntityLink childAbout = new EntityLink(DOMAIN, child.getFullyQualifiedName());
        daoCollection
            .feedDAO()
            .updateByEntityId(childAbout.getLinkString(), child.getId().toString());
      }
    }

    private void updateSearchIndexes(String oldFqn, String newFqn, Domain updated) {
      LOG.info(
          "Updating search indexes after renaming domain from {} to {} using bulk operations",
          oldFqn,
          newFqn);

      // Update parent domain in search index with new FQN
      Domain parentWithFields = get(null, updated.getId(), getFields("parent,owners,experts"));
      parentWithFields.setFullyQualifiedName(newFqn);
      parentWithFields.setName(updated.getName());
      searchRepository.updateEntityIndex(parentWithFields);

      // Bulk update all domain entities' FQNs and parent.fullyQualifiedName in search
      // index
      // This updates domain_search_index for all nested domains
      searchRepository.updateDomainFqnByPrefix(oldFqn, newFqn);
      LOG.info("Bulk updated all domain FQNs in search index from {} to {}", oldFqn, newFqn);

      // Bulk update all asset domain references across all indices via global alias
      // This updates the domains[].fullyQualifiedName field in all assets
      searchRepository.updateAssetDomainFqnByPrefix(oldFqn, newFqn);
      LOG.info(
          "Bulk updated all asset domain references in search index from {} to {}", oldFqn, newFqn);
    }

    private void updateTagUsage(String oldFqn, String newFqn) {
      // Update exact match for the domain itself
      daoCollection.tagUsageDAO().updateTargetFQNHash(oldFqn, newFqn);

      // Update prefix matches for child domains (subdomains)
      daoCollection
          .tagUsageDAO()
          .renameByTargetFQNHash(TagSource.CLASSIFICATION.ordinal(), oldFqn, newFqn);
      daoCollection
          .tagUsageDAO()
          .renameByTargetFQNHash(TagSource.GLOSSARY.ordinal(), oldFqn, newFqn);
    }
  }

  private List<Domain> getNestedDomains(Domain domain) {
    List<String> jsons = daoCollection.domainDAO().getNestedDomains(domain.getFullyQualifiedName());
    return JsonUtils.readObjects(jsons, Domain.class);
  }

  private Map<UUID, EntityReference> batchFetchParents(List<Domain> domains) {
    var parentsMap = new HashMap<UUID, EntityReference>();
    if (domains == null || domains.isEmpty()) {
      return parentsMap;
    }

    // Single batch query to get all parent relationships
    var records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(domains), Relationship.CONTAINS.ordinal());

    // Map domain to its parent
    records.forEach(
        record -> {
          var domainId = UUID.fromString(record.getToId());
          var parentRef =
              getEntityReferenceById(DOMAIN, UUID.fromString(record.getFromId()), NON_DELETED);
          parentsMap.put(domainId, parentRef);
        });

    return parentsMap;
  }

  private Map<UUID, List<EntityReference>> batchFetchExperts(List<Domain> domains) {
    var expertsMap = new HashMap<UUID, List<EntityReference>>();
    if (domains == null || domains.isEmpty()) {
      return expertsMap;
    }

    // Initialize empty lists for all domains
    domains.forEach(domain -> expertsMap.put(domain.getId(), new ArrayList<>()));

    // Single batch query to get all expert relationships
    var records =
        daoCollection
            .relationshipDAO()
            .findToBatch(entityListToStrings(domains), Relationship.EXPERT.ordinal(), Entity.USER);

    // Group experts by domain ID
    records.forEach(
        record -> {
          var domainId = UUID.fromString(record.getFromId());
          var expertRef =
              getEntityReferenceById(Entity.USER, UUID.fromString(record.getToId()), NON_DELETED);
          expertsMap.get(domainId).add(expertRef);
        });

    return expertsMap;
  }
}
