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

import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.secrets.converter.service.ClassConverterFactory;

public class IngestionPipelineBuilder {

  /**
   * Build `IngestionPipeline` object with concrete class for the config which by definition it is a `Object`.
   *
   * @param ingestionPipeline the ingestion pipeline object
   * @return ingestion pipeline with concrete classes
   */
  public static IngestionPipeline addDefinedConfig(IngestionPipeline ingestionPipeline) {
    if (DBT.equals(ingestionPipeline.getPipelineType()) && ingestionPipeline.getSourceConfig() != null) {
      ingestionPipeline
          .getSourceConfig()
          .setConfig(
              ClassConverterFactory.getConverter(DbtPipeline.class)
                  .convert(ingestionPipeline.getSourceConfig().getConfig()));
    }
    if (ingestionPipeline.getOpenMetadataServerConnection() != null) {
      ingestionPipeline.setOpenMetadataServerConnection(
          (OpenMetadataConnection)
              ClassConverterFactory.getConverter(OpenMetadataConnection.class)
                  .convert(ingestionPipeline.getOpenMetadataServerConnection()));
    }
    return ingestionPipeline;
  }
}
