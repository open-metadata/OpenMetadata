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

import io.dropwizard.core.setup.Environment;
import io.dropwizard.db.DataSourceFactory;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.config.ReadReplicaConfiguration;
import org.openmetadata.service.util.jdbi.JdbiUtils;

/**
 * DatabaseManager handles both primary and read replica database connections.
 * It provides separate JDBI instances for write operations (primary) and read operations (replica).
 * If no replica is configured, both read and write operations use the primary database.
 */
@Slf4j
@Getter
public class DatabaseManager {
  private static DatabaseManager instance;

  private final Jdbi primaryJdbi;
  private final Jdbi replicaJdbi;
  private final boolean replicaEnabled;

  private DatabaseManager(Environment environment, OpenMetadataApplicationConfig config) {
    // Initialize primary database connection
    this.primaryJdbi =
        JdbiUtils.createAndSetupJDBI(environment, config.getDataSourceFactory(), "database");
    LOG.info("Initialized primary database connection (write operations)");

    // Initialize replica database connection if configured
    ReadReplicaConfiguration replicaConfig = config.getReadReplicaConfiguration();

    Jdbi tempReplicaJdbi;
    boolean tempReplicaEnabled;

    if (replicaConfig != null) {
      try {
        DataSourceFactory replicaDataSourceFactory =
            replicaConfig.toDataSourceFactory(config.getDataSourceFactory());
        if (replicaDataSourceFactory != null) {
          tempReplicaJdbi =
              JdbiUtils.createAndSetupJDBI(
                  environment, replicaDataSourceFactory, "database-replica");
          tempReplicaEnabled = true;
          LOG.info(
              "Initialized read-replica database connection (read operations) at {}:{}",
              replicaConfig.getHost(),
              replicaConfig.getPort());
        } else {
          // Replica configuration exists but host is empty - treat as no replica
          tempReplicaJdbi = this.primaryJdbi;
          tempReplicaEnabled = false;
          LOG.info("Read replica host not configured. Using primary database for all operations.");
        }
      } catch (Exception e) {
        LOG.error(
            "Failed to initialize read replica database connection. Falling back to primary for all operations.",
            e);
        tempReplicaJdbi = this.primaryJdbi;
        tempReplicaEnabled = false;
      }
    } else {
      // No replica configured, use primary for all operations
      tempReplicaJdbi = this.primaryJdbi;
      tempReplicaEnabled = false;
      LOG.info("No read replica configured. Using primary database for all operations.");
    }

    this.replicaJdbi = tempReplicaJdbi;
    this.replicaEnabled = tempReplicaEnabled;
  }

  /**
   * Initialize the DatabaseManager singleton instance.
   * This should be called once during application startup.
   */
  public static void initialize(Environment environment, OpenMetadataApplicationConfig config) {
    if (instance != null) {
      throw new IllegalStateException("DatabaseManager has already been initialized");
    }
    instance = new DatabaseManager(environment, config);
  }

  /**
   * Get the singleton DatabaseManager instance.
   * @throws IllegalStateException if not initialized
   */
  public static DatabaseManager getInstance() {
    if (instance == null) {
      throw new IllegalStateException(
          "DatabaseManager has not been initialized. Call initialize() first.");
    }
    return instance;
  }

  /**
   * Get JDBI instance for write operations (always uses primary database).
   */
  public Jdbi getWriteJdbi() {
    return primaryJdbi;
  }

  /**
   * Get JDBI instance for read operations (uses replica if available, otherwise primary).
   */
  public Jdbi getReadJdbi() {
    return replicaJdbi;
  }

  /**
   * Returns true if a read replica is configured and successfully initialized.
   */
  public boolean isReplicaEnabled() {
    return replicaEnabled;
  }

  /**
   * For backward compatibility - returns the primary JDBI instance.
   * This method exists to support existing code that expects a single JDBI instance.
   */
  public Jdbi getJdbi() {
    return primaryJdbi;
  }
}
