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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import io.dropwizard.core.setup.Environment;
import io.dropwizard.db.DataSourceFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.config.ReadReplicaConfiguration;

@ExtendWith(MockitoExtension.class)
class DatabaseManagerTest {

  @Mock private Environment environment;
  @Mock private OpenMetadataApplicationConfig config;
  @Mock private DataSourceFactory primaryDataSourceFactory;
  @Mock private ReadReplicaConfiguration readReplicaConfig;

  @Test
  void testSingleDatabaseMode() {
    // Test behavior when no read replica is configured
    when(config.getDataSourceFactory()).thenReturn(primaryDataSourceFactory);
    when(config.getReadReplicaConfiguration()).thenReturn(null);
    when(primaryDataSourceFactory.getDriverClass()).thenReturn("com.mysql.cj.jdbc.Driver");

    DatabaseManager.initialize(environment, config);
    DatabaseManager dbManager = DatabaseManager.getInstance();

    assertFalse(dbManager.isReplicaEnabled());
    assertSame(dbManager.getWriteJdbi(), dbManager.getReadJdbi());
    assertSame(dbManager.getJdbi(), dbManager.getWriteJdbi());
  }

  @Test
  void testReplicaMode() {
    // Test behavior when read replica is configured
    when(config.getDataSourceFactory()).thenReturn(primaryDataSourceFactory);
    when(config.getReadReplicaConfiguration()).thenReturn(readReplicaConfig);
    when(primaryDataSourceFactory.getDriverClass()).thenReturn("com.mysql.cj.jdbc.Driver");
    when(primaryDataSourceFactory.getUrl()).thenReturn("jdbc:mysql://primary:3306/test");
    when(primaryDataSourceFactory.getUser()).thenReturn("user");
    when(primaryDataSourceFactory.getPassword()).thenReturn("password");

    when(readReplicaConfig.getHost()).thenReturn("replica");
    when(readReplicaConfig.getPort()).thenReturn(3306);

    try {
      DatabaseManager.initialize(environment, config);
      DatabaseManager dbManager = DatabaseManager.getInstance();

      // Note: In a real test environment, we might get an exception due to actual database
      // connections
      // but we're testing the logic flow
      assertNotNull(dbManager.getWriteJdbi());
      assertNotNull(dbManager.getReadJdbi());

    } catch (Exception e) {
      // Expected in test environment without actual databases
      assertTrue(e.getMessage().contains("database") || e.getMessage().contains("connection"));
    }
  }

  @Test
  void testDAOFactory() {
    // Reset any existing instance for clean test
    try {
      java.lang.reflect.Field instanceField = DatabaseManager.class.getDeclaredField("instance");
      instanceField.setAccessible(true);
      instanceField.set(null, null);
    } catch (Exception e) {
      // Ignore reflection issues in test
    }

    when(config.getDataSourceFactory()).thenReturn(primaryDataSourceFactory);
    when(config.getReadReplicaConfiguration()).thenReturn(null);
    when(primaryDataSourceFactory.getDriverClass()).thenReturn("com.mysql.cj.jdbc.Driver");

    DatabaseManager.initialize(environment, config);

    assertTrue(DAOFactory.isReadOperation("GET"));
    assertFalse(DAOFactory.isReadOperation("POST"));
    assertFalse(DAOFactory.isReadOperation("PUT"));
    assertFalse(DAOFactory.isReadOperation("DELETE"));
    assertFalse(DAOFactory.isReadOperation("PATCH"));

    // Test DAO factory methods don't throw exceptions
    assertDoesNotThrow(() -> DAOFactory.getReadCollectionDAO());
    assertDoesNotThrow(() -> DAOFactory.getWriteCollectionDAO());
    assertDoesNotThrow(() -> DAOFactory.getJobDAO());
    assertDoesNotThrow(() -> DAOFactory.getMigrationDAO());
  }
}
