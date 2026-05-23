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
 * Matillion Data Productivity Cloud Auth Config.
 */
export interface MatillionDPC {
    /**
     * OAuth2 Client ID for Matillion DPC authentication.
     */
    clientId?: string;
    /**
     * OAuth2 Client Secret for Matillion DPC authentication.
     */
    clientSecret?: string;
    /**
     * Personal Access Token for Matillion DPC. Alternative to OAuth2 Client Credentials.
     */
    personalAccessToken?: string;
    /**
     * Matillion DPC region. Determines the API base URL.
     */
    region?: Region;
    type?:   Type;
}

/**
 * Matillion DPC region. Determines the API base URL.
 */
export enum Region {
    Eu1 = "eu1",
    Us1 = "us1",
}

export enum Type {
    MatillionDPC = "MatillionDPC",
}
