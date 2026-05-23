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
          label: 'label.home-page',
          icon: 'svg-mock',
        }),
        expect.objectContaining({
          key: PageType.DataMarketplace,
          label: 'label.data-marketplace',
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

      expect(options).toHaveLength(4);
      expect(options).toEqual([
        expect.objectContaining({
          key: PageType.DataProduct,
          label: 'Data Product',
          icon: 'svg-mock',
        }),
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

    it('should only include governance entities in governance category', () => {
      const options = getCustomizePageOptions('governance');
      const keys = options.map((option) => option.key);

      expect(keys).toEqual([
        PageType.DataProduct,
        PageType.Domain,
        PageType.Glossary,
        PageType.GlossaryTerm,
      ]);
    });

    it('should return the correct options for data-assets category', () => {
      const options = getCustomizePageOptions('data-assets');

      expect(options).toHaveLength(19);
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

    it('should exclude governance and special entities from data-assets category', () => {
      const options = getCustomizePageOptions('data-assets');
      const keys = options.map((option) => option.key);

      expect(options).toHaveLength(19);
      expect(keys).not.toContain(PageType.Glossary);
      expect(keys).not.toContain(PageType.GlossaryTerm);
      expect(keys).not.toContain(PageType.Domain);
      expect(keys).not.toContain(PageType.DataProduct);
      expect(keys).not.toContain(PageType.LandingPage);
      expect(keys).not.toContain(PageType.Tag);
      expect(keys).not.toContain(PageType.Classification);
    });

    it('should include all other entities in data-assets category', () => {
      const options = getCustomizePageOptions('data-assets');
      const keys = options.map((option) => option.key);

      expect(options).toHaveLength(19);
      expect(keys).toContain(PageType.APICollection);
      expect(keys).toContain(PageType.APIEndpoint);
      expect(keys).toContain(PageType.Chart);
      expect(keys).toContain(PageType.Container);
      expect(keys).toContain(PageType.Dashboard);
      expect(keys).toContain(PageType.DashboardDataModel);
      expect(keys).toContain(PageType.Database);
      expect(keys).toContain(PageType.DatabaseSchema);
      expect(keys).toContain(PageType.Directory);
      expect(keys).toContain(PageType.File);
      expect(keys).toContain(PageType.Metric);
      expect(keys).toContain(PageType.MlModel);
      expect(keys).toContain(PageType.Pipeline);
      expect(keys).toContain(PageType.SearchIndex);
      expect(keys).toContain(PageType.Spreadsheet);
      expect(keys).toContain(PageType.StoredProcedure);
      expect(keys).toContain(PageType.Table);
      expect(keys).toContain(PageType.Topic);
      expect(keys).toContain(PageType.Worksheet);
    });

    it('should return an empty array for an unknown category', () => {
      const options = getCustomizePageOptions('unknown-category');

      expect(options).toHaveLength(0);
      expect(options).toEqual([]);
    });

    it('should return an empty array for empty string category', () => {
      const options = getCustomizePageOptions('');

      expect(options).toHaveLength(0);
      expect(options).toEqual([]);
    });

    it('should return an empty array for null-like category', () => {
      const options = getCustomizePageOptions('null');

      expect(options).toHaveLength(0);
      expect(options).toEqual([]);
    });
  });
});
