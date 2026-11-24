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

import {
  clearPersonaSession,
  readPersonaSession,
  writePersonaSession,
} from './PersonaSessionUtils';

const KEY = 'omSelectedPersona';

describe('PersonaSessionUtils', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  describe('writePersonaSession', () => {
    it('persists the persona id to sessionStorage', () => {
      writePersonaSession('persona-123');

      expect(sessionStorage.getItem(KEY)).toBe('persona-123');
    });

    it('overwrites a previously stored value', () => {
      writePersonaSession('old-id');
      writePersonaSession('new-id');

      expect(sessionStorage.getItem(KEY)).toBe('new-id');
    });

    it('silently does nothing when sessionStorage throws', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      expect(() => writePersonaSession('persona-123')).not.toThrow();
    });

    it('does nothing when window is undefined', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error — intentionally removing window to test the guard
      delete globalThis.window;

      try {
        writePersonaSession('persona-123');

        expect(sessionStorage.getItem(KEY)).toBeNull();
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });

  describe('readPersonaSession', () => {
    it('returns null when nothing has been written', () => {
      expect(readPersonaSession()).toBeNull();
    });

    it('returns the stored persona id after a write', () => {
      sessionStorage.setItem(KEY, 'persona-abc');

      expect(readPersonaSession()).toBe('persona-abc');
    });

    it('returns null when sessionStorage throws', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('SecurityError');
      });

      expect(readPersonaSession()).toBeNull();
    });

    it('returns null when window is undefined', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error — intentionally removing window to test the guard
      delete globalThis.window;

      try {
        expect(readPersonaSession()).toBeNull();
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });

  describe('clearPersonaSession', () => {
    it('removes the stored persona id', () => {
      sessionStorage.setItem(KEY, 'persona-xyz');
      clearPersonaSession();

      expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('is idempotent when nothing is stored', () => {
      expect(() => clearPersonaSession()).not.toThrow();

      expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('silently does nothing when sessionStorage throws', () => {
      jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('SecurityError');
      });

      expect(() => clearPersonaSession()).not.toThrow();
    });

    it('does nothing when window is undefined', () => {
      sessionStorage.setItem(KEY, 'persona-xyz');
      const originalWindow = globalThis.window;
      // @ts-expect-error — intentionally removing window to test the guard
      delete globalThis.window;

      try {
        clearPersonaSession();
      } finally {
        globalThis.window = originalWindow;
      }

      expect(sessionStorage.getItem(KEY)).toBe('persona-xyz');
    });
  });

  describe('write → read → clear round-trip', () => {
    it('stores, retrieves, and removes a persona id', () => {
      writePersonaSession('round-trip-id');

      expect(readPersonaSession()).toBe('round-trip-id');

      clearPersonaSession();

      expect(readPersonaSession()).toBeNull();
    });
  });
});
