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

package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.utils.common.AccessTokenConfig;
import org.openmetadata.schema.entity.utils.common.BasicAuthConfig;
import org.openmetadata.schema.entity.utils.common.GcpCredentialsConfig;
import org.openmetadata.schema.entity.utils.common.MWAAAuthConfig;
import org.openmetadata.schema.services.connections.pipeline.AirflowRestApiConnection;

class AirflowRestApiConnectionClassConverterTest {

  private final AirflowRestApiConnectionClassConverter converter =
      new AirflowRestApiConnectionClassConverter();

  @Test
  void convert_basicAuth_convertsAuthConfig() {
    Map<String, Object> authMap = new HashMap<>();
    authMap.put("username", "admin");
    authMap.put("password", "secret");

    Map<String, Object> connMap = new HashMap<>();
    connMap.put("authConfig", authMap);

    Object result = converter.convert(connMap);

    assertInstanceOf(AirflowRestApiConnection.class, result);
    AirflowRestApiConnection conn = (AirflowRestApiConnection) result;
    assertInstanceOf(BasicAuthConfig.class, conn.getAuthConfig());
    BasicAuthConfig auth = (BasicAuthConfig) conn.getAuthConfig();
    assertEquals("admin", auth.getUsername());
    assertEquals("secret", auth.getPassword());
  }

  @Test
  void convert_accessToken_convertsAuthConfig() {
    Map<String, Object> authMap = new HashMap<>();
    authMap.put("token", "my-access-token");

    Map<String, Object> connMap = new HashMap<>();
    connMap.put("authConfig", authMap);

    Object result = converter.convert(connMap);

    assertInstanceOf(AirflowRestApiConnection.class, result);
    AirflowRestApiConnection conn = (AirflowRestApiConnection) result;
    assertInstanceOf(AccessTokenConfig.class, conn.getAuthConfig());
    AccessTokenConfig auth = (AccessTokenConfig) conn.getAuthConfig();
    assertEquals("my-access-token", auth.getToken());
  }

  @Test
  void convert_gcpCredentials_convertsAuthConfig() {
    Map<String, Object> gcpValues = new HashMap<>();
    gcpValues.put("type", "service_account");
    gcpValues.put("projectId", "my-project");

    Map<String, Object> gcpCreds = new HashMap<>();
    gcpCreds.put("gcpConfig", gcpValues);

    Map<String, Object> authMap = new HashMap<>();
    authMap.put("credentials", gcpCreds);

    Map<String, Object> connMap = new HashMap<>();
    connMap.put("authConfig", authMap);

    Object result = converter.convert(connMap);

    assertInstanceOf(AirflowRestApiConnection.class, result);
    AirflowRestApiConnection conn = (AirflowRestApiConnection) result;
    assertInstanceOf(GcpCredentialsConfig.class, conn.getAuthConfig());
  }

  @Test
  void convert_mwaaAuth_convertsAuthConfig() {
    Map<String, Object> awsConfig = new HashMap<>();
    awsConfig.put("awsRegion", "us-east-1");
    awsConfig.put("awsAccessKeyId", "AKIAIOSFODNN7EXAMPLE");
    awsConfig.put("awsSecretAccessKey", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");

    Map<String, Object> mwaaConfig = new HashMap<>();
    mwaaConfig.put("mwaaEnvironmentName", "my-environment");
    mwaaConfig.put("awsConfig", awsConfig);

    Map<String, Object> authMap = new HashMap<>();
    authMap.put("mwaaConfig", mwaaConfig);

    Map<String, Object> connMap = new HashMap<>();
    connMap.put("authConfig", authMap);

    Object result = converter.convert(connMap);

    assertInstanceOf(AirflowRestApiConnection.class, result);
    AirflowRestApiConnection conn = (AirflowRestApiConnection) result;
    assertInstanceOf(MWAAAuthConfig.class, conn.getAuthConfig());
    MWAAAuthConfig auth = (MWAAAuthConfig) conn.getAuthConfig();
    assertNotNull(auth.getMwaaConfig());
    assertEquals("my-environment", auth.getMwaaConfig().getMwaaEnvironmentName());
  }

  @Test
  void convert_nullAuthConfig_returnsConnectionWithoutConversion() {
    // When authConfig is null, it's not a Map instance, so line 40 (early return) is hit
    Map<String, Object> connMap = new HashMap<>();
    connMap.put("authConfig", null);

    Object result = converter.convert(connMap);

    assertInstanceOf(AirflowRestApiConnection.class, result);
  }
}
