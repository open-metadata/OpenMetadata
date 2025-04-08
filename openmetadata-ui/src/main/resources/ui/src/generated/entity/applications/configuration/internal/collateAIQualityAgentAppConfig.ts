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
 * Configuration for the Collate AI Quality Agent.
 */
export interface CollateAIQualityAgentAppConfig {
    /**
     * Whether the suggested tests should be active or after being created. You can review the
     * tests being created on your tables and add the ones you want to execute to the Test Suite
     * pipelines.
     */
    active?: boolean;
    /**
     * You can use the UI Query Filter builder to select the assets that you want to generate
     * the Data Quality Tests for. You can filter by any property of your tables: the service,
     * database or schema they belong to, their name, owners, domain,... and even by Custom
     * Properties!
     */
    filter: string;
    /**
     * Application Type
     */
    type?: CollateAIQualityAgentAppType;
}

/**
 * Application Type
 *
 * Application type.
 */
export enum CollateAIQualityAgentAppType {
    CollateAIQualityAgent = "CollateAIQualityAgent",
}
