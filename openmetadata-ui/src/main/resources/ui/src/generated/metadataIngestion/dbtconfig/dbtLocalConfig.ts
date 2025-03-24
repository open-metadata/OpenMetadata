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
 * DBT Catalog, Manifest and Run Results file path config.
 */
export interface DbtLocalConfig {
    /**
     * DBT catalog file path to extract dbt models with their column schemas.
     */
    dbtCatalogFilePath?: string;
    /**
     * dbt Configuration type
     */
    dbtConfigType: DbtConfigType;
    /**
     * DBT manifest file path to extract dbt models and associate with tables.
     */
    dbtManifestFilePath: string;
    /**
     * DBT run results file path to extract the test results information.
     */
    dbtRunResultsFilePath?: string;
    /**
     * DBT sources file path to extract the freshness test result.
     */
    dbtSourcesFilePath?: string;
}

/**
 * dbt Configuration type
 */
export enum DbtConfigType {
    Local = "local",
}
