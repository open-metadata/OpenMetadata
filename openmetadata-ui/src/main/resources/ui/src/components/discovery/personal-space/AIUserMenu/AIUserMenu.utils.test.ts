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

import { User } from '../../../../generated/entity/teams/user';
import { getLanguageName, getUserPersonas } from './AIUserMenu.utils';

const persona = (id: string) => ({ id, name: id, type: 'persona' });

describe('AIUserMenu utils', () => {
  describe('getUserPersonas', () => {
    it('returns no personas for a missing user', () => {
      expect(getUserPersonas()).toEqual([]);
    });

    it('merges assigned, inherited and default personas without duplicates', () => {
      const user = {
        personas: [persona('a'), persona('b')],
        inheritedPersonas: [persona('b'), persona('c')],
        defaultPersona: persona('a'),
      } as User;

      expect(getUserPersonas(user).map(({ id }) => id)).toEqual([
        'a',
        'b',
        'c',
      ]);
    });
  });

  describe('getLanguageName', () => {
    it('returns the native name of a supported locale', () => {
      expect(getLanguageName('en-US')).toBe('English');
      expect(getLanguageName('ja-JP')).toBe('日本語');
    });

    it('falls back to the locale code when it is not supported', () => {
      expect(getLanguageName('xx-XX')).toBe('xx-XX');
    });
  });
});
