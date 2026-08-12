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
 * SAP BW/4HANA Pipeline Connection Config for Process Chain extraction.
 */
export interface SapBw4HanaPipelineConnection {
    /**
     * Schema name in HANA where BW/4HANA ABAP metadata tables reside (e.g. SAPHANADB). Check
     * your system with: SELECT SCHEMA_NAME FROM SYS.TABLES WHERE TABLE_NAME = 'RSOADSO'.
     */
    abapSchema?: string;
    /**
     * Host and port of the SAP HANA instance underlying BW/4HANA, e.g. hana-host:30015.
     */
    hostPort: string;
    /**
     * Password for the HANA database user.
     */
    password: string;
    /**
     * Regex to only include/exclude Process Chains that match the pattern.
     */
    pipelineFilterPattern?:      FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: SapBw4HanaPipelineType;
    /**
     * HANA database username with access to BW metadata tables.
     */
    username: string;
}

/**
 * Regex to only include/exclude Process Chains that match the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 */
export interface FilterPattern {
    /**
     * List of strings/regex patterns to match and exclude only database entities that match.
     */
    excludes?: string[];
    /**
     * List of strings/regex patterns to match and include only database entities that match.
     */
    includes?: string[];
}

/**
 * Service Type
 *
 * SAP BW/4HANA pipeline service type.
 */
export enum SapBw4HanaPipelineType {
    SapBw4HanaPipeline = "SapBw4HanaPipeline",
}
