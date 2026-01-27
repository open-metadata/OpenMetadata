/*
 *  Copyright 2026 Collate.
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
/**
 * Summary information about a pipeline including impacted assets count
 */
export interface PipelineSummary {
    /**
     * End time of the pipeline schedule
     */
    endTime?: number;
    /**
     * List of fully qualified names of tables impacted by this pipeline
     */
    impactedAssets?: string[];
    /**
     * Total count of tables impacted by this pipeline
     */
    impactedAssetsCount: number;
    /**
     * Status of last execution
     */
    lastRunStatus?: LastRunStatus | null;
    /**
     * Timestamp of last pipeline execution
     */
    lastRunTime?: number;
    /**
     * Fully qualified name of the pipeline
     */
    pipelineFqn: string;
    /**
     * Unique identifier of the pipeline
     */
    pipelineId: string;
    /**
     * Name of the pipeline
     */
    pipelineName: string;
    /**
     * Schedule interval as stored in pipeline
     */
    scheduleInterval?: null | string;
    /**
     * Type of pipeline service
     */
    serviceType: PipelineServiceType;
    /**
     * Start time of the pipeline schedule
     */
    startTime?: number;
}

export enum LastRunStatus {
    Failed = "Failed",
    Pending = "Pending",
    Running = "Running",
    Skipped = "Skipped",
    Successful = "Successful",
}

/**
 * Type of pipeline service
 *
 * Type of pipeline service - Airflow or Prefect.
 */
export enum PipelineServiceType {
    Airbyte = "Airbyte",
    Airflow = "Airflow",
    CustomPipeline = "CustomPipeline",
    DBTCloud = "DBTCloud",
    Dagster = "Dagster",
    DataFactory = "DataFactory",
    DatabricksPipeline = "DatabricksPipeline",
    DomoPipeline = "DomoPipeline",
    Fivetran = "Fivetran",
    Flink = "Flink",
    GluePipeline = "GluePipeline",
    KafkaConnect = "KafkaConnect",
    KinesisFirehose = "KinesisFirehose",
    Matillion = "Matillion",
    MicrosoftFabricPipeline = "MicrosoftFabricPipeline",
    Mulesoft = "Mulesoft",
    Nifi = "Nifi",
    OpenLineage = "OpenLineage",
    Snowplow = "Snowplow",
    Spark = "Spark",
    Spline = "Spline",
    Ssis = "SSIS",
    Stitch = "Stitch",
    Wherescape = "Wherescape",
}
