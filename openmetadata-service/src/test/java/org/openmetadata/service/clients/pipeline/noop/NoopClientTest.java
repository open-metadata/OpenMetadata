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

package org.openmetadata.service.clients.pipeline.noop;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.sdk.PipelineServiceClientInterface;

/**
 * Guards the status the Noop client reports. It used to answer {@code null}, which the metering
 * decorator dereferenced - every UI poll of {@code /services/ingestionPipelines/status} on an
 * Airflow-less deployment ended in a NullPointerException.
 */
class NoopClientTest {

  private static final String DISABLED = "disabled";

  private static NoopClient enabledNoopClient() {
    return new NoopClient(
        new PipelineServiceClientConfiguration()
            .withEnabled(true)
            .withClassName(NoopClient.class.getName())
            .withIngestionIpInfoEnabled(false));
  }

  @Test
  void getServiceStatusReportsDisabledInsteadOfNull() {
    PipelineServiceClientResponse status = enabledNoopClient().getServiceStatus();

    assertNotNull(status);
    assertEquals(200, status.getCode());
    assertEquals(DISABLED, status.getPlatform());
    assertEquals(DISABLED, status.getVersion());
  }

  @Test
  void platformIsReportedAsDisabled() {
    assertEquals(DISABLED, enabledNoopClient().getPlatform());
  }

  @Test
  void getServiceStatusBackoffReportsHealthy() {
    assertEquals(
        PipelineServiceClientInterface.HEALTHY_STATUS,
        enabledNoopClient().getServiceStatusBackoff());
  }
}
