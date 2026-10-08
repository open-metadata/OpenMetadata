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

import { EntityFields } from '../../enums/AdvancedSearch.enum';
import dataProductClassBase, {
  DataProductClassBase,
} from './DataProductClassBase';

jest.mock('../../constants/DataProduct.constants', () => ({
  DATAPRODUCT_FILTERS: [
    { label: 'label.owner-plural', key: 'owners.displayName' },
  ],
  DATAPRODUCT_DEFAULT_QUICK_FILTERS: ['owners.displayName'],
}));

jest.mock('../DataProductUtils', () => ({
  getDataProductDetailTabs: jest.fn().mockReturnValue([]),
  getDataProductWidgetsFromKey: jest.fn().mockReturnValue([]),
}));

jest.mock('../i18next/LocalUtil', () => ({
  __esModule: true,
  default: { t: jest.fn((key: string) => key) },
}));

describe('DataProductClassBase', () => {
  let instance: DataProductClassBase;

  beforeEach(() => {
    instance = new DataProductClassBase();
  });

  describe('listing filters', () => {
    it('returns the data product filter set', () => {
      expect(instance.getListingFilters()).toEqual([
        { label: 'label.owner-plural', key: 'owners.displayName' },
      ]);
    });

    it('omits the Collate-only status filter', () => {
      expect(instance.getListingFilters().map((f) => f.key)).not.toContain(
        EntityFields.ENTITY_STATUS
      );
    });

    it('returns the matching quick-filter keys', () => {
      expect(instance.getListingQuickFilterKeys()).toEqual([
        'owners.displayName',
      ]);
    });

    it('omits the Collate-only status key', () => {
      expect(instance.getListingQuickFilterKeys()).not.toContain(
        EntityFields.ENTITY_STATUS
      );
    });
  });

  describe('getListingExtraColumns', () => {
    it('contributes no extra listing column in OSS', () => {
      expect(instance.getListingExtraColumns()).toEqual([]);
    });

    // Callers feed the result straight into a useMemo dep list, so a fresh
    // array per call would recompute the columns on every render.
    it('returns the same array identity on every call', () => {
      expect(instance.getListingExtraColumns()).toBe(
        instance.getListingExtraColumns()
      );
    });
  });

  describe('singleton export', () => {
    it('default export is an instance of DataProductClassBase', () => {
      expect(dataProductClassBase).toBeInstanceOf(DataProductClassBase);
    });
  });
});
