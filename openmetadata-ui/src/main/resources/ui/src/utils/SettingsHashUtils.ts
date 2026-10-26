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
 * The settings-modal hash contract (`#<tab>/<subPath>`): a name or FQN in a
 * hash segment is URL-encoded exactly once by whoever builds the hash (each
 * panel's `viewToSubPath`, `settingsPathToHash`), so a space, `%`, `/`, `#` or
 * `?` stays inside its segment and survives the browser's own percent-encoding;
 * each panel's parser decodes it once with this. A malformed escape (a
 * hand-edited `#...%ZZ`) makes `decodeURIComponent` throw, which would unmount
 * the panel, so the raw value is kept instead. Dependency-free on purpose: the
 * panel utils import it, and tests mock their heavier neighbours.
 * ADR:2026-10-21-settings-pages-are-classic-only
 */
export const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
