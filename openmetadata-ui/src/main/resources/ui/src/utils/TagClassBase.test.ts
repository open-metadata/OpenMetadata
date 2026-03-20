/*
 *  Copyright 2023 Collate.
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
import React from 'react';
import { queryFilterToRemoveSomeClassification } from '../constants/Tag.constants';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { Tag } from '../generated/entity/classification/tag';
import { searchQuery } from '../rest/searchAPI';
import tagClassBase, { TagClassBase } from './TagClassBase';

jest.mock('../rest/searchAPI');

jest.mock('./StringsUtils', () => ({
  getEncodedFqn: jest.fn().mockReturnValue('test'),
  escapeESReservedCharacters: jest.fn().mockReturnValue('test'),
}));

jest.mock('./CustomizePage/CustomizePageUtils', () => ({
  getTabLabelFromId: jest.fn().mockReturnValue('Tab Label'),
}));

jest.mock('../components/DataAssets/CommonWidgets/CommonWidgets', () => ({
  CommonWidgets: 'CommonWidgets',
}));

jest.mock('../components/DataAssets/DomainLabelV2/DomainLabelV2', () => ({
  DomainLabelV2: 'DomainLabelV2',
}));

jest.mock('../components/DataAssets/OwnerLabelV2/OwnerLabelV2', () => ({
  OwnerLabelV2: 'OwnerLabelV2',
}));

const mockSearchResponse = (fqn: string) => ({
  hits: {
    hits: [{ _source: { fullyQualifiedName: fqn } }],
    total: { value: 1 },
  },
});

describe('TagClassBase', () => {
  beforeEach(() => {
    (searchQuery as jest.Mock).mockClear();
  });

  it('should create an instance of TagClassBase', () => {
    expect(tagClassBase).toBeInstanceOf(TagClassBase);
  });

  describe('getTags', () => {
    it('calls searchQuery with classification-merged queryFilter by default', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(mockSearchResponse('test'));

      await tagClassBase.getTags('test', 1);

      expect(searchQuery).toHaveBeenCalledWith({
        query: '*test*',
        pageNumber: 1,
        pageSize: 10,
        queryFilter: {
          query: {
            bool: {
              must: [{ term: { disabled: 'false' } }],
              must_not:
                queryFilterToRemoveSomeClassification.query.bool.must_not,
            },
          },
        },
        searchIndex: SearchIndex.TAG,
      });
    });

    it('calls searchQuery with only disabled filter when emptyQueryFilter is true', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(mockSearchResponse('test'));

      await tagClassBase.getTags('test', 1, true);

      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryFilter: {
            query: {
              bool: {
                must: [{ term: { disabled: 'false' } }],
              },
            },
          },
        })
      );
    });

    it('returns correct data shape from searchQuery response', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(mockSearchResponse('test'));

      const result = await tagClassBase.getTags('test', 1);

      expect(result).toEqual({
        data: [
          {
            label: 'test',
            value: 'test',
            data: { fullyQualifiedName: 'test' },
          },
        ],
        paging: { total: 1 },
      });
    });

    it('returns empty string label/value when fullyQualifiedName is missing', async () => {
      (searchQuery as jest.Mock).mockResolvedValue({
        hits: { hits: [{ _source: {} }], total: { value: 1 } },
      });

      const result = await tagClassBase.getTags('', 1);

      expect(result.data[0].label).toBe('');
      expect(result.data[0].value).toBe('');
    });
  });

  describe('getTagDetailPageTabsIds', () => {
    it('returns 4 tabs', () => {
      const tabs = tagClassBase.getTagDetailPageTabsIds();

      expect(tabs).toHaveLength(4);
    });

    it('returns tabs in expected order', () => {
      const tabs = tagClassBase.getTagDetailPageTabsIds();
      const ids = tabs.map((t) => t.id);

      expect(ids).toEqual([
        EntityTabs.OVERVIEW,
        EntityTabs.ASSETS,
        EntityTabs.ACTIVITY_FEED,
        EntityTabs.CUSTOM_PROPERTIES,
      ]);
    });

    it('only OVERVIEW tab is editable', () => {
      const tabs = tagClassBase.getTagDetailPageTabsIds();

      const editableIds = tabs.filter((t) => t.editable).map((t) => t.id);

      expect(editableIds).toEqual([EntityTabs.OVERVIEW]);
    });

    it('non-OVERVIEW tabs are not editable', () => {
      const tabs = tagClassBase.getTagDetailPageTabsIds();

      tabs
        .filter((t) => t.id !== EntityTabs.OVERVIEW)
        .forEach((t) => expect(t.editable).toBe(false));
    });
  });

  describe('getDefaultLayout', () => {
    it('returns 3 widget configs when tab is OVERVIEW', () => {
      const layout = tagClassBase.getDefaultLayout(EntityTabs.OVERVIEW);

      expect(layout).toHaveLength(3);
    });

    it('returns 3 widget configs when no tab is given', () => {
      const layout = tagClassBase.getDefaultLayout();

      expect(layout).toHaveLength(3);
    });

    it('returns empty array for non-OVERVIEW tab', () => {
      expect(tagClassBase.getDefaultLayout(EntityTabs.ASSETS)).toEqual([]);
      expect(tagClassBase.getDefaultLayout(EntityTabs.ACTIVITY_FEED)).toEqual(
        []
      );
      expect(
        tagClassBase.getDefaultLayout(EntityTabs.CUSTOM_PROPERTIES)
      ).toEqual([]);
    });

    it('OVERVIEW layout includes LEFT_PANEL, DOMAIN, and OWNERS widgets', () => {
      const layout = tagClassBase.getDefaultLayout(EntityTabs.OVERVIEW);
      const keys = layout.map((w) => w.i);

      expect(keys).toContain(DetailPageWidgetKeys.LEFT_PANEL);
      expect(keys).toContain(DetailPageWidgetKeys.DOMAIN);
      expect(keys).toContain(DetailPageWidgetKeys.OWNERS);
    });

    it('LEFT_PANEL widget is static', () => {
      const layout = tagClassBase.getDefaultLayout(EntityTabs.OVERVIEW);
      const leftPanel = layout.find(
        (w) => w.i === DetailPageWidgetKeys.LEFT_PANEL
      );

      expect(leftPanel?.static).toBe(true);
    });
  });

  describe('getCommonWidgetList', () => {
    it('returns 3 widgets', () => {
      const widgets = tagClassBase.getCommonWidgetList();

      expect(widgets).toHaveLength(3);
    });

    it('first widget is DESCRIPTION', () => {
      const widgets = tagClassBase.getCommonWidgetList();

      expect(widgets[0].fullyQualifiedName).toBe(
        DetailPageWidgetKeys.DESCRIPTION
      );
    });

    it('includes DOMAIN and OWNERS widgets', () => {
      const widgets = tagClassBase.getCommonWidgetList();
      const keys = widgets.map((w) => w.fullyQualifiedName);

      expect(keys).toContain(DetailPageWidgetKeys.DOMAIN);
      expect(keys).toContain(DetailPageWidgetKeys.OWNERS);
    });
  });

  describe('getWidgetHeight', () => {
    it('returns height for DESCRIPTION widget', () => {
      const height = tagClassBase.getWidgetHeight(
        DetailPageWidgetKeys.DESCRIPTION
      );

      expect(height).toBe(4);
    });

    it('returns height for OWNERS widget', () => {
      const height = tagClassBase.getWidgetHeight(DetailPageWidgetKeys.OWNERS);

      expect(height).toBe(1.5);
    });

    it('returns height for DOMAIN widget', () => {
      const height = tagClassBase.getWidgetHeight(DetailPageWidgetKeys.DOMAIN);

      expect(height).toBe(1.5);
    });

    it('returns 1 for unknown widget key', () => {
      const height = tagClassBase.getWidgetHeight('unknown-widget');

      expect(height).toBe(1);
    });
  });

  describe('getDummyData', () => {
    it('returns a Tag object with required fields', () => {
      const tag = tagClassBase.getDummyData();

      expect(tag).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        fullyQualifiedName: expect.any(String),
      });
    });

    it('returns a tag that is not disabled', () => {
      const tag = tagClassBase.getDummyData();

      expect(tag.disabled).toBe(false);
    });

    it('returns a tag that is not deprecated', () => {
      const tag = tagClassBase.getDummyData();

      expect(tag.deprecated).toBe(false);
    });
  });

  describe('getRightPanelForOverviewTab', () => {
    it('returns a React element', () => {
      const element = tagClassBase.getRightPanelForOverviewTab({
        editOwnerPermission: true,
        editDomainPermission: true,
      });

      expect(React.isValidElement(element)).toBe(true);
    });

    it('passes editDomainPermission to DomainLabelV2', () => {
      const element = tagClassBase.getRightPanelForOverviewTab({
        editOwnerPermission: false,
        editDomainPermission: true,
      });

      const domainChild = (element.props as { children: React.ReactElement[] })
        .children[0];

      expect(domainChild.props.hasPermission).toBe(true);
    });

    it('passes editOwnerPermission to OwnerLabelV2', () => {
      const element = tagClassBase.getRightPanelForOverviewTab({
        editOwnerPermission: true,
        editDomainPermission: false,
      });

      const ownerChild = (element.props as { children: React.ReactElement[] })
        .children[1];

      expect(ownerChild.props.hasPermission).toBe(true);
    });
  });

  describe('getWidgetsFromKey', () => {
    it('returns a React element wrapping CommonWidgets', () => {
      const widgetConfig = {
        i: DetailPageWidgetKeys.DESCRIPTION,
        x: 0,
        y: 0,
        w: 6,
        h: 4,
      };

      const element = tagClassBase.getWidgetsFromKey(widgetConfig);

      expect(React.isValidElement(element)).toBe(true);
      expect(element.props).toMatchObject({
        entityType: EntityType.TAG,
        showTaskHandler: false,
        widgetConfig,
      });
    });
  });

  describe('getAutoClassificationComponent', () => {
    it('returns null', () => {
      expect(tagClassBase.getAutoClassificationComponent(true)).toBeNull();
      expect(tagClassBase.getAutoClassificationComponent(false)).toBeNull();
    });
  });

  describe('getRecognizerFeedbackPopup', () => {
    it('returns null', () => {
      const result = tagClassBase.getRecognizerFeedbackPopup(
        {} as never,
        'entity.fqn',
        React.createElement('span')
      );

      expect(result).toBeNull();
    });
  });

  describe('getClassificationReviewerWidget', () => {
    it('returns null', () => {
      expect(tagClassBase.getClassificationReviewerWidget()).toBeNull();
    });
  });

  describe('getClassificationFields', () => {
    it('returns the correct set of fields', () => {
      const fields = tagClassBase.getClassificationFields();

      expect(fields).toEqual([
        TabSpecificField.OWNERS,
        TabSpecificField.USAGE_COUNT,
        TabSpecificField.TERM_COUNT,
        TabSpecificField.DOMAINS,
      ]);
    });

    it('returns 4 fields', () => {
      expect(tagClassBase.getClassificationFields()).toHaveLength(4);
    });
  });

  describe('getAdditionalTagDetailPageTabs', () => {
    it('returns an empty array by default', () => {
      const mockTag = { fullyQualifiedName: 'PII.Sensitive' } as unknown as Tag;

      expect(
        tagClassBase.getAdditionalTagDetailPageTabs(mockTag, 'overview')
      ).toEqual([]);
    });

    it('returns an empty array regardless of activeTab value', () => {
      const mockTag = { fullyQualifiedName: 'PII.Sensitive' } as unknown as Tag;

      expect(
        tagClassBase.getAdditionalTagDetailPageTabs(mockTag, 'assets')
      ).toEqual([]);
      expect(
        tagClassBase.getAdditionalTagDetailPageTabs(mockTag, 'activity_feed')
      ).toEqual([]);
    });
  });
});
