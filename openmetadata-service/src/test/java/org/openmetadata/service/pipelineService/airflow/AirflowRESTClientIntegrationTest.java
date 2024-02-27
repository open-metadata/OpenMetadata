/*
 *  Copyright 2022 Collate
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
package org.openmetadata.service.pipelineService.airflow;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.security.KeyStoreException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.Parameters;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.service.clients.pipeline.airflow.AirflowRESTClient;

class AirflowRESTClientTest {

  @Test
  void test_buildUri() throws KeyStoreException {
    // We build the right URI for a simple url
    PipelineServiceClientConfiguration config = getPipelineServiceConfiguration();
    AirflowRESTClient restClient = new AirflowRESTClient(config);
    assertEquals(
        "http://localhost:8080/api/v1/openmetadata/last_dag_logs",
        restClient.buildURI("last_dag_logs").toString());

    // We build the right URI for a service URLs with paths
    config.setApiEndpoint("http://localhost:8080/airflow");
    restClient = new AirflowRESTClient(config);
    assertEquals(
        "http://localhost:8080/airflow/api/v1/openmetadata/last_dag_logs",
        restClient.buildURI("last_dag_logs").toString());

    // The same works with more segments
    config.setApiEndpoint("http://localhost:8080/airflow/foo");
    restClient = new AirflowRESTClient(config);
    assertEquals(
        "http://localhost:8080/airflow/foo/api/v1/openmetadata/health",
        restClient.buildURI("health").toString());
  }

  private PipelineServiceClientConfiguration getPipelineServiceConfiguration() {
    PipelineServiceClientConfiguration pipelineServiceClientConfiguration =
        new PipelineServiceClientConfiguration();
    pipelineServiceClientConfiguration.setHostIp("111.11.11.1");
    pipelineServiceClientConfiguration.setApiEndpoint("http://localhost:8080");

    Parameters params = new Parameters();
    params.setAdditionalProperty("username", "user");
    params.setAdditionalProperty("password", "pass");
    params.setAdditionalProperty("timeout", 60);

    pipelineServiceClientConfiguration.setParameters(params);

    return pipelineServiceClientConfiguration;
  }
}
