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
 * DashboardService Metadata Pipeline Configuration.
 */
export interface DashboardServiceMetadataPipeline {
    /**
     * Regex exclude or include charts that matches the pattern.
     */
    chartFilterPattern?: FilterPattern;
    /**
     * Regex to exclude or include dashboards that matches the pattern.
     */
    dashboardFilterPattern?: FilterPattern;
    /**
     * Regex exclude or include data models that matches the pattern.
     */
    dataModelFilterPattern?: FilterPattern;
    /**
     * Optional configuration to toggle the ingestion of data models.
     */
    includeDataModels?: boolean;
    /**
     * Optional Configuration to include/exclude draft dashboards. By default it will include
     * draft dashboards
     */
    includeDraftDashboard?: boolean;
    /**
     * Enabling a flag will replace the current owner with a new owner from the source during
     * metadata ingestion, if the current owner is null. It is recommended to keep the flag
     * enabled to obtain the owner information during the first metadata ingestion.
     */
    includeOwners?: boolean;
    /**
     * Optional configuration to toggle the tags ingestion.
     */
    includeTags?: boolean;
    /**
     * Details required to generate Lineage
     */
    lineageInformation?: LineageInformation;
    /**
     * Optional configuration to soft delete dashboards in OpenMetadata if the source dashboards
     * are deleted. Also, if the dashboard is deleted, all the associated entities like lineage,
     * etc., with that dashboard will be deleted
     */
    markDeletedDashboards?: boolean;
    /**
     * Optional configuration to soft delete data models in OpenMetadata if the source data
     * models are deleted. Also, if the data models is deleted, all the associated entities like
     * lineage, etc., with that data models will be deleted
     */
    markDeletedDataModels?: boolean;
    /**
     * Set the 'Override Lineage' toggle to control whether to override the existing lineage.
     */
    overrideLineage?: boolean;
    /**
     * Set the 'Override Metadata' toggle to control whether to override the existing metadata
     * in the OpenMetadata server with the metadata fetched from the source. If the toggle is
     * set to true, the metadata fetched from the source will override the existing metadata in
     * the OpenMetadata server. If the toggle is set to false, the metadata fetched from the
     * source will not override the existing metadata in the OpenMetadata server. This is
     * applicable for fields like description, tags, owner and displayName
     */
    overrideMetadata?: boolean;
    /**
     * Regex to exclude or include projects that matches the pattern.
     */
    projectFilterPattern?: FilterPattern;
    /**
     * Pipeline type
     */
    type?: DashboardMetadataConfigType;
}

/**
 * Regex exclude or include charts that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to exclude or include dashboards that matches the pattern.
 *
 * Regex exclude or include data models that matches the pattern.
 *
 * Regex to exclude or include projects that matches the pattern.
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
 * Details required to generate Lineage
 */
export interface LineageInformation {
    /**
     * List of service path prefixes for lineage matching. Supported formats: DBServiceName,
     * DBServiceName.DatabaseName, DBServiceName.DatabaseName.SchemaName, or
     * DBServiceName.DatabaseName.SchemaName.TableName
     */
    dbServicePrefixes?: string[];
    [property: string]: any;
}

/**
 * Pipeline type
 *
 * Dashboard Source Config Metadata Pipeline type
 */
export enum DashboardMetadataConfigType {
    DashboardMetadata = "DashboardMetadata",
}
