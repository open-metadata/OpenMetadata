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
 * App Run Record.
 */
export interface AppLogRecord {
    /**
     * Unique identifier of this application for which the job is ran.
     */
    appId: string;
    /**
     * Name of the application.
     */
    appName: string;
    /**
     * An exception associated with the log.
     */
    exception?: Exception;
    /**
     * Extension type.
     */
    extension: string;
    /**
     * Level of the log.
     */
    level: Level;
    /**
     * Message of the log.
     */
    message: string;
    /**
     * An identifier of the app run. Depends on the context of the application.
     */
    runId?: string;
    /**
     * Update time of the job status.
     */
    timestamp: number;
}

/**
 * An exception associated with the log.
 */
export interface Exception {
    message?:    string;
    name?:       string;
    stackTrace?: string;
    [property: string]: any;
}

/**
 * Level of the log.
 */
export enum Level {
    Debug = "DEBUG",
    Error = "ERROR",
    Info = "INFO",
    Warn = "WARN",
}
