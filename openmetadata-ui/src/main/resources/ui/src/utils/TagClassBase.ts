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
import { isEmpty } from 'lodash';
import React from 'react';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import { DomainLabelV2 } from '../components/DataAssets/DomainLabelV2/DomainLabelV2';
import { OwnerLabelV2 } from '../components/DataAssets/OwnerLabelV2/OwnerLabelV2';
import { PAGE_SIZE } from '../constants/constants';
import {
  DESCRIPTION_WIDGET,
  GridSizes,
} from '../constants/CustomizeWidgets.constants';
import { queryFilterToRemoveSomeClassification } from '../constants/Tag.constants';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { Tag } from '../generated/entity/classification/tag';
import { Tab } from '../generated/system/ui/uiCustomization';
import { TagLabel } from '../generated/type/tagLabel';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { searchQuery } from '../rest/searchAPI';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import i18n from './i18next/LocalUtil';
import { getTermQuery } from './SearchUtils';
import { escapeESReservedCharacters, getEncodedFqn } from './StringsUtils';

export interface TagRightPanelParams {
  editOwnerPermission: boolean;
  editDomainPermission: boolean;
}

type TagWidgetKeys =
  | DetailPageWidgetKeys.DESCRIPTION
  | DetailPageWidgetKeys.OWNERS
  | DetailPageWidgetKeys.DOMAIN;

class TagClassBase {
  defaultWidgetHeight: Record<TagWidgetKeys, number>;

  constructor() {
    this.defaultWidgetHeight = {
      [DetailPageWidgetKeys.DESCRIPTION]: 4,
      [DetailPageWidgetKeys.OWNERS]: 1.5,
      [DetailPageWidgetKeys.DOMAIN]: 1.5,
    };
  }

  public async getTags(
    searchText: string,
    page: number,
    emptyQueryFilter?: boolean
  ) {
    const encodedValue = getEncodedFqn(escapeESReservedCharacters(searchText));

    // Build the queryFilter by merging disabled:false with any existing filters
    const disabledFilter = getTermQuery({ disabled: 'false' });

    let mergedQueryFilter = {};
    if (emptyQueryFilter) {
      // If emptyQueryFilter is true, only use the disabled filter
      mergedQueryFilter = disabledFilter;
    } else {
      const hasClassificationFilter = !isEmpty(
        queryFilterToRemoveSomeClassification
      );
      if (hasClassificationFilter) {
        // Merge both filters: disabled:false (must) + classification exclusions (must_not)
        mergedQueryFilter = {
          query: {
            bool: {
              must: disabledFilter.query.bool.must,
              must_not:
                queryFilterToRemoveSomeClassification.query.bool.must_not,
            },
          },
        };
      } else {
        mergedQueryFilter = disabledFilter;
      }
    }

    const res = await searchQuery({
      query: `*${encodedValue}*`,
      pageNumber: page,
      pageSize: PAGE_SIZE,
      queryFilter: mergedQueryFilter,
      searchIndex: SearchIndex.TAG,
    });

    return {
      data: res.hits.hits.map(({ _source }) => ({
        label: _source.fullyQualifiedName ?? '',
        value: _source.fullyQualifiedName ?? '',
        data: _source,
      })),
      paging: {
        total: res.hits.total.value,
      },
    };
  }

  public getRightPanelForOverviewTab(
    params: TagRightPanelParams
  ): React.ReactElement {
    const { editOwnerPermission, editDomainPermission } = params;

    return React.createElement(
      'div',
      { className: 'd-flex flex-column gap-5' },
      React.createElement(DomainLabelV2, {
        multiple: true,
        showDomainHeading: true,
        hasPermission: editDomainPermission,
      }),
      React.createElement(OwnerLabelV2, {
        dataTestId: 'tag-owner-name',
        hasPermission: editOwnerPermission,
      })
    );
  }

  public getTagDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.OVERVIEW,
      EntityTabs.ASSETS,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: tab === EntityTabs.OVERVIEW,
    }));
  }

  public getDefaultLayout(tab?: EntityTabs): WidgetConfig[] {
    if (tab && tab !== EntityTabs.OVERVIEW) {
      return [];
    }

    return [
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION] + 0.5,
        i: DetailPageWidgetKeys.LEFT_PANEL,
        w: 6,
        x: 0,
        y: 0,
        children: [
          {
            h: this.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION],
            i: DetailPageWidgetKeys.DESCRIPTION,
            w: 1,
            x: 0,
            y: 0,
            static: false,
          },
        ],
        static: true,
      },
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.DOMAIN],
        i: DetailPageWidgetKeys.DOMAIN,
        w: 2,
        x: 6,
        y: 0,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.OWNERS],
        i: DetailPageWidgetKeys.OWNERS,
        w: 2,
        x: 6,
        y: 1,
        static: false,
      },
    ];
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.DOMAIN,
        name: i18n.t('label.domain'),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
      {
        fullyQualifiedName: DetailPageWidgetKeys.OWNERS,
        name: i18n.t('label.owner-plural'),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
    ];
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig): React.ReactElement {
    return React.createElement(CommonWidgets, {
      entityType: EntityType.TAG,
      showTaskHandler: false,
      widgetConfig,
    });
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case DetailPageWidgetKeys.DESCRIPTION:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION];
      case DetailPageWidgetKeys.OWNERS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.OWNERS];
      case DetailPageWidgetKeys.DOMAIN:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.DOMAIN];
      default:
        return 1;
    }
  }

  public getDummyData(): Tag {
    return {
      id: 'dummy-tag',
      name: 'Sample Tag',
      displayName: 'Sample Tag',
      description: 'This is a sample tag for demonstration purposes',
      fullyQualifiedName: 'sample.classification.tag',
      deprecated: false,
      disabled: false,
      version: 0.1,
      updatedAt: Date.now(),
      updatedBy: 'admin',
      href: '',
    } as Tag;
  }
  public getAutoClassificationComponent = (
    _isClassification: boolean
  ): React.ReactElement | null => {
    return null;
  };

  public getRecognizerTab = (
    _tagData: Tag,
    _activeTab: string,
    _t: (key: string) => string,
    _count?: number
  ): {
    label: React.ReactElement;
    key: string;
    children: React.ReactElement;
  } | null => {
    return null;
  };

  public getRecognizerFeedbackPopup(
    _tagLabel: TagLabel,
    _entityFqn: string,
    _children: React.ReactElement
  ): React.ReactElement | null {
    return null;
  }
}

const tagClassBase = new TagClassBase();

export default tagClassBase;
export { TagClassBase };
