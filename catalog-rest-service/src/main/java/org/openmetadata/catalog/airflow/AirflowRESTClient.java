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

package org.openmetadata.catalog.airflow;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import javax.ws.rs.core.Response;
import org.json.JSONObject;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.airflow.models.AirflowAuthRequest;
import org.openmetadata.catalog.airflow.models.AirflowAuthResponse;
import org.openmetadata.catalog.airflow.models.AirflowDagRun;
import org.openmetadata.catalog.airflow.models.AirflowListResponse;
import org.openmetadata.catalog.airflow.models.IngestionAirflowPipeline;
import org.openmetadata.catalog.exception.AirflowException;
import org.openmetadata.catalog.exception.AirflowPipelineDeploymentException;
import org.openmetadata.catalog.operations.pipelines.AirflowPipeline;
import org.openmetadata.catalog.operations.pipelines.PipelineStatus;
import org.openmetadata.catalog.util.JsonUtils;

public class AirflowRESTClient {
  private final URL url;
  private final String username;
  private final String password;
  private final HttpClient client;
  private static final String AUTH_HEADER = "Authorization";
  private static final String AUTH_TOKEN = "Bearer %s";
  private static final String CONTENT_HEADER = "Content-Type";
  private static final String CONTENT_TYPE = "application/json";

  public AirflowRESTClient(CatalogApplicationConfig config) {
    AirflowConfiguration airflowConfig = config.getAirflowConfiguration();
    try {
      this.url = new URL(airflowConfig.getApiEndpoint());
    } catch (MalformedURLException e) {
      throw new AirflowException(airflowConfig.getApiEndpoint() + " Malformed.");
    }
    this.username = airflowConfig.getUsername();
    this.password = airflowConfig.getPassword();
    this.client =
        HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(airflowConfig.getTimeout()))
            .build();
  }

  private String authenticate() throws InterruptedException, IOException {
    String authEndpoint = "%s/api/v1/security/login";
    String authUrl = String.format(authEndpoint, url);
    AirflowAuthRequest authRequest =
        AirflowAuthRequest.builder().username(this.username).password(this.password).build();
    String authPayload = JsonUtils.pojoToJson(authRequest);
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(authUrl))
            .header(CONTENT_HEADER, CONTENT_TYPE)
            .POST(HttpRequest.BodyPublishers.ofString(authPayload))
            .build();
    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() == 200) {
      AirflowAuthResponse authResponse = JsonUtils.readValue(response.body(), AirflowAuthResponse.class);
      return authResponse.getAccessToken();
    }
    throw new AirflowException("Failed to get access_token. Please check AirflowConfiguration username, password");
  }

  public String deploy(AirflowPipeline airflowPipeline, CatalogApplicationConfig config, Boolean decrypt) {
    try {
      IngestionAirflowPipeline pipeline =
          AirflowUtils.toIngestionPipeline(airflowPipeline, config.getAirflowConfiguration(), decrypt);
      String token = authenticate();
      String authToken = String.format(AUTH_TOKEN, token);
      String pipelinePayload = JsonUtils.pojoToJson(pipeline);
      String deployEndPoint = "%s/rest_api/api?api=deploy_dag";
      String deployUrl = String.format(deployEndPoint, url);
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(deployUrl))
              .header(CONTENT_HEADER, CONTENT_TYPE)
              .header(AUTH_HEADER, authToken)
              .POST(HttpRequest.BodyPublishers.ofString(pipelinePayload))
              .build();
      HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() == 200) {
        return response.body();
      }
      throw AirflowPipelineDeploymentException.byMessage(
          airflowPipeline.getName(),
          "Failed to trigger Airflow Pipeline",
          Response.Status.fromStatusCode(response.statusCode()));
    } catch (Exception e) {
      throw AirflowPipelineDeploymentException.byMessage(airflowPipeline.getName(), e.getMessage());
    }
  }

  public String runPipeline(String pipelineName) {
    try {
      String token = authenticate();
      String authToken = String.format(AUTH_TOKEN, token);
      String triggerEndPoint = "%s/rest_api/api?api=trigger_dag";
      String triggerUrl = String.format(triggerEndPoint, url);
      JSONObject requestPayload = new JSONObject();
      requestPayload.put("workflow_name", pipelineName);
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(triggerUrl))
              .header(CONTENT_HEADER, CONTENT_TYPE)
              .header(AUTH_HEADER, authToken)
              .POST(HttpRequest.BodyPublishers.ofString(requestPayload.toString()))
              .build();
      HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() == 200) {
        return response.body();
      }

      throw AirflowPipelineDeploymentException.byMessage(
          pipelineName, "Failed to trigger IngestionPipeline", Response.Status.fromStatusCode(response.statusCode()));
    } catch (Exception e) {
      throw AirflowPipelineDeploymentException.byMessage(pipelineName, e.getMessage());
    }
  }

  public AirflowPipeline getStatus(AirflowPipeline airflowPipeline) {
    try {
      String token = authenticate();
      String authToken = String.format(AUTH_TOKEN, token);
      String statusEndPoint = "%s/rest_api/api?api=list_run&dag_id=%s";
      String statusUrl = String.format(statusEndPoint, url, airflowPipeline.getName());
      JSONObject requestPayload = new JSONObject();
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(statusUrl))
              .header(CONTENT_HEADER, CONTENT_TYPE)
              .header(AUTH_HEADER, authToken)
              .POST(HttpRequest.BodyPublishers.ofString(requestPayload.toString()))
              .build();
      HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() == 200) {
        AirflowListResponse airflowListResponse = JsonUtils.readValue(response.body(), AirflowListResponse.class);
        airflowPipeline.setNextExecutionDate(airflowListResponse.getNextRun());
        List<PipelineStatus> statuses = new ArrayList<>();
        for (AirflowDagRun dagRun : airflowListResponse.getDagRuns()) {
          PipelineStatus pipelineStatus =
              new PipelineStatus()
                  .withState(dagRun.getState())
                  .withStartDate(dagRun.getStartDate())
                  .withEndDate(dagRun.getEndDate());
          statuses.add(pipelineStatus);
        }
        airflowPipeline.setPipelineStatuses(statuses);
        return airflowPipeline;
      }

      throw AirflowPipelineDeploymentException.byMessage(
          airflowPipeline.getName(),
          "Failed to fetch ingestion pipeline runs",
          Response.Status.fromStatusCode(response.statusCode()));
    } catch (Exception e) {
      throw AirflowPipelineDeploymentException.byMessage(airflowPipeline.getName(), e.getMessage());
    }
  }
}
