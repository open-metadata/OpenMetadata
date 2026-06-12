package org.openmetadata.service.clients.pipeline;

import static org.openmetadata.service.util.MicrometerBundleUtil.recordMetrics;

import java.util.function.Supplier;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientStatus;
import org.openmetadata.sdk.PipelineServiceClientInterface;

@Slf4j
public class MeteredPipelineServiceClient implements PipelineServiceClientInterface {

  private final PipelineServiceClientInterface decoratedClient;

  public MeteredPipelineServiceClient(PipelineServiceClientInterface decoratedClient) {
    this.decoratedClient = decoratedClient;
  }

  @Override
  public PipelineServiceClientResponse getServiceStatus() {
    return respondWithMetering(decoratedClient::getServiceStatus);
  }

  @Override
  public PipelineServiceClientResponse runAutomationFlow(String clusterName) {
    return respondWithMetering(() -> decoratedClient.runAutomationFlow(clusterName));
  }

  @Override
  public Response getLastOperatorLogs(String ingestionPipelineFQN, String taskId) {
    return decoratedClient.getLastOperatorLogs(ingestionPipelineFQN, taskId);
  }

  @Override
  public Response getLogs(String pipelineName, String pipelineType, Long start, Long end) {
    return decoratedClient.getLogs(pipelineName, pipelineType, start, end);
  }

  @Override
  public Response uploadLogs(String pipelineName, String pipelineType) {
    return decoratedClient.uploadLogs(pipelineName, pipelineType);
  }

  @Override
  public Response deleteLogs(String pipelineName) {
    return decoratedClient.deleteLogs(pipelineName);
  }

  @Override
  public void updateServiceEndpoint() {
    decoratedClient.updateServiceEndpoint();
  }

  @Override
  public String getHostIp() {
    return decoratedClient.getHostIp();
  }

  @Override
  public void validateHostIp() {
    decoratedClient.validateHostIp();
  }

  @Override
  public boolean isPipelineServiceClientReady() {
    return decoratedClient.isPipelineServiceClientReady();
  }

  @Override
  public void deployPipeline(String pipelineName, PipelineServiceClientResponse response) {
    decoratedClient.deployPipeline(pipelineName, response);
  }

  @Override
  public void runPipeline(String pipelineName, String pipelineType, Long start, Long end) {
    decoratedClient.runPipeline(pipelineName, pipelineType, start, end);
  }

  @Override
  public void stopPipeline(String pipelineName) {
    decoratedClient.stopPipeline(pipelineName);
  }

  @Override
  public void deletePipeline(String pipelineName) {
    decoratedClient.deletePipeline(pipelineName);
  }

  @Override
  public PipelineServiceClientResponse getAutomationFlowStatus() {
    return decoratedClient.getAutomationFlowStatus();
  }

  private PipelineServiceClientResponse respondWithMetering(
      Supplier<PipelineServiceClientResponse> responseSupplier) {
    PipelineServiceClientResponse result = responseSupplier.get();
    if (result == null) {
      return new PipelineServiceClientResponse()
          .withCode(200)
          .withTimestamp(System.currentTimeMillis());
    }
    long elapsedTime = System.currentTimeMillis() - result.getTimestamp();
    long statusCode = result.getCode();
    String requestType = extractRequestType();
    recordMetrics(requestType, statusCode, elapsedTime);
    return result;
  }

  private String extractRequestType() {
    StackTraceElement[] stackTrace = Thread.currentThread().getStackTrace();
    if (stackTrace.length > 2) {
      return stackTrace[2].getMethodName();
    }
    return "unknown";
  }
}
