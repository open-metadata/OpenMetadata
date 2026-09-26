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
import { DefaultViewMode } from '../../../generated/api/configuration/appConfiguration';
import { ViewModeRow } from './DefaultAppModePage.types';
import {
  buildRowsFromViewModes,
  buildViewModesMap,
  DOMAIN_PAGE_ID,
  getViewOptionsForPage,
  serializeViewModes,
} from './DefaultAppModePage.utils';

describe('DefaultAppModePage.utils', () => {
  describe('getViewOptionsForPage', () => {
    it('returns Table and Grid for a non-domains page', () => {
      const ids = getViewOptionsForPage('dataProducts').map(
        (option) => option.id
      );

      expect(ids).toEqual([DefaultViewMode.List, DefaultViewMode.Grid]);
    });

    it('returns Table, Grid and Tree for the domains page', () => {
      const ids = getViewOptionsForPage(DOMAIN_PAGE_ID).map(
        (option) => option.id
      );

      expect(ids).toEqual([
        DefaultViewMode.List,
        DefaultViewMode.Grid,
        DefaultViewMode.Tree,
      ]);
    });
  });

  describe('buildRowsFromViewModes', () => {
    it('returns an empty array for undefined input', () => {
      expect(buildRowsFromViewModes(undefined)).toEqual([]);
    });

    it('returns an empty array for an empty map', () => {
      expect(buildRowsFromViewModes({})).toEqual([]);
    });

    it('builds a row per entry with matching page and view', () => {
      const rows = buildRowsFromViewModes({
        dataProducts: DefaultViewMode.Grid,
        domains: DefaultViewMode.Tree,
      });

      expect(rows.map((row) => ({ page: row.page, view: row.view }))).toEqual([
        { page: 'dataProducts', view: DefaultViewMode.Grid },
        { page: 'domains', view: DefaultViewMode.Tree },
      ]);

      rows.forEach((row) => expect(row.id).toEqual(expect.any(String)));
    });
  });

  describe('buildViewModesMap', () => {
    it('returns an empty map for an empty rows array', () => {
      expect(buildViewModesMap([])).toEqual({});
    });

    it('drops rows missing a page or a view', () => {
      const rows: ViewModeRow[] = [
        { id: '1', page: 'dataProducts', view: null },
        { id: '2', page: null, view: DefaultViewMode.Grid },
        { id: '3', page: null, view: null },
      ];

      expect(buildViewModesMap(rows)).toEqual({});
    });

    it('keeps only rows with both a page and a view', () => {
      const rows: ViewModeRow[] = [
        { id: '1', page: 'dataProducts', view: DefaultViewMode.Grid },
        { id: '2', page: 'domains', view: null },
        { id: '3', page: 'subDomains', view: DefaultViewMode.List },
      ];

      expect(buildViewModesMap(rows)).toEqual({
        dataProducts: DefaultViewMode.Grid,
        subDomains: DefaultViewMode.List,
      });
    });
  });

  describe('serializeViewModes', () => {
    it('serializes identically regardless of insertion order', () => {
      const a = {
        dataProducts: DefaultViewMode.Grid,
        domains: DefaultViewMode.Tree,
      };
      const b = {
        domains: DefaultViewMode.Tree,
        dataProducts: DefaultViewMode.Grid,
      };

      expect(serializeViewModes(a)).toEqual(serializeViewModes(b));
    });

    it('serializes differently when the content actually differs', () => {
      const a = { dataProducts: DefaultViewMode.Grid };
      const b = { dataProducts: DefaultViewMode.List };

      expect(serializeViewModes(a)).not.toEqual(serializeViewModes(b));
    });
  });
});
