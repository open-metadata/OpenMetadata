package org.openmetadata.catalog.ingestion;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;
import org.apache.commons.text.translate.NumericEntityUnescaper;

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
    @JsonProperty("schedule_interval")
    String schedulerInterval;
    List<OpenMetadataIngestionTask> tasks;
}