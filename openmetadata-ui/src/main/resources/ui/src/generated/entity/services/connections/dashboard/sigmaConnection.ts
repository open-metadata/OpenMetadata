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
 * Sigma Connection Config
 */
export interface SigmaConnection {
    /**
     * Sigma API version.
     */
    apiVersion?: string;
    /**
     * client_id for Sigma.
     */
    clientId: string;
    /**
     * clientSecret for Sigma.
     */
    clientSecret: string;
    /**
     * Sigma API url.
     */
    hostPort: string;
    /**
     * Service Type
     */
    type?: SigmaType;
}

/**
 * Service Type
 *
 * Sigma service type
 */
export enum SigmaType {
    Sigma = "Sigma",
}
