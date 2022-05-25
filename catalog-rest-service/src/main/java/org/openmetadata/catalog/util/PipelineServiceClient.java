package org.openmetadata.catalog.util;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.openmetadata.catalog.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.catalog.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.catalog.exception.PipelineServiceClientException;

/**
 * Client to make API calls to add, deleted, and deploy pipelines on a PipelineService, such as Airflow. Core
 * abstractions are as follows:
 *
 * <ul>
 *   <li>A PipelineService is a service such as AirFlow to which a pipeline can be deployed
 *   <li>A Pipeline is a workflow for performing certain tasks. Example - ingestion pipeline is a workflow that connects
 *       to a database service or other services and collect metadata.
 *   <li>Pipeline uses `Connection` to a service as dependency. A Pipeline might need to connection to database service
 *       to collect metadata, OpenMetadata to user metadata over APIs, etc.
 * </ul>
 */
public abstract class PipelineServiceClient {
  protected final URL serviceURL;
  protected final String username;
  protected final String password;
  protected final HttpClient client;
  protected static final String AUTH_HEADER = "Authorization";
  protected static final String AUTH_TOKEN = "Bearer %s";
  protected static final String CONTENT_HEADER = "Content-Type";
  protected static final String CONTENT_TYPE = "application/json";

  public PipelineServiceClient(String userName, String password, String apiEndpoint, int apiTimeout) {
    try {
      this.serviceURL = new URL(apiEndpoint);
    } catch (MalformedURLException e) {
      throw new PipelineServiceClientException(apiEndpoint + " Malformed.");
    }
    this.username = userName;
    this.password = password;
    this.client =
        HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(apiTimeout))
            .build();
  }

  public final HttpResponse<String> post(String endpoint, String payload) throws IOException, InterruptedException {
    return post(endpoint, payload, true);
  }

  public final HttpResponse<String> post(String endpoint, String payload, boolean authenticate)
      throws IOException, InterruptedException {
    String authToken = authenticate ? authenticate() : null;
    HttpRequest.Builder requestBuilder =
        HttpRequest.newBuilder(URI.create(endpoint))
            .header(CONTENT_HEADER, CONTENT_TYPE)
            .POST(HttpRequest.BodyPublishers.ofString(payload));
    if (authenticate) {
      requestBuilder.header(AUTH_HEADER, String.format(AUTH_TOKEN, authToken));
    }
    return client.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
  }

  /* Authenticate with the service */
  public abstract String authenticate();

  /* Check the status of pipeline service to ensure it is healthy */
  public abstract HttpResponse<String> getServiceStatus();

  /* Test the connection to the service such as database service a pipeline depends on. */
  public abstract HttpResponse<String> testConnection(TestServiceConnection testServiceConnection);

  /* Deploy a pipeline to the pipeline service */
  public abstract String deployPipeline(IngestionPipeline ingestionPipeline);

  /* Deploy run the pipeline at the pipeline service */
  public abstract String runPipeline(String pipelineName);

  /* Stop and delete a pipeline at the pipeline service */
  public abstract String deletePipeline(String pipelineName);

  /* Get the status of a deployed pipeline */
  public abstract IngestionPipeline getPipelineStatus(IngestionPipeline ingestionPipeline);
}
