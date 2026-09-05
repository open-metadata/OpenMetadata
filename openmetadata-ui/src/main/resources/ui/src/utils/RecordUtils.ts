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
 * user-controlled) key. The record is copied into a `Map` and the key is
 * validated with `Map.has` before `Map.get` is called, so lookup never performs
 * a computed member access on a user-controlled name and a crafted key such as
 * `constructor` or `__proto__` can neither resolve to an inherited member nor be
 * invoked as a handler. (This is the remediation recommended by CodeQL's
 * `js/unvalidated-dynamic-method-call` rule.)
 */
// Memoise the per-record lookup Map by record identity so a stable dispatch
// table (the common case — module-level constant maps) is copied into a Map
// once instead of on every call. WeakMap keeps this bounded by GC: an entry is
// released as soon as its record object is, so no explicit size cap is needed.
const lookupCache = new WeakMap<object, Map<string, unknown>>();

export const getOwnHandler = <T>(
  record: Record<string, T>,
  key: string | undefined
): T | undefined => {
  if (key === undefined) {
    return undefined;
  }

  let lookup = lookupCache.get(record);
  if (!lookup) {
    lookup = new Map(Object.entries(record));
    lookupCache.set(record, lookup);
  }

  return lookup.has(key) ? (lookup.get(key) as T) : undefined;
};
