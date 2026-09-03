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
 * Safely read a value from a dispatch/lookup object using a dynamic (possibly
 * user-controlled) key. The record is copied into a `Map` and the value is read
 * through `Map.get`, so lookup never performs a computed member access on a
 * user-controlled name: a crafted key such as `constructor` or `__proto__` can
 * neither resolve to an inherited member nor be invoked as a handler.
 */
export const getOwnHandler = <T>(
  record: Record<string, T>,
  key: string | undefined
): T | undefined =>
  key === undefined ? undefined : new Map(Object.entries(record)).get(key);
