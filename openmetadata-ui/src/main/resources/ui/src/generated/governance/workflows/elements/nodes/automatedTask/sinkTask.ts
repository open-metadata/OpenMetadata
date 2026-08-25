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
 * Pushes entity data to an external sink destination such as Git repositories, webhooks, or
 * HTTP endpoints.
 */
export interface SinkTask {
    branches?: string[];
    config:    SinkTaskConfiguration;
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
    name: string;
    /**
     * Variables this node outputs for use in subsequent nodes
     */
    output?:  string[];
    subType?: string;
    type?:    string;
}

export interface SinkTaskConfiguration {
    /**
     * If true, collect all entities and write in single operation (single git commit). If
     * false, write each entity individually.
     */
    batchMode?:       boolean;
    entityFilter?:    EntityFilter;
    hierarchyConfig?: HierarchyConfiguration;
    outputFormat?:    OutputFormat;
    /**
     * Inline sink-specific configuration. Schema depends on sinkType.
     */
    sinkConfig?: { [key: string]: any };
    sinkType:    SinkType;
    syncMode?:   SyncMode;
    /**
     * Timeout in seconds for sink operations.
     */
    timeoutSeconds?: number;
}

/**
 * Optional filter to select specific entities or entity types.
 */
export interface EntityFilter {
    /**
     * Filter entities by domain.
     */
    domains?: string[];
    /**
     * Filter entities by type (e.g., table, dashboard, glossaryTerm).
     */
    entityTypes?: string[];
    /**
     * Filter entities by tag.
     */
    tags?: string[];
}

/**
 * Configuration for maintaining asset hierarchy in output.
 */
export interface HierarchyConfiguration {
    /**
     * Maintain entity hierarchy in directory structure.
     */
    preserveHierarchy?: boolean;
    /**
     * Base directory path for output files.
     */
    rootPath?: string;
}

/**
 * Format for serialized entity output.
 */
export enum OutputFormat {
    JSON = "json",
    YAML = "yaml",
}

/**
 * Type of sink destination.
 */
export enum SinkType {
    Git = "git",
    HTTPEndpoint = "httpEndpoint",
    Webhook = "webhook",
}

/**
 * How entities should be synchronized to the sink.
 */
export enum SyncMode {
    Append = "append",
    Merge = "merge",
    Overwrite = "overwrite",
}

export interface InputNamespaceMap {
    relatedEntity: string;
    updatedBy?:    string;
}
