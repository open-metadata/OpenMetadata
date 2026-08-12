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
 * Per-user UI preferences. Each entry is a typed discriminated union — see
 * preferences/*.json for concrete schemas.
 */
export interface UserPreferences {
    /**
     * List of typed per-user UI preferences (e.g. appMode). Each entry is a discriminated union
     * keyed by `type`.
     */
    preferences: AppModePreference[];
    /**
     * Last update time corresponding to the new version of the preferences in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * Unique identifier of the User this preferences bag belongs to.
     */
    userId: string;
}

/**
 * User preference for app-mode boot behavior (AI vs Classic).
 */
export interface AppModePreference {
    config: Config;
    type:   Type;
}

export interface Config {
    value: Value | null;
}

export enum Value {
    AI = "ai",
    Classic = "classic",
}

export enum Type {
    AppMode = "appMode",
}
