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

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jobs.JobDAO;

/**
 * DAOFactory provides DAO instances based on the HTTP operation type.
 * For read operations (GET), it uses the read replica if available.
 * For write operations (POST, PUT, DELETE, PATCH), it always uses the primary database.
 */
@Slf4j
public class DAOFactory {

  /**
   * Determines if the current operation is a read operation based on HTTP method.
   * @param httpMethod The HTTP method (GET, POST, PUT, DELETE, PATCH)
   * @return true if this is a read operation, false otherwise
   */
  public static boolean isReadOperation(String httpMethod) {
    return "GET".equalsIgnoreCase(httpMethod);
  }

  /**
   * Get CollectionDAO instance based on operation type.
   * @param httpMethod The HTTP method
   * @return Appropriate CollectionDAO instance
   */
  public static CollectionDAO getCollectionDAO(String httpMethod) {
    DatabaseManager dbManager = DatabaseManager.getInstance();

    if (isReadOperation(httpMethod) && dbManager.isReplicaEnabled()) {
      LOG.debug("Using read replica for {} operation", httpMethod);
      return dbManager.getReadJdbi().onDemand(CollectionDAO.class);
    } else {
      LOG.debug("Using primary database for {} operation", httpMethod);
      return dbManager.getWriteJdbi().onDemand(CollectionDAO.class);
    }
  }

  /**
   * Get CollectionDAO for read operations (uses replica if available).
   * @return CollectionDAO instance for read operations
   */
  public static CollectionDAO getReadCollectionDAO() {
    return getCollectionDAO("GET");
  }

  /**
   * Get CollectionDAO for write operations (always uses primary).
   * @return CollectionDAO instance for write operations
   */
  public static CollectionDAO getWriteCollectionDAO() {
    return getCollectionDAO("POST");
  }

  /**
   * Get JobDAO instance. Job operations always use the primary database
   * since they involve state changes and require strong consistency.
   * @return JobDAO instance using primary database
   */
  public static JobDAO getJobDAO() {
    DatabaseManager dbManager = DatabaseManager.getInstance();
    return dbManager.getWriteJdbi().onDemand(JobDAO.class);
  }

  /**
   * Get MigrationDAO instance. Migration operations always use the primary database.
   * @return MigrationDAO instance using primary database
   */
  public static MigrationDAO getMigrationDAO() {
    DatabaseManager dbManager = DatabaseManager.getInstance();
    return dbManager.getWriteJdbi().onDemand(MigrationDAO.class);
  }

  /**
   * Get DatabaseManager instance for testing purposes.
   * @return DatabaseManager instance
   */
  public static DatabaseManager getDatabaseManager() {
    return DatabaseManager.getInstance();
  }

  /**
   * Generic method to get any DAO instance based on operation type.
   * @param daoClass The DAO class to instantiate
   * @param httpMethod The HTTP method
   * @param <T> The DAO type
   * @return DAO instance
   */
  public static <T> T getDAO(Class<T> daoClass, String httpMethod) {
    DatabaseManager dbManager = DatabaseManager.getInstance();

    if (isReadOperation(httpMethod) && dbManager.isReplicaEnabled()) {
      LOG.debug("Using read replica for {} operation on {}", httpMethod, daoClass.getSimpleName());
      return dbManager.getReadJdbi().onDemand(daoClass);
    } else {
      LOG.debug(
          "Using primary database for {} operation on {}", httpMethod, daoClass.getSimpleName());
      return dbManager.getWriteJdbi().onDemand(daoClass);
    }
  }

  /**
   * Get DAO for read operations.
   * @param daoClass The DAO class to instantiate
   * @param <T> The DAO type
   * @return DAO instance for read operations
   */
  public static <T> T getReadDAO(Class<T> daoClass) {
    return getDAO(daoClass, "GET");
  }

  /**
   * Get DAO for write operations.
   * @param daoClass The DAO class to instantiate
   * @param <T> The DAO type
   * @return DAO instance for write operations
   */
  public static <T> T getWriteDAO(Class<T> daoClass) {
    return getDAO(daoClass, "POST");
  }
}
