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

import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.SQLException;
import org.quartz.utils.ConnectionProvider;

/**
 * Hands a Quartz job store connections from a pool this application owns.
 *
 * <p>Registering one of these under a unique name with {@code DBConnectionManager} replaces
 * Quartz's default of building its own c3p0 pool from {@code org.quartz.dataSource.*} properties.
 * That default is unusable here for two reasons. It captures a static password, which breaks under
 * AWS RDS IAM as soon as the 15-minute token expires and every subsequent physical connect fails
 * auth. And {@code DBConnectionManager} is a process-wide singleton keyed by datasource name whose
 * registration is an unguarded map put, so two schedulers configured under the same name silently
 * clobber each other's pool — orphaning one and leaving the survivor shared, then closed out from
 * under whichever job store shuts down second.
 */
public record QuartzConnectionProvider(HikariDataSource dataSource) implements ConnectionProvider {

  @Override
  public Connection getConnection() throws SQLException {
    return dataSource.getConnection();
  }

  @Override
  public void initialize() {
    // The pool is constructed ready to serve; nothing deferred to Quartz.
  }

  @Override
  public void shutdown() {
    // Quartz calls this from JobStoreSupport#shutdown, which is this pool's end of life.
    if (!dataSource.isClosed()) {
      dataSource.close();
    }
  }
}
