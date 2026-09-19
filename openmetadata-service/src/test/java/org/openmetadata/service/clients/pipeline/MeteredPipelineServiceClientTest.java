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

package org.openmetadata.service.clients.pipeline;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.sdk.RunOptions;

class MeteredPipelineServiceClientTest {

  /**
   * Airflow sends a run's options with the trigger. If the metering wrapper fell back to the
   * interface default instead, Airflow would receive the pipeline without them and run the whole
   * suite.
   */
  @Test
  void runOptionsReachTheWrappedClientAsGiven() {
    PipelineServiceClientInterface wrappedClient = mock(PipelineServiceClientInterface.class);
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withName("orders_suite_pipeline")
            .withPipelineType(PipelineType.TEST_SUITE)
            .withSourceConfig(new SourceConfig().withConfig(new TestSuitePipeline()));
    RunOptions options = RunOptions.forTestCases(List.of("table_row_count"));
    PipelineServiceClientResponse accepted = new PipelineServiceClientResponse().withCode(200);
    when(wrappedClient.runPipelineWithOptions(pipeline, null, options)).thenReturn(accepted);

    MeteredPipelineServiceClient meteredClient = new MeteredPipelineServiceClient(wrappedClient);

    assertSame(accepted, meteredClient.runPipelineWithOptions(pipeline, null, options));
  }
}
