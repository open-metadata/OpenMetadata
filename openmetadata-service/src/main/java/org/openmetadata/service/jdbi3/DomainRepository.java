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
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_PARENT;
import static org.openmetadata.service.Entity.getEntityReferenceById;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNameAlreadyExists;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
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
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CachedRelationshipDao;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.metadata.InheritedReferences;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityBatchFields;
import org.openmetadata.service.entity.read.EntityPageReader;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.domains.DomainResource;
import org.openmetadata.service.search.DefaultInheritedFieldEntitySearch;
import org.openmetadata.service.search.EntityBuilderConstant;
import org.openmetadata.service.search.InheritedFieldEntitySearch;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldQuery;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldResult;
import org.openmetadata.service.search.QueryFilterBuilder;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.IntakeFormValidator;
import org.openmetadata.service.util.LineageUtil;

@Slf4j
@Repository()
public class DomainRepository implements EntityPolicy<Domain> {

  private static final String UPDATE_FIELDS = "parent,children,experts";

  private static final String FIELD_CHILDREN_COUNT = "childrenCount";

  private static final String DESCENDANT_WILDCARD = "%";

  private InheritedFieldEntitySearch inheritedFieldEntitySearch;

  private final ThreadLocal<DomainHardDeleteContext> domainHardDeleteSubtree = new ThreadLocal<>();

  private record RetainedDataProductCascadePlan(
      Set<UUID> retainedDataProductIds, Map<UUID, List<UUID>> deletingParentsByDataProduct) {}

  /**
   * Per-thread context for a single root domain hard-delete cascade: the full subtree of domain ids
   * being deleted, the user that triggered the delete, and the set of shared data products detached
   * during the cascade that must be re-indexed once the cascade completes.
   */
  private static final class DomainHardDeleteContext {

    private final Set<UUID> deletingDomainIds;

    private final String updatedBy;

    private final Set<UUID> dataProductsToReindex = new HashSet<>();

    private DomainHardDeleteContext(Set<UUID> deletingDomainIds, String updatedBy) {
      this.deletingDomainIds = deletingDomainIds;
      this.updatedBy = updatedBy;
    }
  }

