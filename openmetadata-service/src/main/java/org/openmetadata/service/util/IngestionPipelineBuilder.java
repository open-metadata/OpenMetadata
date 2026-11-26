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

import static org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType.DBT;
import static org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType.METADATA;

import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline.StorageMetadataConfigType;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;

@Slf4j
public final class IngestionPipelineBuilder {
  private static final String CONFIG_TYPE_FIELD = "type";
  private static final String MANIFEST_SOURCE_FIELD = "storageMetadataConfigSource";

  private IngestionPipelineBuilder() {
    // Final
  }

  /**
   * Build `IngestionPipeline` object with concrete class for the config which by definition it is a
   * `Object`. For a pipeline being written: a storage config that matches no schema is refused.
   */
  public static void addDefinedConfig(IngestionPipeline ingestionPipeline) {
    addDefinedConfig(ingestionPipeline, false);
  }

  /**
   * {@link #addDefinedConfig} for a pipeline read back from the store. A stored storage config that
   * no longer matches its schema loses its manifest source, where the credentials are, and keeps the
   * rest, so the pipeline can still be read and repaired.
   * ADR:2026-10-24-a-masked-connection-secret-is-kept-only-while-the-endpoint-is-unchanged
   */
  public static void addDefinedConfigForRead(IngestionPipeline ingestionPipeline) {
    addDefinedConfig(ingestionPipeline, true);
  }

  private static void addDefinedConfig(IngestionPipeline ingestionPipeline, boolean forRead) {
    if (DBT.equals(ingestionPipeline.getPipelineType())
        && ingestionPipeline.getSourceConfig() != null) {
      ingestionPipeline
          .getSourceConfig()
          .setConfig(
              ClassConverterFactory.getConverter(DbtPipeline.class)
                  .convert(ingestionPipeline.getSourceConfig().getConfig()));
    } else if (ingestionPipeline.getSourceConfig() != null
        && isStorageMetadata(ingestionPipeline)) {
      typeStorageMetadata(ingestionPipeline, forRead);
    }
    if (ingestionPipeline.getOpenMetadataServerConnection() != null) {
      ingestionPipeline.setOpenMetadataServerConnection(
          (OpenMetadataConnection)
              ClassConverterFactory.getConverter(OpenMetadataConnection.class)
                  .convert(ingestionPipeline.getOpenMetadataServerConnection()));
    }
  }

  /**
   * A storage manifest read from S3, ADLS or GCS carries that store's credentials. Left as a map,
   * the masker and the secrets manager never reach them, so they would be returned and stored in
   * the clear.
   */
  private static boolean isStorageMetadata(IngestionPipeline ingestionPipeline) {
    Object config = ingestionPipeline.getSourceConfig().getConfig();
    return config instanceof StorageServiceMetadataPipeline
        || (config instanceof Map<?, ?> map
            && (StorageMetadataConfigType.STORAGE_METADATA
                    .value()
                    .equals(map.get(CONFIG_TYPE_FIELD))
                || (METADATA.equals(ingestionPipeline.getPipelineType())
                    && ingestionPipeline.getService() != null
                    && Entity.STORAGE_SERVICE.equals(ingestionPipeline.getService().getType()))));
  }

  private static void typeStorageMetadata(IngestionPipeline ingestionPipeline, boolean forRead) {
    try {
      ingestionPipeline
          .getSourceConfig()
          .setConfig(
              ClassConverterFactory.getConverter(StorageServiceMetadataPipeline.class)
                  .convert(ingestionPipeline.getSourceConfig().getConfig()));
    } catch (IllegalArgumentException e) {
      String problem =
          String.format(
              "Storage metadata config of pipeline [%s] does not match its schema: %s",
              ingestionPipeline.getName(), e.getMessage());
      if (!forRead) {
        throw new BadRequestException(problem, e);
      }
      LOG.warn("{}; its manifest source is left out", problem);
      withoutManifestSource(ingestionPipeline.getSourceConfig());
    }
  }

  private static void withoutManifestSource(SourceConfig sourceConfig) {
    if (sourceConfig.getConfig() instanceof StorageServiceMetadataPipeline typed) {
      typed.setStorageMetadataConfigSource(null);
    } else if (sourceConfig.getConfig() instanceof Map<?, ?> config) {
      Map<Object, Object> kept = new HashMap<>(config);
      kept.remove(MANIFEST_SOURCE_FIELD);
      sourceConfig.setConfig(kept);
    }
  }
}
