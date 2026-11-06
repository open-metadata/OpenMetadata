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
 * Authentication configuration for a self-hosted Prefect Server. Leave Basic Auth String
 * empty if the server has no auth enabled.
 */
export interface ServerAuth {
    /**
     * Self-hosted Prefect Server Basic Auth credential (PREFECT_SERVER_API_AUTH_STRING), format
     * 'user:password'. Leave empty if the server has no auth enabled.
     */
    authString?: string;
}
