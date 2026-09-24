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

package org.openmetadata.service.security.policyevaluator;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceAttributes;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.Invalidatable;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;

/**
 * Answers "which services carry this tag / go by this name" for the search-side translation of the
 * service policy conditions.
 *
 * <p>The REST evaluator reads a single asset's service directly and needs none of this. The search
 * evaluator has the opposite problem: it must compile a condition into a query <em>before</em> it
 * sees any document, so it needs the reverse mapping up front. Asset search documents carry {@code
 * service.id} but not the service's tags, so the condition is compiled into a {@code
 * terms(service.id, ...)} filter over resolved ids — the same "resolve at build time and embed
 * literals" shape {@code hasAnyRole()} and {@code inAnyTeam()} already use. That keeps the feature
 * working against an unmodified search index, with no mapping change and no reindex.
 *
 * <p>The whole reverse mapping is rebuilt in one pass and held as a single immutable snapshot, so
 * cost is independent of how many users, rules, or tags are involved. This matters because the
 * ElasticSearch search path has no compiled-query cache and rebuilds its RBAC filter on every
 * request; resolving per rule per request instead would put ~26 SELECTs on each one.
 */
@Slf4j
public final class ServiceAttributeResolver {

  /**
   * How long a snapshot is served before a rebuild is triggered. {@code refreshAfterWrite} reloads
   * asynchronously and keeps serving the previous snapshot while it runs, so no request ever blocks
   * on the rebuild — with plain expiry the first request after the TTS would pay for all 13 service
   * listings inside the search hot path.
   */
  private static final long REFRESH_SECONDS = 60;

  /**
   * Hard ceiling if a rebuild keeps failing. Caffeine keeps serving a stale snapshot indefinitely
   * under {@code refreshAfterWrite} alone, which would pin authorization to a stale service list
   * for as long as the database stays unreachable.
   */
  private static final long EXPIRE_MINUTES = 5;

  private static final String SNAPSHOT_KEY = "serviceAttributes";

  /**
   * One entry, so the cache is trivially bounded as CLAUDE.md requires. Volatile because {@link
   * #invalidate()} replaces the whole cache rather than evicting from it — see the note there.
   */
  private static volatile LoadingCache<String, ServiceSnapshot> snapshotCache = buildCache();

  private ServiceAttributeResolver() {}

  /**
   * Reverse lookups for one point in time, plus a {@code signature} identifying this content.
   *
   * @param serviceIdsByTagFqn tag FQN to the ids of services carrying it
   * @param serviceIdsByName service name to its id, as a single-element set so callers can union
   *     lookups uniformly
   * @param serviceIdsByEnvironment environment value to the ids of services declaring it
   * @param serviceIdsByType connector type to the ids of services of that type, lowercased
   * @param signature content hash, used to key caches that embed resolved ids
   */
  record ServiceSnapshot(
      Map<String, Set<String>> serviceIdsByTagFqn,
      Map<String, Set<String>> serviceIdsByName,
      Map<String, Set<String>> serviceIdsByEnvironment,
      Map<String, Set<String>> serviceIdsByType,
      long signature) {

    static ServiceSnapshot of(
        Map<String, Set<String>> serviceIdsByTagFqn,
        Map<String, Set<String>> serviceIdsByName,
        Map<String, Set<String>> serviceIdsByEnvironment,
        Map<String, Set<String>> serviceIdsByType) {
      return new ServiceSnapshot(
          deepCopy(serviceIdsByTagFqn),
          deepCopy(serviceIdsByName),
          deepCopy(serviceIdsByEnvironment),
          deepCopy(serviceIdsByType),
          Objects.hash(
              serviceIdsByTagFqn, serviceIdsByName, serviceIdsByEnvironment, serviceIdsByType));
    }

    /** The value sets are copied too, so the snapshot cannot be mutated through them. */
    private static Map<String, Set<String>> deepCopy(Map<String, Set<String>> index) {
      Map<String, Set<String>> copy = new HashMap<>(index.size());
      index.forEach((key, serviceIds) -> copy.put(key, Set.copyOf(serviceIds)));
      return Map.copyOf(copy);
    }

    static ServiceSnapshot empty() {
      return of(Map.of(), Map.of(), Map.of(), Map.of());
    }
  }

  /** Ids of every service carrying at least one of {@code tagFQNs}. */
  public static Set<String> serviceIdsForTags(Collection<String> tagFQNs) {
    return lookup(snapshot().serviceIdsByTagFqn(), tagFQNs);
  }

