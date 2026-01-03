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
 * Authentication configuration for self-hosted Dremio Software using username and password.
 * Dremio Software is deployed on-premises or in your own cloud infrastructure.
 */
export interface SoftwareAuth {
    /**
     * URL to your self-hosted Dremio Software instance, including protocol and port (e.g.,
     * http://localhost:9047 or https://dremio.example.com:9047).
     */
    hostPort: string;
    /**
     * Password for the Dremio Software user account.
     */
    password: string;
    /**
     * Username for authenticating with Dremio Software. This user should have appropriate
     * permissions to access metadata.
     */
    username: string;
}
