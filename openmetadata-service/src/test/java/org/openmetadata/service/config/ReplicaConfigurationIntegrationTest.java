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

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.validation.Validators;
import jakarta.validation.Validator;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationConfig;

class ReplicaConfigurationIntegrationTest {

  private final ObjectMapper mapper = Jackson.newObjectMapper();
  private final Validator validator = Validators.newValidator();

  @Test
  void testYamlConfigurationWithoutReplica() throws Exception {
    String yamlConfig =
        """
        database:
          driverClass: com.mysql.cj.jdbc.Driver
          user: openmetadata_user
          password: openmetadata_password
          url: jdbc:mysql://localhost:3306/openmetadata_db
        """;

    OpenMetadataApplicationConfig config = parseConfig(yamlConfig);

    assertNotNull(config.getDataSourceFactory());
    assertNull(config.getReadReplicaConfiguration());
    assertEquals("com.mysql.cj.jdbc.Driver", config.getDataSourceFactory().getDriverClass());
  }

  @Test
  void testYamlConfigurationWithReplica() throws Exception {
    String yamlConfig =
        """
        database:
          driverClass: com.mysql.cj.jdbc.Driver
          user: openmetadata_user
          password: openmetadata_password
          url: jdbc:mysql://localhost:3306/openmetadata_db
        readReplica:
          host: replica.example.com
          port: 3306
          databaseName: openmetadata_db
          auth:
            username: replica_user
            password: replica_password
          maxSize: 25
        """;

    OpenMetadataApplicationConfig config = parseConfig(yamlConfig);

    assertNotNull(config.getDataSourceFactory());
    assertNotNull(config.getReadReplicaConfiguration());

    ReadReplicaConfiguration replica = config.getReadReplicaConfiguration();
    assertEquals("replica.example.com", replica.getHost());
    assertEquals(3306, replica.getPort());
    assertEquals("openmetadata_db", replica.getDatabaseName());
    assertEquals(25, replica.getMaxSize());

    assertNotNull(replica.getAuth());
    assertEquals("replica_user", replica.getAuth().getUsername());
    assertEquals("replica_password", replica.getAuth().getPassword());
  }

  @Test
  void testYamlConfigurationWithMinimalReplica() throws Exception {
    String yamlConfig =
        """
        database:
          driverClass: com.mysql.cj.jdbc.Driver
          user: openmetadata_user
          password: openmetadata_password
          url: jdbc:mysql://localhost:3306/openmetadata_db
        readReplica:
          host: replica.example.com
        """;

    OpenMetadataApplicationConfig config = parseConfig(yamlConfig);

    assertNotNull(config.getReadReplicaConfiguration());
    ReadReplicaConfiguration replica = config.getReadReplicaConfiguration();
    assertEquals("replica.example.com", replica.getHost());
    assertNull(replica.getPort()); // Should use default from primary
    assertNull(replica.getDatabaseName()); // Should inherit from primary
    assertNull(replica.getAuth()); // Should inherit from primary
  }

  @Test
  void testReplicaConfigurationValidation() throws Exception {
    // Test that host is required for replica configuration
    String yamlConfig =
        """
        database:
          driverClass: com.mysql.cj.jdbc.Driver
          user: openmetadata_user
          password: openmetadata_password
          url: jdbc:mysql://localhost:3306/openmetadata_db
        readReplica:
          port: 3306
        """;

    assertThrows(Exception.class, () -> parseConfig(yamlConfig));
  }

  private OpenMetadataApplicationConfig parseConfig(String yamlContent) throws Exception {
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class, validator, mapper, "dw");

    return factory.build(
        new FileConfigurationSourceProvider() {
          @Override
          public InputStream open(String path) throws IOException {
            return new ByteArrayInputStream(yamlContent.getBytes());
          }
        },
        "test-config");
  }
}
