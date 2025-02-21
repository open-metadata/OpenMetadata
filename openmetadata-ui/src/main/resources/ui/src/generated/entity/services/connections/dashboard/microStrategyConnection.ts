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
 * MicroStrategy Connection Config
 */
export interface MicroStrategyConnection {
    /**
     * Host and Port of the MicroStrategy instance.
     */
    hostPort: string;
    /**
     * Login Mode for Microstrategy's REST API connection. You can authenticate with one of the
     * following authentication modes: `Standard (1)`, `Anonymous (8)`. Default will be
     * `Standard (1)`. If you're using demo account for Microstrategy, it will be needed to
     * authenticate through loginMode `8`.
     */
    loginMode?: string;
    /**
     * Password to connect to MicroStrategy.
     */
    password: string;
    /**
     * MicroStrategy Project Name
     */
    projectName?:                string;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: MicroStrategyType;
    /**
     * Username to connect to MicroStrategy. This user should have privileges to read all the
     * metadata in MicroStrategy.
     */
    username: string;
}

/**
 * Service Type
 *
 * MicroStrategy service type
 */
export enum MicroStrategyType {
    MicroStrategy = "MicroStrategy",
}
