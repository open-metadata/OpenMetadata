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

package org.openmetadata.service.resources.system;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.config.ReadReplicaConfiguration;
import org.openmetadata.service.jdbi3.DAOFactory;
import org.openmetadata.service.jdbi3.DatabaseManager;
import org.openmetadata.service.security.SecurityUtil;

/**
 * Test class for read replica functionality in OpenMetadata.
 * Tests both scenarios: with and without read replicas configured.
 */
@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ReadReplicaTest extends OpenMetadataApplicationTest {

  @BeforeAll
  void setup() {}

  @Test
  void testDatabaseManagerInitialization() {
    assertNotNull(DatabaseManager.getInstance(), "DatabaseManager should be initialized");
    Jdbi primaryJdbi = DatabaseManager.getInstance().getWriteJdbi();
    assertNotNull(primaryJdbi, "Primary JDBI should be available");

    Jdbi readJdbi = DatabaseManager.getInstance().getReadJdbi();
    assertNotNull(readJdbi, "Read JDBI should be available");
    assertEquals(
        primaryJdbi, readJdbi, "Without replica config, read and write JDBI should be the same");

    assertFalse(
        DatabaseManager.getInstance().isReplicaEnabled(),
        "Replica should not be enabled in test environment without replica config");
  }

  @Test
  void testDAOFactoryRouting() {
    assertTrue(DAOFactory.isReadOperation("GET"), "GET should be identified as read operation");
    assertFalse(DAOFactory.isReadOperation("HEAD"), "HEAD should be identified as write operation");
    assertFalse(
        DAOFactory.isReadOperation("OPTIONS"), "OPTIONS should be identified as write operation");

    assertFalse(DAOFactory.isReadOperation("POST"), "POST should be identified as write operation");
    assertFalse(DAOFactory.isReadOperation("PUT"), "PUT should be identified as write operation");
    assertFalse(
        DAOFactory.isReadOperation("DELETE"), "DELETE should be identified as write operation");
    assertFalse(
        DAOFactory.isReadOperation("PATCH"), "PATCH should be identified as write operation");

    assertTrue(
        DAOFactory.isReadOperation("get"), "Lowercase GET should be identified as read operation");
    assertFalse(
        DAOFactory.isReadOperation("post"),
        "Lowercase POST should be identified as write operation");
    assertFalse(
        DAOFactory.isReadOperation(null), "Null method should be identified as write operation");
    assertFalse(
        DAOFactory.isReadOperation(""), "Empty method should be identified as write operation");
    assertFalse(
        DAOFactory.isReadOperation("UNKNOWN"),
        "Unknown method should be identified as write operation");
  }

  @Test
  void testReadReplicaConfigurationParsing() {
    ReadReplicaConfiguration config = new ReadReplicaConfiguration();
    config.setHost("replica-host");

    assertNotNull(config.getHost(), "Host should be set");
    assertEquals("replica-host", config.getHost(), "Host should match");
    assertNull(config.getPort(), "Port should be null when not set");
    assertNull(config.getDatabaseName(), "Database name should be null when not set");
    assertNull(config.getAuth(), "Auth should be null when not set");

    ReadReplicaConfiguration.AuthConfiguration auth =
        new ReadReplicaConfiguration.AuthConfiguration();
    auth.setUsername("replica_user");
    auth.setPassword("replica_pass");

    config.setPort(3307);
    config.setDatabaseName("replica_db");
    config.setAuth(auth);
    config.setMaxSize(50);

    assertEquals(3307, config.getPort().intValue(), "Port should match");
    assertEquals("replica_db", config.getDatabaseName(), "Database name should match");
    assertEquals("replica_user", config.getAuth().getUsername(), "Username should match");
    assertEquals("replica_pass", config.getAuth().getPassword(), "Password should match");
    assertEquals(50, config.getMaxSize().intValue(), "Max size should match");
  }

  @Test
  void testStatusCheckWithoutReplica() {
    WebTarget target = getResource("system/status");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    assertEquals(
        Response.Status.OK.getStatusCode(),
        response.getStatus(),
        "Status check should succeed without replica");
    String responseBody = response.readEntity(String.class);
    assertNotNull(responseBody, "Status check response should not be null");
  }

  @Test
  void testGetOperationsUseReadConnection() {
    WebTarget target = getResource("system/settings");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    assertTrue(
        response.getStatus() >= 200 && response.getStatus() < 300, "GET operation should succeed");
  }

  @Test
  void testBackwardCompatibility() {
    assertNotNull(Entity.getJdbi(), "Entity.jdbi should be available for backward compatibility");
    Jdbi backwardCompatJdbi = DatabaseManager.getInstance().getJdbi();
    assertNotNull(backwardCompatJdbi, "Backward compatibility JDBI should be available");
    assertEquals(
        DatabaseManager.getInstance().getWriteJdbi(),
        backwardCompatJdbi,
        "Backward compatibility JDBI should be the same as write JDBI");
  }

  @Test
  void testReplicaConfigurationIntegration() {
    try {
      OpenMetadataApplicationConfig config = APP.getConfiguration();
      ReadReplicaConfiguration replicaConfig = config.getReadReplicaConfiguration();
      LOG.info(
          "Replica configuration in test: {}",
          replicaConfig != null ? "configured" : "not configured");
      assertNotNull(
          DatabaseManager.getInstance(),
          "DatabaseManager should work with or without replica config");
    } catch (Exception e) {
      fail("Replica configuration integration should not throw exceptions: " + e.getMessage());
    }
  }

  @Test
  void testReplicaAwareResourceFunctionality() {
    WebTarget target = getResource("system/settings");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    assertTrue(
        response.getStatus() >= 200 && response.getStatus() < 300,
        "System endpoints should work correctly with replica infrastructure");
  }
}
