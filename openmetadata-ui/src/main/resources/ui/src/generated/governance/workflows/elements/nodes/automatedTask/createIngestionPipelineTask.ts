/*
 *  Copyright 2025 Collate.
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
 * Creates an Ingestion Pipeline
 */
export interface CreateIngestionPipelineTask {
    branches?: string[];
    config?:   Config;
    /**
     * Description of the Node.
     */
    description?: string;
    /**
     * Display Name that identifies this Node.
     */
    displayName?:       string;
    input?:             string[];
    inputNamespaceMap?: InputNamespaceMap;
    /**
     * Name that identifies this Node.
     */
    name?:    string;
    output?:  string[];
    subType?: string;
    type?:    string;
    [property: string]: any;
}

export interface Config {
    deploy:       boolean;
    pipelineType: PipelineType;
}

/**
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
    Profiler = "profiler",
    TestSuite = "TestSuite",
    Usage = "usage",
}

export interface InputNamespaceMap {
    relatedEntity: string;
}
