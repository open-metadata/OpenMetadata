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
 * Lightdash Connection Config
 */
export interface LightdashConnection {
    /**
     * The personal access token you can generate in the Lightdash app under the user settings
     */
    apiKey: string;
    /**
     * Address for your running Lightdash instance
     */
    hostPort: string;
    /**
     * The Project UUID for your Lightdash instance
     */
    projectUUID: string;
    /**
     * Use if your Lightdash instance is behind a proxy like (Cloud IAP)
     */
    proxyAuthentication?: string;
    /**
     * The Space UUID for your Lightdash instance
     */
    spaceUUID:                   string;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: LightdashType;
}

/**
 * Service Type
 *
 * Lightdash service type
 */
export enum LightdashType {
    Lightdash = "Lightdash",
}
