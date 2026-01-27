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
 * Authentication configuration for Dremio Cloud using Personal Access Token (PAT). Dremio
 * Cloud is a fully managed SaaS platform.
 */
export interface CloudAuth {
    /**
     * Personal Access Token for authenticating with Dremio Cloud. Generate this token from your
     * Dremio Cloud account settings under Settings -> Personal Access Tokens.
     */
    personalAccessToken: string;
    /**
     * Dremio Cloud Project ID (required). This unique identifier can be found in your Dremio
     * Cloud project URL or project settings.
     */
    projectId: string;
    /**
     * Dremio Cloud region where your organization is hosted. Choose 'US' for United States
     * region or 'EU' for European region.
     */
    region: CloudRegion;
}

/**
 * Dremio Cloud region where your organization is hosted. Choose 'US' for United States
 * region or 'EU' for European region.
 */
export enum CloudRegion {
    Eu = "EU",
    Us = "US",
}
