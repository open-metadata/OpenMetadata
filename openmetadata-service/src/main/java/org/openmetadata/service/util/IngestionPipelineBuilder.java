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

import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;

public final class IngestionPipelineBuilder {
  private IngestionPipelineBuilder() {}

  public static void addDefinedConfig(IngestionPipeline ingestionPipeline) {
    addDefinedConfig(ingestionPipeline, false);
  }

  /** Retains malformed stored sources so schema-declared credentials can still be protected. */
  public static void addDefinedConfigForRead(IngestionPipeline ingestionPipeline) {
    addDefinedConfig(ingestionPipeline, true);
  }

  private static void addDefinedConfig(IngestionPipeline ingestionPipeline, boolean forRead) {
    SourceConfig sourceConfig = ingestionPipeline.getSourceConfig();
    if (sourceConfig != null) {
      sourceConfig.setConfig(
          forRead
              ? ClassConverterFactory.convertPropertyForRead(
                  SourceConfig.class, "config", sourceConfig.getConfig())
              : ClassConverterFactory.convertProperty(
                  SourceConfig.class, "config", sourceConfig.getConfig()));
    }
    if (ingestionPipeline.getOpenMetadataServerConnection() != null) {
      var converter = ClassConverterFactory.getConverter(OpenMetadataConnection.class);
      ingestionPipeline.setOpenMetadataServerConnection(
          (OpenMetadataConnection)
              (forRead
                  ? converter.convertForRead(ingestionPipeline.getOpenMetadataServerConnection())
                  : converter.convert(ingestionPipeline.getOpenMetadataServerConnection())));
    }
  }
}
