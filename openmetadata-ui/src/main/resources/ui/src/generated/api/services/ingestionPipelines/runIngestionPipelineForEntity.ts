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
 * Run the ingestion pipeline of the given type that owns an entity, scoped to that entity
 * alone: a test suite pipeline for a test case, or a profiler, metadata or auto
 * classification pipeline for a table.
 */
export interface RunIngestionPipelineForEntity {
    /**
     * Link to the entity to run the pipeline for, such as `<#E::testCase::{fqn}>` or
     * `<#E::table::{fqn}>`.
     */
    entityLink: string;
    /**
     * Type of the pipeline to run for the entity.
     */
    pipelineType: PipelineType;
}

/**
 * Type of the pipeline to run for the entity.
 *
 * Type of Pipeline - metadata, usage
 */
export enum PipelineType {
    Application = "application",
    AutoClassification = "autoClassification",
    DataInsight = "dataInsight",
    Dbt = "dbt",
    ElasticSearchReindex = "elasticSearchReindex",
    Lineage = "lineage",
    Metadata = "metadata",
    PolicyAgent = "policyAgent",
    Profiler = "profiler",
    TestSuite = "TestSuite",
    Usage = "usage",
}
