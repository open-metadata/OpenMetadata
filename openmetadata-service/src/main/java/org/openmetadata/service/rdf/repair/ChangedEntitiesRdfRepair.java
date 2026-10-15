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
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityDAO.ChangedRow;
import org.openmetadata.service.jobs.RepairByEntityType;

/**
 * The scheduled RDF repair's look at recent changes. For every projected entity type it pages
 * through the rows changed in a window, oldest first, on the {@code (updatedAt, id)} index, and
 * asks the RDF store when each one's projection says it last changed. A row whose projection is
 * missing, or carries another {@code updatedAt}, is queued for a refresh on the live write queue,
 * which projects the row as the database holds it: a write lost to a crash, or one the queue gave
 * up on.
 */
@Slf4j
public class ChangedEntitiesRdfRepair {
  static final int PAGE_SIZE = 200;

  private final RdfProjectedEntities projected;
  private final Supplier<List<String>> entityTypes;
  private final BiConsumer<String, UUID> refresh;
  private final RepairByEntityType byType = new RepairByEntityType("RDF repair");

  /**
   * @param entityTypes the entity types RDF projects
   * @param refresh queues a refresh of one entity's projection
   */
  public ChangedEntitiesRdfRepair(
      final RdfProjectedEntities projected,
      final Supplier<List<String>> entityTypes,
      final BiConsumer<String, UUID> refresh) {
    this.projected = projected;
    this.entityTypes = entityTypes;
    this.refresh = refresh;
  }

  /**
   * Queues refreshes for the rows changed after {@code since} and no later than {@code until}
   * whose projections are missing or stale.
   *
   * @param heartbeat run after each page, to keep the pass's lock
   * @return how many entities were queued
   */
  public int repair(final long since, final long until, final Runnable heartbeat) throws Exception {
    return byType.run(
        entityTypes.get(), entityType -> repairType(entityType, since, until, heartbeat));
  }

  private int repairType(
      final String entityType, final long since, final long until, final Runnable heartbeat) {
    final EntityDAO<?> rows = Entity.getEntityRepository(entityType).getDao();
    int queued = 0;
    List<ChangedRow> page = rows.listChangedAfter(rows.getTableName(), until, since, "", PAGE_SIZE);
    while (!page.isEmpty()) {
      queued += refreshStale(entityType, page);
      heartbeat.run();
      final ChangedRow last = page.getLast();
      page =
          rows.listChangedAfter(rows.getTableName(), until, last.updatedAt(), last.id(), PAGE_SIZE);
    }
    return queued;
  }

  private int refreshStale(final String entityType, final List<ChangedRow> page) {
    final Map<String, Set<Long>> modified =
        projected.modifiedTimes(entityType, page.stream().map(ChangedRow::id).toList());
    final List<ChangedRow> stale = page.stream().filter(row -> isStale(row, modified)).toList();
    stale.forEach(row -> refresh.accept(entityType, UUID.fromString(row.id())));
    if (!stale.isEmpty()) {
      LOG.info(
          "RDF repair queued {} {} entities whose projection is missing or stale",
          stale.size(),
          entityType);
    }
    return stale.size();
  }

  /** A row with no projection, or one projected from another version of the row. */
  static boolean isStale(final ChangedRow row, final Map<String, Set<Long>> modified) {
    return !modified.getOrDefault(row.id(), Set.of()).contains(row.updatedAt());
  }
}
