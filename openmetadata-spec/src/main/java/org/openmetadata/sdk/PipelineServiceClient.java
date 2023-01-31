package org.openmetadata.sdk;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Pattern;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.sdk.exception.PipelineServiceClientException;
import org.openmetadata.sdk.exception.PipelineServiceVersionException;

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
@Slf4j
public abstract class PipelineServiceClient {
  protected final URL serviceURL;
  protected final String username;
  protected final String password;
  protected final String hostIp;
  protected final HttpClient client;
  protected static final String AUTH_HEADER = "Authorization";
  protected static final String CONTENT_HEADER = "Content-Type";
  protected static final String CONTENT_TYPE = "application/json";

  public static final String SERVER_VERSION;

  static {
    String rawServerVersion;
    try {
      rawServerVersion = getServerVersion();
    } catch (IOException e) {
      rawServerVersion = "unknown";
    }
    SERVER_VERSION = rawServerVersion;
  }

  public PipelineServiceClient(String userName, String password, String apiEndpoint, String hostIp, int apiTimeout) {
    try {
      this.serviceURL = new URL(apiEndpoint);
    } catch (MalformedURLException e) {
      throw new PipelineServiceClientException(apiEndpoint + " Malformed.");
    }
    this.username = userName;
    this.password = password;
    this.hostIp = hostIp;
    this.client =
        HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(apiTimeout))
            .build();
  }

  public final HttpResponse<String> post(String endpoint, String payload) throws IOException, InterruptedException {
    return post(endpoint, payload, true);
  }

  public final String getBasicAuthenticationHeader(String username, String password) {
    String valueToEncode = username + ":" + password;
    return "Basic " + Base64.getEncoder().encodeToString(valueToEncode.getBytes());
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

  public static String getServerVersion() throws IOException {
    InputStream fileInput = PipelineServiceClient.class.getResourceAsStream("/catalog/VERSION");
    Properties props = new Properties();
    props.load(fileInput);
    return props.getProperty("version", "unknown");
  }

  public final String getVersionFromString(String version) {
    if (version != null) {
      return Pattern.compile("(\\d+.\\d+.\\d+)")
          .matcher(version)
          .results()
          .map(m -> m.group(1))
          .findFirst()
          .orElseThrow(
              () ->
                  new PipelineServiceVersionException(String.format("Cannot extract version x.y.z from %s", version)));
    } else {
      throw new PipelineServiceVersionException("Received version as null");
    }
  }

  public final Boolean validServerClientVersions(String clientVersion) {
    return getVersionFromString(clientVersion).equals(getVersionFromString(SERVER_VERSION));
  }

  public final Map<String, String> getHostIp() {
    try {
      return CommonUtil.nullOrEmpty(this.hostIp) ? requestGetHostIp() : Map.of("ip", this.hostIp);
    } catch (Exception e) {
      LOG.error("Failed to get Pipeline Service host IP. {}", e.getMessage());
      return Map.of(
          "ip",
          "Failed to find the IP of Airflow Container. Please make sure https://api.ipify.org, "
              + "https://api.my-ip.io/ip reachable from your network.");
    }
  }

  /* Check the status of pipeline service to ensure it is healthy */
  public abstract Response getServiceStatus();

  /* Test the connection to the service such as database service a pipeline depends on. */
  public abstract HttpResponse<String> testConnection(TestServiceConnection testServiceConnection);

  /* Deploy a pipeline to the pipeline service */
  public abstract String deployPipeline(IngestionPipeline ingestionPipeline);

  /* Deploy run the pipeline at the pipeline service */
  public abstract String runPipeline(String pipelineName);

  /* Stop and delete a pipeline at the pipeline service */
  public abstract String deletePipeline(String pipelineName);

  /* Get the status of a deployed pipeline */
  public abstract List<PipelineStatus> getQueuedPipelineStatus(IngestionPipeline ingestionPipeline);

  /* Toggle the state of an Ingestion Pipeline as enabled/disabled */
  public abstract IngestionPipeline toggleIngestion(IngestionPipeline ingestionPipeline);

  /* Get the all last run logs of a deployed pipeline */
  public abstract Map<String, String> getLastIngestionLogs(IngestionPipeline ingestionPipeline, String after);

  /* Get the all last run logs of a deployed pipeline */
  public abstract HttpResponse<String> killIngestion(IngestionPipeline ingestionPipeline);

  /*
  Get the Pipeline Service host IP to whitelist in source systems
  Should return a map in the shape {"ip": "111.11.11.1"}
  */
  public abstract Map<String, String> requestGetHostIp();
}
