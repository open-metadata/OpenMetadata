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

package org.openmetadata.service.util;

import java.util.Map;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline.StorageMetadataConfigType;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;

public final class IngestionPipelineBuilder {

  private IngestionPipelineBuilder() {
    // Final
  }

  private static final String CONFIG_TYPE = "type";

  /**
   * Build `IngestionPipeline` object with concrete class for the config which by definition it is a `Object`.
   *
   * <p>Only the configs that can hold secrets are typed; any other config stays a map, which the
   * password masker and the secrets manager skip. ADR:2026-11-02-oneof-secrets-are-typed-by-ordered-converter-candidates
   */
  public static void addDefinedConfig(IngestionPipeline ingestionPipeline) {
    SourceConfig sourceConfig = ingestionPipeline.getSourceConfig();
    if (sourceConfig != null && sourceConfig.getConfig() != null) {
      Class<?> configClass =
          secretBearingConfigClass(ingestionPipeline.getPipelineType(), sourceConfig.getConfig());
      if (configClass != null) {
        sourceConfig.setConfig(
            ClassConverterFactory.getConverter(configClass).convert(sourceConfig.getConfig()));
      }
    }
    if (ingestionPipeline.getOpenMetadataServerConnection() != null) {
      ingestionPipeline.setOpenMetadataServerConnection(
          (OpenMetadataConnection)
              ClassConverterFactory.getConverter(OpenMetadataConnection.class)
                  .convert(ingestionPipeline.getOpenMetadataServerConnection()));
    }
  }

  private static Class<?> secretBearingConfigClass(PipelineType pipelineType, Object config) {
    if (pipelineType == null) {
      return null;
    }
    return switch (pipelineType) {
      case DBT -> DbtPipeline.class;
      case TEST_SUITE -> TestSuitePipeline.class;
      case METADATA -> isStorageMetadataConfig(config)
          ? StorageServiceMetadataPipeline.class
          : null;
      default -> null;
    };
  }

  /** Every service's metadata pipeline shares {@code METADATA}, so the config's own type decides. */
  private static boolean isStorageMetadataConfig(Object config) {
    return config instanceof StorageServiceMetadataPipeline
        || config instanceof Map<?, ?> map
            && StorageMetadataConfigType.STORAGE_METADATA.value().equals(map.get(CONFIG_TYPE));
  }
}
