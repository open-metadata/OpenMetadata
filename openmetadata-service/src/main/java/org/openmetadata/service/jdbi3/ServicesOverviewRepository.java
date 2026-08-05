/*
 *  Copyright 2026 Collate
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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.services.ServiceHealth;
import org.openmetadata.schema.api.services.ServiceSummary;
import org.openmetadata.schema.api.services.ServicesOverview;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil;

/**
 * Serves {@code GET /v1/services/overview}: counts across every service entity type plus one
 * globally name-sorted page merged across them.
 *
 * <p>Two design points are load-bearing rather than incidental:
 *
 * <ul>
 *   <li><b>Never returns entities.</b> It projects to {@link ServiceSummary}, which has no {@code
 *       connection} property. It also deliberately does not go through {@code ServiceEntityResource},
 *       whose list path unconditionally decrypts and masks every row's connection config. So no
 *       secret material is ever touched to serve this view.
 *   <li><b>Reads keys, then hydrates only the page.</b> Each entity type contributes an index-only
 *       {@code (name, id)} scan; those are merged and sliced, and only the surviving page is
 *       deserialized from {@code json}. The number of rows deserialized is therefore bounded by
 *       {@code limit} regardless of how many services exist.
 * </ul>
 */
@Slf4j
public class ServicesOverviewRepository {
  /**
   * Only the fields the summary exposes. Notably not {@code pipelines}, which {@code
   * ServiceEntityRepository.setFieldsInBulk} would resolve with two extra queries for data this view
   * does not render.
   */
  private static final String SUMMARY_FIELDS = "owners,tags";

  private final ServiceHealthProvider healthProvider;

  public ServicesOverviewRepository(ServiceHealthProvider healthProvider) {
    this.healthProvider = healthProvider;
  }

  public ServicesOverview getOverview(SecurityContext securityContext, ServicesOverviewRequest r) {
    Map<String, Map<String, Integer>> byConnector = countsByConnector(securityContext, r);
    Map<String, Integer> counts = sumInner(byConnector);
    assertHealthFilterIsSatisfiable(counts, r);
    boolean universeResolvable = isUniverseResolvable(counts, r);
    // Scanned once and threaded through: both the health tally and the per-service health map are
    // derived from the same universe-wide key scan, and that scan is one index read per service
    // entity type. Deriving them independently ran it twice on every request that asks for health
    // — which the Connections page does on every load.
    Map<String, List<TypedKey>> universeKeys =
        r.includeHealth() && universeResolvable ? universeKeys(securityContext, r) : Map.of();
    Map<UUID, ServiceHealth> universeHealth = universeHealth(universeKeys);
    Map<String, Map<String, Integer>> byHealth = countsByHealth(universeKeys, universeHealth);
    List<TypedKey> keys = listKeys(securityContext, r);
    List<TypedKey> page = slice(keys, r.offset(), r.limit());
    List<ServiceSummary> data = hydrate(page, pageHealth(r, page, universeHealth), r);
    int listTotal = listTotal(counts, byConnector, keys, r);
    logOverview(r, counts, keys.size(), data.size());
    return new ServicesOverview()
        .withCounts(counts)
        .withServiceTypeCounts(byConnector)
        .withHealthCounts(byHealth)
        .withTotal(sum(counts))
        .withData(data)
        .withPaging(new Paging().withOffset(r.offset()).withLimit(r.limit()).withTotal(listTotal));
  }

  /** A merged-page key. {@code name}/{@code id} mirror the DB's {@code ORDER BY name, id}. */
  record TypedKey(String entityType, String name, UUID id) {}

  // ---------------------------------------------------------------- counts

  private Map<String, Map<String, Integer>> countsByConnector(
      SecurityContext securityContext, ServicesOverviewRequest r) {
    Map<String, Map<String, Integer>> result = new LinkedHashMap<>();
    for (String entityType : r.entityTypes()) {
      result.put(entityType, connectorCounts(securityContext, r, entityType));
    }
    return result;
  }

