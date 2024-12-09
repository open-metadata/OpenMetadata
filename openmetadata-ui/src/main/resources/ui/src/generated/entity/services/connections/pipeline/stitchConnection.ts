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
 * Stitch Connection
 */
export interface StitchConnection {
    /**
     * Host and port of the Stitch API host
     */
    hostPort:                    string;
    supportsMetadataExtraction?: boolean;
    /**
     * Token to connect to Stitch api doc
     */
    token: string;
    /**
     * Service Type
     */
    type?: StitchType;
}

/**
 * Service Type
 *
 * Service type.
 */
export enum StitchType {
    Stitch = "Stitch",
}
