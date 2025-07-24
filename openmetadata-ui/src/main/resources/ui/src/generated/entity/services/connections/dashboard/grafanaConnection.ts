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
 * Grafana Connection Config
 */
export interface GrafanaConnection {
    /**
     * Service Account Token to authenticate to the Grafana APIs. Use Service Account Tokens
     * (format: glsa_xxxx) for authentication. Legacy API Keys are no longer supported by
     * Grafana as of January 2025. Both self-hosted and Grafana Cloud are supported. Requires
     * Admin role for full metadata extraction.
     */
    apiKey: string;
    /**
     * URL to the Grafana instance.
     */
    hostPort: string;
    /**
     * Page size for pagination in API requests. Default is 100.
     */
    pageSize?:                   number;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: GrafanaType;
    /**
     * Boolean marking if we need to verify the SSL certs for Grafana. Default to True.
     */
    verifySSL?: boolean;
}

/**
 * Service Type
 *
 * Grafana service type
 */
export enum GrafanaType {
    Grafana = "Grafana",
}
