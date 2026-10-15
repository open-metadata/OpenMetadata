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
package org.openmetadata.service.jobs;

import java.sql.SQLException;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;

/**
 * Runs a scheduled repair's look at changed rows one entity type at a time. A type that fails does
 * not stop the others, and its failure is thrown after them, so the pass keeps its window for the
 * next pass. A type whose table has no {@code updatedAt} column cannot be paged by change time at
 * all; it is set aside for as long as the server runs instead of failing every pass.
 */
@Slf4j
public final class RepairByEntityType {
  /** Repairs the rows of one entity type changed in the pass's window. */
  @FunctionalInterface
  public interface TypeRepair {
    int repair(String entityType) throws Exception;
  }

  // PostgreSQL's and MySQL's SQL state for a column the table does not have.
  private static final Set<String> UNDEFINED_COLUMN_STATES = Set.of("42703", "42S22");

  private final String repairName;
  // Entity types whose tables have no updatedAt column; bounded by the set of entity types.
  private final Set<String> typesWithoutChangeTime = ConcurrentHashMap.newKeySet();

  public RepairByEntityType(final String repairName) {
    this.repairName = repairName;
  }

  /**
   * Runs {@code repair} for each of {@code entityTypes}.
   *
   * @return the total the type repairs returned
   */
  public int run(final List<String> entityTypes, final TypeRepair repair) throws Exception {
    int repaired = 0;
    Exception firstFailure = null;
    for (final String entityType : entityTypes) {
      if (!typesWithoutChangeTime.contains(entityType)) {
        try {
          repaired += repair.repair(entityType);
        } catch (Exception e) {
          firstFailure = recordFailure(entityType, e, firstFailure);
        }
      }
    }
    if (firstFailure != null) {
      throw firstFailure;
    }
    return repaired;
  }

  /** Returns the first failure that should hold the window back. */
  private Exception recordFailure(
      final String entityType, final Exception failure, final Exception firstFailure) {
    Exception holding = firstFailure;
    if (lacksChangeTime(failure)) {
      typesWithoutChangeTime.add(entityType);
      LOG.warn(
          "{} cannot tell which {} rows changed: their table has no updatedAt column. Only the"
              + " daily sweep and full rebuilds cover them.",
          repairName,
          entityType);
    } else {
      LOG.warn("{} could not check the changed {} rows", repairName, entityType, failure);
      holding = firstFailure == null ? failure : firstFailure;
    }
    return holding;
  }

  /** The table has no {@code updatedAt} column, as PostgreSQL or MySQL reports it. */
  static boolean lacksChangeTime(final Throwable failure) {
    boolean undefinedColumn = false;
    for (Throwable cause = failure; cause != null && !undefinedColumn; cause = cause.getCause()) {
      undefinedColumn =
          cause instanceof SQLException sqlException
              && sqlException.getSQLState() != null
              && UNDEFINED_COLUMN_STATES.contains(sqlException.getSQLState());
    }
    return undefinedColumn;
  }
}
