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

import type { PersonaView } from './Personas.types';
import {
  hashSubPathToView,
  isFullscreenPersonaCategory,
  isFullscreenPersonaHash,
  viewToSubPath,
} from './Personas.utils';

describe('Personas.utils', () => {
  describe('hashSubPathToView', () => {
    it('maps empty sub-path to the landing view', () => {
      expect(hashSubPathToView('')).toEqual({ type: 'landing' });
    });

    it('maps "add" to the add view', () => {
      expect(hashSubPathToView('add')).toEqual({ type: 'add' });
    });

    it('maps a bare fqn to the detail view', () => {
      expect(hashSubPathToView('data-steward')).toEqual({
        type: 'detail',
        fqn: 'data-steward',
        name: 'data-steward',
      });
    });

    it('maps "<fqn>/customize/<category>" to the customize view', () => {
      expect(hashSubPathToView('data-steward/customize/navigation')).toEqual({
        type: 'customize',
        fqn: 'data-steward',
        name: 'data-steward',
        category: 'navigation',
      });
    });
  });

  describe('viewToSubPath', () => {
    it('returns undefined for the landing view', () => {
      expect(viewToSubPath({ type: 'landing' })).toBeUndefined();
    });

    it('returns "add" for the add view', () => {
      expect(viewToSubPath({ type: 'add' })).toBe('add');
    });

    it('returns the fqn for the detail view', () => {
      expect(
        viewToSubPath({ type: 'detail', fqn: 'data-steward', name: 'x' })
      ).toBe('data-steward');
    });

    it('encodes the customize view with the category', () => {
      expect(
        viewToSubPath({
          type: 'customize',
          fqn: 'data-steward',
          name: 'x',
          category: 'app-layout',
        })
      ).toBe('data-steward/customize/app-layout');
    });
  });

  describe('round-trip', () => {
    const views: PersonaView[] = [
      { type: 'landing' },
      { type: 'add' },
      { type: 'detail', fqn: 'data-steward', name: 'data-steward' },
      {
        type: 'customize',
        fqn: 'data-steward',
        name: 'data-steward',
        category: 'askCollateSidebar',
      },
    ];

    it.each(views)('survives view → subPath → view for %o', (view) => {
      expect(hashSubPathToView(viewToSubPath(view) ?? '')).toEqual(view);
    });
  });

  describe('isFullscreenPersonaCategory', () => {
    it.each([
      'homepage',
      'LandingPage',
      'governance/Domain',
      'data-assets/Table',
    ])('is fullscreen for %s', (category) => {
      expect(isFullscreenPersonaCategory(category)).toBe(true);
    });

    it.each(['navigation', 'DataMarketplace', 'governance', 'data-assets'])(
      'stays in the modal for %s',
      (category) => {
        expect(isFullscreenPersonaCategory(category)).toBe(false);
      }
    );
  });

  describe('isFullscreenPersonaHash', () => {
    it('is true only for a personas customize hash on a fullscreen category', () => {
      expect(
        isFullscreenPersonaHash('personas', 'p1/customize/data-assets/Table')
      ).toBe(true);
      expect(
        isFullscreenPersonaHash('personas', 'p1/customize/governance')
      ).toBe(false);
      expect(isFullscreenPersonaHash('personas', 'p1')).toBe(false);
      expect(isFullscreenPersonaHash('bots', 'p1/customize/homepage')).toBe(
        false
      );
      expect(isFullscreenPersonaHash(null, '')).toBe(false);
    });
  });
});
