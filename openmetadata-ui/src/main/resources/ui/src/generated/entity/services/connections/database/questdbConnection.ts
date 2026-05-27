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
 * QuestDB Connection Config
 */
export interface QuestdbConnection {
    /**
     * Choose Auth Config Type.
     */
    authType:             AuthConfigurationType;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Host and port of the QuestDB service (default PostgreSQL wire protocol port is 8812).
     */
    hostPort: string;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?:                        QuestDBScheme;
    supportsMetadataExtraction?:    boolean;
    supportsViewLineageExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: QuestDBType;
    /**
     * Username to connect to QuestDB.
     */
    username: string;
}

/**
 * Choose Auth Config Type.
 *
 * Common Database Connection Config
 */
export interface AuthConfigurationType {
    /**
     * Password to connect to source.
     */
    password?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum QuestDBScheme {
    PostgresqlPsycopg2 = "postgresql+psycopg2",
}

/**
 * Regex to only include/exclude tables that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 */
export interface FilterPattern {
    /**
     * List of strings/regex patterns to match and exclude only database entities that match.
     */
    excludes?: string[];
    /**
     * List of strings/regex patterns to match and include only database entities that match.
     */
    includes?: string[];
}

/**
 * Service Type
 *
 * Service type.
 */
export enum QuestDBType {
    QuestDB = "QuestDB",
}
