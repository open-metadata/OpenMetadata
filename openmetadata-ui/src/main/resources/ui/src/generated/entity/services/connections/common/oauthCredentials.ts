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
 * OAuth 2.0 credentials for connector authentication (stored for internal use by
 * OpenMetadata MCP server)
 */
export interface OauthCredentials {
    /**
     * Current access token (automatically refreshed when expired)
     */
    accessToken?: string;
    /**
     * OAuth 2.0 client identifier for the connector application
     */
    clientId: string;
    /**
     * OAuth 2.0 client secret (encrypted via SecretsManager)
     */
    clientSecret: string;
    /**
     * Unix timestamp (seconds since epoch) when the access token expires. Uses int64 to avoid
     * Y2038 overflow.
     */
    expiresAt?: number;
    /**
     * Long-lived refresh token for automatic access token renewal without user interaction
     */
    refreshToken: string;
    /**
     * List of OAuth scopes granted to this application
     */
    scopes?: string[];
    /**
     * OAuth token endpoint for internal token refresh operations. If not specified, will be
     * inferred from connector configuration.
     */
    tokenEndpoint?: string;
}
