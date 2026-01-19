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
 * Base AWS configuration for authentication. Supports static credentials, IAM roles, and
 * default credential provider chain.
 */
export interface AwsBaseConfig {
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
     * Custom endpoint URL for AWS-compatible services (MinIO, LocalStack).
     */
    endpointUrl?: string;
    /**
     * AWS Region (e.g., us-east-1). When set, enables AWS authentication.
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
