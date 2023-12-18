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

package org.openmetadata.service.clients.pipeline.airflow;

import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.KeyStoreException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import javax.net.ssl.SSLContext;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.sdk.PipelineServiceClient;
import org.openmetadata.sdk.exception.PipelineServiceClientException;
import org.openmetadata.service.exception.IngestionPipelineDeploymentException;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.SSLUtil;

@Slf4j
public class AirflowRESTClient extends PipelineServiceClient {

  private static final String PLATFORM = "Airflow";
  private static final String USERNAME_KEY = "username";
  private static final String PASSWORD_KEY = "password";
  private static final String TIMEOUT_KEY = "timeout";
  private static final String TRUSTSTORE_PATH_KEY = "truststorePath";
  private static final String TRUSTSTORE_PASSWORD_KEY = "truststorePassword";

  protected final String username;
  protected final String password;
  protected final HttpClient client;
  protected final URL serviceURL;
  private static final String API_ENDPOINT = "api/v1/openmetadata";
  private static final String DAG_ID = "dag_id";

  public AirflowRESTClient(PipelineServiceClientConfiguration config) throws KeyStoreException {

    super(config);

    this.setPlatform(PLATFORM);

    this.username = (String) config.getParameters().getAdditionalProperties().get(USERNAME_KEY);
    this.password = (String) config.getParameters().getAdditionalProperties().get(PASSWORD_KEY);
    this.serviceURL = validateServiceURL(config.getApiEndpoint());

    SSLContext sslContext = createAirflowSSLContext(config);

    HttpClient.Builder clientBuilder =
        HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(
                Duration.ofSeconds(
                    (Integer) config.getParameters().getAdditionalProperties().get(TIMEOUT_KEY)));

    if (sslContext == null) {
      this.client = clientBuilder.build();
    } else {
      this.client = clientBuilder.sslContext(sslContext).build();
    }
  }

  private static SSLContext createAirflowSSLContext(PipelineServiceClientConfiguration config)
      throws KeyStoreException {

    String truststorePath =
        (String) config.getParameters().getAdditionalProperties().get(TRUSTSTORE_PATH_KEY);
    String truststorePassword =
        (String) config.getParameters().getAdditionalProperties().get(TRUSTSTORE_PASSWORD_KEY);

    return SSLUtil.createSSLContext(truststorePath, truststorePassword, PLATFORM);
  }

  public final HttpResponse<String> post(String endpoint, String payload, boolean authenticate)
      throws IOException, InterruptedException {
    HttpRequest.Builder requestBuilder =
        HttpRequest.newBuilder(URI.create(endpoint))
            .header(CONTENT_HEADER, CONTENT_TYPE)
            .POST(HttpRequest.BodyPublishers.ofString(payload));
    if (authenticate) {
      requestBuilder.header(AUTH_HEADER, getBasicAuthenticationHeader(username, password));
    }
    return client.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
  }

  public final HttpResponse<String> post(String endpoint, String payload)
      throws IOException, InterruptedException {
    return post(endpoint, payload, true);
  }

  @Override
  public PipelineServiceClientResponse deployPipeline(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    HttpResponse<String> response;
    try {
      String deployEndpoint = "%s/%s/deploy";
      String deployUrl = String.format(deployEndpoint, serviceURL, API_ENDPOINT);
      String pipelinePayload = JsonUtils.pojoToJson(ingestionPipeline);
      response = post(deployUrl, pipelinePayload);
      if (response.statusCode() == 200) {
        ingestionPipeline.setDeployed(true);
        return new PipelineServiceClientResponse()
            .withCode(200)
            .withReason(response.body())
            .withPlatform(this.getPlatform());
      }
    } catch (Exception e) {
      throw IngestionPipelineDeploymentException.byMessage(
          ingestionPipeline.getName(), e.getMessage());
    }
    throw new PipelineServiceClientException(
        String.format(
            "%s Failed to deploy Ingestion Pipeline due to airflow API returned %s and response %s",
            ingestionPipeline.getName(),
            Response.Status.fromStatusCode(response.statusCode()),
            response.body()));
  }

