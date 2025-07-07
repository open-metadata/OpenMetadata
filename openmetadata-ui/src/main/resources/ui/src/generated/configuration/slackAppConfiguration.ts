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
 * This schema defines the Slack App Information
 */
export interface SlackAppConfiguration {
    /**
     * Client Id of the Application
     */
    clientId: string;
    /**
     * Client Secret of the Application.
     */
    clientSecret: string;
    /**
     * Signing Secret of the Application. Confirm that each request comes from Slack by
     * verifying its unique signature.
     */
    signingSecret: string;
}
