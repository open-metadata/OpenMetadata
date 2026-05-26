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
 * Generic AppMode primitives. The mode itself is just a string; modes
 * and their behaviour (routes, sidebar, styling) are contributed at
 * runtime through the `useAppModeRegistry` registry. OM core never names
 * specific modes — that's the consumer's job.
 */

export const APP_MODE_STORAGE_KEY = 'collate.appMode';
export const APP_MODE_CHANGE_EVENT = 'collate:app-mode-change';
export const DEFAULT_APP_MODE = 'default';
