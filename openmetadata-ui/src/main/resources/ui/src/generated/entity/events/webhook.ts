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
 * This schema defines webhook for receiving events from OpenMetadata.
 */
export interface Webhook {
    /**
     * Authentication configuration for the webhook. If not specified, the webhook will be sent
     * without authentication.
     */
    authType?: AuthenticationConfigurationType;
    /**
     * Endpoint to receive the webhook events over POST requests.
     */
    endpoint?: string;
    /**
     * Custom headers to be sent with the webhook request.
     */
    headers?: { [key: string]: any };
    /**
     * HTTP operation to send the webhook request. Supports POST or PUT.
     */
    httpMethod?: HTTPMethod;
    /**
     * Query parameters to be added to the webhook request URL.
     */
    queryParams?: { [key: string]: any };
    /**
     * List of receivers to send mail to
     */
    receivers?: string[];
    /**
     * Send the Event to Admins
     */
    sendToAdmins?: boolean;
    /**
     * Send the Event to Followers
     */
    sendToFollowers?: boolean;
    /**
     * Send the Event to Owners
     */
    sendToOwners?: boolean;
}

/**
 * Authentication configuration for the webhook. If not specified, the webhook will be sent
 * without authentication.
 *
 * No authentication.
 *
 * Bearer token authentication for webhook endpoints.
 *
 * OAuth2 Client Credentials configuration for webhook authentication.
 */
export interface AuthenticationConfigurationType {
    /**
     * Authentication type discriminator.
     */
    type: Type;
    /**
     * Secret key used for computing HMAC SHA256 signature of webhook payload, sent in the
     * X-OM-Signature header.
     */
    secretKey?: string;
    /**
     * OAuth2 client identifier. Stored encrypted via Fernet.
     */
    clientId?: string;
    /**
     * OAuth2 client secret. Stored encrypted via Fernet.
     */
    clientSecret?: string;
    /**
     * Optional OAuth2 scopes to request (space-separated).
     */
    scope?: string;
    /**
     * Token endpoint URL to obtain access tokens.
     */
    tokenUrl?: string;
}

/**
 * Authentication type discriminator.
 */
export enum Type {
    Bearer = "bearer",
    None = "none",
    Oauth2 = "oauth2",
}

/**
 * HTTP operation to send the webhook request. Supports POST or PUT.
 */
export enum HTTPMethod {
    Post = "POST",
    Put = "PUT",
}
