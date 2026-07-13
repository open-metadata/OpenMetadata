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
 * Generic AppMode primitives.
 *
 * The active mode is a string. OM core stays mode-agnostic — it knows
 * about the abstraction (a current mode value, a registry to look up
 * mode-specific routes) but never names specific modes. Consumers
 * (plugins, themes) register their modes at runtime through
 * `useAppRoutesRegistry`. The mode is persisted to `localStorage` via
 * Zustand persist middleware (see `useAppModeStore`).
 */

export const APP_MODE_STORAGE_KEY = 'om.appMode';

export const DEFAULT_APP_MODE = 'default';
