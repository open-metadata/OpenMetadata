/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.tasks;

import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.databases.DatasourceConfig;

/**
 * Generates human-readable task identifiers (e.g. {@code TASK-00001}) using a database-backed
 * sequence. Uses {@code LAST_INSERT_ID()} on MySQL and a dedicated DAO method on PostgreSQL,
 * both of which serialize concurrent writers via row locking on the sequence row.
 */
public final class TaskIdGenerator {

  private TaskIdGenerator() {}

  /**
   * Allocate the next sequential task ID, formatted as {@code TASK-XXXXX}.
   * The number portion is zero-padded to 5 digits and grows beyond 5 digits if exhausted.
   */
  public static String generateTaskId(CollectionDAO daoCollection) {
    long nextId = getNextSequenceId(daoCollection);
    return String.format("TASK-%05d", nextId);
  }

  private static long getNextSequenceId(CollectionDAO daoCollection) {
    Boolean isMySQL = DatasourceConfig.getInstance().isMySQL();
    if (Boolean.TRUE.equals(isMySQL)) {
      return Entity.getJdbi()
          .withHandle(
              handle -> {
                handle
                    .createUpdate("UPDATE new_task_sequence SET id = LAST_INSERT_ID(id + 1)")
                    .execute();
                return handle.createQuery("SELECT LAST_INSERT_ID()").mapTo(Long.class).one();
              });
    }
    return daoCollection.taskDAO().getNextTaskIdPostgres();
  }
}
