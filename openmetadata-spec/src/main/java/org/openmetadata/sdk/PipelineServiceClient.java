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

package org.openmetadata.sdk;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.http.HttpResponse;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Pattern;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
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
  protected final String hostIp;

  protected static final String AUTH_HEADER = "Authorization";
  protected static final String CONTENT_HEADER = "Content-Type";
  protected static final String CONTENT_TYPE = "application/json";

  public static final Map<String, String> TYPE_TO_TASK =
      Map.of(
          PipelineType.METADATA.toString(),
          "ingestion_task",
          PipelineType.PROFILER.toString(),
          "profiler_task",
          PipelineType.LINEAGE.toString(),
          "lineage_task",
          PipelineType.DBT.toString(),
          "dbt_task",
          PipelineType.USAGE.toString(),
          "usage_task",
          PipelineType.TEST_SUITE.toString(),
          "test_suite_task",
          PipelineType.DATA_INSIGHT.toString(),
          "data_insight_task",
          PipelineType.ELASTIC_SEARCH_REINDEX.toString(),
          "elasticsearch_reindex_task");

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

  public PipelineServiceClient(PipelineServiceClientConfiguration pipelineServiceClientConfiguration) {
    this.hostIp = pipelineServiceClientConfiguration.getHostIp();
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
              + "https://api.my-ip.io/ip reachable from your network or that the `hostIp` setting is configured.");
    }
  }

  /* Check the status of pipeline service to ensure it is healthy */
  public abstract Response getServiceStatus();

  /* Test the connection to the service such as database service a pipeline depends on. */
  public abstract HttpResponse<String> testConnection(TestServiceConnection testServiceConnection);

  /* Deploy a pipeline to the pipeline service */
  public abstract String deployPipeline(IngestionPipeline ingestionPipeline, ServiceEntityInterface service);

  /* Deploy run the pipeline at the pipeline service */
  public abstract String runPipeline(IngestionPipeline ingestionPipeline, ServiceEntityInterface service);

  /* Stop and delete a pipeline at the pipeline service */
  public abstract String deletePipeline(IngestionPipeline ingestionPipeline);

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
