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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataS3Config;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;

class IngestionPipelineBuilderTest {
  private static final String SECRET = "manifest-secret";

  @BeforeEach
  void createMasker() {
    EntityMaskerFactory.setEntityMasker(null);
    EntityMaskerFactory.createEntityMasker();
  }

  @AfterEach
  void resetMasker() {
    EntityMaskerFactory.setEntityMasker(null);
  }

  /** A manifest source no source schema matches would keep its credentials out of reach. */
  @Test
  void aManifestMatchingNoSourceSchemaIsRefusedWhenWritten() {
    IngestionPipeline pipeline = storagePipeline(manifestSource(true));

    assertThrows(
        BadRequestException.class, () -> IngestionPipelineBuilder.addDefinedConfig(pipeline));
  }

  /** Stored before the check, such a source is left out of what is read rather than returned. */
  @Test
  void aStoredManifestMatchingNoSourceSchemaIsReadWithoutItsCredentials() {
    IngestionPipeline pipeline = storagePipeline(manifestSource(true));

    EntityMaskerFactory.getEntityMasker().maskIngestionPipeline(pipeline);

    assertFalse(JsonUtils.pojoToJson(pipeline).contains(SECRET));
  }

  @Test
  void aManifestMatchingASourceSchemaIsTyped() {
    IngestionPipeline pipeline = storagePipeline(manifestSource(false));

    IngestionPipelineBuilder.addDefinedConfig(pipeline);

    StorageServiceMetadataPipeline config =
        assertInstanceOf(
            StorageServiceMetadataPipeline.class, pipeline.getSourceConfig().getConfig());
    assertInstanceOf(StorageMetadataS3Config.class, config.getStorageMetadataConfigSource());
  }

  private static IngestionPipeline storagePipeline(Map<String, Object> manifestSource) {
    Map<String, Object> config = new HashMap<>();
    config.put("type", "StorageMetadata");
    config.put("storageMetadataConfigSource", manifestSource);
    return new IngestionPipeline()
        .withName("storage_manifest")
        .withPipelineType(PipelineType.METADATA)
        .withSourceConfig(new SourceConfig().withConfig(config));
  }

  private static Map<String, Object> manifestSource(boolean withPropertyNoSchemaHas) {
    Map<String, Object> source = new HashMap<>();
    source.put(
        "securityConfig",
        Map.of(
            "awsAccessKeyId", "manifest-key",
            "awsSecretAccessKey", SECRET,
            "awsRegion", "us-east-1"));
    source.put("prefixConfig", Map.of("containerName", "manifests", "objectPrefix", "om"));
    if (withPropertyNoSchemaHas) {
      source.put("notInAnySourceSchema", "x");
    }
    return source;
  }
}