  private Map<String, Integer> connectorCounts(
      SecurityContext securityContext, ServicesOverviewRequest r, String entityType) {
    Map<String, Integer> counts = new LinkedHashMap<>();
    ListFilter filter = countFilter(securityContext, r, entityType);
    for (EntityDAO.ServiceTypeCount row :
        Entity.getEntityRepository(entityType).getDao().listCountByServiceType(filter)) {
      counts.merge(row.serviceType(), row.count(), Integer::sum);
    }
    return counts;
  }

  /**
   * Per-health-state counts, omitted entirely when the universe is too large to resolve. Omitting
   * is deliberate: an approximate tally is indistinguishable from an exact one to the caller, and
   * these numbers drive filter controls where a silently wrong count is worse than an absent one.
   */
  private Map<String, Map<String, Integer>> countsByHealth(
      Map<String, List<TypedKey>> universeKeys, Map<UUID, ServiceHealth> health) {
    Map<String, Map<String, Integer>> result = new LinkedHashMap<>();
    for (Map.Entry<String, List<TypedKey>> entry : universeKeys.entrySet()) {
      result.put(entry.getKey(), tallyHealth(entry.getValue(), health));
    }
    return result;
  }

  /**
   * Tallies health across a type's services.
   *
   * <p>The tally walks scanned keys, and that scan is bounded, whereas {@code counts} comes from an
   * uncapped {@code GROUP BY}. Rather than let the two disagree, {@link #countsByHealth} omits the
   * tally entirely when the universe is not resolvable — a service beyond the scan window has a
   * real health state, and reporting it as anything else (including "not run") would be a wrong
   * answer dressed up as a complete one.
   */
  private Map<String, Integer> tallyHealth(List<TypedKey> keys, Map<UUID, ServiceHealth> health) {
    Map<String, Integer> tally = new LinkedHashMap<>();
    for (TypedKey key : keys) {
      ServiceHealth state = health.getOrDefault(key.id(), ServiceHealth.NOT_RUN);
      tally.merge(state.value(), 1, Integer::sum);
    }
    return tally;
  }

  // ---------------------------------------------------------------- health

  /**
   * Whether health can be resolved for the whole counted universe.
   *
   * <p>Health is derived per service, so an aggregate over the universe costs one resolution per
   * service and is therefore bounded. A single *page* is not — see {@link #pageHealth}. Splitting
   * the two is what lets a large estate still get per-service health and a usable first page while
   * only the genuinely universe-wide answers step aside.
   */
  private boolean isUniverseResolvable(Map<String, Integer> counts, ServicesOverviewRequest r) {
    return isResolvable(counts, r.entityTypes());
  }

  /**
   * The health filter is gated on the listed types alone, not the universe. Gating it on the
   * universe would refuse a perfectly small list because some other service type is large, and the
   * only way out would be to shrink the universe too — which changes the very count maps the caller
   * drives their filter controls from.
   */
  private void assertHealthFilterIsSatisfiable(
      Map<String, Integer> counts, ServicesOverviewRequest r) {
    if (!nullOrEmpty(r.healths()) && !isResolvable(counts, r.listEntityTypes())) {
      throw new BadRequestException(
          String.format(
              "Cannot filter by health when a listed service type has more than %d services, "
                  + "because health must be resolved for every candidate before the list can be "
                  + "filtered. Narrow the request with q, listEntityType or domain.",
              ServicesOverviewRequest.MAX_WINDOW));
    }
  }

  private boolean isResolvable(Map<String, Integer> counts, Set<String> entityTypes) {
    return entityTypes.stream()
        .noneMatch(
            entityType -> counts.getOrDefault(entityType, 0) > ServicesOverviewRequest.MAX_WINDOW);
  }

  /** Health for every service in the universe — needed only by the tally and the health filter. */
  private Map<UUID, ServiceHealth> universeHealth(Map<String, List<TypedKey>> universeKeys) {
    Map<UUID, ServiceHealth> health = Map.of();
    if (!universeKeys.isEmpty()) {
      List<UUID> ids =
          universeKeys.values().stream().flatMap(List::stream).map(TypedKey::id).toList();
      health = healthProvider.healthByServiceId(ids);
    }
    return health;
  }

