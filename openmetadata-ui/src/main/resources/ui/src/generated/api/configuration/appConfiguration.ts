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
 * App-wide UI configuration set by the deployment operator via yaml/env. Not backed by the
 * database; not mutable at runtime.
 */
export interface AppConfiguration {
    /**
     * Tenant-wide app-mode force. Non-null pins every user to this mode at boot regardless of
     * their per-user preference; null means user preference wins.
     */
    defaultAppMode?: DefaultAppMode | null;
}

export enum DefaultAppMode {
    AI = "ai",
    Classic = "classic",
}
