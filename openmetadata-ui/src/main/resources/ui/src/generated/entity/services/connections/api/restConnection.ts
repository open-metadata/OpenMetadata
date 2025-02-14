/*
 *  Copyright 2024 Collate.
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
 * REST Connection Config
 */
export interface RESTConnection {
    /**
     * Open API Schema URL.
     */
    openAPISchemaURL: string;
    /**
     * Supports Metadata Extraction.
     */
    supportsMetadataExtraction?: boolean;
    /**
     * Generated Token to connect to OpenAPI Schema.
     */
    token?: string;
    /**
     * REST API Type
     */
    type?: RESTType;
}

/**
 * REST API Type
 *
 * REST API type
 */
export enum RESTType {
    REST = "Rest",
}