  /**
   * Health for the returned page. Costs the same three batched queries whatever the estate size,
   * because it resolves at most {@code limit} services — so {@code data[*].health} stays available
   * and exact even when the universe-wide tally cannot be computed.
   */
  private Map<UUID, ServiceHealth> pageHealth(
      ServicesOverviewRequest r, List<TypedKey> page, Map<UUID, ServiceHealth> universeHealth) {
    Map<UUID, ServiceHealth> health = universeHealth;
    if (r.includeHealth() && universeHealth.isEmpty() && !page.isEmpty()) {
      health = healthProvider.healthByServiceId(page.stream().map(TypedKey::id).toList());
    }
    return health;
  }

  /**
   * Keys for every service in the counted universe, i.e. ignoring the list-only selectors. Needed
   * whenever health is requested, because a health tally has to attribute every service in the
   * universe — including the ones with no pipelines, which no pipeline-side query can see.
   */
  private Map<String, List<TypedKey>> universeKeys(
      SecurityContext securityContext, ServicesOverviewRequest r) {
    Map<String, List<TypedKey>> keys = new LinkedHashMap<>();
    for (String entityType : r.entityTypes()) {
      ListFilter filter = countFilter(securityContext, r, entityType);
      keys.put(entityType, scanKeys(entityType, filter, ServicesOverviewRequest.MAX_WINDOW, true));
    }
    return keys;
  }

  // ---------------------------------------------------------------- listing

  /**
   * Keys for the listed types, health-filtered where asked.
   *
   * <p>Health for the filter is resolved from the scanned keys themselves rather than from the
   * universe-wide map: the filter only ever narrows {@code data}, which is scoped to the listed
   * types, so it has no business depending on how large some unrelated service type happens to be.
   */
  private List<TypedKey> listKeys(SecurityContext securityContext, ServicesOverviewRequest r) {
    List<List<TypedKey>> perType = new ArrayList<>();
    for (String entityType : r.listEntityTypes()) {
      ListFilter filter = listFilter(securityContext, r, entityType);
      perType.add(scanKeys(entityType, filter, r.keyScanLimit(), r.ascending()));
    }
    Map<UUID, ServiceHealth> health = healthForFilter(r, perType);
    return merge(
        perType.stream().map(keys -> filterByHealth(keys, health, r)).toList(), r.ascending());
  }

  private Map<UUID, ServiceHealth> healthForFilter(
      ServicesOverviewRequest r, List<List<TypedKey>> perType) {
    Map<UUID, ServiceHealth> health = Map.of();
    if (!nullOrEmpty(r.healths())) {
      health =
          healthProvider.healthByServiceId(
              perType.stream().flatMap(List::stream).map(TypedKey::id).toList());
    }
    return health;
  }

  private List<TypedKey> scanKeys(
      String entityType, ListFilter filter, int limit, boolean ascending) {
    return Entity.getEntityRepository(entityType)
        .getDao()
        .listKeys(filter, limit, ascending)
        .stream()
        .map(row -> new TypedKey(entityType, row.name(), UUID.fromString(row.id())))
        .toList();
  }

  /**
   * Health cannot be pushed into SQL — it lives in the time-series table, not on the service row —
   * so it is applied after the scan. That is why {@link ServicesOverviewRequest#keyScanLimit()}
   * stops bounding the scan by {@code offset + limit} once a health filter is present.
   */
  private List<TypedKey> filterByHealth(
      List<TypedKey> keys, Map<UUID, ServiceHealth> health, ServicesOverviewRequest r) {
    List<TypedKey> result = keys;
    if (!nullOrEmpty(r.healths())) {
      result =
          keys.stream()
              .filter(
                  key -> r.healths().contains(health.getOrDefault(key.id(), ServiceHealth.NOT_RUN)))
              .toList();
    }
    return result;
  }

