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

import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.openmetadata.catalog.airflow.models.AirflowAuthRequest;
import org.openmetadata.catalog.airflow.models.AirflowAuthResponse;
import org.openmetadata.catalog.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.catalog.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.catalog.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.catalog.exception.IngestionPipelineDeploymentException;
import org.openmetadata.catalog.exception.PipelineServiceClientException;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.PipelineServiceClient;

@Slf4j
public class AirflowRESTClient extends PipelineServiceClient {
  private final String apiEndpoint = "api/v1/openmetadata";

  public AirflowRESTClient(AirflowConfiguration airflowConfig) {
    super(
        airflowConfig.getUsername(),
        airflowConfig.getPassword(),
        airflowConfig.getApiEndpoint(),
        airflowConfig.getTimeout());
  }

  @Override
  public String deployPipeline(IngestionPipeline ingestionPipeline) {
    HttpResponse<String> response;
    try {
      String deployEndpoint = "%s/%s/deploy";
      String deployUrl = String.format(deployEndpoint, serviceURL, apiEndpoint);
      String pipelinePayload = JsonUtils.pojoToJson(ingestionPipeline);
      response = post(deployUrl, pipelinePayload);
      if (response.statusCode() == 200) {
        return response.body();
      }
    } catch (Exception e) {
      throw IngestionPipelineDeploymentException.byMessage(ingestionPipeline.getName(), e.getMessage());
    }

    throw new PipelineServiceClientException(
        String.format(
            "%s Failed to deploy Ingestion Pipeline due to airflow API returned %s and response %s",
            ingestionPipeline.getName(), Response.Status.fromStatusCode(response.statusCode()), response.body()));
  }

  @Override
  public String deletePipeline(String pipelineName) {
    try {
      String deleteEndpoint = "%s/%s/delete?dag_id=%s";
      HttpResponse<String> response =
          deleteRequestAuthenticatedForJsonContent(deleteEndpoint, serviceURL, apiEndpoint, pipelineName);
      return response.body();
    } catch (Exception e) {
      LOG.error(String.format("Failed to delete Airflow Pipeline %s from Airflow DAGS", pipelineName));
    }
    return null;
  }

  @Override
  public String runPipeline(String pipelineName) {
    HttpResponse<String> response;
    try {
      String triggerEndPoint = "%s/%s/trigger";
      String triggerUrl = String.format(triggerEndPoint, serviceURL, apiEndpoint);
      JSONObject requestPayload = new JSONObject();
      requestPayload.put("dag_id", pipelineName);
      response = post(triggerUrl, requestPayload.toString());
      if (response.statusCode() == 200) {
        return response.body();
      }
    } catch (Exception e) {
      throw IngestionPipelineDeploymentException.byMessage(pipelineName, e.getMessage());
    }

    throw IngestionPipelineDeploymentException.byMessage(
        pipelineName, "Failed to trigger IngestionPipeline", Response.Status.fromStatusCode(response.statusCode()));
  }

  @Override
  public IngestionPipeline toggleIngestion(IngestionPipeline ingestionPipeline) {
    HttpResponse<String> response;
    try {
      String toggleEndPoint;
      String toggleUrl;
      JSONObject requestPayload = new JSONObject();
      requestPayload.put("dag_id", ingestionPipeline.getName());
      // If the pipeline is currently enabled, disable it
      if (ingestionPipeline.getEnabled().equals(Boolean.TRUE)) {
        toggleEndPoint = "%s/%s/disable";
        toggleUrl = String.format(toggleEndPoint, serviceURL, apiEndpoint);
        response = post(toggleUrl, requestPayload.toString());
        if (response.statusCode() == 200) {
          ingestionPipeline.setEnabled(false);
          return ingestionPipeline;
        } else if (response.statusCode() == 404) {
          ingestionPipeline.setDeployed(false);
          return ingestionPipeline;
        }
        // otherwise, enable it back
      } else {
        toggleEndPoint = "%s/%s/enable";
        toggleUrl = String.format(toggleEndPoint, serviceURL, apiEndpoint);
        response = post(toggleUrl, requestPayload.toString());
        if (response.statusCode() == 200) {
          ingestionPipeline.setEnabled(true);
          return ingestionPipeline;
        } else if (response.statusCode() == 404) {
          ingestionPipeline.setDeployed(false);
          return ingestionPipeline;
        }
      }
    } catch (Exception e) {
      throw PipelineServiceClientException.byMessage(ingestionPipeline.getName(), e.getMessage());
    }
    throw PipelineServiceClientException.byMessage(
        ingestionPipeline.getName(),
        "Failed to toggle ingestion pipeline state",
        Response.Status.fromStatusCode(response.statusCode()));
  }