  @Override
  public PipelineServiceClientResponse deletePipeline(IngestionPipeline ingestionPipeline) {
    String pipelineName = ingestionPipeline.getName();
    HttpResponse<String> response;
    try {
      String deleteEndpoint = "%s/%s/delete?dag_id=%s";
      response =
          deleteRequestAuthenticatedForJsonContent(
              deleteEndpoint, serviceURL, API_ENDPOINT, pipelineName);
      if (response.statusCode() == 200) {
        return new PipelineServiceClientResponse().withCode(200).withPlatform(this.getPlatform());
      }
    } catch (Exception e) {
      LOG.error(
          String.format("Failed to delete Airflow Pipeline %s from Airflow DAGS", pipelineName));
    }
    return new PipelineServiceClientResponse()
        .withCode(500)
        .withReason(
            String.format("Failed to delete Airflow Pipeline %s from Airflow DAGS", pipelineName))
        .withPlatform(this.getPlatform());
  }

  @Override
  public PipelineServiceClientResponse runPipeline(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    String pipelineName = ingestionPipeline.getName();
    HttpResponse<String> response;
    try {
      String triggerEndPoint = "%s/%s/trigger";
      String triggerUrl = String.format(triggerEndPoint, serviceURL, API_ENDPOINT);
      JSONObject requestPayload = new JSONObject();
      requestPayload.put(DAG_ID, pipelineName);
      response = post(triggerUrl, requestPayload.toString());
      if (response.statusCode() == 200) {
        return new PipelineServiceClientResponse()
            .withCode(200)
            .withReason(response.body())
            .withPlatform(this.getPlatform());
      }
    } catch (Exception e) {
      throw IngestionPipelineDeploymentException.byMessage(pipelineName, e.getMessage());
    }

    throw IngestionPipelineDeploymentException.byMessage(
        pipelineName,
        "Failed to trigger IngestionPipeline",
        Response.Status.fromStatusCode(response.statusCode()));
  }

