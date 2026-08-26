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
 * Short-lived sessionStorage buffer for the active persona selection.
 * Survives page refreshes within the same tab; cleared on new sessions
 * (tab close / logout) so a fresh login falls back to the server default.
 *
 * sessionStorage can throw in Safari Private Mode or when storage is
 * disabled by policy — every accessor silently degrades so the app still
 * works, refreshes just won't remember the selected persona.
 */
const SELECTED_PERSONA_SESSION_KEY = 'omSelectedPersona';

const hasWindow = (): boolean => typeof globalThis.window !== 'undefined';

export const writePersonaSession = (personaId: string): void => {
  if (!hasWindow()) {
    return;
  }
  try {
    globalThis.window.sessionStorage.setItem(
      SELECTED_PERSONA_SESSION_KEY,
      personaId
    );
  } catch {
    // quota-exceeded or storage disabled — in-memory store still holds the
    // selection, cross-refresh persistence is just unavailable.
  }
};

export const readPersonaSession = (): string | null => {
  if (!hasWindow()) {
    return null;
  }
  try {
    return globalThis.window.sessionStorage.getItem(
      SELECTED_PERSONA_SESSION_KEY
    );
  } catch {
    return null;
  }
};

export const clearPersonaSession = (): void => {
  if (!hasWindow()) {
    return;
  }
  try {
    globalThis.window.sessionStorage.removeItem(SELECTED_PERSONA_SESSION_KEY);
  } catch {
    // ignore
  }
};
