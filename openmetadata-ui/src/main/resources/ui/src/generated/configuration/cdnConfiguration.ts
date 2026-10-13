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
 * This schema defines the CDN Configuration for serving the UI's static assets from a CDN.
 * It is disabled by default and not exposed in the default openmetadata.yaml; downstream
 * distributions can bind it from their own configuration.
 */
export interface CDNConfiguration {
    /**
     * CDN base URL, without the application version and without a trailing slash.
     */
    baseUrl?: string;
    /**
     * Indicates whether static assets are served from the CDN.
     */
    enabled?: boolean;
}
