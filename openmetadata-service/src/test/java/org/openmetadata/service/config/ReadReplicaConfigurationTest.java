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

package org.openmetadata.service.config;

import static org.junit.jupiter.api.Assertions.*;

import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.util.Duration;
import org.junit.jupiter.api.Test;

class ReadReplicaConfigurationTest {

  @Test
  void testToDataSourceFactoryWithDefaults() {
    // Setup primary DataSourceFactory
    DataSourceFactory primary = new DataSourceFactory();
    primary.setDriverClass("com.mysql.cj.jdbc.Driver");
    primary.setUrl("jdbc:mysql://primary:3306/openmetadata_db?useSSL=false");
    primary.setUser("primary_user");
    primary.setPassword("primary_password");
    primary.setMaxSize(50);
    primary.setMinSize(10);
    primary.setInitialSize(10);
    primary.setCheckConnectionWhileIdle(true);
    primary.setCheckConnectionOnBorrow(true);
    primary.setEvictionInterval(Duration.minutes(5));
    primary.setMinIdleTime(Duration.minutes(1));

    // Setup replica configuration
    ReadReplicaConfiguration replicaConfig = new ReadReplicaConfiguration();
    replicaConfig.setHost("replica");
    replicaConfig.setPort(3306);

    // Convert to DataSourceFactory
    DataSourceFactory replica = replicaConfig.toDataSourceFactory(primary);

    // Verify replica settings
    assertEquals("com.mysql.cj.jdbc.Driver", replica.getDriverClass());
    assertTrue(replica.getUrl().contains("replica:3306"));
    assertTrue(replica.getUrl().contains("openmetadata_db"));
    assertTrue(replica.getUrl().contains("useSSL=false"));
    assertEquals("primary_user", replica.getUser());
    assertEquals("primary_password", replica.getPassword());
    assertEquals(50, replica.getMaxSize());
    assertEquals(10, replica.getMinSize());
    assertEquals(10, replica.getInitialSize());
    assertTrue(replica.getCheckConnectionWhileIdle());
    assertTrue(replica.getCheckConnectionOnBorrow());
  }

  @Test
  void testToDataSourceFactoryWithCustomSettings() {
    // Setup primary DataSourceFactory
    DataSourceFactory primary = new DataSourceFactory();
    primary.setDriverClass("org.postgresql.Driver");
    primary.setUrl("jdbc:postgresql://primary:5432/openmetadata_db");
    primary.setUser("primary_user");
    primary.setPassword("primary_password");
    primary.setMaxSize(50);

    // Setup replica configuration with custom settings
    ReadReplicaConfiguration replicaConfig = new ReadReplicaConfiguration();
    replicaConfig.setHost("replica");
    replicaConfig.setPort(5433);
    replicaConfig.setDatabaseName("replica_db");
    replicaConfig.setMaxSize(100);

    ReadReplicaConfiguration.AuthConfiguration auth =
        new ReadReplicaConfiguration.AuthConfiguration();
    auth.setUsername("replica_user");
    auth.setPassword("replica_password");
    replicaConfig.setAuth(auth);

    // Convert to DataSourceFactory
    DataSourceFactory replica = replicaConfig.toDataSourceFactory(primary);

    // Verify custom settings are used
    assertEquals("org.postgresql.Driver", replica.getDriverClass());
    assertTrue(replica.getUrl().contains("replica:5433"));
    assertTrue(replica.getUrl().contains("replica_db"));
    assertEquals("replica_user", replica.getUser());
    assertEquals("replica_password", replica.getPassword());
    assertEquals(100, replica.getMaxSize());
  }

  @Test
  void testPortExtraction() {
    DataSourceFactory primary = new DataSourceFactory();

    // Test MySQL default port
    primary.setDriverClass("com.mysql.cj.jdbc.Driver");
    primary.setUrl("jdbc:mysql://host/db");
    ReadReplicaConfiguration config = new ReadReplicaConfiguration();
    config.setHost("replica");
    DataSourceFactory replica = config.toDataSourceFactory(primary);
    assertTrue(replica.getUrl().contains("replica:3306"));

    // Test PostgreSQL default port
    primary.setDriverClass("org.postgresql.Driver");
    primary.setUrl("jdbc:postgresql://host/db");
    replica = config.toDataSourceFactory(primary);
    assertTrue(replica.getUrl().contains("replica:5432"));

    // Test explicit port in primary URL
    primary.setUrl("jdbc:mysql://host:3307/db");
    replica = config.toDataSourceFactory(primary);
    assertTrue(replica.getUrl().contains("replica:3307"));
  }

  @Test
  void testPartialConfiguration() {
    DataSourceFactory primary = new DataSourceFactory();
    primary.setDriverClass("com.mysql.cj.jdbc.Driver");
    primary.setUrl("jdbc:mysql://primary:3306/openmetadata_db");
    primary.setUser("primary_user");
    primary.setPassword("primary_password");

    // Minimal replica configuration
    ReadReplicaConfiguration replicaConfig = new ReadReplicaConfiguration();
    replicaConfig.setHost("replica");

    DataSourceFactory replica = replicaConfig.toDataSourceFactory(primary);

    // Should inherit from primary
    assertTrue(replica.getUrl().contains("replica:3306"));
    assertTrue(replica.getUrl().contains("openmetadata_db"));
    assertEquals("primary_user", replica.getUser());
    assertEquals("primary_password", replica.getPassword());
  }
}
