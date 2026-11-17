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

package org.openmetadata.service.migration.utils;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Finds the entities, of any type and live or soft-deleted, whose FQN is a given one, by looking
 * each entity table up by its name hash.
 *
 * <p>Migrations run before the server's own tables of later versions exist, while every entity
 * type of the running build is already registered. A table the database reports as missing holds
 * no entity yet. Any other failure is reported as a holder, so a caller never takes a name it could
 * not check as free (ADR:2026-11-17-a-migration-entity-lookup-treats-only-a-missing-table-as-empty).
 * Table and column names come from the registered DAOs, never from input, since SQL cannot bind them.
 */
@Slf4j
public final class EntityFqnHolders {
  // MySQL's ER_NO_SUCH_TABLE and PostgreSQL's undefined_table.
  private static final Set<String> MISSING_TABLE_STATES = Set.of("42S02", "42P01");
  private final Handle handle;
  private final List<EntityTable> tables;
  private final Set<String> missingTables = new HashSet<>();

  /** The table an entity type is stored in, and its name hash column. */
  public record EntityTable(String entityType, String tableName, String nameHashColumn) {}

  /** An entity that holds the FQN, or a table that could not be searched for it. */
  public record Holder(String entityType, String id, String lookupFailure) {
    static Holder found(final String entityType, final String id) {
      return new Holder(entityType, id, null);
    }

    static Holder notLookedUp(final String entityType, final String reason) {
      return new Holder(entityType, null, reason);
    }

    public boolean is(final String otherType, final String otherId) {
      return entityType.equals(otherType) && otherId.equals(id);
    }

    @Override
    public String toString() {
      return lookupFailure == null
          ? entityType + " " + id
          : entityType + " (not looked up: " + lookupFailure + ")";
    }
  }

  private EntityFqnHolders(final Handle handle, final List<EntityTable> tables) {
    this.handle = handle;
    this.tables = tables;
  }

  /** The table of every registered entity type. Time series types have no FQN of their own. */
  public static List<EntityTable> registeredTables() {
    final List<EntityTable> tables = new ArrayList<>();
    for (final String entityType : new TreeSet<>(Entity.getEntityList())) {
      try {
        final EntityDAO<?> dao = Entity.getEntityRepository(entityType).getDao();
        tables.add(new EntityTable(entityType, dao.getTableName(), dao.getNameHashColumn()));
      } catch (EntityNotFoundException e) {
        LOG.debug("Entity type {} has no table of its own", entityType);
      }
    }
    return List.copyOf(tables);
  }

  public static EntityFqnHolders in(final Handle handle, final List<EntityTable> tables) {
    return new EntityFqnHolders(handle, List.copyOf(tables));
  }

  public List<Holder> holding(final String fqn) {
    final String nameHash = FullyQualifiedName.buildHash(fqn);
    final List<Holder> holders = new ArrayList<>();
    for (final EntityTable table : tables) {
      if (!missingTables.contains(table.tableName())) {
        holders.addAll(holdingIn(table, nameHash));
      }
    }
    return List.copyOf(holders);
  }

  private List<Holder> holdingIn(final EntityTable table, final String nameHash) {
    try {
      return handle
          .createQuery(
              "SELECT id FROM "
                  + table.tableName()
                  + " WHERE "
                  + table.nameHashColumn()
                  + " = :nameHash")
          .bind("nameHash", nameHash)
          .mapTo(String.class)
          .list()
          .stream()
          .map(id -> Holder.found(table.entityType(), id))
          .toList();
    } catch (Exception e) {
      return missingTable(e) ? notCreatedYet(table) : notLookedUp(table, e);
    }
  }

  /** A table cannot appear during the run, so it is not looked up again. */
  private List<Holder> notCreatedYet(final EntityTable table) {
    missingTables.add(table.tableName());
    LOG.info(
        "Table {} does not exist yet, so it holds no {}", table.tableName(), table.entityType());
    return List.of();
  }

  private static List<Holder> notLookedUp(final EntityTable table, final Exception e) {
    return List.of(Holder.notLookedUp(table.entityType(), e.getMessage()));
  }

  /** Only the database's own "no such table" error proves the table holds nothing. */
  private static boolean missingTable(final Throwable failure) {
    boolean missing = false;
    for (Throwable cause = failure; cause != null && !missing; cause = cause.getCause()) {
      missing =
          cause instanceof SQLException sqlException
              && MISSING_TABLE_STATES.contains(sqlException.getSQLState());
    }
    return missing;
  }
}
