/*
 *  Copyright 2025 Collate.
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

import { EntityTabs } from '../../enums/entity.enum';
import glossaryTermClassBase, {
  GlossaryTermClassBase,
  GlossaryTermDetailPageTabProps,
} from './GlossaryTermClassBase';
import { getGlossaryTermDetailPageTabs } from './GlossaryTermUtils';

jest.mock('./GlossaryTermUtils', () => ({
  getGlossaryTermDetailPageTabs: jest
    .fn()
    .mockReturnValue([{ key: 'mock-tab' }]),
}));

jest.mock('../../utils/CustomizePage/CustomizePageUtils', () => ({
  getTabLabelFromId: jest.fn((tab: string) => tab),
}));

const mockProps = {} as GlossaryTermDetailPageTabProps;

describe('GlossaryTermClassBase', () => {
  let instance: GlossaryTermClassBase;

  beforeEach(() => {
    jest.clearAllMocks();
    instance = new GlossaryTermClassBase();
  });

  describe('getGlossaryTermDetailPageTabs', () => {
    it('delegates to getGlossaryTermDetailPageTabs util', () => {
      const result = instance.getGlossaryTermDetailPageTabs(mockProps);

      expect(getGlossaryTermDetailPageTabs).toHaveBeenCalledWith(mockProps);
      expect(result).toEqual([{ key: 'mock-tab' }]);
    });
  });

  describe('getGlossaryTermDetailPageTabsIds', () => {
    it('returns all 5 expected tab IDs', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      expect(tabs).toHaveLength(5);
    });

    it('includes OVERVIEW tab', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      expect(tabs.find((t) => t.id === EntityTabs.OVERVIEW)).toBeDefined();
    });

    it('includes GLOSSARY_TERMS tab', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      expect(
        tabs.find((t) => t.id === EntityTabs.GLOSSARY_TERMS)
      ).toBeDefined();
    });

    it('includes ASSETS tab', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      expect(tabs.find((t) => t.id === EntityTabs.ASSETS)).toBeDefined();
    });

    it('includes ACTIVITY_FEED tab', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      expect(tabs.find((t) => t.id === EntityTabs.ACTIVITY_FEED)).toBeDefined();
    });

    it('includes CUSTOM_PROPERTIES tab', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      expect(
        tabs.find((t) => t.id === EntityTabs.CUSTOM_PROPERTIES)
      ).toBeDefined();
    });

    it('all tabs have editable set to false', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      tabs.forEach((tab) => {
        expect(tab.editable).toBe(false);
      });
    });

    it('all tabs have empty layout array', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      tabs.forEach((tab) => {
        expect(tab.layout).toEqual([]);
      });
    });

    it('tabs are in correct order', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();
      const ids = tabs.map((t) => t.id);

      expect(ids).toEqual([
        EntityTabs.OVERVIEW,
        EntityTabs.GLOSSARY_TERMS,
        EntityTabs.ASSETS,
        EntityTabs.ACTIVITY_FEED,
        EntityTabs.CUSTOM_PROPERTIES,
      ]);
    });
  });

  describe('singleton export', () => {
    it('default export is an instance of GlossaryTermClassBase', () => {
      expect(glossaryTermClassBase).toBeInstanceOf(GlossaryTermClassBase);
    });
  });
});