  /**
   * Merges the per-type lists into one globally ordered list.
   *
   * <p>A single sort rather than a k-way merge: with at most 13 already-ordered inputs the
   * asymptotic difference is a log factor on a list bounded by the pagination window, and the sort
   * is the version that stays obviously correct.
   *
   * <p>Ordering is decided here, in Java, so the result does not vary with the database's collation
   * (MySQL's default is case-insensitive, PostgreSQL's is not). The one place the database's own
   * order still matters is which rows a *truncated* per-type scan returns, so a type holding more
   * than {@code offset + limit} services can differ at the page boundary between engines. That only
   * bites at deep offsets on very large estates, which is the regime this endpoint already refuses
   * past {@link ServicesOverviewRequest#MAX_WINDOW}.
   */
  static List<TypedKey> merge(List<List<TypedKey>> perType, boolean ascending) {
    Comparator<TypedKey> byKey =
        Comparator.comparing(TypedKey::name, String.CASE_INSENSITIVE_ORDER)
            .thenComparing(TypedKey::name)
            .thenComparing(key -> key.id().toString());
    Comparator<TypedKey> order = ascending ? byKey : byKey.reversed();
    return perType.stream().flatMap(List::stream).sorted(order).toList();
  }

  static List<TypedKey> slice(List<TypedKey> keys, int offset, int limit) {
    int from = Math.min(offset, keys.size());
    int to = Math.min(from + limit, keys.size());
    return keys.subList(from, to);
  }

  // ---------------------------------------------------------------- hydration

  private List<ServiceSummary> hydrate(
      List<TypedKey> page, Map<UUID, ServiceHealth> health, ServicesOverviewRequest r) {
    Map<UUID, ServiceSummary> byId = new HashMap<>();
    for (Map.Entry<String, List<UUID>> entry : groupByType(page).entrySet()) {
      hydrateType(entry.getKey(), entry.getValue(), r)
          .forEach(summary -> byId.put(summary.getId(), summary));
    }
    return page.stream()
        .map(key -> byId.get(key.id()))
        .filter(java.util.Objects::nonNull)
        .map(summary -> withHealth(summary, health, r))
        .toList();
  }

  private Map<String, List<UUID>> groupByType(List<TypedKey> page) {
    Map<String, List<UUID>> grouped = new LinkedHashMap<>();
    page.forEach(
        key -> grouped.computeIfAbsent(key.entityType(), type -> new ArrayList<>()).add(key.id()));
    return grouped;
  }

  @SuppressWarnings("unchecked")
  private List<ServiceSummary> hydrateType(
      String entityType, List<UUID> ids, ServicesOverviewRequest r) {
    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    List<EntityInterface> entities =
        (List<EntityInterface>) repository.getDao().findEntitiesByIds(ids, r.include());
    ((EntityRepository<EntityInterface>) repository)
        .setFieldsInBulk(repository.getFields(SUMMARY_FIELDS), entities);
    return entities.stream().map(entity -> toSummary(entity, entityType)).toList();
  }

  private ServiceSummary withHealth(
      ServiceSummary summary, Map<UUID, ServiceHealth> health, ServicesOverviewRequest r) {
    return r.includeHealth()
        ? summary.withHealth(health.getOrDefault(summary.getId(), ServiceHealth.NOT_RUN))
        : summary;
  }

  private ServiceSummary toSummary(EntityInterface entity, String entityType) {
    return new ServiceSummary()
        .withId(entity.getId())
        .withEntityType(entityType)
        .withName(entity.getName())
        .withDisplayName(entity.getDisplayName())
        .withFullyQualifiedName(entity.getFullyQualifiedName())
        .withDescription(entity.getDescription())
        .withServiceType(serviceTypeOf(entity))
        .withOwners(entity.getOwners())
        .withTags(entity.getTags())
        .withUpdatedAt(entity.getUpdatedAt())
        .withDeleted(Boolean.TRUE.equals(entity.getDeleted()));
  }

  /**
   * Every service entity declares a {@code serviceType} enum, but they are 13 unrelated generated
   * types with no shared interface, so the value is read reflectively rather than through a cast
   * ladder. The column is also generated from this same JSON field, so it always exists.
   */
  private String serviceTypeOf(EntityInterface entity) {
    String serviceType = null;
    try {
      Object value = entity.getClass().getMethod("getServiceType").invoke(entity);
      serviceType = value == null ? null : String.valueOf(value);
    } catch (ReflectiveOperationException e) {
      LOG.warn("Service entity {} exposes no serviceType", entity.getClass().getSimpleName(), e);
    }
    return serviceType;
  }

