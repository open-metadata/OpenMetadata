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

package org.openmetadata.service.clients.pipeline.config.types;

import static org.openmetadata.service.clients.pipeline.config.WorkflowConfigBuilder.buildDefaultSource;

import java.util.UUID;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.BulkSink;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceQueryUsagePipeline;
import org.openmetadata.schema.metadataIngestion.OpenMetadataWorkflowConfig;
import org.openmetadata.schema.metadataIngestion.Processor;
import org.openmetadata.schema.metadataIngestion.Source;
import org.openmetadata.schema.metadataIngestion.Stage;
import org.openmetadata.schema.services.connections.metadata.ComponentConfig;
import org.openmetadata.schema.utils.JsonUtils;

public class UsageWorkflowConfig implements WorkflowConfigTypeStrategy {

  public OpenMetadataWorkflowConfig buildOMWorkflowConfig(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service)
      throws WorkflowBuildException {
    OpenMetadataWorkflowConfig config = new OpenMetadataWorkflowConfig();

    Source source = buildDefaultSource(ingestionPipeline, service);
    source.setType(String.format("%s-usage", source.getType()));

    Processor processor =
        new Processor().withType("query-parser").withConfig(new ComponentConfig());

    // Pick up the configured path or create a random one
    DatabaseServiceQueryUsagePipeline usageConfig =
        JsonUtils.convertValue(
            ingestionPipeline.getSourceConfig().getConfig(),
            DatabaseServiceQueryUsagePipeline.class);

    if (usageConfig.getStageFileLocation() == null) {
      usageConfig.setStageFileLocation(
          "/tmp/openmetadata/" + StringUtils.left(UUID.randomUUID().toString(), 6));
    }

    ComponentConfig componentConfig =
        new ComponentConfig()
            .withAdditionalProperty("filename", usageConfig.getStageFileLocation());

    Stage stage = new Stage().withType("table-usage").withConfig(componentConfig);

    BulkSink bulkSink = new BulkSink().withType("metadata-usage").withConfig(componentConfig);

    config.setSource(source);
    config.setProcessor(processor);
    config.setStage(stage);
    config.setBulkSink(bulkSink);

    return config;
  }
}
