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
 * Administrative MCP OAuth client inventory. Never includes client secrets or tokens.
 */
export interface OauthClient {
    /**
     * Number of stored access tokens that have not expired at the time of this inventory query.
     */
    activeAccessTokens?: number;
    /**
     * Number of stored refresh tokens that are neither expired nor revoked at the time of this
     * inventory query.
     */
    activeRefreshTokens?: number;
    clientId?:            string;
    clientName?:          string;
    issuedAt?:            number;
    redirectUris?:        string[];
}
