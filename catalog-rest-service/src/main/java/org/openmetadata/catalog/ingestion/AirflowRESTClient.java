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

package org.openmetadata.catalog.ingestion;

import org.json.JSONObject;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.exception.IngestionPipelineDeploymentException;
import org.openmetadata.catalog.operations.workflows.Ingestion;
import org.openmetadata.catalog.operations.workflows.IngestionStatus;
import org.openmetadata.catalog.util.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.core.Response;
import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

public class AirflowRESTClient {
    private static final Logger LOG = LoggerFactory.getLogger(AirflowRESTClient.class);
    private final URL url;
    private final String username;
    private final String password;
    private final HttpClient client;
    private final String authEndpoint = "%s/api/v1/security/login";
    private final String deployEndPoint = "%s/rest_api/api?api=deploy_dag";
    private final String triggerEndPoint = "%s/rest_api/api?api=trigger_dag";
    private final String statusEndPoint = "%s/rest_api/api?api=list_run&dag_id=%s";
    private final String authHeader = "Bearer %s";


    public AirflowRESTClient(CatalogApplicationConfig config) {
        AirflowConfiguration airflowConfig = config.getAirflowConfiguration();
        try {
            this.url = new URL(airflowConfig.getApiEndpoint());
        } catch (MalformedURLException e) {
            throw new RuntimeException(e);
        }
        this.username = airflowConfig.getUsername();
        this.password = airflowConfig.getPassword();
        this.client = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(airflowConfig.getTimeout()))
                .build();
    }

    private String authenticate() throws InterruptedException, IOException {
        String url = String.format(this.authEndpoint, this.url);
        AirflowAuthRequest authRequest = AirflowAuthRequest.builder()
                .username(this.username)
                .password(this.password).build();
        String authPayload = JsonUtils.pojoToJson(authRequest);
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(authPayload))
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() == 200) {
            AirflowAuthResponse authResponse = JsonUtils.readValue(response.body(), AirflowAuthResponse.class);
            return authResponse.getAccessToken();
        }
        throw new RuntimeException("Failed to get access_token. Please check AirflowConfiguration username, password");
    }

    public String deploy(Ingestion ingestion, CatalogApplicationConfig config) {
        try {
            IngestionPipeline pipeline = AirflowUtils.toIngestionPipeline(ingestion, config.getAirflowConfiguration());
            String token = authenticate();
            String authToken = String.format(this.authHeader, token);
            String pipelinePayload = JsonUtils.pojoToJson(pipeline);
            String url = String.format(this.deployEndPoint, this.url);
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("Authorization", authToken)
                    .POST(HttpRequest.BodyPublishers.ofString(pipelinePayload))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                return response.body();
            }
            throw IngestionPipelineDeploymentException.byMessage(ingestion.getName(),
                    "Failed to trigger IngestionPipeline",
                    Response.Status.fromStatusCode(response.statusCode()));
        } catch (Exception e) {
            throw IngestionPipelineDeploymentException.byMessage(ingestion.getName(), e.getMessage());
        }
    }

    public String runPipeline(String pipelineName) {
        try {
            String token = authenticate();
            String authToken = String.format(this.authHeader, token);
            String url = String.format(this.triggerEndPoint, this.url);
            JSONObject requestPayload = new JSONObject();
            requestPayload.put("workflow_name", pipelineName);
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("Authorization", authToken)
                    .POST(HttpRequest.BodyPublishers.ofString(requestPayload.toString()))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                return response.body();
            }

            throw IngestionPipelineDeploymentException.byMessage(pipelineName,
                        "Failed to trigger IngestionPipeline",
                        Response.Status.fromStatusCode(response.statusCode()));
        } catch (Exception e) {
            throw IngestionPipelineDeploymentException.byMessage(pipelineName, e.getMessage());
        }
    }

    public Ingestion getStatus(Ingestion ingestion)  {
        try {
            String token = authenticate();
            String authToken = String.format(this.authHeader, token);
            String url = String.format(this.statusEndPoint, this.url, ingestion.getName());
            JSONObject requestPayload = new JSONObject();
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("Authorization", authToken)
                    .POST(HttpRequest.BodyPublishers.ofString(requestPayload.toString()))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                AirflowListResponse airflowListResponse = JsonUtils.readValue(response.body(),
                        AirflowListResponse.class);
                ingestion.setNextExecutionDate(airflowListResponse.getNextRun());
                List<IngestionStatus> statuses = new ArrayList<>();
                for (AirflowDagRun dagRun: airflowListResponse.dagRuns) {
                    IngestionStatus ingestionStatus = new IngestionStatus().withState(dagRun.getState())
                            .withStartDate(dagRun.getStartDate()).withEndDate(dagRun.getEndDate());
                    statuses.add(ingestionStatus);
                }
                ingestion.setIngestionStatuses(statuses);
                return ingestion;
            }

            throw IngestionPipelineDeploymentException.byMessage(ingestion.getName(),
                    "Failed to fetch ingestion pipeline runs",
                    Response.Status.fromStatusCode(response.statusCode()));
        } catch (Exception e) {
            throw IngestionPipelineDeploymentException.byMessage(ingestion.getName(), e.getMessage());
        }
    }
}
