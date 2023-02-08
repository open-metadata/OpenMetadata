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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResourceTest.DATABASE_METADATA_CONFIG;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.Parameters;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.sdk.exception.PipelineServiceClientException;
import org.openmetadata.service.clients.pipeline.airflow.AirflowRESTClient;

@ExtendWith(MockitoExtension.class)
class AirflowRESTClientIntegrationTest {

  private static final String DAG_NAME = "test_dag";
  private static final String URI_TO_HANDLE_REQUEST = "/";

  public static final IngestionPipeline INGESTION_PIPELINE =
      new IngestionPipeline()
          .withName(DAG_NAME)
          .withId(UUID.randomUUID())
          .withPipelineType(PipelineType.METADATA)
          .withSourceConfig(DATABASE_METADATA_CONFIG)
          .withAirflowConfig(new AirflowConfig().withStartDate(new DateTime("2022-06-10T15:06:47+00:00").toDate()));

  @RegisterExtension private static final HttpServerExtension httpServerExtension = new HttpServerExtension();

  AirflowRESTClient airflowRESTClient;

  @BeforeEach
  void setUp() {

    PipelineServiceClientConfiguration pipelineServiceClientConfiguration = new PipelineServiceClientConfiguration();
    pipelineServiceClientConfiguration.setHostIp("111.11.11.1");
    pipelineServiceClientConfiguration.setMetadataApiEndpoint("http://openmetadata-server:8585/api");

    Parameters params = new Parameters();
    params.setAdditionalProperty("username", "user");
    params.setAdditionalProperty("password", "pass");
    params.setAdditionalProperty("apiEndpoint", "");

    pipelineServiceClientConfiguration.setParameters(params);

    airflowRESTClient = new AirflowRESTClient(pipelineServiceClientConfiguration);
    httpServerExtension.unregisterHandler();
  }

  @Test
  void testLastIngestionLogsAreRetrievedWhenStatusCodesAre200() {
    Map<String, String> expectedMap = Map.of("key1", "value1", "key2", "value2");

    registerMockedEndpoints(200);

    assertEquals(expectedMap, airflowRESTClient.getLastIngestionLogs(INGESTION_PIPELINE, "after"));
  }

  @Test
  void testLastIngestionLogsExceptionWhenLoginFails() {
    registerMockedEndpoints(200);

    Exception exception =
        assertThrows(
            PipelineServiceClientException.class,
            () -> airflowRESTClient.getLastIngestionLogs(INGESTION_PIPELINE, "after"));

    String expectedMessage = "Failed to get last ingestion logs.";
    String actualMessage = exception.getMessage();

    assertEquals(expectedMessage, actualMessage);
  }

  @Test
  void testLastIngestionLogsExceptionWhenStatusCode404() {
    registerMockedEndpoints(404);

    Exception exception =
        assertThrows(
            PipelineServiceClientException.class,
            () -> airflowRESTClient.getLastIngestionLogs(INGESTION_PIPELINE, "after"));

    String expectedMessage = "Failed to get last ingestion logs.";
    String actualMessage = exception.getMessage();

    assertEquals(expectedMessage, actualMessage);
  }

  private void registerMockedEndpoints(int lastDagLogStatusCode) {
    String jsonResponse = "{ \"key1\": \"value1\", \"key2\": \"value2\" }";

    Map<String, MockResponse> pathResponses = new HashMap<>();
    pathResponses.put(
        "/api/v1/openmetadata/last_dag_logs&dag_id=" + DAG_NAME,
        new MockResponse(jsonResponse, "application/json", lastDagLogStatusCode));

    httpServerExtension.registerHandler(URI_TO_HANDLE_REQUEST, new JsonHandler(pathResponses));
  }
}
