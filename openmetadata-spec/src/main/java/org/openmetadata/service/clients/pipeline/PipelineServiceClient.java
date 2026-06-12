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

package org.openmetadata.service.clients.pipeline;

import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Pattern;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.sdk.exception.PipelineServiceClientException;
import org.openmetadata.sdk.exception.PipelineServiceVersionException;

/**
 * Client to make API calls to add, deleted, and deploy pipelines on a PipelineService, such as
 * Airflow. Core abstractions are as follows:
 *
 * <ul>
 *   <li>A PipelineService is a service such as AirFlow to which a pipeline can be deployed
 *   <li>A Pipeline is a workflow for performing certain tasks. Example - ingestion pipeline is a
 *       workflow that connects to a database service or other services and collect metadata.
 *   <li>Pipeline uses `Connection` to a service as dependency. A Pipeline might need to connection
 *       to database service to collect metadata, OpenMetadata to user metadata over APIs, etc.
 * </ul>
 */
@Slf4j
public abstract class PipelineServiceClient implements PipelineServiceClientInterface {
  protected final boolean pipelineServiceClientEnabled;
  protected final String hostIp;

  protected final boolean ingestionIpInfoEnabled;

  @Getter @Setter private String platform;

  protected static final String AUTH_HEADER = "Authorization";
  protected static final String CONTENT_HEADER = "Content-Type";
  protected static final String CONTENT_TYPE = "application/json";
  private static final Integer MAX_ATTEMPTS = 3;
  private static final long DEFAULT_BACKOFF_MILLIS = 5_000L;
  private static final String DISABLED_STATUS = "disabled";

  private volatile Retry serviceStatusRetry;

  protected static final String SERVER_VERSION;

  static {
    String rawServerVersion;
    try {
      rawServerVersion = getServerVersion();
    } catch (IOException e) {
      rawServerVersion = "unknown";
    }
    SERVER_VERSION = rawServerVersion;
  }

  public PipelineServiceClient(
      PipelineServiceClientConfiguration pipelineServiceClientConfiguration) {
    this.pipelineServiceClientEnabled = pipelineServiceClientConfiguration.getEnabled();
    this.hostIp = pipelineServiceClientConfiguration.getHostIp();
    this.ingestionIpInfoEnabled = pipelineServiceClientConfiguration.getIngestionIpInfoEnabled();
  }

  public final URL validateServiceURL(String serviceURL) {
    try {
      return new URL(serviceURL);
    } catch (MalformedURLException e) {
      throw new PipelineServiceClientException(serviceURL + " Malformed.");
    }
  }

  public final String getBasicAuthenticationHeader(String username, String password) {
    String valueToEncode = username + ":" + password;
    return "Basic " + Base64.getEncoder().encodeToString(valueToEncode.getBytes());
  }

