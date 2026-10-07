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
 * App-wide UI configuration. It exists both in the server configuration (yaml/env) and in
 * the database, and configSource.app (APP_CONFIG_SOURCE, default DB) decides which one
 * wins. In DB mode the stored value wins, and the server configuration only fills values
 * the stored setting lacks.
 */
export interface AppConfiguration {
    /**
     * Tenant-wide 'first impression' app-mode default. Seeds the app mode for users who have
     * not chosen one; user preference and persona-level app mode still win over this default.
     * Null means no tenant default is configured.
     */
    defaultAppMode?: DefaultAppMode | null;
}

export enum DefaultAppMode {
    AI = "ai",
    Classic = "classic",
}
