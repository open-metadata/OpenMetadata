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
 * dbt Cloud configuration.
 */
export interface DbtCloudConfig {
    /**
     * dbt cloud account Id
     */
    dbtCloudAccountId: string;
    /**
     * dbt cloud account authentication token
     */
    dbtCloudAuthToken: string;
    /**
     * When no job IDs are set, extract the dbt run artifacts from the latest completed run of
     * every job of the project (or of the account, when no project is set) instead of only the
     * most recent run. CI jobs are skipped.
     */
    dbtCloudIngestAllJobs?: boolean;
    /**
     * Comma-separated IDs of the dbt cloud jobs to extract the dbt run artifacts from, using
     * the latest completed run of each job. If left empty, the artifacts of the most recent
     * completed run across all jobs are used.
     */
    dbtCloudJobId?: string;
    /**
     * In case of multiple projects in a dbt cloud account, specify the project's id from which
     * you want to extract the dbt run artifacts
     */
    dbtCloudProjectId?: string;
    /**
     * URL to connect to your dbt cloud instance. E.g., https://cloud.getdbt.com or
     * https://emea.dbt.com/
     */
    dbtCloudUrl: string;
    /**
     * dbt Configuration type
     */
    dbtConfigType: DbtConfigType;
}

/**
 * dbt Configuration type
 */
export enum DbtConfigType {
    Cloud = "cloud",
}