  public static String getServerVersion() throws IOException {
    InputStream fileInput = PipelineServiceClient.class.getResourceAsStream("/catalog/VERSION");
    Properties props = new Properties();
    if (fileInput != null) {
      props.load(fileInput);
    }
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
                  new PipelineServiceVersionException(
                      String.format("Cannot extract version x.y.z from %s", version)));
    } else {
      throw new PipelineServiceVersionException("Received version as null");
    }
  }

  private String getMajorMinorVersion(String fullVersion) {
    String[] versionParts = fullVersion.split("\\.");
    if (versionParts.length >= 2) {
      return versionParts[0] + "." + versionParts[1];
    }
    return fullVersion;
  }

  @Override
  public final Boolean validServerClientVersions(String clientVersion, String serverVersion) {
    String clientFullVersion = getVersionFromString(clientVersion);
    String serverFullVersion = getVersionFromString(serverVersion);

    return getMajorMinorVersion(clientFullVersion).equals(getMajorMinorVersion(serverFullVersion));
  }

  public String buildVersionMismatchErrorMessage(String ingestionVersion, String serverVersion) {
    if (getVersionFromString(ingestionVersion).compareTo(getVersionFromString(serverVersion)) < 0) {
      return String.format(
          "Ingestion version [%s] is older than Server Version [%s]. Please upgrade your ingestion client.",
          ingestionVersion, serverVersion);
    }
    return String.format(
        "Server version [%s] is older than Ingestion Version [%s]. Please upgrade your server or downgrade the ingestion client.",
        serverVersion, ingestionVersion);
  }

  /** To build the response of getServiceStatus */
  protected PipelineServiceClientResponse buildHealthyStatus(String ingestionVersion) {
    return new PipelineServiceClientResponse()
        .withCode(200)
        .withVersion(ingestionVersion)
        .withPlatform(this.getPlatform());
  }

  /** To build the response of getServiceStatus */
  protected PipelineServiceClientResponse buildUnhealthyStatus(String reason) {
    return new PipelineServiceClientResponse()
        .withCode(500)
        .withReason(reason)
        .withPlatform(this.getPlatform());
  }

  public final Response getHostIp() {

    if (this.ingestionIpInfoEnabled) {
      return getHostIpInternal();
    }
    return Response.status(Response.Status.NO_CONTENT).build();
  }

  private Response getHostIpInternal() {
    Map<String, String> body;
    try {
      body = CommonUtil.nullOrEmpty(this.hostIp) ? requestGetHostIp() : Map.of("ip", this.hostIp);
      return Response.ok(body, MediaType.APPLICATION_JSON_TYPE).build();
    } catch (Exception e) {
      LOG.error("Failed to get Pipeline Service host IP. {}", e.getMessage());
      // We don't want the request to fail for an informative ping
      body =
          Map.of(
              "ip",
              "Failed to find the IP of Airflow Container. Please make sure https://api.ipify.org, "
                  + "https://api.my-ip.io/ip reachable from your network or that the `hostIp` setting is configured.");
      return Response.ok(body, MediaType.APPLICATION_JSON_TYPE).build();
    }
  }

  /**
   * Check the pipeline service status with an exception backoff to make sure we don't raise any
   * false positives. Delegates to {@link #getServiceStatus()}, which already retries transient
   * failures.
   */
  public String getServiceStatusBackoff() {
    PipelineServiceClientResponse status = getServiceStatus();
    return status.getCode() != 200 ? UNHEALTHY_STATUS : HEALTHY_STATUS;
  }

  /**
   * Check the status of pipeline service to ensure it is healthy. Retries up to {@link
   * #MAX_ATTEMPTS} times with backoff so that a single transient failure (e.g. Airflow restart,
   * network blip) does not permanently mark the agent as unavailable. Responses with status codes
   * &ge; 500 are retried; known non-transient 4xx responses (401, 403, 404, version mismatch) are
   * returned immediately. Any other unexpected HTTP status code is passed through as-is and will
   * not trigger retries.
   */
  public PipelineServiceClientResponse getServiceStatus() {
    if (!pipelineServiceClientEnabled) {
      return buildHealthyStatus(DISABLED_STATUS).withPlatform(DISABLED_STATUS);
    }
    PipelineServiceClientResponse response =
        retryForServiceStatus().executeSupplier(this::getServiceStatusInternal);
    return response != null
        ? response
        : buildUnhealthyStatus("Pipeline service returned no response");
  }

  /** Returns the wait duration between retry attempts in milliseconds. */
  protected long getRetryBackoffMillis() {
    return DEFAULT_BACKOFF_MILLIS;
  }

  private Retry retryForServiceStatus() {
    if (serviceStatusRetry == null) {
      synchronized (this) {
        if (serviceStatusRetry == null) {
          var retryConfig =
              RetryConfig.<PipelineServiceClientResponse>custom()
                  .maxAttempts(MAX_ATTEMPTS)
                  .waitDuration(Duration.ofMillis(getRetryBackoffMillis()))
                  .retryOnResult(response -> response == null || response.getCode() >= 500)
                  .failAfterMaxAttempts(false)
                  .build();
          serviceStatusRetry = Retry.of("getServiceStatus", retryConfig);
        }
      }
    }
    return serviceStatusRetry;
  }

  public List<PipelineStatus> getQueuedPipelineStatus(IngestionPipeline ingestionPipeline) {
    List<PipelineStatus> result = new ArrayList<>();
    if (pipelineServiceClientEnabled) {
      try {
        List<PipelineStatus> internal = getQueuedPipelineStatusInternal(ingestionPipeline);
        if (internal != null) {
          result.addAll(internal);
        }
      } catch (Exception e) {
        LOG.warn(
            "Failed to fetch queued pipeline status for {}: {}. Returning stored statuses only.",
            ingestionPipeline.getFullyQualifiedName(),
            e.getMessage());
      }
    }
    return result;
  }

  protected abstract PipelineServiceClientResponse getServiceStatusInternal();

  /* Get the Pipeline Service host IP to whitelist in source systems. Should return a map in the shape "ip: 111.11.11.1" */
  protected abstract Map<String, String> requestGetHostIp();
}
