package org.openmetadata.service.clients.pipeline;

import io.prometheus.client.Counter;
import jakarta.ws.rs.core.Response;
import java.net.URL;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.sdk.exception.PipelineServiceClientException;
import io.micrometer.core.instrument.Metrics;

public class MeteredPipelineServiceClient implements PipelineServiceClientInterface {
  private final String DEPLOY = "deploy";
  private final String RUN = "run";
  private final String DELETE = "delete";
  private final String TOGGLE = "toggle";
  private final String KILL = "kill";
  private final String GET_LOGS = "get_logs";
  private final String GET_STATUS = "get_status";
  private final String RUN_AUTOMATIONS_WORKFLOW = "run_automations_workflow";
  private final String RUN_APPLICATION_FLOW = "run_application_flow";
  private final String VALIDATE_APP_REGISTRATION = "validate_app_registration";

  private final PipelineServiceClientInterface decoratedClient;

  public MeteredPipelineServiceClient(PipelineServiceClientInterface decoratedClient) {
    this.decoratedClient = decoratedClient;
  }

  private <T> T executeWithMetering(String name, Supplier<T> operation) {
    try {
      T result = operation.get();
      Metrics.counter("pipeline_client_request_status", 
          "operation", name, 
          "status", "200").increment();
      return result;
    } catch (PipelineServiceClientException e) {
      Metrics.counter("pipeline_client_request_status", 
          "operation", name, 
          "status", Integer.toString(e.getResponse().getStatus())).increment();
      throw e;
    } catch (Exception e) {
      Metrics.counter("pipeline_client_request_status", 
          "operation", name, 
          "status", "unknown").increment();
      throw e;
    }
  }

  private PipelineServiceClientResponse respondWithMetering(
      String name, Supplier<PipelineServiceClientResponse> operation) {
    try {
      PipelineServiceClientResponse result = operation.get();
      Metrics.counter("pipeline_client_request_status", 
          "operation", name, 
          "status", Integer.toString(result.getCode())).increment();
      return result;
    } catch (PipelineServiceClientException e) {
      Metrics.counter("pipeline_client_request_status", 
          "operation", name, 
          "status", Integer.toString(e.getResponse().getStatus())).increment();
      throw e;
    } catch (Exception e) {
      Metrics.counter("pipeline_client_request_status", 
          "operation", name, 
          "status", "unknown").increment();
      throw e;
    }
  }

  @Override
  public PipelineServiceClientResponse deployPipeline(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    return this.respondWithMetering(
        DEPLOY, () -> this.decoratedClient.deployPipeline(ingestionPipeline, service));
  }

  @Override
  public PipelineServiceClientResponse runPipeline(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    return this.respondWithMetering(
        RUN, () -> this.decoratedClient.runPipeline(ingestionPipeline, service));
  }

  @Override
  public PipelineServiceClientResponse runPipeline(
      IngestionPipeline ingestionPipeline,
      ServiceEntityInterface service,
      Map<String, Object> config) {
    return this.respondWithMetering(
        RUN, () -> this.decoratedClient.runPipeline(ingestionPipeline, service, config));
  }

  @Override
  public PipelineServiceClientResponse deletePipeline(IngestionPipeline ingestionPipeline) {
    return this.respondWithMetering(
        DELETE, () -> this.decoratedClient.deletePipeline(ingestionPipeline));
  }

  @Override
  public List<PipelineStatus> getQueuedPipelineStatusInternal(IngestionPipeline ingestionPipeline) {
    return this.decoratedClient.getQueuedPipelineStatusInternal(ingestionPipeline);
  }

  public PipelineServiceClientResponse toggleIngestion(IngestionPipeline ingestionPipeline) {
    return this.respondWithMetering(
        TOGGLE, () -> this.decoratedClient.toggleIngestion(ingestionPipeline));
  }

  @Override
  public Map<String, String> getLastIngestionLogs(
      IngestionPipeline ingestionPipeline, String after) {
    return executeWithMetering(
        GET_LOGS, () -> this.decoratedClient.getLastIngestionLogs(ingestionPipeline, after));
  }

  public PipelineServiceClientResponse killIngestion(IngestionPipeline ingestionPipeline) {
    return this.respondWithMetering(
        KILL, () -> this.decoratedClient.killIngestion(ingestionPipeline));
  }

  @Override
  public String getPlatform() {
    return this.decoratedClient.getPlatform();
  }

  @Override
  public URL validateServiceURL(String serviceURL) {
    return decoratedClient.validateServiceURL(serviceURL);
  }

  @Override
  public String getBasicAuthenticationHeader(String username, String password) {
    return decoratedClient.getBasicAuthenticationHeader(username, password);
  }

  @Override
  public Boolean validServerClientVersions(String clientVersion) {
    return decoratedClient.validServerClientVersions(clientVersion);
  }

  @Override
  public Response getHostIp() {
    return decoratedClient.getHostIp();
  }

  @Override
  public String getServiceStatusBackoff() {
    return executeWithMetering(GET_STATUS, decoratedClient::getServiceStatusBackoff);
  }

  @Override
  public PipelineServiceClientResponse getServiceStatus() {
    return this.respondWithMetering(GET_STATUS, this.decoratedClient::getServiceStatus);
  }

  @Override
  public List<PipelineStatus> getQueuedPipelineStatus(IngestionPipeline ingestionPipeline) {
    return this.decoratedClient.getQueuedPipelineStatus(ingestionPipeline);
  }

  @Override
  public PipelineServiceClientResponse runAutomationsWorkflow(Workflow workflow) {
    return this.respondWithMetering(
        RUN_AUTOMATIONS_WORKFLOW, () -> this.decoratedClient.runAutomationsWorkflow(workflow));
  }

  @Override
  public PipelineServiceClientResponse runApplicationFlow(App application) {
    return this.respondWithMetering(
        RUN_APPLICATION_FLOW, () -> this.decoratedClient.runApplicationFlow(application));
  }

  @Override
  public PipelineServiceClientResponse validateAppRegistration(AppMarketPlaceDefinition app) {
    return this.respondWithMetering(
        VALIDATE_APP_REGISTRATION, () -> this.decoratedClient.validateAppRegistration(app));
  }
}
