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
 * OAuth2 Machine-to-Machine authentication using Service Principal credentials for
 * Databricks.
 */
export interface DatabricksOAuth {
    /**
     * Service Principal Application ID created in your Databricks Account Console for OAuth
     * Machine-to-Machine authentication.
     */
    clientId: string;
    /**
     * OAuth Secret generated for the Service Principal in Databricks Account Console. Used for
     * secure OAuth2 authentication.
     */
    clientSecret: string;
}
