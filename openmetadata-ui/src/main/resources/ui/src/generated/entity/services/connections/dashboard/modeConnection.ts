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
 * Mode Connection Config
 */
export interface ModeConnection {
    /**
     * Access Token for Mode Dashboard
     */
    accessToken: string;
    /**
     * Access Token Password for Mode Dashboard
     */
    accessTokenPassword: string;
    /**
     * Filter query parameter for some of the Mode API calls
     */
    filterQueryParam?: string;
    /**
     * URL for the mode instance.
     */
    hostPort?:                   string;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: ModeType;
    /**
     * Mode Workspace Name
     */
    workspaceName: string;
}

/**
 * Service Type
 *
 * Mode service type
 */
export enum ModeType {
    Mode = "Mode",
}
