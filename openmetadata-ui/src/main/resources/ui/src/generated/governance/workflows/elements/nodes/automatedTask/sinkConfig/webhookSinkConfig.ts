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
 * Configuration for webhook-based sinks.
 */
export interface WebhookSinkConfig {
    /**
     * Authentication configuration for webhook requests.
     */
    authentication?: Authentication;
    /**
     * Configuration for batching multiple entities in a single request.
     */
    batchConfig?: BatchConfiguration;
    /**
     * HTTP endpoint URL for the webhook.
     */
    endpoint: string;
    /**
     * Additional HTTP headers to include in requests.
     */
    headers?:     { [key: string]: string };
    httpMethod?:  HTTPMethod;
    retryConfig?: RetryConfiguration;
    /**
     * Timeout in seconds for HTTP requests.
     */
    timeout?: number;
}

/**
 * Authentication configuration for webhook requests.
 */
export interface Authentication {
    /**
     * API key value.
     */
    apiKey?: string;
    /**
     * Header name for API key authentication.
     */
    headerName?: string;
    /**
     * Password for basic authentication.
     */
    password?: string;
    /**
     * Bearer token for authentication.
     */
    token?: string;
    type?:  AuthenticationType;
    /**
     * Username for basic authentication.
     */
    username?: string;
}

/**
 * Type of authentication for webhook requests.
 */
export enum AuthenticationType {
    APIKey = "apiKey",
    Basic = "basic",
    Bearer = "bearer",
    None = "none",
}

/**
 * Configuration for batching multiple entities in a single request.
 */
export interface BatchConfiguration {
    /**
     * Maximum number of entities per request.
     */
    batchSize?: number;
    /**
     * Send multiple entities in a single request.
     */
    enabled?: boolean;
}

/**
 * HTTP method to use for the webhook request.
 */
export enum HTTPMethod {
    Patch = "PATCH",
    Post = "POST",
    Put = "PUT",
}

export interface RetryConfiguration {
    maxRetries?:        number;
    retryDelaySeconds?: number;
}
