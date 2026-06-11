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
 * Platform-wide configuration for LLM chat/completion providers. Generic - usable by any
 * feature that needs structured LLM completions.
 */
export interface LlmConfiguration {
    anthropic?: Anthropic;
    bedrock?:   Bedrock;
    /**
     * Whether LLM completion features are enabled.
     */
    enabled?: boolean;
    google?:  Google;
    /**
     * Maximum number of concurrent LLM completion requests.
     */
    maxConcurrentRequests?: number;
    openai?:                Openai;
    provider?:              LlmProvider;
}

export interface Anthropic {
    apiKey?:         string;
    baseUrl?:        string;
    maxTokens?:      number;
    modelId?:        string;
    temperature?:    number;
    timeoutSeconds?: number;
}

export interface Bedrock {
    /**
     * AWS credentials configuration for Bedrock service.
     */
    awsConfig?:      AWSBaseConfig;
    maxTokens?:      number;
    modelId?:        string;
    temperature?:    number;
    timeoutSeconds?: number;
}

/**
 * AWS credentials configuration for Bedrock service.
 *
 * Base AWS configuration for authentication. Supports static credentials, IAM roles, and
 * default credential provider chain.
 */
export interface AWSBaseConfig {
    /**
     * AWS Access Key ID. Falls back to default credential provider chain if not set.
     */
    accessKeyId?: string;
    /**
     * ARN of IAM role to assume for cross-account access.
     */
    assumeRoleArn?: string;
    /**
     * Session name for assumed role.
     */
    assumeRoleSessionName?: string;
    /**
     * Enable AWS IAM authentication. When enabled, uses the default credential provider chain
     * (environment variables, instance profile, etc.). Defaults to false for backward
     * compatibility.
     */
    enabled?: boolean;
    /**
     * Custom endpoint URL for AWS-compatible services (MinIO, LocalStack).
     */
    endpointUrl?: string;
    /**
     * AWS Region (e.g., us-east-1). Required when AWS authentication is enabled.
     */
    region?: string;
    /**
     * AWS Secret Access Key. Falls back to default credential provider chain if not set.
     */
    secretAccessKey?: string;
    /**
     * AWS Session Token for temporary credentials.
     */
    sessionToken?: string;
}

export interface Google {
    apiKey?:         string;
    endpoint?:       string;
    maxTokens?:      number;
    modelId?:        string;
    temperature?:    number;
    timeoutSeconds?: number;
}

export interface Openai {
    apiKey?:         string;
    apiVersion?:     string;
    deploymentName?: string;
    endpoint?:       string;
    maxTokens?:      number;
    modelId?:        string;
    temperature?:    number;
    timeoutSeconds?: number;
}

/**
 * Supported LLM completion providers.
 */
export enum LlmProvider {
    Anthropic = "anthropic",
    AzureOpenAI = "azureOpenAI",
    Bedrock = "bedrock",
    Google = "google",
    Noop = "noop",
    Openai = "openai",
}
