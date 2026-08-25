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
 * OAuth2 Client Credentials configuration for webhook authentication.
 */
export interface WebhookOAuth2Config {
    /**
     * OAuth2 client identifier. Stored encrypted via Fernet.
     */
    clientId: string;
    /**
     * OAuth2 client secret. Stored encrypted via Fernet.
     */
    clientSecret: string;
    /**
     * Optional OAuth2 scopes to request (space-separated).
     */
    scope?: string;
    /**
     * Token endpoint URL to obtain access tokens.
     */
    tokenUrl: string;
    /**
     * Authentication type discriminator.
     */
    type: Type;
}

/**
 * Authentication type discriminator.
 */
export enum Type {
    Oauth2 = "oauth2",
}
