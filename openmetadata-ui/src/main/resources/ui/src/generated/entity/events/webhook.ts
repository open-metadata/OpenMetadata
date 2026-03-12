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
     * Authentication configuration for the webhook.
     */
    authType?: WebhookNoAuth | WebhookBearerAuth | WebhookOAuth2Config;
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

export interface WebhookNoAuth {
    type: WebhookAuthType.None;
}

export interface WebhookBearerAuth {
    type: WebhookAuthType.Bearer;
    secretKey: string;
}

export interface WebhookOAuth2Config {
    type: WebhookAuthType.OAuth2;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
}

export enum WebhookAuthType {
    None = "none",
    Bearer = "bearer",
    OAuth2 = "oauth2",
}

/**
 * HTTP operation to send the webhook request. Supports POST or PUT.
 */
export enum HTTPMethod {
    Post = "POST",
    Put = "PUT",
}