  @Override
  public PipelineServiceClientResponse toggleIngestion(IngestionPipeline ingestionPipeline) {
    HttpResponse<String> response;
    try {
      String toggleEndPoint;
      String toggleUrl;
      JSONObject requestPayload = new JSONObject();
      requestPayload.put(DAG_ID, ingestionPipeline.getName());
      // If the pipeline is currently enabled, disable it
      if (ingestionPipeline.getEnabled().equals(Boolean.TRUE)) {
        toggleEndPoint = "%s/%s/disable";
        toggleUrl = String.format(toggleEndPoint, serviceURL, API_ENDPOINT);
        response = post(toggleUrl, requestPayload.toString());
        if (response.statusCode() == 200) {
          ingestionPipeline.setEnabled(false);
          return new PipelineServiceClientResponse()
              .withCode(200)
              .withReason(response.body())
              .withPlatform(this.getPlatform());
        } else if (response.statusCode() == 404) {
          ingestionPipeline.setDeployed(false);
          return new PipelineServiceClientResponse()
              .withCode(404)
              .withReason(response.body())
              .withPlatform(this.getPlatform());
        }
        // otherwise, enable it back
      } else {
        toggleEndPoint = "%s/%s/enable";
        toggleUrl = String.format(toggleEndPoint, serviceURL, API_ENDPOINT);
        response = post(toggleUrl, requestPayload.toString());
        if (response.statusCode() == 200) {
          ingestionPipeline.setEnabled(true);
          return new PipelineServiceClientResponse()
              .withCode(200)
              .withReason(response.body())
              .withPlatform(this.getPlatform());
        } else if (response.statusCode() == 404) {
          ingestionPipeline.setDeployed(false);
          return new PipelineServiceClientResponse()
              .withCode(404)
              .withReason(response.body())
              .withPlatform(this.getPlatform());
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
  public List<PipelineStatus> getQueuedPipelineStatusInternal(IngestionPipeline ingestionPipeline) {
    HttpResponse<String> response;
    try {
      String statusEndPoint = "%s/%s/status?dag_id=%s&only_queued=true";
      response =
          getRequestAuthenticatedForJsonContent(
              statusEndPoint, serviceURL, API_ENDPOINT, ingestionPipeline.getName());
      if (response.statusCode() == 200) {
        return JsonUtils.readObjects(response.body(), PipelineStatus.class);
      }
    } catch (Exception e) {
      throw PipelineServiceClientException.byMessage(ingestionPipeline.getName(), e.getMessage());
    }
    // Return an empty list. We'll just show the stored status from the Ingestion Pipeline
    LOG.error(
        String.format(
            "Got status code [%s] trying to get queued statuses: [%s]",
            response.statusCode(), response.body()));
    return new ArrayList<>();
  }

  /**
   * Scenarios handled here: 1. Failed to access Airflow APIs: No response from Airflow; APIs might not be installed 2.
   * Auth failed when accessing Airflow APIs 3. Different versions between server and client
   */
  @Override
  public PipelineServiceClientResponse getServiceStatusInternal() {
    HttpResponse<String> response;
    try {
      response =
          getRequestAuthenticatedForJsonContent("%s/%s/health-auth", serviceURL, API_ENDPOINT);

      // We can reach the APIs and get the status back from Airflow
      if (response.statusCode() == 200) {
        JSONObject responseJSON = new JSONObject(response.body());
        String ingestionVersion = responseJSON.getString("version");

        if (Boolean.TRUE.equals(validServerClientVersions(ingestionVersion))) {
          return buildHealthyStatus(ingestionVersion);
        } else {
          return buildUnhealthyStatus(
              buildVersionMismatchErrorMessage(ingestionVersion, SERVER_VERSION));
        }
      }

      // Auth error when accessing the APIs
      if (response.statusCode() == 401 || response.statusCode() == 403) {
        return buildUnhealthyStatus(
            String.format(
                "Authentication failed for user [%s] trying to access the Airflow APIs.",
                this.username));
      }

      // APIs URL not found
      if (response.statusCode() == 404) {
        return buildUnhealthyStatus(
            "Airflow APIs not found. Please follow the installation guide.");
      }

      return buildUnhealthyStatus(
          String.format(
              "Unexpected status response: code [%s] - [%s]",
              response.statusCode(), response.body()));

    } catch (Exception e) {
      return buildUnhealthyStatus(
          String.format("Failed to get REST status due to [%s].", e.getMessage()));
    }
  }

  @Override
  public PipelineServiceClientResponse runAutomationsWorkflow(Workflow workflow) {
    HttpResponse<String> response;
    try {
      String automationsEndpoint = "%s/%s/run_automation";
      String automationsUrl = String.format(automationsEndpoint, serviceURL, API_ENDPOINT);
      String workflowPayload = JsonUtils.pojoToJson(workflow);
      response = post(automationsUrl, workflowPayload);
      if (response.statusCode() == 200) {
        return new PipelineServiceClientResponse()
            .withCode(200)
            .withReason(response.body())
            .withPlatform(this.getPlatform());
      }
    } catch (Exception e) {
      throw IngestionPipelineDeploymentException.byMessage(workflow.getName(), e.getMessage());
    }
    throw new PipelineServiceClientException(
        String.format(
            "%s Failed to trigger workflow due to airflow API returned %s and response %s",
            workflow.getName(),
            Response.Status.fromStatusCode(response.statusCode()),
            response.body()));
  }

  @Override
  public PipelineServiceClientResponse runApplicationFlow(App application) {
    return sendPost(APP_TRIGGER, application);
  }

  @Override
  public PipelineServiceClientResponse validateAppRegistration(
      AppMarketPlaceDefinition appMarketPlaceDefinition) {
    return new PipelineServiceClientResponse()
        .withCode(200)
        .withReason("Success")
        .withPlatform(this.getPlatform());
    // TODO: Currently only internal apps are available, external apps will need this validation
    // return sendPost(APP_VALIDATE, appMarketPlaceDefinition);
  }

  private PipelineServiceClientResponse sendPost(String endpoint, Object request) {
    HttpResponse<String> response;
    String workflowPayload = JsonUtils.pojoToJson(request);
    try {
      String automationsEndpoint = "%s/%s/%s";
      String automationsUrl =
          String.format(automationsEndpoint, serviceURL, API_ENDPOINT, endpoint);
      response = post(automationsUrl, workflowPayload);
      if (response.statusCode() == 200) {
        return new PipelineServiceClientResponse()
            .withCode(200)
            .withReason(response.body())
            .withPlatform(this.getPlatform());
      }
    } catch (Exception e) {
      throw IngestionPipelineDeploymentException.byMessage(workflowPayload, e.getMessage());
    }
    throw new PipelineServiceClientException(
        String.format(
            "%s Failed to trigger flow due to airflow API returned %s and response %s",
            workflowPayload,
            Response.Status.fromStatusCode(response.statusCode()),
            response.body()));
  }

  @Override
  public PipelineServiceClientResponse killIngestion(IngestionPipeline ingestionPipeline) {
    HttpResponse<String> response;
    try {
      String killEndPoint = "%s/%s/kill";
      String killUrl = String.format(killEndPoint, serviceURL, API_ENDPOINT);
      JSONObject requestPayload = new JSONObject();
      requestPayload.put(DAG_ID, ingestionPipeline.getName());
      response = post(killUrl, requestPayload.toString());
      if (response.statusCode() == 200) {
        return new PipelineServiceClientResponse()
            .withCode(200)
            .withReason(response.body())
            .withPlatform(this.getPlatform());
      }
    } catch (Exception e) {
      throw PipelineServiceClientException.byMessage(
          "Failed to kill running workflows", e.getMessage());
    }
    throw new PipelineServiceClientException(
        String.format("Failed to kill running workflows due to %s", response.body()));
  }

  @Override
  public Map<String, String> requestGetHostIp() {
    HttpResponse<String> response;
    try {
      response = getRequestAuthenticatedForJsonContent("%s/%s/ip", serviceURL, API_ENDPOINT);
      if (response.statusCode() == 200) {
        return JsonUtils.readValue(response.body(), new TypeReference<>() {});
      }
    } catch (Exception e) {
      throw PipelineServiceClientException.byMessage(
          "Failed to get Pipeline Service host IP.", e.getMessage());
    }
    throw new PipelineServiceClientException(
        String.format("Failed to get Pipeline Service host IP due to %s", response.body()));
  }

  @Override
  public Map<String, String> getLastIngestionLogs(
      IngestionPipeline ingestionPipeline, String after) {
    HttpResponse<String> response;
    String taskId = TYPE_TO_TASK.get(ingestionPipeline.getPipelineType().toString());
    // Init empty after query param
    String afterParam = "";
    if (after != null) {
      afterParam = String.format("&after=%s", after);
    }
    try {
      response =
          getRequestAuthenticatedForJsonContent(
              "%s/%s/last_dag_logs?dag_id=%s&task_id=%s%s",
              serviceURL, API_ENDPOINT, ingestionPipeline.getName(), taskId, afterParam);
      if (response.statusCode() == 200) {
        return JsonUtils.readValue(response.body(), new TypeReference<>() {});
      }
    } catch (Exception e) {
      throw PipelineServiceClientException.byMessage(
          "Failed to get last ingestion logs.", e.getMessage());
    }
    throw new PipelineServiceClientException(
        String.format("Failed to get last ingestion logs due to %s", response.body()));
  }

  private HttpResponse<String> getRequestAuthenticatedForJsonContent(
      String stringUrlFormat, Object... stringReplacement)
      throws IOException, InterruptedException {
    HttpRequest request =
        authenticatedRequestBuilder(stringUrlFormat, stringReplacement).GET().build();
    return client.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> deleteRequestAuthenticatedForJsonContent(
      String stringUrlFormat, Object... stringReplacement)
      throws IOException, InterruptedException {
    HttpRequest request =
        authenticatedRequestBuilder(stringUrlFormat, stringReplacement).DELETE().build();
    return client.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpRequest.Builder authenticatedRequestBuilder(
      String stringUrlFormat, Object... stringReplacement) {
    String url = String.format(stringUrlFormat, stringReplacement);
    return HttpRequest.newBuilder(URI.create(url))
        .header(CONTENT_HEADER, CONTENT_TYPE)
        .header(AUTH_HEADER, getBasicAuthenticationHeader(username, password));
  }
}
