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
package org.openmetadata.catalog.airflow;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.resources.services.ingestionpipelines.IngestionPipelineResourceTest.DATABASE_METADATA_CONFIG;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.SneakyThrows;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.catalog.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.catalog.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.catalog.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.catalog.exception.PipelineServiceClientException;

@ExtendWith(MockitoExtension.class)
public class AirflowRESTClientIntegrationTest {

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
    AirflowConfiguration airflowConfiguration = createDefaultAirflowConfiguration();
    airflowRESTClient = new AirflowRESTClient(airflowConfiguration);
    httpServerExtension.unregisterHandler();
  }

  @Test
  public void testLastIngestionLogsAreRetrievedWhenStatusCodesAre200() {
    Map<String, String> expectedMap = Map.of("key1", "value1", "key2", "value2");

    registerMockedEndpoints(200, 200);

    assertEquals(expectedMap, airflowRESTClient.getLastIngestionLogs(INGESTION_PIPELINE));
  }

  @Test
  public void testLastIngestionLogsExceptionWhenLoginFails() {
    registerMockedEndpoints(404, 200);

    Exception exception =
        assertThrows(
            PipelineServiceClientException.class, () -> airflowRESTClient.getLastIngestionLogs(INGESTION_PIPELINE));

    String expectedMessage = "Failed to get last ingestion logs.";
    String actualMessage = exception.getMessage();

    assertEquals(expectedMessage, actualMessage);
  }

  @Test
  public void testLastIngestionLogsExceptionWhenStatusCode404() {
    registerMockedEndpoints(200, 404);

    Exception exception =
        assertThrows(
            PipelineServiceClientException.class, () -> airflowRESTClient.getLastIngestionLogs(INGESTION_PIPELINE));

    String expectedMessage = "Failed to get last ingestion logs.";
    String actualMessage = exception.getMessage();

    assertEquals(expectedMessage, actualMessage);
  }

  @SneakyThrows
  private AirflowConfiguration createDefaultAirflowConfiguration() {
    AirflowConfiguration airflowConfiguration = new AirflowConfiguration();
    airflowConfiguration.setApiEndpoint(HttpServerExtension.getUriFor("").toString());
    airflowConfiguration.setUsername("user");
    airflowConfiguration.setPassword("pass");
    airflowConfiguration.setTimeout(60);
    return airflowConfiguration;
  }

  private void registerMockedEndpoints(int loginStatusCode, int lastDagLogStatusCode) {
    String jsonResponse = "{ \"key1\": \"value1\", \"key2\": \"value2\" }";

    Map<String, MockResponse> pathResponses = new HashMap<>();
    pathResponses.put(
        "/rest_api/api?api=last_dag_logs&dag_id=" + DAG_NAME,
        new MockResponse(jsonResponse, "application/json", lastDagLogStatusCode));
    pathResponses.put("/api/v1/security/login", new MockResponse("{}", "application/json", loginStatusCode));

    httpServerExtension.registerHandler(URI_TO_HANDLE_REQUEST, new JsonHandler(pathResponses));
  }
}
