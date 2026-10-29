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

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline.StorageMetadataConfigType;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;

@Slf4j
public final class IngestionPipelineBuilder {

  private IngestionPipelineBuilder() {
    // Final
  }

  /** Build `IngestionPipeline` object with concrete class for the config which by definition it is a `Object`. */
  public static void addDefinedConfig(IngestionPipeline ingestionPipeline) {
    if (DBT.equals(ingestionPipeline.getPipelineType())
        && ingestionPipeline.getSourceConfig() != null) {
      ingestionPipeline
          .getSourceConfig()
          .setConfig(
              ClassConverterFactory.getConverter(DbtPipeline.class)
                  .convert(ingestionPipeline.getSourceConfig().getConfig()));
    } else if (ingestionPipeline.getSourceConfig() != null
        && isStorageMetadata(ingestionPipeline)) {
      typeStorageMetadata(ingestionPipeline);
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
            && (StorageMetadataConfigType.STORAGE_METADATA.value().equals(map.get("type"))
                || (METADATA.equals(ingestionPipeline.getPipelineType())
                    && ingestionPipeline.getService() != null
                    && Entity.STORAGE_SERVICE.equals(ingestionPipeline.getService().getType()))));
  }

  private static void typeStorageMetadata(IngestionPipeline ingestionPipeline) {
    try {
      ingestionPipeline
          .getSourceConfig()
          .setConfig(
              ClassConverterFactory.getConverter(StorageServiceMetadataPipeline.class)
                  .convert(ingestionPipeline.getSourceConfig().getConfig()));
    } catch (IllegalArgumentException e) {
      // A config that no longer matches the schema stays as stored, so the pipeline can still be
      // read and repaired.
      LOG.warn(
          "Storage metadata config of pipeline [{}] does not match its schema: {}",
          ingestionPipeline.getName(),
          e.getMessage());
    }
  }
}
