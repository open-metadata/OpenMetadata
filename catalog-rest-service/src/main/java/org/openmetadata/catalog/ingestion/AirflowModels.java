/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.ingestion;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
@Builder
class AirflowAuthRequest {
  String username;
  String password;
  @Builder.Default
  String provider = "db";
  @Builder.Default
  Boolean refresh = true;
}

@Getter
class AirflowAuthResponse {
  @JsonProperty("access_token")
  String accessToken;
  @JsonProperty("refresh_token")
  String refreshToken;
}

@Getter
class AirflowDagRun {
  String state;
  String startDate;
  String endDate;
}

@Getter
class AirflowListResponse {
  @JsonProperty("status")
  String status;
  @JsonProperty("next_run")
  String nextRun;
  @JsonProperty("dag_runs")
  List<AirflowDagRun> dagRuns;
}

@Builder
@Getter
class OpenMetadataIngestionComponent {
  String type;
  Map<String, Object> config;
}

@Builder
@Getter
class OpenMetadataIngestionConfig {
  OpenMetadataIngestionComponent source;
  OpenMetadataIngestionComponent sink;
  @JsonProperty("metadata_server")
  OpenMetadataIngestionComponent metadataServer;
}

@Builder
@Getter
class IngestionTaskConfig {
  @Builder.Default
  @JsonProperty("python_callable_name")
  String pythonCallableName = "metadata_ingestion_workflow";

  @Builder.Default
  @JsonProperty("python_callable_file")
  String pythonCallableFile = "metadata_ingestion.py";

  @JsonProperty("op_kwargs")
  Map<String, Object> opKwargs;
}


@Builder
@Getter
class OpenMetadataIngestionTask {
  String name;
  @Builder.Default
  String operator = "airflow.operators.python_operator.PythonOperator";
  IngestionTaskConfig config;
}

@Builder
@Getter
class IngestionPipeline {
  String name;
  @Builder.Default
  Boolean forceDeploy = true;
  @Builder.Default
  Boolean pauseWorkflow = false;
  String description;
  @Builder.Default
  Integer concurrency = 1;
  @Builder.Default
  Integer maxActiveRuns = 1;
  @Builder.Default
  Integer workflowTimeout = 60;
  @Builder.Default
  String workflowDefaultView = "tree";
  @Builder.Default
  String orientation = "LR";
  String owner;
  String startDate;
  @Builder.Default
  Integer retries = 3;
  @Builder.Default
  Integer retryDelay = 300;
  String scheduleInterval;
  List<OpenMetadataIngestionTask> tasks;
}