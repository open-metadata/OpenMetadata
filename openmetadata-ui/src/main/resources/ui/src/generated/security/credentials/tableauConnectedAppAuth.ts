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
 * Tableau connected app (direct trust) credentials. OpenMetadata signs a short-lived JWT
 * with the secret and signs in as the given Tableau user.
 */
export interface TableauConnectedAppAuth {
    /**
     * Client ID of the Tableau connected app.
     */
    clientId: string;
    /**
     * ID of the connected app secret.
     */
    secretId: string;
    /**
     * Value of the connected app secret.
     */
    secretValue: string;
    /**
     * Tableau user to sign in as; ingestion runs with this user's permissions. On Tableau Cloud
     * this is the user's email address.
     */
    username: string;
}
