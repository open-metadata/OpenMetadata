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
import java.net.URISyntaxException;
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
import org.apache.http.client.utils.URIBuilder;
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
  private static final String DOCS_LINK =
      "Follow [this guide](https://docs.open-metadata.org/deployment/ingestion/openmetadata) for further details.";

  protected final String username;
  protected final String password;
  protected final HttpClient client;
  protected final URL serviceURL;
  private static final List<String> API_ENDPOINT_SEGMENTS = List.of("api", "v1", "openmetadata");
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
      String deployUrl = buildURI("deploy").build().toString();
      String pipelinePayload = JsonUtils.pojoToJson(ingestionPipeline);
      response = post(deployUrl, pipelinePayload);
      if (response.statusCode() == 200) {
        ingestionPipeline.setDeployed(true);
        return getResponse(200, response.body());
      }
    } catch (IOException | URISyntaxException e) {
      throw IngestionPipelineDeploymentException.byMessage(
          ingestionPipeline.getName(), DEPLOYMENT_ERROR, e.getMessage());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw IngestionPipelineDeploymentException.byMessage(
          ingestionPipeline.getName(), DEPLOYMENT_ERROR, e.getMessage());
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
      URIBuilder uri = buildURI("delete");
      uri.addParameter(DAG_ID, pipelineName);
      response = deleteRequestAuthenticatedForJsonContent(uri.build().toString());
      if (response.statusCode() == 200) {
        return getResponse(200, response.body());
      }
    } catch (IOException | URISyntaxException e) {
      LOG.error(
          String.format("Failed to delete Airflow Pipeline %s from Airflow DAGS", pipelineName));
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.error(
          String.format("Failed to delete Airflow Pipeline %s from Airflow DAGS", pipelineName));
    }
    return getResponse(
        500, String.format("Failed to delete Airflow Pipeline %s from Airflow DAGS", pipelineName));
  }

  @Override
  public PipelineServiceClientResponse runPipeline(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    String pipelineName = ingestionPipeline.getName();
    HttpResponse<String> response;
    try {
      String triggerUrl = buildURI("trigger").build().toString();
      JSONObject requestPayload = new JSONObject();
      requestPayload.put(DAG_ID, pipelineName);
      response = post(triggerUrl, requestPayload.toString());
      if (response.statusCode() == 200) {
        return getResponse(200, response.body());
      }
    } catch (IOException | URISyntaxException e) {
      throw IngestionPipelineDeploymentException.byMessage(
          pipelineName, TRIGGER_ERROR, e.getMessage());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw IngestionPipelineDeploymentException.byMessage(
          pipelineName, TRIGGER_ERROR, e.getMessage());
    }

    throw IngestionPipelineDeploymentException.byMessage(
        pipelineName,
        TRIGGER_ERROR,
        "Failed to trigger IngestionPipeline",
        Response.Status.fromStatusCode(response.statusCode()));
  }

  @Override
  public PipelineServiceClientResponse toggleIngestion(IngestionPipeline ingestionPipeline) {
    HttpResponse<String> response;
    try {
      String toggleUrl;
      JSONObject requestPayload = new JSONObject();
      requestPayload.put(DAG_ID, ingestionPipeline.getName());
      // If the pipeline is currently enabled, disable it
      if (ingestionPipeline.getEnabled().equals(Boolean.TRUE)) {
        toggleUrl = buildURI("disable").build().toString();
        response = post(toggleUrl, requestPayload.toString());
        if (response.statusCode() == 200) {
          ingestionPipeline.setEnabled(false);
          return getResponse(200, response.body());
        } else if (response.statusCode() == 404) {
          ingestionPipeline.setDeployed(false);
          return getResponse(404, response.body());
        }
        // otherwise, enable it back
      } else {
        toggleUrl = buildURI("enable").build().toString();
        response = post(toggleUrl, requestPayload.toString());
        if (response.statusCode() == 200) {
          ingestionPipeline.setEnabled(true);
          ingestionPipeline.setEnabled(false);
        } else if (response.statusCode() == 404) {
          ingestionPipeline.setDeployed(false);
          return getResponse(404, response.body());
        }
      }
    } catch (IOException | URISyntaxException e) {
      throw clientException(ingestionPipeline, e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw clientException(ingestionPipeline, e);
    }
    throw clientException(ingestionPipeline, "Failed to toggle ingestion pipeline state", response);
  }

  @Override
  public List<PipelineStatus> getQueuedPipelineStatusInternal(IngestionPipeline ingestionPipeline) {
    HttpResponse<String> response;
    try {
      URIBuilder uri = buildURI("status");
      uri.addParameter(DAG_ID, ingestionPipeline.getName());
      uri.addParameter("only_queued", "true");
      response = getRequestAuthenticatedForJsonContent(uri.build().toString());
      if (response.statusCode() == 200) {
        return JsonUtils.readObjects(response.body(), PipelineStatus.class);
      }
    } catch (IOException | URISyntaxException e) {
      throw clientException(ingestionPipeline, e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw clientException(ingestionPipeline, e);
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
      String healthUrl = buildURI("health-auth").build().toString();
      response = getRequestAuthenticatedForJsonContent(healthUrl);

      // We can reach the APIs and get the status back from Airflow
      if (response.statusCode() == 200) {
        JSONObject responseJSON = new JSONObject(response.body());
        String ingestionVersion = responseJSON.getString("version");
        return Boolean.TRUE.equals(validServerClientVersions(ingestionVersion))
            ? buildHealthyStatus(ingestionVersion)
            : buildUnhealthyStatus(
                buildVersionMismatchErrorMessage(ingestionVersion, SERVER_VERSION));
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
            String.format(
                "Airflow APIs not found. Please validate if the OpenMetadata Airflow plugin is installed correctly. %s",
                DOCS_LINK));
      }

      return buildUnhealthyStatus(
          String.format(
              "Unexpected status response: code [%s] - [%s]",
              response.statusCode(), response.body()));

    } catch (IOException | URISyntaxException e) {
      String exceptionMsg;
      if (e.getMessage() != null) {
        exceptionMsg = String.format("Failed to get Airflow status due to [%s].", e.getMessage());
      } else {
        exceptionMsg = "Failed to connect to Airflow.";
      }
      return buildUnhealthyStatus(String.format("%s %s", exceptionMsg, DOCS_LINK));
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return buildUnhealthyStatus(String.format("Failed to connect to Airflow. %s", DOCS_LINK));
    }
  }

  @Override
  public PipelineServiceClientResponse runAutomationsWorkflow(Workflow workflow) {
    HttpResponse<String> response;
    try {
      String automationsUrl = buildURI("run_automation").build().toString();
      String workflowPayload = JsonUtils.pojoToJson(workflow);
      response = post(automationsUrl, workflowPayload);
      if (response.statusCode() == 200) {
        return getResponse(200, response.body());
      }
    } catch (IOException | URISyntaxException e) {
      // We can end up here if the test connection is not sending back anything after the POST
      // request
      // due to the connection to the source service not being properly resolved.
      throw IngestionPipelineDeploymentException.byMessage(
          workflow.getName(),
          TRIGGER_ERROR,
          "No response from the test connection. Make sure your service is reachable and accepting connections");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw IngestionPipelineDeploymentException.byMessage(
          workflow.getName(), TRIGGER_ERROR, e.getMessage());
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
    return getResponse(200, "Success");
    // TODO: Currently only internal apps are available, external apps will need this validation
    // return sendPost(APP_VALIDATE, appMarketPlaceDefinition);
  }

  private PipelineServiceClientResponse sendPost(String endpoint, Object request) {
    HttpResponse<String> response;
    String workflowPayload = JsonUtils.pojoToJson(request);
    try {
      String automationsUrl = buildURI(endpoint).build().toString();
      response = post(automationsUrl, workflowPayload);
      if (response.statusCode() == 200) {
        return getResponse(200, response.body());
      }
    } catch (IOException | URISyntaxException e) {
      throw IngestionPipelineDeploymentException.byMessage(
          workflowPayload, DEPLOYMENT_ERROR, e.getMessage());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw IngestionPipelineDeploymentException.byMessage(
          workflowPayload, DEPLOYMENT_ERROR, e.getMessage());
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
      String killUrl;
      killUrl = buildURI("kill").build().toString();
      JSONObject requestPayload = new JSONObject();
      requestPayload.put(DAG_ID, ingestionPipeline.getName());
      response = post(killUrl, requestPayload.toString());
      if (response.statusCode() == 200) {
        return getResponse(200, response.body());
      }
    } catch (IOException | URISyntaxException e) {
      throw clientException("Failed to kill running workflows", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw clientException("Failed to kill running workflows", e);
    }
    throw new PipelineServiceClientException(
        String.format("Failed to kill running workflows due to %s", response.body()));
  }

  @Override
  public Map<String, String> requestGetHostIp() {
    HttpResponse<String> response;
    try {
      response = getRequestAuthenticatedForJsonContent(buildURI("ip").build().toString());
      if (response.statusCode() == 200) {
        return JsonUtils.readValue(response.body(), new TypeReference<>() {});
      }
    } catch (IOException | URISyntaxException e) {
      throw clientException("Failed to get Pipeline Service host IP.", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw clientException("Failed to get Pipeline Service host IP.", e);
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

    URIBuilder uri = buildURI("last_dag_logs");
    if (after != null) {
      uri.addParameter("after", after);
    }
    uri.addParameter(DAG_ID, ingestionPipeline.getName());
    uri.addParameter("task_id", taskId);
    try {
      response = getRequestAuthenticatedForJsonContent(uri.build().toString());
      if (response.statusCode() == 200) {
        return JsonUtils.readValue(response.body(), new TypeReference<>() {});
      }
    } catch (IOException | URISyntaxException e) {
      throw clientException("Failed to get last ingestion logs.", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw clientException("Failed to get last ingestion logs.", e);
    }
    throw new PipelineServiceClientException(
        String.format("Failed to get last ingestion logs due to %s", response.body()));
  }

  public URIBuilder buildURI(String path) {
    try {
      List<String> pathInternal = new ArrayList<>(API_ENDPOINT_SEGMENTS);
      pathInternal.add(path);
      URIBuilder builder = new URIBuilder(String.valueOf(serviceURL));
      List<String> segments = new ArrayList<>(builder.getPathSegments());
      segments.addAll(pathInternal);
      return builder.setPathSegments(segments);
    } catch (Exception e) {
      throw clientException(String.format("Failed to built request URI for path [%s].", path), e);
    }
  }

  private HttpResponse<String> getRequestAuthenticatedForJsonContent(String url)
      throws IOException, InterruptedException {
    HttpRequest request = authenticatedRequestBuilder(url).GET().build();
    return client.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> deleteRequestAuthenticatedForJsonContent(String url)
      throws IOException, InterruptedException {
    HttpRequest request = authenticatedRequestBuilder(url).DELETE().build();
    return client.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpRequest.Builder authenticatedRequestBuilder(String url) {
    return HttpRequest.newBuilder(URI.create(url))
        .header(CONTENT_HEADER, CONTENT_TYPE)
        .header(AUTH_HEADER, getBasicAuthenticationHeader(username, password));
  }

  private PipelineServiceClientResponse getResponse(int code, String body) {
    return new PipelineServiceClientResponse()
        .withCode(code)
        .withReason(body)
        .withPlatform(this.getPlatform());
  }

  private PipelineServiceClientException clientException(String message, Exception e) {
    return PipelineServiceClientException.byMessage(message, e.getMessage());
  }

  private PipelineServiceClientException clientException(IngestionPipeline pipeline, Exception e) {
    return clientException(pipeline.getName(), e);
  }

  private PipelineServiceClientException clientException(
      IngestionPipeline pipeline, String message, HttpResponse<String> response) {
    return PipelineServiceClientException.byMessage(
        pipeline.getName(), message, Response.Status.fromStatusCode(response.statusCode()));
  }
}
