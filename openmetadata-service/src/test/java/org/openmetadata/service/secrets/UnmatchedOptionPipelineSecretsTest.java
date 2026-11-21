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
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.fernet.Fernet;

/**
 * The dbt and storage manifest sources of an ingestion pipeline carry GCP credentials, whose
 * {@code gcpConfig} is a {@code oneOf}. A value must match one of its options to be saved.
 */
class UnmatchedOptionPipelineSecretsTest {

  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String PRIVATE_KEY = "unmatched-option-pipeline-private-key";
  private static final Map<String, Object> UNMATCHED_GCP_CONFIG =
      Map.of("type", "service_account", "privateKey", PRIVATE_KEY, "path", "/keys/sa.json");

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
  void refusesADbtPipelineWhoseGcpConfigMatchesNoOption() {
    IngestionPipeline pipeline = dbtGcs(UNMATCHED_GCP_CONFIG);

    IllegalArgumentException e =
        assertThrows(
            IllegalArgumentException.class,
            () -> secretsManager.encryptIngestionPipeline(pipeline));

    assertFalse(e.getMessage().contains(PRIVATE_KEY), e.getMessage());
  }

  @Test
  void refusesAStoragePipelineWhoseGcpConfigMatchesNoOption() {
    IngestionPipeline pipeline = storageGcs(UNMATCHED_GCP_CONFIG);

    BadRequestException e =
        assertThrows(
            BadRequestException.class, () -> secretsManager.encryptIngestionPipeline(pipeline));

    assertFalse(e.getMessage().contains(PRIVATE_KEY), e.getMessage());
  }

  @Test
  void savesADbtPipelineWhoseGcpConfigMatchesAnOption() {
    IngestionPipeline pipeline =
        dbtGcs(Map.of("type", "service_account", "projectId", "p", "privateKey", PRIVATE_KEY));

    secretsManager.encryptIngestionPipeline(pipeline);

    assertTrue(Fernet.isTokenized((String) dbtGcpConfig(pipeline).get("privateKey")));
  }

  @Test
  void decryptsTheEncryptedLeavesOfAStoredPipelineValueThatMatchesNoOption() {
    IngestionPipeline stored =
        dbtGcs(
            Map.of(
                "type", "service_account",
                "privateKey", Fernet.getInstance().encrypt(PRIVATE_KEY),
                "path", "/keys/sa.json"));

    secretsManager.decryptIngestionPipeline(stored);

    assertEquals(
        Map.of("type", "service_account", "privateKey", PRIVATE_KEY, "path", "/keys/sa.json"),
        dbtGcpConfig(stored));
  }

  static IngestionPipeline dbtGcs(Map<String, Object> gcpConfig) {
    Map<String, Object> source =
        Map.of("dbtConfigType", "gcs", "dbtSecurityConfig", Map.of("gcpConfig", gcpConfig));
    return pipeline("dbt", Map.of("type", "DBT", "dbtConfigSource", source));
  }

  private static IngestionPipeline storageGcs(Map<String, Object> gcpConfig) {
    Map<String, Object> source = Map.of("securityConfig", Map.of("gcpConfig", gcpConfig));
    return pipeline(
        "metadata", Map.of("type", "StorageMetadata", "storageMetadataConfigSource", source));
  }

  private static IngestionPipeline pipeline(String type, Map<String, Object> config) {
    return JsonUtils.convertValue(
        Map.of(
            "id",
            "0f6d6d6c-2c58-4e6e-9a3c-7a0b1e2f3c4d",
            "name",
            "gcs-pipeline",
            "pipelineType",
            type,
            "sourceConfig",
            Map.of("config", config),
            "airflowConfig",
            Map.of()),
        IngestionPipeline.class);
  }

  @SuppressWarnings("unchecked")
  static Map<String, Object> dbtGcpConfig(IngestionPipeline pipeline) {
    Map<String, Object> json = JsonUtils.readValue(JsonUtils.pojoToJson(pipeline), Map.class);
    Map<String, Object> sourceConfig = (Map<String, Object>) json.get("sourceConfig");
    Map<String, Object> config = (Map<String, Object>) sourceConfig.get("config");
    Map<String, Object> source = (Map<String, Object>) config.get("dbtConfigSource");
    Map<String, Object> security = (Map<String, Object>) source.get("dbtSecurityConfig");
    return (Map<String, Object>) security.get("gcpConfig");
  }
}
