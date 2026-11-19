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

package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.fernet.Fernet;

/**
 * Power BI's {@code pbitFilesSource} and Microsoft Access's {@code connection} each offer a local
 * path option next to options that hold cloud credentials. Every option saves and reads back, and
 * a value that matches none of them is refused.
 */
class LocalPathOptionSecretsTest {

  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String POWER_BI = "PowerBI";
  private static final String MICROSOFT_ACCESS = "MicrosoftAccess";
  private static final String AWS_SECRET = "local-path-option-aws-secret";
  private static final Map<String, Object> AWS_CONFIG =
      Map.of(
          "awsAccessKeyId",
          "access-key",
          "awsSecretAccessKey",
          AWS_SECRET,
          "awsRegion",
          "eu-west-1");

  private static SecretsManager secretsManager;

  @BeforeAll
  static void setUp() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    secretsManager =
        DBSecretsManager.getInstance(
            SecretsManagerProvider.DB,
            new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null));
    secretsManager.setFernet(Fernet.getInstance());
  }

  @AfterAll
  static void tearDown() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void savesAndReadsBackALocalPbitFilesSource() {
    Map<String, Object> local = Map.of("pbitFileConfigType", "local", "path", "/data/pbit");

    Map<String, Object> readBack = roundTrip(POWER_BI, ServiceType.DASHBOARD, powerBi(local));

    Map<String, Object> source = property(readBack, "pbitFilesSource");
    assertEquals("local", source.get("pbitFileConfigType"));
    assertEquals("/data/pbit", source.get("path"));
  }

  @Test
  void savesAnS3PbitFilesSourceWithItsSecretEncrypted() {
    Map<String, Object> s3 = Map.of("pbitFileConfigType", "s3", "securityConfig", AWS_CONFIG);

    Map<String, Object> stored =
        json(
            secretsManager.encryptServiceConnectionConfig(
                powerBi(s3), POWER_BI, "power-bi", ServiceType.DASHBOARD));
    Map<String, Object> readBack = roundTrip(POWER_BI, ServiceType.DASHBOARD, powerBi(s3));

    assertTrue(Fernet.isTokenized(awsSecret(property(stored, "pbitFilesSource"))));
    assertEquals(AWS_SECRET, awsSecret(property(readBack, "pbitFilesSource")));
  }

  @Test
  void refusesAPbitFilesSourceThatMatchesNoOption() {
    Map<String, Object> mixed = Map.of("path", "/data/pbit", "securityConfig", AWS_CONFIG);

    InvalidServiceConnectionException e =
        assertThrows(
            InvalidServiceConnectionException.class,
            () ->
                secretsManager.encryptServiceConnectionConfig(
                    powerBi(mixed), POWER_BI, "power-bi", ServiceType.DASHBOARD));

    assertTrue(e.getMessage().contains("[pbitFilesSource]"), e.getMessage());
    assertFalse(e.getMessage().contains(AWS_SECRET), e.getMessage());
  }

  @Test
  void savesAndReadsBackALocalAccessFilePath() {
    Map<String, Object> readBack =
        roundTrip(
            MICROSOFT_ACCESS,
            ServiceType.DATABASE,
            Map.of("connection", Map.of("localFilePath", "/data/sales.accdb")));

    assertEquals(Map.of("localFilePath", "/data/sales.accdb"), property(readBack, "connection"));
  }

  @Test
  void savesAnS3AccessLocationWithItsSecretEncrypted() {
    Map<String, Object> config = Map.of("connection", Map.of("awsConfig", AWS_CONFIG));

    Map<String, Object> stored =
        json(
            secretsManager.encryptServiceConnectionConfig(
                config, MICROSOFT_ACCESS, "access", ServiceType.DATABASE));
    Map<String, Object> readBack = roundTrip(MICROSOFT_ACCESS, ServiceType.DATABASE, config);

    assertTrue(Fernet.isTokenized(awsSecret(property(stored, "connection"))));
    assertEquals(AWS_SECRET, awsSecret(property(readBack, "connection")));
  }

  @Test
  void refusesAnAccessLocationThatMatchesNoOption() {
    Map<String, Object> config =
        Map.of("connection", Map.of("localFilePath", "/data/sales.accdb", "awsConfig", AWS_CONFIG));

    InvalidServiceConnectionException e =
        assertThrows(
            InvalidServiceConnectionException.class,
            () ->
                secretsManager.encryptServiceConnectionConfig(
                    config, MICROSOFT_ACCESS, "access", ServiceType.DATABASE));

    assertTrue(e.getMessage().contains("[connection]"), e.getMessage());
    assertFalse(e.getMessage().contains(AWS_SECRET), e.getMessage());
  }

  private static Map<String, Object> roundTrip(
      String connectionType, ServiceType serviceType, Map<String, Object> config) {
    Object stored =
        secretsManager.encryptServiceConnectionConfig(
            config, connectionType, "local-path-option", serviceType);
    Map<String, Object> storedJson = json(stored);
    return json(
        secretsManager.decryptServiceConnectionConfig(storedJson, connectionType, serviceType));
  }

  private static Map<String, Object> powerBi(Map<String, Object> pbitFilesSource) {
    return Map.of("clientId", "client", "tenantId", "tenant", "pbitFilesSource", pbitFilesSource);
  }

  private static String awsSecret(Map<String, Object> option) {
    Map<String, Object> aws =
        property(option, option.containsKey("awsConfig") ? "awsConfig" : "securityConfig");
    return (String) aws.get("awsSecretAccessKey");
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> property(Map<String, Object> json, String name) {
    return (Map<String, Object>) json.get(name);
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> json(Object value) {
    return JsonUtils.readValue(JsonUtils.pojoToJson(value), Map.class);
  }
}