  public DomainRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                DomainResource.COLLECTION_PATH,
                DOMAIN,
                Domain.class,
                Entity.getCollectionDAO().domainDAO()),
            new EntityPolicyContext.WriteFields(UPDATE_FIELDS, UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
    context().options().setRenameAllowed(true);
    // Initialize inherited field search
    if (context().dependencies().search() != null) {
      inheritedFieldEntitySearch =
          new DefaultInheritedFieldEntitySearch(context().dependencies().search());
    }
    // Register bulk field fetchers for efficient database operations
    fieldLoading().register(FIELD_PARENT, this::fetchAndSetParents);
    fieldLoading().register(FIELD_EXPERTS, this::fetchAndSetExperts);
    fieldLoading().register(FIELD_CHILDREN_COUNT, this::fetchAndSetChildrenCount);
  }

  @Override
  public void setFields(Domain entity, Fields fields, RelationIncludes relationIncludes) {
    entity.withParent(resolveParentRef(entity));
    entity.withChildrenCount(
        fields.contains(FIELD_CHILDREN_COUNT)
            ? getChildrenCount(entity)
            : entity.getChildrenCount());
  }

  private Integer getChildrenCount(Domain entity) {
    return context()
        .dependencies()
        .daos()
        .domainDAO()
        .countNestedDomains(entity.getFullyQualifiedName());
  }

  private void fetchAndSetParents(List<Domain> domains, Fields fields) {
    // Parent is needed both when explicitly requested and as the source for owners/experts
    // inheritance. Batch-loading it here lets the base inheritance path dedup parent loads instead
    // of resolving each domain's parent with a separate query.
    boolean parentNeeded =
        fields.contains(FIELD_PARENT)
            || fields.contains(FIELD_OWNERS)
            || fields.contains(FIELD_EXPERTS);
    if (!parentNeeded || nullOrEmpty(domains)) {
      return;
    }
    EntityBatchFields.assign(true, domains, batchFetchParents(domains), Domain::setParent);
  }

  private void fetchAndSetExperts(List<Domain> domains, Fields fields) {
    if (fields.contains(FIELD_EXPERTS) && !nullOrEmpty(domains)) {
      EntityBatchFields.assign(true, domains, batchFetchExperts(domains), Domain::setExperts);
    }
  }

  private void fetchAndSetChildrenCount(List<Domain> entities, Fields fields) {
    if (fields.contains(FIELD_CHILDREN_COUNT) && !nullOrEmpty(entities)) {
      Map<UUID, Integer> childCountByDomainId = nestedDescendantCounts(entities);
      entities.forEach(
          entity -> entity.setChildrenCount(childCountByDomainId.getOrDefault(entity.getId(), 0)));
    }
  }

  /**
   * Nested (all-depth) descendant count for each domain on the page, computed with a single DB read
   * plus a single in-memory pass. Candidate descendant hashes are pulled once — scoped to the page's
   * longest common ancestor when there is one, else a full {@code fqnHash} scan — then attributed to
   * their ancestor domains. O(descendants × depth), so it stays linear even for a flat list of every
   * domain.
   */
  private Map<UUID, Integer> nestedDescendantCounts(List<Domain> pageDomains) {
    Map<UUID, String> hashByDomainId =
        pageDomains.stream()
            .collect(
                Collectors.toMap(
                    Domain::getId,
                    domain -> FullyQualifiedName.buildHash(domain.getFullyQualifiedName())));
    Map<String, Integer> descendantCountByHash =
        DomainHierarchyHashes.countDescendantsByAncestor(
            fetchCandidateDescendantHashes(hashByDomainId.values()), hashByDomainId.values());
    return hashByDomainId.entrySet().stream()
        .collect(
            Collectors.toMap(
                Map.Entry::getKey,
                entry -> descendantCountByHash.getOrDefault(entry.getValue(), 0)));
  }

  /**
   * Pull the candidate descendant hashes in a single query. When the page shares a common ancestor
   * (siblings, or domains under one top-level domain) this is a selective index range scan; only a
   * page spanning unrelated top-level domains falls back to a full {@code fqnHash} scan. Never a
   * query-per-parent fan-out.
   */
  private List<String> fetchCandidateDescendantHashes(Collection<String> domainHashes) {
    String commonAncestorHash = DomainHierarchyHashes.longestCommonAncestor(domainHashes);
    List<String> candidateHashes;
    if (commonAncestorHash.isEmpty()) {
      candidateHashes = context().dependencies().daos().domainDAO().listAllFqnHashes();
    } else {
      candidateHashes =
          context()
              .dependencies()
              .daos()
              .domainDAO()
              .listFqnHashesByPrefix(descendantLikePattern(commonAncestorHash));
    }
    return candidateHashes;
  }

  private static String descendantLikePattern(String ancestorHash) {
    return ancestorHash + Entity.SEPARATOR + DESCENDANT_WILDCARD;
  }

  @Override
  public void clearFields(Domain entity, Fields fields) {
    entity.withParent(fields.contains(FIELD_PARENT) ? entity.getParent() : null);
    entity.withChildrenCount(
        fields.contains(FIELD_CHILDREN_COUNT) ? entity.getChildrenCount() : null);
  }

  @Override
  public void prepare(Domain entity, boolean update) {
    // Parent, Experts, Owner are already validated
    IntakeFormValidator.validate(entity, Entity.DOMAIN);
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("parent");
  }

  @Override
  public void storeEntity(Domain entity, boolean update) {
    persistence().store(entity, update);
  }

  @Override
  public void storeEntities(List<Domain> entities) {
    persistence().insertMany(entities);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<Domain> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Domain::getId).toList();
    deleteToMany(ids, Entity.DOMAIN, Relationship.CONTAINS, Entity.DOMAIN);
  }

  @Override
  public void storeRelationships(Domain entity) {
    if (entity.getParent() != null) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  entity.getParent().getId(),
                  entity.getId(),
                  DOMAIN,
                  DOMAIN,
                  Relationship.CONTAINS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
    for (EntityReference expert : listOrEmpty(entity.getExperts())) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  entity.getId(), expert.getId(), DOMAIN, Entity.USER, Relationship.EXPERT),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  @Override
  public String getInheritableFields() {
    return FIELD_OWNERS + "," + FIELD_EXPERTS;
  }

  @Override
  public boolean requiresParentForInheritance(Domain entity, Fields fields) {
    boolean needsOwners = fields.contains(FIELD_OWNERS) && nullOrEmpty(entity.getOwners());
    boolean needsExperts = fields.contains(FIELD_EXPERTS) && nullOrEmpty(entity.getExperts());
    return needsOwners || needsExperts;
  }

  @Override
  public void fetchInheritableRelationships(List<Domain> entities, Fields fields) {
    // Base fetches owners (and domains); a subdomain also inherits experts from its parent, so the
    // parent must carry experts when loaded for inheritance.
    EntityPolicy.super.fetchInheritableRelationships(entities, fields);
    if (fields.contains(FIELD_EXPERTS)) {
      fetchAndSetExperts(entities, fields);
    }
  }

  @Override
  public void applyInheritance(Domain entity, Fields fields, EntityInterface parent) {
    InheritedReferences.apply(InheritedReferences.Field.OWNERS, entity, fields, parent);
    InheritedReferences.apply(InheritedReferences.Field.EXPERTS, entity, fields, parent);
  }

  public BulkOperationResult bulkAddAssets(String domainName, BulkAssets request, String userName) {
    Domain domain = getByName(null, domainName, fieldPolicy().parse("id"));
    return bulkAssetsOperation(domain.getId(), DOMAIN, Relationship.HAS, request, true, userName);
  }

  public BulkOperationResult bulkRemoveAssets(
      String domainName, BulkAssets request, String userName) {
    Domain domain = getByName(null, domainName, fieldPolicy().parse("id"));
    return bulkAssetsOperation(domain.getId(), DOMAIN, Relationship.HAS, request, false, userName);
  }

  public ResultList<EntityReference> getDomainAssets(UUID domainId, int limit, int offset) {
    Domain domain =
        reads()
            .byId(
                domainId,
                new EntityReadService.Query(
                    null,
                    fieldPolicy().parse("id,fullyQualifiedName"),
                    RelationIncludes.fromInclude(Include.NON_DELETED),
                    false));
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
    Domain domain = getByName(null, domainName, fieldPolicy().parse("id,fullyQualifiedName"));
    return getDomainAssets(domain.getId(), limit, offset);
  }

  public Map<String, Integer> getAllDomainsWithAssetsCount() {
    if (inheritedFieldEntitySearch == null) {
      LOG.warn("Search unavailable for domain asset counts");
      return new HashMap<>();
    }
    List<String> allFqns = context().dependencies().daos().domainDAO().listAllFqns();
    Map<String, Integer> domainAssetCounts = new LinkedHashMap<>();
    for (String fullyQualifiedName : allFqns) {
      domainAssetCounts.put(fullyQualifiedName, 0);
    }
    String queryFilter =
        QueryFilterBuilder.buildDomainAssetsCountFilter("domains.fullyQualifiedName");
    Map<String, Integer> exactCounts =
        inheritedFieldEntitySearch.getAggregatedCountsByField(
            "domains.fullyQualifiedName", queryFilter, EntityBuilderConstant.MAX_AGGREGATE_SIZE);
    for (Map.Entry<String, Integer> entry : exactCounts.entrySet()) {
      String currentDomainFqn = entry.getKey();
      int count = entry.getValue();
      while (currentDomainFqn != null) {
        if (domainAssetCounts.containsKey(currentDomainFqn)) {
          domainAssetCounts.computeIfPresent(
              currentDomainFqn, (ignored, current) -> current + count);
        }
        int separatorIndex = currentDomainFqn.lastIndexOf('.');
        currentDomainFqn =
            separatorIndex > 0 ? currentDomainFqn.substring(0, separatorIndex) : null;
      }
    }
    return domainAssetCounts;
  }

  @Transaction
  @Override
  public BulkOperationResult bulkAssetsOperation(
      UUID entityId,
      String fromEntity,
      Relationship relationship,
      BulkAssets request,
      boolean isAdd,
      String userName) {
    boolean dryRun = Boolean.TRUE.equals(request.getDryRun());
    BulkOperationResult result =
        new BulkOperationResult().withStatus(ApiStatus.SUCCESS).withDryRun(dryRun);
    List<BulkResponse> success = new ArrayList<>();
    if (nullOrEmpty(request.getAssets())) {
      // Nothing to Validate — schema marks assets optional, so a request without it is valid
      return result.withSuccessRequest(
          List.of(new BulkResponse().withMessage("Nothing to Validate.")));
    }
    EntityUtil.populateEntityReferences(request.getAssets());
    EntityReference domainRef = isAdd ? getEntityReferenceById(DOMAIN, entityId, ALL) : null;
    for (EntityReference ref : request.getAssets()) {
      result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);
      if (dryRun) {
        success.add(buildDryRunImpactResponse(entityId, ref, relationship, isAdd));
        result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
        continue;
      }
      cleanupOldDomain(ref, fromEntity, relationship);
      cleanupDataProducts(entityId, ref, relationship, isAdd);
      if (isAdd) {
        relationshipWrites()
            .add(
                new EntityRelationshipWriter.Edge(
                    entityId, ref.getId(), fromEntity, ref.getType(), relationship),
                EntityRelationshipWriter.Value.EMPTY,
                false);
        LineageUtil.addDomainLineage(entityId, ref.getType(), domainRef);
      }
      // The asset's stored entity JSON has `domains` stripped (FIELDS_STORED_AS_RELATIONSHIPS)
      // and re-derived from entity_relationship on read. The relationship row is fresh, but
      // the asset's cached entity bundle and the per-field domains/owners hash entry both
      // hold the previous-domain view. Drop every cached variant so the next read rebuilds
      // it from the freshly-written relationships.
      EntityCaches.invalidations()
          .referencesChanged(ref.getType(), ref.getId(), ref.getFullyQualifiedName());
      success.add(new BulkResponse().withRequest(ref));
      result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
      // Re-index the asset and fan its re-derived domains out to inherited descendants in search.
      // Uniform for add and remove: on add descendants follow the newly assigned domain; on remove
      // they follow whatever the asset now inherits from its own ancestry (or are cleared if none),
      // matching the entity page. Descendants with an explicit domain are left untouched.
      context().dependencies().search().updateEntityAndPropagateInheritedDomainsToChildren(ref);
    }
    result.withSuccessRequest(success);
    if (!dryRun && result.getStatus().equals(ApiStatus.SUCCESS)) {
      EntityInterface entityInterface = Entity.getEntity(fromEntity, entityId, "id", ALL);
      ChangeDescription change =
          addBulkAddRemoveChangeDescription(
              entityInterface.getVersion(), isAdd, request.getAssets(), null);
      String eventUserName = userName != null ? userName : entityInterface.getUpdatedBy();
      ChangeEvent changeEvent =
          getChangeEvent(
              entityInterface, change, fromEntity, entityInterface.getVersion(), eventUserName);
      Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
    }
    return result;
  }

  private BulkResponse buildDryRunImpactResponse(
      UUID targetDomainId, EntityReference ref, Relationship relationship, boolean isAdd) {
    BulkResponse response;
    try {
      EntityReference currentDomain =
          relationships()
              .singleFrom(
                  new EntityRelationshipReader.Selection(
                      ref.getId(), ref.getType(), relationship, DOMAIN),
                  false,
                  true);
      List<EntityReference> affectedDataProducts =
          getAffectedDataProductsForDryRun(targetDomainId, ref, relationship, isAdd);
      boolean isMove =
          isAdd && currentDomain != null && !currentDomain.getId().equals(targetDomainId);
      boolean hasSideEffects = isMove || !affectedDataProducts.isEmpty();
      String message =
          buildDryRunImpactMessage(ref, currentDomain, targetDomainId, affectedDataProducts, isAdd);
      response =
          new BulkResponse()
              .withRequest(ref)
              .withMessage(message)
              .withHasSideEffects(hasSideEffects);
    } catch (Exception e) {
      // Dry-run is a best-effort preview — a single asset whose impact can't be
      // computed (e.g. a dangling relationship) must not abort the whole batch.
      // Surface the failure on that asset's response and keep going.
      LOG.warn("Failed to compute dry-run impact for asset {}", ref.getId(), e);
      response =
          new BulkResponse()
              .withRequest(ref)
              .withMessage("Impact could not be computed: " + e.getMessage())
              .withHasSideEffects(false);
    }
    return response;
  }

  private List<EntityReference> getAffectedDataProductsForDryRun(
      UUID targetDomainId, EntityReference ref, Relationship relationship, boolean isAdd) {
    List<EntityReference> dataProducts = getDataProducts(ref.getId(), ref.getType());
    if (dataProducts.isEmpty()) {
      return dataProducts;
    }
    if (!isAdd) {
      return dataProducts;
    }
    return filterDataProductsByDomain(dataProducts, targetDomainId, relationship);
  }

  private String buildDryRunImpactMessage(
      EntityReference ref,
      EntityReference currentDomain,
      UUID targetDomainId,
      List<EntityReference> affectedDataProducts,
      boolean isAdd) {
    StringBuilder message = new StringBuilder();
    if (isAdd) {
      if (currentDomain == null) {
        message
            .append(ref.getType())
            .append(" '")
            .append(ref.getFullyQualifiedName())
            .append("' will be added to the domain.");
      } else if (currentDomain.getId().equals(targetDomainId)) {
        message
            .append(ref.getType())
            .append(" '")
            .append(ref.getFullyQualifiedName())
            .append("' is already in this domain.");
      } else {
        message
            .append(ref.getType())
            .append(" '")
            .append(ref.getFullyQualifiedName())
            .append("' will be moved from domain '")
            .append(currentDomain.getFullyQualifiedName())
            .append("'.");
      }
      if (!affectedDataProducts.isEmpty()) {
        message.append(" The following data product relationships will be removed: ");
        message.append(
            affectedDataProducts.stream()
                .map(EntityReference::getFullyQualifiedName)
                .collect(Collectors.joining(", ")));
        message.append(".");
      }
    } else {
      message
          .append(ref.getType())
          .append(" '")
          .append(ref.getFullyQualifiedName())
          .append("' will be removed from the domain.");
      if (!affectedDataProducts.isEmpty()) {
        message.append(" The following data product relationships will also be removed: ");
        message.append(
            affectedDataProducts.stream()
                .map(EntityReference::getFullyQualifiedName)
                .collect(Collectors.joining(", ")));
        message.append(".");
      }
    }
    return message.toString();
  }

  private void cleanupOldDomain(EntityReference ref, String fromEntity, Relationship relationship) {
    EntityReference oldDomain =
        relationships()
            .singleFrom(
                new EntityRelationshipReader.Selection(
                    ref.getId(), ref.getType(), relationship, DOMAIN),
                false,
                true);
    relationshipWrites()
        .deleteIncoming(
            new EntityRelationshipWriter.Selection(
                ref.getId(), ref.getType(), relationship, fromEntity));
    LineageUtil.removeDomainLineage(ref.getId(), ref.getType(), oldDomain);
  }

  @Override
  public void deleteChildren(UUID id, boolean recursive, boolean hardDelete, String updatedBy) {
    boolean rootDomainHardDelete = hardDelete && domainHardDeleteSubtree.get() == null;
    if (rootDomainHardDelete) {
      domainHardDeleteSubtree.set(
          new DomainHardDeleteContext(collectDomainSubtreeIds(List.of(id)), updatedBy));
    }
    try {
      EntityPolicy.super.deleteChildren(id, recursive, hardDelete, updatedBy);
    } finally {
      if (rootDomainHardDelete) {
        DomainHardDeleteContext context = domainHardDeleteSubtree.get();
        domainHardDeleteSubtree.remove();
        reindexDetachedDataProducts(context);
      }
    }
  }

  @Override
  public Runnable enterBulkHardDeleteCascade(List<Domain> domains) {
    if (domainHardDeleteSubtree.get() != null) {
      return () -> {};
    }
    DomainHardDeleteContext context =
        new DomainHardDeleteContext(
            collectDomainSubtreeIds(domains.stream().map(Domain::getId).toList()), null);
    domainHardDeleteSubtree.set(context);
    return () -> {
      domainHardDeleteSubtree.remove();
      reindexDetachedDataProducts(context);
    };
  }

  @Override
  public List<CollectionDAO.EntityRelationshipRecord> prepareChildrenForHardDeleteCascade(
      UUID parentId, List<CollectionDAO.EntityRelationshipRecord> children, String updatedBy) {
    List<String> dataProductIds =
        children.stream()
            .filter(child -> DATA_PRODUCT.equals(child.getType()))
            .map(child -> child.getId().toString())
            .distinct()
            .toList();
    if (dataProductIds.isEmpty()) {
      return children;
    }
    DomainHardDeleteContext context = requireContext();
    RetainedDataProductCascadePlan plan =
        retainedSharedDataProductCascadePlan(dataProductIds, context.deletingDomainIds);
    if (plan.retainedDataProductIds().isEmpty()) {
      return children;
    }
    detachRetainedDataProductsFromDeletingDomains(
        plan.retainedDataProductIds(), plan.deletingParentsByDataProduct(), context, updatedBy);
    return children.stream()
        .filter(
            child ->
                !DATA_PRODUCT.equals(child.getType())
                    || !plan.retainedDataProductIds().contains(child.getId()))
        .toList();
  }

  @Override
  public List<CollectionDAO.EntityRelationshipObject> prepareChildrenForHardDeleteCascade(
      List<Domain> parents,
      List<CollectionDAO.EntityRelationshipObject> children,
      String updatedBy) {
    List<String> dataProductIds =
        children.stream()
            .filter(this::isDomainDataProductContainment)
            .map(CollectionDAO.EntityRelationshipObject::getToId)
            .distinct()
            .toList();
    if (dataProductIds.isEmpty()) {
      return children;
    }
    DomainHardDeleteContext context = requireContext();
    RetainedDataProductCascadePlan plan =
        retainedSharedDataProductCascadePlan(dataProductIds, context.deletingDomainIds);
    if (plan.retainedDataProductIds().isEmpty()) {
      return children;
    }
    detachRetainedDataProductsFromDeletingDomains(
        plan.retainedDataProductIds(), plan.deletingParentsByDataProduct(), context, updatedBy);
    return children.stream()
        .filter(
            child ->
                !isDomainDataProductContainment(child)
                    || !plan.retainedDataProductIds().contains(UUID.fromString(child.getToId())))
        .toList();
  }

  private boolean isDomainDataProductContainment(CollectionDAO.EntityRelationshipObject child) {
    return Relationship.CONTAINS.ordinal() == child.getRelation()
        && DOMAIN.equals(child.getFromEntity())
        && DATA_PRODUCT.equals(child.getToEntity());
  }

  private DomainHardDeleteContext requireContext() {
    DomainHardDeleteContext context = domainHardDeleteSubtree.get();
    if (context == null) {
      throw new IllegalStateException("Domain hard-delete subtree context is not initialized");
    }
    return context;
  }

  private Set<UUID> collectDomainSubtreeIds(List<UUID> rootIds) {
    Set<UUID> domainIds = new HashSet<>();
    ArrayDeque<UUID> queue = new ArrayDeque<>(rootIds);
    while (!queue.isEmpty()) {
      UUID domainId = queue.removeFirst();
      if (!domainIds.add(domainId)) {
        continue;
      }
      context()
          .dependencies()
          .daos()
          .relationshipDAO()
          .findTo(domainId, DOMAIN, Relationship.CONTAINS.ordinal(), DOMAIN)
          .forEach(child -> queue.add(child.getId()));
    }
    return domainIds;
  }

  private RetainedDataProductCascadePlan retainedSharedDataProductCascadePlan(
      List<String> dataProductIds, Set<UUID> deletingDomainIds) {
    Map<UUID, List<UUID>> deletingParentsByDataProduct = new HashMap<>();
    Set<UUID> retainedDataProductIds = new HashSet<>();
    context()
        .dependencies()
        .daos()
        .relationshipDAO()
        .findFromBatch(dataProductIds, Relationship.CONTAINS.ordinal(), DOMAIN, ALL)
        .forEach(
            relationship -> {
              UUID dataProductId = UUID.fromString(relationship.getToId());
              UUID domainId = UUID.fromString(relationship.getFromId());
              if (deletingDomainIds.contains(domainId)) {
                deletingParentsByDataProduct
                    .computeIfAbsent(dataProductId, id -> new ArrayList<>())
                    .add(domainId);
              } else {
                retainedDataProductIds.add(dataProductId);
              }
            });
    return new RetainedDataProductCascadePlan(retainedDataProductIds, deletingParentsByDataProduct);
  }

  private void detachRetainedDataProductsFromDeletingDomains(
      Set<UUID> retainedDataProductIds,
      Map<UUID, List<UUID>> deletingParentsByDataProduct,
      DomainHardDeleteContext context,
      String updatedBy) {
    DataProductRepository dataProductRepository =
        (DataProductRepository) Entity.getEntityRepository(DATA_PRODUCT);
    String detachUpdatedBy = updatedBy != null ? updatedBy : context.updatedBy;
    for (UUID dataProductId : retainedDataProductIds) {
      dataProductRepository.detachFromDeletingDomains(
          dataProductId, deletingParentsByDataProduct.get(dataProductId), detachUpdatedBy);
      context.dataProductsToReindex.add(dataProductId);
    }
  }

  private void reindexDetachedDataProducts(DomainHardDeleteContext context) {
    if (context != null && !context.dataProductsToReindex.isEmpty()) {
      DataProductRepository dataProductRepository =
          (DataProductRepository) Entity.getEntityRepository(DATA_PRODUCT);
      dataProductRepository.reindexAfterDomainDetach(context.dataProductsToReindex);
    }
  }

  private void cleanupDataProducts(
      UUID entityId, EntityReference ref, Relationship relationship, boolean isAdd) {
    List<EntityReference> dataProducts = getDataProducts(ref.getId(), ref.getType());
    if (dataProducts.isEmpty()) return;
    List<EntityReference> dataProductsToDelete =
        isAdd ? filterDataProductsByDomain(dataProducts, entityId, relationship) : dataProducts;
    if (!dataProductsToDelete.isEmpty()) {
      context()
          .dependencies()
          .daos()
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

  private List<EntityReference> filterDataProductsByDomain(
      List<EntityReference> dataProducts, UUID targetDomainId, Relationship relationship) {
    Map<UUID, UUID> associatedDomains =
        context()
            .dependencies()
            .daos()
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
    return dataProducts.stream()
        .filter(
            dp -> {
              UUID domainId = associatedDomains.get(dp.getId());
              return domainId != null && !domainId.equals(targetDomainId);
            })
        .collect(Collectors.toList());
  }

  @Override
  public EntityUpdater<Domain> getUpdater(
      Domain original, Domain updated, EntityOperation operation, ChangeSource changeSource) {
    return new DomainUpdater(original, updated, operation).mutation();
  }

  @Override
  public void restorePatchAttributes(Domain original, Domain updated) {
    EntityPolicy.super.restorePatchAttributes(original, updated);
    // Parent can't be changed
    updated.withParent(original.getParent());
    // Children can't be changed
    updated.withChildren(original.getChildren());
  }

  @Override
  public void setFullyQualifiedName(Domain entity) {
    // Validate parent
    if (entity.getParent() == null) {
      // Top level domain
      entity.setFullyQualifiedName(FullyQualifiedName.build(entity.getName()));
    } else {
      // Sub domain
      EntityReference parent = entity.getParent();
      entity.setFullyQualifiedName(
          FullyQualifiedName.add(parent.getFullyQualifiedName(), entity.getName()));
    }
  }

  @Override
  public EntityReference getParentReference(Domain entity) {
    return entity.getParent();
  }

  private EntityReference resolveParentRef(Domain entity) {
    // fromEntityType MUST be null here: the cache-aware container fast-path in the 5-arg
    // getFromEntityRef only engages for a type-agnostic CONTAINS lookup. Passing DOMAIN would be
    // "clearer" but would bypass the relationship-container cache entirely, defeating the warm-read
    // optimization. A domain's only CONTAINS parent is its parent domain, so the lookup is
    // unambiguous today; if another entity type is ever allowed to CONTAIN a domain, the container
    // cache contract itself (not just this call) would need revisiting.
    return relationships()
        .singleFrom(
            new EntityRelationshipReader.Selection(
                entity.getId(), DOMAIN, Relationship.CONTAINS, null),
            false,
            true);
  }

  @Override
  public EntityInterface getParentEntity(Domain entity, String fields) {
    return entity.getParent() != null
        ? Entity.getEntity(entity.getParent(), fields, Include.NON_DELETED)
        : null;
  }

  public ResultList<EntityHierarchy> buildHierarchy(
      String fieldsParam, int limit, String directChildrenOf, int offset) {
    return buildHierarchy(fieldsParam, limit, directChildrenOf, offset, null);
  }

  public ResultList<EntityHierarchy> buildHierarchy(
      String fieldsParam,
      int limit,
      String directChildrenOf,
      int offset,
      SecurityContext securityContext) {
    fieldsParam = EntityUtil.addField(fieldsParam, Entity.FIELD_PARENT);
    Fields fields = fieldPolicy().parse(fieldsParam);
    ListFilter filter = new ListFilter(null);
    filter.addQueryParam("directChildrenOf", directChildrenOf);
    filter.addQueryParam("offset", String.valueOf(offset));
    // Enable hierarchy filtering
    filter.addQueryParam("hierarchyFilter", "true");
    if (securityContext != null) {
      EntityUtil.applyDomainSelfRestriction(securityContext, filter);
    }
    ResultList<Domain> resultList =
        pages().after(new EntityPageReader.Projection(null, fields, filter), limit, null);
    List<Domain> domains = resultList.getData();
    List<EntityHierarchy> hierarchyList =
        domains.stream()
            .map(domain -> JsonUtils.readValue(JsonUtils.pojoToJson(domain), EntityHierarchy.class))
            .collect(Collectors.toList());
    int total =
        resultList.getPaging() != null ? resultList.getPaging().getTotal() : hierarchyList.size();
    return new ResultList<>(hierarchyList, null, null, total);
  }

  public class DomainUpdater implements EntitySpecificMutation<Domain> {

    private boolean renameProcessed = false;

    public DomainUpdater(Domain original, Domain updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void reset() {
      renameProcessed = false;
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Domain> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate("name", () -> updateName(entityUpdate.getUpdated()));
      entityUpdate.compareAndUpdate(
          "domainType",
          () ->
              entityUpdate.recordChange(
                  "domainType",
                  entityUpdate.getOriginal().getDomainType(),
                  entityUpdate.getUpdated().getDomainType()));
    }

    private void updateName(Domain updated) {
      // Use getOriginalFqn() which was captured at EntityUpdater construction time.
      // This is reliable even after revert() reassigns 'original' to 'previous'.
      String oldFqn = entityUpdate.getOriginalFqn();
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
      Domain existing = lookup().byNameOrNull(updated.getName(), ALL);
      if (existing != null && !existing.getId().equals(updated.getId())) {
        throw new IllegalArgumentException(entityNameAlreadyExists(DOMAIN, updated.getName()));
      }
      LOG.info("Domain FQN changed from {} to {}", oldFqn, newFqn);
      // Drop cache entries for every descendant before we rewrite the DB: child domains and any
      // data product under this domain. Must happen BEFORE updateFqn so the descendant lookup
      // matches the old FQN prefix. The publish() fan-out handles peer instances.
      // Capture the descendants so the post-write pass can re-evict any entry a racing reader
      // re-populated with the pre-rename row between this call and the DAO updateFqn below.
      // The pass below runs after updateFqn but inside this transaction — see
      // EntityCaches.targets().beforeRename for the residual pre-commit window.
      List<EntityDAO.EntityIdFqnPair> renamedDomains =
          EntityCaches.targets().beforeRename(Entity.DOMAIN, oldFqn);
      List<EntityDAO.EntityIdFqnPair> renamedDataProducts =
          EntityCaches.targets().beforeRename(Entity.DATA_PRODUCT, oldFqn);
      // Update all child domains' FQNs and FQN hashes
      context().dependencies().daos().domainDAO().updateFqn(oldFqn, newFqn);
      // Update data products' FQNs under this domain
      context().dependencies().daos().dataProductDAO().updateFqn(oldFqn, newFqn);
      entityUpdate.recordChange("name", FullyQualifiedName.unquoteName(oldFqn), updated.getName());
      updateEntityLinks(oldFqn, newFqn, updated);
      updateSearchIndexes(oldFqn, newFqn, updated);
      updateTagUsage(oldFqn, newFqn);
      // Any asset (table/dashboard/...) that carries this domain in its `domains` reference
      // now has a stale FQN embedded in its cache. Invalidate them so next read rebuilds with
      // the new FQN. Covers both the renamed domain and every descendant domain we just bulk-
      // updated above.
      invalidateDomainReferencers(updated.getId());
      for (Domain child : getNestedDomains(updated)) {
        invalidateDomainReferencers(child.getId());
      }
      EntityCaches.targets().afterRename(Entity.DOMAIN, renamedDomains);
      EntityCaches.targets().afterRename(Entity.DATA_PRODUCT, renamedDataProducts);
    }

    private void invalidateDomainReferencers(UUID domainId) {
      // Pull the referencer FQN from the relationship record JSON so the by-name cache variant
      // is evicted alongside the by-id one. Without it, GET-by-name for assets that embed this
      // domain would keep returning the stale domain reference until TTL.
      List<CollectionDAO.EntityRelationshipRecord> referencers =
          context()
              .dependencies()
              .daos()
              .relationshipDAO()
              .findTo(domainId, Entity.DOMAIN, Relationship.HAS.ordinal());
      for (CollectionDAO.EntityRelationshipRecord record : referencers) {
        EntityCaches.invalidations().referenced(record);
      }
    }

    private void updateEntityLinks(String oldFqn, String newFqn, Domain updated) {
      // Update field relationships for feed
      context().dependencies().daos().fieldRelationshipDAO().renameByToFQN(oldFqn, newFqn);
      ConversationRepository conversations = Entity.getConversationRepository();
      conversations.updateEntityReference(updated.getEntityReference(), oldFqn);
      // Update feed entity links for all child domains
      List<Domain> childDomains = getNestedDomains(updated);
      for (Domain child : childDomains) {
        String childNewFqn = child.getFullyQualifiedName();
        String childOldFqn = oldFqn + childNewFqn.substring(newFqn.length());
        conversations.updateEntityReference(child.getEntityReference(), childOldFqn);
      }
    }

    private void updateSearchIndexes(String oldFqn, String newFqn, Domain updated) {
      LOG.info(
          "Updating search indexes after renaming domain from {} to {} using bulk operations",
          oldFqn,
          newFqn);
      // Update parent domain in search index with new FQN
      Domain parentWithFields =
          reads()
              .byId(
                  updated.getId(),
                  new EntityReadService.Query(
                      null,
                      fieldPolicy().parse("parent,owners,experts"),
                      RelationIncludes.fromInclude(Include.NON_DELETED),
                      false));
      parentWithFields.setFullyQualifiedName(newFqn);
      parentWithFields.setName(updated.getName());
      context().dependencies().search().updateEntityIndex(parentWithFields);
      // Bulk update all domain entities' FQNs and parent.fullyQualifiedName in search
      // index
      // This updates domain_search_index for all nested domains
      context().dependencies().search().updateDomainFqnByPrefix(oldFqn, newFqn);
      LOG.info("Bulk updated all domain FQNs in search index from {} to {}", oldFqn, newFqn);
      // Bulk update all asset domain references across all indices via global alias
      // This updates the domains[].fullyQualifiedName field in all assets
      context().dependencies().search().updateAssetDomainFqnByPrefix(oldFqn, newFqn);
      LOG.info(
          "Bulk updated all asset domain references in search index from {} to {}", oldFqn, newFqn);
    }

    private void updateTagUsage(String oldFqn, String newFqn) {
      // Update exact match for the domain itself
      context().dependencies().daos().tagUsageDAO().updateTargetFQNHash(oldFqn, newFqn);
      // Update prefix matches for child domains (subdomains)
      context()
          .dependencies()
          .daos()
          .tagUsageDAO()
          .renameByTargetFQNHash(TagSource.CLASSIFICATION.ordinal(), oldFqn, newFqn);
      context()
          .dependencies()
          .daos()
          .tagUsageDAO()
          .renameByTargetFQNHash(TagSource.GLOSSARY.ordinal(), oldFqn, newFqn);
    }

    private final EntityUpdater<Domain> entityUpdate;

    public EntityUpdater<Domain> mutation() {
      return entityUpdate;
    }
  }

  private List<Domain> getNestedDomains(Domain domain) {
    List<String> jsons =
        context()
            .dependencies()
            .daos()
            .domainDAO()
            .getNestedDomains(domain.getFullyQualifiedName());
    return JsonUtils.readObjects(jsons, Domain.class);
  }

  private Map<UUID, EntityReference> batchFetchParents(List<Domain> domains) {
    var parentsMap = new HashMap<UUID, EntityReference>();
    if (nullOrEmpty(domains)) {
      return parentsMap;
    }
    var records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(entityListToStrings(domains), Relationship.CONTAINS.ordinal());
    List<UUID> parentIds =
        records.stream().map(record -> UUID.fromString(record.getFromId())).distinct().toList();
    // Resolve with ALL to match the single-read cache-aware path (getFromEntityRef resolves the
    // container with ALL), so entries this batch warms into the container cache are consistent
    // with what a subsequent single read expects. Domains don't support soft delete, so ALL and
    // NON_DELETED are equivalent here today.
    Map<UUID, EntityReference> parentRefsById =
        Entity.getEntityReferencesByIds(DOMAIN, parentIds, ALL).stream()
            .collect(Collectors.toMap(EntityReference::getId, Function.identity(), (a, b) -> a));
    CachedRelationshipDao containerCache = CacheBundle.getCachedRelationshipDao();
    records.forEach(
        record -> {
          var parentRef = parentRefsById.get(UUID.fromString(record.getFromId()));
          if (parentRef != null) {
            UUID childId = UUID.fromString(record.getToId());
            parentsMap.put(childId, parentRef);
            // Warm the container cache so a later single read of this domain hits the cache
            // instead of the DB. The batch resolves the same CONTAINS parent that the 5-arg
            // getFromEntityRef caches; no-op when distributed caching is disabled.
            if (containerCache != null) {
              containerCache.putContainer(
                  DOMAIN, childId, Relationship.CONTAINS.ordinal(), parentRef);
            }
          }
        });
    return parentsMap;
  }

  private Map<UUID, List<EntityReference>> batchFetchExperts(List<Domain> domains) {
    var expertsMap = new HashMap<UUID, List<EntityReference>>();
    if (domains == null || domains.isEmpty()) {
      return expertsMap;
    }
    domains.forEach(domain -> expertsMap.put(domain.getId(), new ArrayList<>()));
    var records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findToBatch(entityListToStrings(domains), Relationship.EXPERT.ordinal(), Entity.USER);
    List<UUID> expertIds =
        records.stream().map(r -> UUID.fromString(r.getToId())).distinct().toList();
    Map<UUID, EntityReference> expertRefsById =
        Entity.getEntityReferencesByIds(Entity.USER, expertIds, Include.NON_DELETED).stream()
            .collect(Collectors.toMap(EntityReference::getId, Function.identity(), (a, b) -> a));
    records.forEach(
        record -> {
          var domainId = UUID.fromString(record.getFromId());
          var expertRef = expertRefsById.get(UUID.fromString(record.getToId()));
          if (expertRef != null) {
            expertsMap.get(domainId).add(expertRef);
          }
        });
    return expertsMap;
  }

  private final EntityPolicyContext<Domain> entityContext;

  @Override
  public final EntityPolicyContext<Domain> context() {
    return entityContext;
  }
}