  // ---------------------------------------------------------------- filters and totals

  /** Filters that scope the counted universe. Deliberately excludes the list-only selectors. */
  private ListFilter countFilter(
      SecurityContext securityContext, ServicesOverviewRequest r, String entityType) {
    ListFilter filter = new ListFilter(r.include());
    if (r.excludeProvider() != null) {
      filter.addQueryParam("excludeProvider", r.excludeProvider().value());
    }
    if (!nullOrEmpty(r.q())) {
      filter.addQueryParam("nameFilter", r.q());
    }
    if (r.domainId() != null) {
      filter.addQueryParam("domainId", r.domainId().toString());
    }
    EntityUtil.addDomainQueryParam(securityContext, filter, entityType);
    return filter;
  }

  private ListFilter listFilter(
      SecurityContext securityContext, ServicesOverviewRequest r, String entityType) {
    ListFilter filter = countFilter(securityContext, r, entityType);
    if (!nullOrEmpty(r.serviceTypes())) {
      filter.addQueryParam("connectorType", String.join(",", r.serviceTypes()));
    }
    return filter;
  }

  /**
   * Derived arithmetically from the count maps rather than queried. Buckets within one dimension are
   * disjoint — a service has exactly one connector type and exactly one health state — so summing
   * the selected buckets cannot double-count. Only when both selectors are active is there no single
   * map to sum, and then the already-materialized key list is the answer.
   */
  private int listTotal(
      Map<String, Integer> counts,
      Map<String, Map<String, Integer>> byConnector,
      List<TypedKey> keys,
      ServicesOverviewRequest r) {
    boolean hasConnector = !nullOrEmpty(r.serviceTypes());
    boolean hasHealth = !nullOrEmpty(r.healths());
    int total;
    if (hasHealth) {
      // A health filter forces the scan to cover the listed types in full, and those types are
      // asserted resolvable before we get here, so the filtered keys *are* the total. Deriving it
      // from healthCounts instead would report zero whenever that map is omitted for being
      // universe-unresolvable — a paging total of zero alongside a non-empty page.
      total = keys.size();
    } else if (hasConnector) {
      total = sumSelected(byConnector, r.listEntityTypes(), r.serviceTypes());
    } else {
      total = r.listEntityTypes().stream().mapToInt(type -> counts.getOrDefault(type, 0)).sum();
    }
    return total;
  }

  private int sumSelected(
      Map<String, Map<String, Integer>> nested, Set<String> entityTypes, Set<String> buckets) {
    int total = 0;
    for (String entityType : entityTypes) {
      Map<String, Integer> inner = nested.getOrDefault(entityType, Map.of());
      for (String bucket : buckets) {
        total += inner.getOrDefault(bucket, 0);
      }
    }
    return total;
  }

  private Map<String, Integer> sumInner(Map<String, Map<String, Integer>> nested) {
    Map<String, Integer> totals = new LinkedHashMap<>();
    nested.forEach(
        (entityType, inner) ->
            totals.put(entityType, inner.values().stream().mapToInt(Integer::intValue).sum()));
    return totals;
  }

  private int sum(Map<String, Integer> counts) {
    return counts.values().stream().mapToInt(Integer::intValue).sum();
  }

  private void logOverview(
      ServicesOverviewRequest r, Map<String, Integer> counts, int matchedKeys, int returned) {
    int total = sum(counts);
    LOG.debug(
        "services overview: universe={} listTypes={} total={} matchedKeys={} returned={} offset={} limit={}",
        r.entityTypes().size(),
        r.listEntityTypes().size(),
        total,
        matchedKeys,
        returned,
        r.offset(),
        r.limit());
    if (total > ServicesOverviewRequest.LARGE_ESTATE_WARN_THRESHOLD) {
      LOG.warn(
          "services overview: {} services exceeds {} — clients paginating this endpoint should expect server-side paging",
          total,
          ServicesOverviewRequest.LARGE_ESTATE_WARN_THRESHOLD);
    }
  }
}
