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
 * Hex Connection Config
 */
export interface HexConnection {
    /**
     * Hex API URL. For Hex.tech cloud, use https://app.hex.tech
     */
    hostPort: string;
    /**
     * Whether to import Hex project categories as OpenMetadata tags
     */
    includeCategories?:          boolean;
    supportsMetadataExtraction?: boolean;
    /**
     * Hex API token for authentication. Can be personal or workspace token.
     */
    token: string;
    /**
     * Type of token to use for authentication
     */
    tokenType?: TokenType;
    /**
     * Service Type
     */
    type?: HexType;
}

/**
 * Type of token to use for authentication
 */
export enum TokenType {
    Personal = "personal",
    Workspace = "workspace",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum HexType {
    Hex = "Hex",
}
