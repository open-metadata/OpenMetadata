package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public record DataContractIndex(DataContract dataContract) implements SearchIndex {
  private static final Logger INDEX_LOG = LoggerFactory.getLogger(DataContractIndex.class);

  /** Large or free-form contract blocks; indexing them would explode the dynamic mapping. */
  private static final Set<String> EXCLUDED_FIELDS =
      Set.of(
          "schema",
          "semantics",
          "qualityExpectations",
          "odcsQualityRules",
          "odcsElementExtensions",
          "odcsPreservedFields",
          "contractUpdates",
          "sla",
          "security",
          "termsOfUse");

  @Override
  public Object getEntity() {
    return dataContract;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.DATA_CONTRACT;
  }

  @Override
  public Map<String, Object> buildSearchIndexDoc(DocBuildContext ctx) {
    final Map<String, Object> doc = SearchIndex.super.buildSearchIndexDoc(ctx);
    // DataContract has no domains field of its own, so copy its governed entity's effective
    // domains onto the top-level document for search RBAC (hasDomain / matchAnyDomain).
    // ADR:2026-11-28-data-contract-search-documents-carry-their-governed-entitys-domains
    final List<EntityReference> domains =
        ctx != null && ctx.prefetchedDomains() != null
            ? ctx.prefetchedDomains()
            : resolveGovernedEntityDomains(dataContract);
    doc.put(Entity.FIELD_DOMAINS, getEntitiesWithDisplayName(domains));
    return doc;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("entity", getEntityWithDisplayName(dataContract.getEntity()));
    doc.put("testSuite", getEntityWithDisplayName(dataContract.getTestSuite()));
    return doc;
  }

  @Override
  public Set<String> getExcludedFields() {
    return EXCLUDED_FIELDS;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }

  public static Map<UUID, List<EntityReference>> prefetchGovernedEntityDomains(
      List<? extends EntityInterface<?>> entities) {
    final Map<String, List<DataContract>> contractsByTargetType =
        groupContractsByTargetType(entities);
    final Map<UUID, List<EntityReference>> prefetched = new HashMap<>();
    contractsByTargetType.forEach(
        (targetType, contracts) -> prefetchDomainsForTargetType(targetType, contracts, prefetched));
    return prefetched.isEmpty() ? null : prefetched;
  }

  private static Map<String, List<DataContract>> groupContractsByTargetType(
      List<? extends EntityInterface<?>> entities) {
    final Map<String, List<DataContract>> grouped = new LinkedHashMap<>();
    for (EntityInterface<?> entity : listOrEmpty(entities)) {
      if (entity instanceof DataContract contract
          && contract.getId() != null
          && hasResolvableDomainTarget(contract.getEntity())) {
        grouped
            .computeIfAbsent(contract.getEntity().getType(), ignored -> new ArrayList<>())
            .add(contract);
      }
    }
    return grouped;
  }

  private static void prefetchDomainsForTargetType(
      String targetType,
      List<DataContract> contracts,
      Map<UUID, List<EntityReference>> prefetched) {
    final List<EntityReference> uniqueTargets = uniqueTargetReferences(contracts);
    try {
      final List<EntityInterface<?>> targetEntities =
          Entity.getEntities(uniqueTargets, Entity.FIELD_DOMAINS, Include.ALL);
      final Map<UUID, List<EntityReference>> domainsByTargetId =
          new HashMap<>(targetEntities.size());
      for (EntityInterface<?> targetEntity : targetEntities) {
        if (targetEntity != null && targetEntity.getId() != null) {
          domainsByTargetId.put(targetEntity.getId(), listOrEmpty(targetEntity.getDomains()));
        }
      }
      bindPrefetchedDomains(contracts, domainsByTargetId, prefetched);
    } catch (Exception ex) {
      // Leave this target type unprefetched so buildSearchIndexDoc falls back per contract.
      INDEX_LOG.warn(
          "Skipping batch domain prefetch for {} {} data contracts: {}",
          contracts.size(),
          targetType,
          ex.getMessage());
    }
  }

  private static List<EntityReference> uniqueTargetReferences(List<DataContract> contracts) {
    final Map<UUID, EntityReference> byId = new LinkedHashMap<>();
    for (DataContract contract : contracts) {
      byId.putIfAbsent(contract.getEntity().getId(), contract.getEntity());
    }
    return List.copyOf(byId.values());
  }

  private static void bindPrefetchedDomains(
      List<DataContract> contracts,
      Map<UUID, List<EntityReference>> domainsByTargetId,
      Map<UUID, List<EntityReference>> prefetched) {
    for (DataContract contract : contracts) {
      final List<EntityReference> targetDomains =
          domainsByTargetId.get(contract.getEntity().getId());
      // Missing targets stay out of the map so buildSearchIndexDoc fails closed on them.
      if (targetDomains != null) {
        prefetched.put(contract.getId(), targetDomains);
      }
    }
  }

  private static List<EntityReference> resolveGovernedEntityDomains(DataContract dataContract) {
    final EntityReference target = dataContract.getEntity();
    List<EntityReference> domains = List.of();
    if (hasResolvableDomainTarget(target)) {
      try {
        final EntityInterface<?> targetEntity =
            Entity.getEntity(target, Entity.FIELD_DOMAINS, Include.ALL);
        domains = listOrEmpty(targetEntity.getDomains());
      } catch (EntityNotFoundException ex) {
        INDEX_LOG.warn(
            "Governed entity [{} {}] not found for DataContract [{}], skipping indexing: {}",
            target.getType(),
            target.getId(),
            dataContract.getFullyQualifiedName(),
            ex.getMessage());
        throw ex;
      }
    }
    return domains;
  }

  private static boolean hasResolvableDomainTarget(EntityReference target) {
    return target != null
        && target.getId() != null
        && !nullOrEmpty(target.getType())
        && !Entity.isTimeSeriesEntity(target.getType())
        && Entity.hasEntityRepository(target.getType())
        && Entity.entityHasField(target.getType(), Entity.FIELD_DOMAINS);
  }
}
