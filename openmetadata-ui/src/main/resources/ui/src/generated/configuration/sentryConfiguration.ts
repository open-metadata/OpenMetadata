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
 * This schema defines the Sentry Configuration for error tracking and performance
 * monitoring.
 */
export interface SentryConfiguration {
    /**
     * Sentry Data Source Name (DSN) for the backend.
     */
    backendDsn?: string;
    /**
     * Enable Sentry SDK debug mode.
     */
    debug?: boolean;
    /**
     * Indicates whether Sentry error tracking is enabled.
     */
    enabled?: boolean;
    /**
     * Environment label sent to Sentry (e.g., development, staging, production).
     */
    environment?: string;
    /**
     * Server name reported to Sentry.
     */
    serverName?: string;
    /**
     * Sample rate for performance traces (0.0 to 1.0).
     */
    tracesSampleRate?: number;
    /**
     * Sentry Data Source Name (DSN) for the UI.
     */
    uiDsn?: string;
}
