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

import {
  CommonWidgetType,
  GridSizes,
} from '../../constants/CustomizeWidgets.constants';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { DataProduct } from '../../generated/entity/domains/dataProduct';
import { Domain, DomainType } from '../../generated/entity/domains/domain';
import { Tab } from '../../generated/system/ui/uiCustomization';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from '../CustomizePage/CustomizePageUtils';
import i18n from '../i18next/LocalUtil';
import { getDataMarketplaceWidgetsFromKey } from './DataMarketplaceUtils';

type MarketplaceWidgetKeys =
  | DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS
  | DetailPageWidgetKeys.MARKETPLACE_DOMAINS;

class DataMarketplaceClassBase {
  defaultWidgetHeight: Record<MarketplaceWidgetKeys, number>;

  constructor() {
    this.defaultWidgetHeight = {
      [DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS]: 1,
      [DetailPageWidgetKeys.MARKETPLACE_DOMAINS]: 1,
    };
  }

  public getDataMarketplaceDetailPageTabsIds(): Tab[] {
    return [
      {
        id: EntityTabs.OVERVIEW,
        name: EntityTabs.OVERVIEW,
        displayName: getTabLabelFromId(EntityTabs.OVERVIEW),
        layout: this.getDefaultLayout(EntityTabs.OVERVIEW),
        editable: true,
      },
    ];
  }

  public getDefaultLayout(tab?: EntityTabs): WidgetConfig[] {
    if (tab && tab !== EntityTabs.OVERVIEW) {
      return [];
    }

    return [
      {
        h: this.defaultWidgetHeight[
          DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS
        ],
        i: DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS,
        w: 8,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.MARKETPLACE_DOMAINS],
        i: DetailPageWidgetKeys.MARKETPLACE_DOMAINS,
        w: 8,
        x: 0,
        y: 1,
        static: false,
      },
    ];
  }

  public getCommonWidgetList(): CommonWidgetType[] {
    return [
      {
        fullyQualifiedName: DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS,
        name: i18n.t('label.data-product-plural'),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
      {
        fullyQualifiedName: DetailPageWidgetKeys.MARKETPLACE_DOMAINS,
        name: i18n.t('label.domain-plural'),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
    ];
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getDataMarketplaceWidgetsFromKey(widgetConfig);
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS:
        return this.defaultWidgetHeight[
          DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS
        ];
      case DetailPageWidgetKeys.MARKETPLACE_DOMAINS:
        return this.defaultWidgetHeight[
          DetailPageWidgetKeys.MARKETPLACE_DOMAINS
        ];
      default:
        return 1;
    }
  }

  public getDummyData() {
    return {} as Record<string, unknown>;
  }

  public getDummyDataProducts(): DataProduct[] {
    return [
      {
        id: 'dummy-dp-1',
        name: 'sales-metrics',
        displayName: 'Sales Metrics',
        fullyQualifiedName: 'sales-metrics',
        description: 'Key sales performance indicators',
      } as DataProduct,
      {
        id: 'dummy-dp-2',
        name: 'customer-analytics',
        displayName: 'Customer Analytics',
        fullyQualifiedName: 'customer-analytics',
        description: 'Customer behavior analysis',
      } as DataProduct,
      {
        id: 'dummy-dp-3',
        name: 'revenue-reports',
        displayName: 'Revenue Reports',
        fullyQualifiedName: 'revenue-reports',
        description: 'Financial revenue data',
      } as DataProduct,
    ];
  }

  public getDummyDomains(): Domain[] {
    return [
      {
        id: 'dummy-domain-1',
        name: 'engineering',
        displayName: 'Engineering',
        fullyQualifiedName: 'engineering',
        domainType: DomainType.Aggregate,
      } as Domain,
      {
        id: 'dummy-domain-2',
        name: 'marketing',
        displayName: 'Marketing',
        fullyQualifiedName: 'marketing',
        domainType: DomainType.ConsumerAligned,
      } as Domain,
      {
        id: 'dummy-domain-3',
        name: 'finance',
        displayName: 'Finance',
        fullyQualifiedName: 'finance',
        domainType: DomainType.SourceAligned,
      } as Domain,
    ];
  }
}

const dataMarketplaceClassBase = new DataMarketplaceClassBase();

export default dataMarketplaceClassBase;
export { DataMarketplaceClassBase };