  @Override
  public IngestionPipeline getPipelineStatus(IngestionPipeline ingestionPipeline) {
    HttpResponse<String> response;
    try {
      String statusEndPoint = "%s/%s/status?dag_id=%s";
      response =
          getRequestAuthenticatedForJsonContent(statusEndPoint, serviceURL, apiEndpoint, ingestionPipeline.getName());
      if (response.statusCode() == 200) {
        List<PipelineStatus> statuses = JsonUtils.readObjects(response.body(), PipelineStatus.class);
        ingestionPipeline.setPipelineStatuses(statuses);
        ingestionPipeline.setDeployed(true);
        return ingestionPipeline;
      } else if (response.statusCode() == 404) {
        ingestionPipeline.setDeployed(false);
      }
    } catch (Exception e) {
      throw PipelineServiceClientException.byMessage(ingestionPipeline.getName(), e.getMessage());
    }
    throw PipelineServiceClientException.byMessage(
        ingestionPipeline.getName(),
        "Failed to fetch ingestion pipeline runs",
        Response.Status.fromStatusCode(response.statusCode()));
  }

  @Override
  public HttpResponse<String> getServiceStatus() {
    HttpResponse<String> response;
    try {
      response = requestNoAuthForJsonContent("%s/%s/health", serviceURL, apiEndpoint);
      if (response.statusCode() == 200) {
        return response;
      }
    } catch (Exception e) {
      throw PipelineServiceClientException.byMessage("Failed to get REST status.", e.getMessage());
    }
    throw new PipelineServiceClientException(String.format("Failed to get REST status due to %s.", response.body()));
  }

  @Override
  public HttpResponse<String> testConnection(TestServiceConnection testServiceConnection) {
    HttpResponse<String> response;
    try {
      String statusEndPoint = "%s/%s/test_connection";
      String statusUrl = String.format(statusEndPoint, serviceURL, apiEndpoint);
      String connectionPayload = JsonUtils.pojoToJson(testServiceConnection);
      response = post(statusUrl, connectionPayload);
      if (response.statusCode() == 200) {
        return response;
      }
    } catch (Exception e) {
      throw PipelineServiceClientException.byMessage("Failed to test connection.", e.getMessage());
    }
    throw new PipelineServiceClientException(String.format("Failed to test connection due to %s", response.body()));
  }

  @Override
  public HttpResponse<String> killIngestion(IngestionPipeline ingestionPipeline) {
    HttpResponse<String> response;
    try {
      String killEndPoint = "%s/%s/kill";
      String killUrl = String.format(killEndPoint, serviceURL, apiEndpoint);
      JSONObject requestPayload = new JSONObject();
      requestPayload.put("dag_id", ingestionPipeline.getName());
      response = post(killUrl, requestPayload.toString());
      if (response.statusCode() == 200) {
        return response;
      }
    } catch (Exception e) {
      throw PipelineServiceClientException.byMessage("Failed to kill running workflows", e.getMessage());
    }
    throw new PipelineServiceClientException(
        String.format("Failed to kill running workflows due to %s", response.body()));
  }

  @Override
  public Map<String, String> getLastIngestionLogs(IngestionPipeline ingestionPipeline) {
    HttpResponse<String> response;
    try {
      response =
          getRequestAuthenticatedForJsonContent(
              "%s/%s/last_dag_logs?dag_id=%s", serviceURL, apiEndpoint, ingestionPipeline.getName());
      if (response.statusCode() == 200) {
        return JsonUtils.readValue(response.body(), new TypeReference<>() {});
      }
    } catch (Exception e) {
      throw PipelineServiceClientException.byMessage("Failed to get last ingestion logs.", e.getMessage());
    }
    throw new PipelineServiceClientException(
        String.format("Failed to get last ingestion logs due to %s", response.body()));
  }

  private HttpResponse<String> getRequestAuthenticatedForJsonContent(
      String stringUrlFormat, Object... stringReplacement) throws IOException, InterruptedException {
    HttpRequest request = authenticatedRequestBuilder(stringUrlFormat, stringReplacement).GET().build();
    return client.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> deleteRequestAuthenticatedForJsonContent(
      String stringUrlFormat, Object... stringReplacement) throws IOException, InterruptedException {
    HttpRequest request = authenticatedRequestBuilder(stringUrlFormat, stringReplacement).DELETE().build();
    return client.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpRequest.Builder authenticatedRequestBuilder(String stringUrlFormat, Object... stringReplacement) {
    String url = String.format(stringUrlFormat, stringReplacement);
    return HttpRequest.newBuilder(URI.create(url))
        .header(CONTENT_HEADER, CONTENT_TYPE)
        .header(AUTH_HEADER, getBasicAuthenticationHeader(username, password));
  }

  private HttpResponse<String> requestNoAuthForJsonContent(String stringUrlFormat, Object... stringReplacement)
      throws IOException, InterruptedException {
    String url = String.format(stringUrlFormat, stringReplacement);
    HttpRequest request = HttpRequest.newBuilder(URI.create(url)).header(CONTENT_HEADER, CONTENT_TYPE).GET().build();
    return client.send(request, HttpResponse.BodyHandlers.ofString());
  }
}