  /** Ids of every service whose name is in {@code serviceNames}. */
  public static Set<String> serviceIdsForNames(Collection<String> serviceNames) {
    return lookup(snapshot().serviceIdsByName(), serviceNames);
  }

  /**
   * Ids of every service whose declared environment is in {@code environments}. Matching is
   * case-insensitive; the index is keyed on the lowercased value.
   */
  public static Set<String> serviceIdsForEnvironments(Collection<String> environments) {
    return lookup(
        snapshot().serviceIdsByEnvironment(),
        environments.stream().map(ServiceAttributeResolver::normalize).toList());
  }

  /**
   * Ids of every service whose connector type is in {@code serviceTypes}. Matching is
   * case-insensitive, as the REST-side condition is.
   *
   * <p>Needed even though asset documents carry a denormalized {@code serviceType}: six indexes
   * ({@code ingestion_pipeline}, {@code query}, {@code query_cost_record}, {@code test_case},
   * {@code test_case_result}, {@code test_case_resolution_status}) index {@code service} without
   * it, so a type-only clause would leave those documents visible under a Deny that the REST path
   * enforces.
   */
  public static Set<String> serviceIdsForTypes(Collection<String> serviceTypes) {
    return lookup(
        snapshot().serviceIdsByType(),
        serviceTypes.stream().map(ServiceAttributeResolver::normalize).toList());
  }

  private static String normalize(String value) {
    return value == null ? null : value.toLowerCase(Locale.ROOT);
  }

  /**
   * Identifies the service state currently compiled into queries. Callers that cache a compiled
   * query holding resolved service ids must include this in their cache key, or they serve the ids
   * from an older snapshot for the remainder of their own TTL. It is a content hash rather than a
   * counter so a snapshot that rebuilds to the same content leaves those caches warm.
   *
   * <p>Being a 32-bit hash, two genuinely different service states could in principle collide and
   * leave a downstream query cached across the change. The exposure is bounded by that cache's own
   * TTL, which is the same staleness window every other subject-keyed condition already carries.
   */
  public static long generation() {
    return snapshot().signature();
  }

  /**
   * Drops the snapshot so the next lookup rebuilds it. Call after any write that changes a
   * service's tags or name.
   *
   * <p>Replaces the cache rather than invalidating the key: Caffeine's {@code refreshAfterWrite}
   * would otherwise hand the next caller the stale snapshot while reloading in the background,
   * which is the opposite of what an explicit invalidation asks for.
   */
  public static void invalidate() {
    snapshotCache = buildCache();
  }

  /**
   * Drops the snapshot when any replica writes a service.
   *
   * <p>{@link #invalidate()} replaces a static field in one JVM, so on its own it only reaches the
   * pod that served the write. Every other replica keeps answering from the snapshot it already
   * built, and keeps returning the same {@link #generation()}, so the caches keyed on it do not
   * turn over either -- an admin tags a service to hide it and its assets stay in search results on
   * every other pod until {@code refreshAfterWrite} elapses. Registering here puts this on the same
   * footing as {@code SubjectCache}, which is policy-evaluation state with the same requirement.
   *
   * <p>Scoped to service entity types: nothing else changes what this snapshot holds, and a
   * catalog-wide write rate would otherwise rebuild it constantly.
   */
  public static Invalidatable invalidator() {
    return (type, id, fqn) -> {
      if (Entity.getServiceEntityTypes().contains(type)) {
        invalidate();
      }
    };
  }

  private static Set<String> lookup(Map<String, Set<String>> index, Collection<String> keys) {
    Set<String> serviceIds = new HashSet<>();
    for (String key : keys) {
      serviceIds.addAll(index.getOrDefault(key, Set.of()));
    }
    return serviceIds;
  }

  private static ServiceSnapshot snapshot() {
    ServiceSnapshot snapshot = snapshotCache.get(SNAPSHOT_KEY);
    return snapshot == null ? ServiceSnapshot.empty() : snapshot;
  }

  private static LoadingCache<String, ServiceSnapshot> buildCache() {
    return Caffeine.newBuilder()
        .maximumSize(1)
        .refreshAfterWrite(REFRESH_SECONDS, TimeUnit.SECONDS)
        .expireAfterWrite(EXPIRE_MINUTES, TimeUnit.MINUTES)
        .build(key -> loadSnapshot());
  }

