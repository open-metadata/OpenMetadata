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
 * Configuration for Git-based sinks using REST/GraphQL APIs. Supports GitHub (GraphQL),
 * GitLab (REST), and Bitbucket (REST).
 */
export interface GitSinkConfig {
    /**
     * Custom API base URL for GitHub Enterprise. Leave empty for github.com. Example:
     * https://github.mycompany.com/api
     */
    apiBaseUrl?: string;
    /**
     * Base directory path in the repository for metadata files.
     */
    basePath?: string;
    /**
     * Target branch for commits.
     */
    branch?: string;
    /**
     * Configuration for Git commits.
     */
    commitConfig?:       CommitConfiguration;
    conflictResolution?: ConflictResolution;
    /**
     * Authentication credentials for Git API operations.
     */
    credentials: GitCredentials;
    /**
     * Git repository URL (HTTPS format). Example: https://github.com/org/repo.git
     */
    repositoryUrl: string;
    /**
     * Configuration for retrying failed API calls.
     */
    retryConfig?: RetryConfiguration;
    /**
     * Configuration for embedding sync metadata in output files.
     */
    syncMetadata?: SyncMetadataConfiguration;
    /**
     * Timeout in seconds for API operations.
     */
    timeout?: number;
}

/**
 * Configuration for Git commits.
 */
export interface CommitConfiguration {
    /**
     * Git commit author email.
     */
    authorEmail?: string;
    /**
     * Git commit author name.
     */
    authorName?: string;
    /**
     * Template for commit messages. Variables: {entityType}, {entityName}, {action}, {count}
     */
    messageTemplate?: string;
}

/**
 * How to handle files that were modified directly in git.
 */
export enum ConflictResolution {
    Fail = "fail",
    OverwriteExternal = "overwriteExternal",
    PreserveExternal = "preserveExternal",
}

/**
 * Authentication credentials for Git API operations.
 */
export interface GitCredentials {
    /**
     * Personal access token or GitHub App token for authentication. Supports secret references
     * (e.g., secret:/path/to/token).
     */
    token: string;
    type:  CredentialsType;
}

/**
 * Type of authentication for Git API operations.
 */
export enum CredentialsType {
    Token = "token",
}

/**
 * Configuration for retrying failed API calls.
 */
export interface RetryConfiguration {
    /**
     * Maximum number of retry attempts for transient failures.
     */
    maxRetries?: number;
    /**
     * Maximum delay in seconds between retries (caps exponential backoff).
     */
    maxRetryDelaySeconds?: number;
    /**
     * Initial delay in seconds before first retry (doubles with each attempt).
     */
    retryDelaySeconds?: number;
}

/**
 * Configuration for embedding sync metadata in output files.
 */
export interface SyncMetadataConfiguration {
    /**
     * Embed _syncMetadata block in each YAML/JSON file for conflict detection and audit.
     */
    embed?: boolean;
}
