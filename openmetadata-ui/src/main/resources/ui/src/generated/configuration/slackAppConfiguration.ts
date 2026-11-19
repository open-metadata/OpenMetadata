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
 * This schema defines the Slack App Information
 */
export interface SlackAppConfiguration {
    /**
     * App-level token (xapp-*) required for Socket Mode. Generate from Slack app settings under
     * App-Level Tokens with connections:write scope.
     */
    appToken?: string;
    /**
     * Bot Token
     */
    botToken?: string;
    /**
     * Client Id of the Application
     */
    clientId: string;
    /**
     * Client Secret of the Application.
     */
    clientSecret: string;
    /**
     * Connection mode for receiving Slack events. Webhook (recommended, and Slack's guidance
     * for production) receives events on a public HTTP endpoint and scales horizontally behind
     * a load balancer. SocketMode uses an outbound WebSocket connection for single-instance
     * deployments that cannot expose a public endpoint (on-prem/firewalled).
     */
    connectionMode?: ConnectionMode;
    /**
     * Signing Secret of the Application. Confirm that each request comes from Slack by
     * verifying its unique signature.
     */
    signingSecret: string;
    /**
     * User Token
     */
    userToken?: string;
}

/**
 * Connection mode for receiving Slack events. Webhook (recommended, and Slack's guidance
 * for production) receives events on a public HTTP endpoint and scales horizontally behind
 * a load balancer. SocketMode uses an outbound WebSocket connection for single-instance
 * deployments that cannot expose a public endpoint (on-prem/firewalled).
 */
export enum ConnectionMode {
    SocketMode = "SocketMode",
    Webhook = "Webhook",
}