  /**
   * Walks every service entity type once, keeping only ids, names, and tag FQNs. Services number in
   * the tens, and only the {@code tags} projection is requested, so the whole pass is 13 list
   * queries plus one batched tag read.
   *
   * <p>A failure propagates rather than yielding an empty snapshot. An empty snapshot resolves
   * every service condition to "no services", which compiles to a match-nothing clause — for a Deny
   * rule that hides nothing, so a database outage would quietly serve the assets the policy exists
   * to hide. Letting the load throw keeps {@code refreshAfterWrite} serving the last known good
   * snapshot, which is both safe and current enough; only a cold cache has nothing to fall back on,
   * and there the request fails instead of over-sharing.
   */
  private static ServiceSnapshot loadSnapshot() {
    Map<String, Set<String>> serviceIdsByTagFqn = new HashMap<>();
    Map<String, Set<String>> serviceIdsByName = new HashMap<>();
    Map<String, Set<String>> serviceIdsByEnvironment = new HashMap<>();
    Map<String, Set<String>> serviceIdsByType = new HashMap<>();
    for (String serviceEntityType : Entity.getServiceEntityTypes()) {
      // A service type with no repository registered yet is not a failure — it happens during
      // bootstrap and in unit tests that register only the entities they exercise.
      if (Entity.hasEntityRepository(serviceEntityType)) {
        indexServices(
            serviceEntityType,
            serviceIdsByTagFqn,
            serviceIdsByName,
            serviceIdsByEnvironment,
            serviceIdsByType);
      }
    }
    LOG.debug(
        "Built service attribute snapshot: {} services, {} distinct tags, {} environments",
        serviceIdsByName.size(),
        serviceIdsByTagFqn.size(),
        serviceIdsByEnvironment.size());
    return ServiceSnapshot.of(
        serviceIdsByTagFqn, serviceIdsByName, serviceIdsByEnvironment, serviceIdsByType);
  }

  /**
   * {@code Include.ALL} on purpose: a soft-deleted service keeps its assets in the search index, so
   * excluding it here would un-hide every asset of a service an admin just deleted.
   */
  private static void indexServices(
      String serviceEntityType,
      Map<String, Set<String>> serviceIdsByTagFqn,
      Map<String, Set<String>> serviceIdsByName,
      Map<String, Set<String>> serviceIdsByEnvironment,
      Map<String, Set<String>> serviceIdsByType) {
    EntityRepository<? extends EntityInterface> repository =
        Entity.getEntityRepository(serviceEntityType);
    List<? extends EntityInterface> services =
        repository.listAll(repository.getFields(Entity.FIELD_TAGS), new ListFilter(Include.ALL));
    for (EntityInterface service : services) {
      String serviceId = service.getId().toString();
      serviceIdsByName.computeIfAbsent(service.getName(), name -> new HashSet<>()).add(serviceId);
      for (TagLabel tag : Entity.getEntityTags(serviceEntityType, service)) {
        serviceIdsByTagFqn
            .computeIfAbsent(tag.getTagFQN(), tagFqn -> new HashSet<>())
            .add(serviceId);
      }
      indexEnvironment(service, serviceId, serviceIdsByEnvironment);
      indexServiceType(service, serviceId, serviceIdsByType);
    }
  }

  private static void indexServiceType(
      EntityInterface service, String serviceId, Map<String, Set<String>> serviceIdsByType) {
    String serviceType = ServiceAttributeUtil.serviceTypeOf(service);
    if (serviceType == null) {
      return;
    }
    serviceIdsByType
        .computeIfAbsent(normalize(serviceType), type -> new HashSet<>())
        .add(serviceId);
  }

  /**
   * {@code serviceAttributes} is stored inline in the service JSON rather than as a relationship,
   * so it arrives with the listing and needs no extra field projection.
   */
  private static void indexEnvironment(
      EntityInterface service, String serviceId, Map<String, Set<String>> serviceIdsByEnvironment) {
    if (!(service instanceof ServiceEntityInterface typedService)) {
      return;
    }
    ServiceAttributes attributes = typedService.getServiceAttributes();
    if (attributes == null || attributes.getEnvironment() == null) {
      return;
    }
    serviceIdsByEnvironment
        .computeIfAbsent(normalize(attributes.getEnvironment().value()), key -> new HashSet<>())
        .add(serviceId);
  }
}
