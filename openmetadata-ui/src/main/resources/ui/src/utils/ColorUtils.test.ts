/*
 *  Copyright 2022 Collate.
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
  getAvatarColorClass,
  getFirstAlphanumeric,
  isLinearGradient,
} from './ColorUtils';

describe('ColorUtils', () => {
  describe('isLinearGradient', () => {
    it('should correctly identify linear gradient colors', () => {
      expect(
        isLinearGradient('linear-gradient(to right, #ff0000, #00ff00)')
      ).toBe(true);
      expect(isLinearGradient('linear-gradient(45deg, #ff0000, #00ff00)')).toBe(
        true
      );
      expect(
        isLinearGradient(
          'linear-gradient(to bottom, rgba(255,0,0,0.5), rgba(0,255,0,0.5))'
        )
      ).toBe(true);
      expect(
        isLinearGradient(
          'linear-gradient(90deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)'
        )
      ).toBe(true);
      expect(
        isLinearGradient('LINEAR-GRADIENT(to right, #ff0000, #00ff00)')
      ).toBe(true);

      expect(isLinearGradient('#ff0000')).toBe(false);
      expect(isLinearGradient('rgb(255, 0, 0)')).toBe(false);
      expect(isLinearGradient('rgba(255, 0, 0, 0.5)')).toBe(false);
      expect(isLinearGradient('red')).toBe(false);
      expect(isLinearGradient('transparent')).toBe(false);
      expect(isLinearGradient('hsl(0, 100%, 50%)')).toBe(false);
      expect(isLinearGradient('hsla(0, 100%, 50%, 0.5)')).toBe(false);
      expect(isLinearGradient('inherit')).toBe(false);
      expect(isLinearGradient('')).toBe(false);
    });
  });

  describe('getFirstAlphanumeric', () => {
    it('should return the first alphabet from name containing only alphabets', () => {
      const firstAlphabet = getFirstAlphanumeric('John Doe');

      expect(firstAlphabet).toBe('j');
    });

    it('should return the first alphanumeric character from name containing both alphabets and numbers', () => {
      let firstAlphabet = getFirstAlphanumeric('3John Doe');

      expect(firstAlphabet).toBe('3');

      firstAlphabet = getFirstAlphanumeric('John3 Doe');

      expect(firstAlphabet).toBe('j');
    });

    it('should return the first alphanumeric character from name containing special characters', () => {
      let firstAlphabet = getFirstAlphanumeric('[Software Engineer] John Doe');

      expect(firstAlphabet).toBe('s');

      firstAlphabet = getFirstAlphanumeric('(Product Manager] Jane Doe');

      expect(firstAlphabet).toBe('p');
    });

    it('should fallback to the first character if there is no alphanumeric character found', () => {
      const firstAlphabet = getFirstAlphanumeric('][/)([*');

      expect(firstAlphabet).toBe(']');
    });

    it('should return the first alphabet from name when it is not in english language', () => {
      let firstAlphabet = getFirstAlphanumeric('🚀Éclair');

      expect(firstAlphabet).toBe('é');

      firstAlphabet = getFirstAlphanumeric('ชานนท์');

      expect(firstAlphabet).toBe('ช');

      firstAlphabet = getFirstAlphanumeric('ño');

      expect(firstAlphabet).toBe('ñ');
    });
  });

  describe('getAvatarColorClass', () => {
    it('should return a solid utility-color class set for solid avatars', () => {
      const result = getAvatarColorClass('John Doe', true);

      expect(result.text).toBe('tw:text-fg-white');
      expect(result.container).toMatch(/tw:bg-utility-[a-z]+-500/);
    });

    it('should return an outlined utility-color class set for non-solid avatars', () => {
      const result = getAvatarColorClass('John Doe', false);

      expect(result.container).toMatch(/tw:bg-utility-[a-z]+-50\b/);
      expect(result.container).toMatch(/tw:border-utility-[a-z]+-200/);
      expect(result.text).toMatch(/tw:text-utility-[a-z]+-700/);
    });

    it('should be deterministic for the same name', () => {
      expect(getAvatarColorClass('Harsh Vador', true)).toEqual(
        getAvatarColorClass('Harsh Vador', true)
      );
    });

    it('should map the same name to the same color family across variants', () => {
      const solid = getAvatarColorClass('Jane Doe', true);
      const outlined = getAvatarColorClass('Jane Doe', false);
      const family = solid.container.match(/tw:bg-utility-([a-z]+)-500/)?.[1];

      expect(family).toBeDefined();
      expect(outlined.container).toContain(`tw:bg-utility-${family}-50`);
    });

    it('should not throw for an empty name', () => {
      expect(() => getAvatarColorClass('', true)).not.toThrow();
    });
  });
});
