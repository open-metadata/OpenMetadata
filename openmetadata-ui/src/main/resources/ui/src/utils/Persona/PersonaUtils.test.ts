/*
 *  Copyright 2024 Collate.
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
import { PageType } from '../../generated/system/ui/uiCustomization';
import {
  getCustomizePageCategories,
  getCustomizePageOptions,
} from './PersonaUtils';

describe('PersonaUtils', () => {
  describe('getCustomizePageCategories', () => {
    it('should return the correct categories', () => {
      const categories = getCustomizePageCategories();

      expect(categories).toEqual([
        expect.objectContaining({
          key: 'navigation',
          label: 'label.navigation',
          icon: 'svg-mock',
        }),
        expect.objectContaining({
          key: PageType.LandingPage,
          label: 'label.homepage',
          icon: 'svg-mock',
        }),
        expect.objectContaining({
          key: 'governance',
          label: 'label.governance',
          icon: 'svg-mock',
        }),
        expect.objectContaining({
          key: 'data-assets',
          label: 'label.data-asset-plural',
          icon: 'svg-mock',
        }),
      ]);
    });
  });

  describe('getCustomizePageOptions', () => {
    it('should return the correct options for governance category', () => {
      const options = getCustomizePageOptions('governance');

      expect(options).toEqual([
        expect.objectContaining({
          key: PageType.Domain,
          label: 'Domain',
          icon: 'svg-mock',
        }),
        expect.objectContaining({
          key: PageType.Glossary,
          label: 'Glossary',
          icon: 'svg-mock',
        }),
        expect.objectContaining({
          key: PageType.GlossaryTerm,
          label: 'Glossary Term',
          icon: 'svg-mock',
        }),
      ]);
    });

    it('should return the correct options for data-assets category', () => {
      const options = getCustomizePageOptions('data-assets');

      expect(options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: PageType.Dashboard,
            label: 'Dashboard',
            icon: 'svg-mock',
          }),
          expect.objectContaining({
            key: PageType.Database,
            label: 'Database',
            icon: 'svg-mock',
          }),
          expect.objectContaining({
            key: PageType.Pipeline,
            label: 'Pipeline',
            icon: 'svg-mock',
          }),
          expect.objectContaining({
            key: PageType.Table,
            label: 'Table',
            icon: 'svg-mock',
          }),
          expect.objectContaining({
            key: PageType.Container,
            label: 'Container',
            icon: 'svg-mock',
          }),
        ])
      );
    });

    it('should return an empty array for an unknown category', () => {
      const options = getCustomizePageOptions('unknown-category');

      expect(options).toEqual([]);
    });
  });
});
