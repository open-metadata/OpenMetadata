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
package org.openmetadata.service.rdf;

import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/**
 * Which entities the graph may project: those that exist and are not soft-deleted. The graph
 * holds the live catalog only, so every edge needs both of its ends to pass this check when it is
 * written. Soft delete never marks {@code entity_relationship} rows, so liveness is read from the
 * entity tables, one query per entity type.
 */
@FunctionalInterface
public interface RdfEntityLiveness {

  /** An entity named by its type and id. */
  record Endpoint(String entityType, UUID entityId) {}

  /** The ids among {@code entityIds} whose entities of {@code entityType} are live. */
  Set<UUID> liveIds(String entityType, Collection<UUID> entityIds);

  default boolean isLive(final String entityType, final UUID entityId) {
    return liveIds(entityType, List.of(entityId)).contains(entityId);
  }

  default boolean areLive(final Endpoint from, final Endpoint to) {
    return liveEndpoints(List.of(from, to)).size() == (from.equals(to) ? 1 : 2);
  }

  /** The live endpoints among {@code endpoints}, read with one query per entity type. */
  default Set<Endpoint> liveEndpoints(final Collection<Endpoint> endpoints) {
    final Map<String, Set<UUID>> idsByType = new LinkedHashMap<>();
    for (final Endpoint endpoint : endpoints) {
      idsByType
          .computeIfAbsent(endpoint.entityType(), ignored -> new HashSet<>())
          .add(endpoint.entityId());
    }
    final Set<Endpoint> live = new HashSet<>();
    idsByType.forEach(
        (entityType, ids) ->
            liveIds(entityType, ids).forEach(id -> live.add(new Endpoint(entityType, id))));
    return live;
  }

  static RdfEntityLiveness database() {
    return RdfEntityLiveness::readLiveIds;
  }

  /**
   * Types without an entity repository, such as time-series records, carry no deleted state, so
   * they are treated as live and keep the edges the graph projected for them before.
   */
  private static Set<UUID> readLiveIds(final String entityType, final Collection<UUID> entityIds) {
    if (entityIds.isEmpty()) {
      return Set.of();
    }
    if (!Entity.hasEntityRepository(entityType) || Entity.isTimeSeriesEntity(entityType)) {
      return Set.copyOf(entityIds);
    }
    return Entity.getEntityRepository(entityType)
        .getDao()
        .findReferencesByIds(List.copyOf(entityIds), Include.NON_DELETED)
        .stream()
        .map(EntityReference::getId)
        .collect(Collectors.toUnmodifiableSet());
  }
}
