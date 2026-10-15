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
package org.openmetadata.service.rdf.repair;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;

/**
 * Removes from the RDF store the entities whose rows are gone: a hard delete whose live write was
 * lost leaves its entity in the graph, and nothing else would remove it. Listing a type's
 * projections means scanning them, so a type is listed only when the store holds more projections
 * of it than the table has rows; deleted rows stay in the table, so in step the counts match. A
 * type is listed by the first hex digit of its ids, one query each, and every id whose row is gone
 * is queued for a refresh, which removes it.
 */
@Slf4j
public class RdfOrphanSweep {
  static final List<String> ID_PREFIXES =
      List.of("0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f");
  static final int IDS_PER_LOOKUP = 1000;

  private final RdfProjectedEntities projected;
  private final BiConsumer<String, UUID> refresh;

  /**
   * @param refresh queues a refresh of one entity's projection
   */
  public RdfOrphanSweep(
      final RdfProjectedEntities projected, final BiConsumer<String, UUID> refresh) {
    this.projected = projected;
    this.refresh = refresh;
  }

  /**
   * Queues the removal of the projected entities of {@code entityTypes} whose rows are gone. A type
   * that fails is logged and left to the next sweep.
   *
   * @param heartbeat run after each id prefix, to keep the pass's lock
   * @return how many were queued
   */
  public long sweep(final List<String> entityTypes, final Runnable heartbeat) {
    final Map<String, Long> projectedCounts = projected.counts();
    long queued = 0;
    for (final String entityType : entityTypes) {
      queued += sweepType(entityType, projectedCounts.getOrDefault(entityType, 0L), heartbeat);
    }
    return queued;
  }

  private long sweepType(
      final String entityType, final long projectedCount, final Runnable heartbeat) {
    long queued = 0;
    try {
      final EntityDAO<?> rows = Entity.getEntityRepository(entityType).getDao();
      if (projectedCount > rows.listTotalCount()) {
        for (final String idPrefix : ID_PREFIXES) {
          queued += removeGone(entityType, rows, projected.ids(entityType, idPrefix));
          heartbeat.run();
        }
      }
    } catch (RuntimeException e) {
      LOG.warn("RDF repair could not sweep {} entities; the next sweep tries again", entityType, e);
    }
    if (queued > 0) {
      LOG.info(
          "RDF repair queued the removal of {} {} entities whose rows are gone",
          queued,
          entityType);
    }
    return queued;
  }

  private long removeGone(
      final String entityType, final EntityDAO<?> rows, final List<String> projectedIds) {
    long queued = 0;
    for (int start = 0; start < projectedIds.size(); start += IDS_PER_LOOKUP) {
      final List<String> ids =
          projectedIds.subList(start, Math.min(start + IDS_PER_LOOKUP, projectedIds.size()));
      final Set<String> existing = Set.copyOf(rows.findExistingIds(rows.getTableName(), ids));
      for (final String id : ids) {
        if (!existing.contains(id)) {
          refresh.accept(entityType, UUID.fromString(id));
          queued++;
        }
      }
    }
    return queued;
  }
}
