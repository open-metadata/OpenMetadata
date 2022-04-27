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
import java.util.List;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.openmetadata.catalog.airflow.models.AirflowAuthRequest;
import org.openmetadata.catalog.airflow.models.AirflowAuthResponse;
import org.openmetadata.catalog.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.catalog.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.catalog.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.catalog.exception.AirflowException;
import org.openmetadata.catalog.exception.IngestionPipelineDeploymentException;
import org.openmetadata.catalog.util.JsonUtils;

@Slf4j
public class AirflowRESTClient {
  private final URL airflowURL;
  private final String username;
  private final String password;
  private final HttpClient client;
  private static final String AUTH_HEADER = "Authorization";
  private static final String AUTH_TOKEN = "Bearer %s";
  private static final String CONTENT_HEADER = "Content-Type";
  private static final String CONTENT_TYPE = "application/json";

  public AirflowRESTClient(AirflowConfiguration airflowConfig) {
    try {
      this.airflowURL = new URL(airflowConfig.getApiEndpoint());
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
    String authUrl = String.format(authEndpoint, airflowURL);
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

  public String deploy(IngestionPipeline ingestionPipeline) {
    HttpResponse<String> response;
    try {
      String token = authenticate();
      String authToken = String.format(AUTH_TOKEN, token);
      String pipelinePayload = JsonUtils.pojoToJson(ingestionPipeline);
      String deployEndPoint = "%s/rest_api/api?api=deploy_dag";
      String deployUrl = String.format(deployEndPoint, airflowURL);

      HttpRequest request =
          HttpRequest.newBuilder(URI.create(deployUrl))
              .header(CONTENT_HEADER, CONTENT_TYPE)
              .header(AUTH_HEADER, authToken)
              .POST(HttpRequest.BodyPublishers.ofString(pipelinePayload))
              .build();
      response = client.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() == 200) {
        return response.body();
      }
    } catch (Exception e) {
      throw IngestionPipelineDeploymentException.byMessage(ingestionPipeline.getName(), e.getMessage());
    }

    throw new AirflowException(
        String.format(
            "%s Failed to deploy Ingestion Pipeline due to airflow API returned %s and response %s",
            ingestionPipeline.getName(), Response.Status.fromStatusCode(response.statusCode()), response.body()));
  }

  public String deletePipeline(String pipelineName) {
    try {
      String token = authenticate();
      String authToken = String.format(AUTH_TOKEN, token);
      String triggerEndPoint = "%s/rest_api/api?api=delete_dag&dag_id=%s";
      String triggerUrl = String.format(triggerEndPoint, airflowURL, pipelineName);
      JSONObject requestPayload = new JSONObject();
      requestPayload.put("workflow_name", pipelineName);
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(triggerUrl))
              .header(CONTENT_HEADER, CONTENT_TYPE)
              .header(AUTH_HEADER, authToken)
              .POST(HttpRequest.BodyPublishers.ofString(requestPayload.toString()))
              .build();
      HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
      return response.body();
    } catch (Exception e) {
      LOG.error(String.format("Failed to delete Airflow Pipeline %s from Airflow DAGS", pipelineName));
    }
    return null;
  }

  public String runPipeline(String pipelineName) {
    HttpResponse<String> response;
    try {
      String token = authenticate();
      String authToken = String.format(AUTH_TOKEN, token);
      String triggerEndPoint = "%s/rest_api/api?api=trigger_dag";
      String triggerUrl = String.format(triggerEndPoint, airflowURL);
      JSONObject requestPayload = new JSONObject();
      requestPayload.put("workflow_name", pipelineName);
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(triggerUrl))
              .header(CONTENT_HEADER, CONTENT_TYPE)
              .header(AUTH_HEADER, authToken)
              .POST(HttpRequest.BodyPublishers.ofString(requestPayload.toString()))
              .build();
      response = client.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() == 200) {
        return response.body();
      }
    } catch (Exception e) {
      throw IngestionPipelineDeploymentException.byMessage(pipelineName, e.getMessage());
    }

    throw IngestionPipelineDeploymentException.byMessage(
        pipelineName, "Failed to trigger IngestionPipeline", Response.Status.fromStatusCode(response.statusCode()));
  }

  public IngestionPipeline getStatus(IngestionPipeline ingestionPipeline) {
    HttpResponse<String> response;
    try {
      String token = authenticate();
      String authToken = String.format(AUTH_TOKEN, token);
      String statusEndPoint = "%s/rest_api/api?api=dag_status&dag_id=%s";
      String statusUrl = String.format(statusEndPoint, airflowURL, ingestionPipeline.getName());
      JSONObject requestPayload = new JSONObject();
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(statusUrl))
              .header(CONTENT_HEADER, CONTENT_TYPE)
              .header(AUTH_HEADER, authToken)
              .POST(HttpRequest.BodyPublishers.ofString(requestPayload.toString()))
              .build();
      response = client.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() == 200) {
        List<PipelineStatus> statuses = JsonUtils.readObjects(response.body(), PipelineStatus.class);
        ingestionPipeline.setPipelineStatuses(statuses);
        ingestionPipeline.setDeployed(true);
        return ingestionPipeline;
      } else if (response.statusCode() == 404) {
        ingestionPipeline.setDeployed(false);
      }
    } catch (Exception e) {
      throw AirflowException.byMessage(ingestionPipeline.getName(), e.getMessage());
    }
    throw AirflowException.byMessage(
        ingestionPipeline.getName(),
        "Failed to fetch ingestion pipeline runs",
        Response.Status.fromStatusCode(response.statusCode()));
  }

  public HttpResponse<String> testConnection(TestServiceConnection testServiceConnection) {
    HttpResponse<String> response;
    try {
      String token = authenticate();
      String authToken = String.format(AUTH_TOKEN, token);
      String statusEndPoint = "%s/rest_api/api?api=test_connection";
      String statusUrl = String.format(statusEndPoint, airflowURL);
      String connectionPayload = JsonUtils.pojoToJson(testServiceConnection);
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(statusUrl))
              .header(CONTENT_HEADER, CONTENT_TYPE)
              .header(AUTH_HEADER, authToken)
              .POST(HttpRequest.BodyPublishers.ofString(connectionPayload))
              .build();
      response = client.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() == 200) {
        return response;
      }

    } catch (Exception e) {
      throw AirflowException.byMessage("Failed to test connection.", e.getMessage());
    }
    throw AirflowException.byMessage("Failed to test connection.", response.body());
  }
}
