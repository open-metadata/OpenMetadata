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

import { TabProps } from '../../components/common/TabsLabel/TabsLabel.interface';
import {
  DESCRIPTION_WIDGET,
  GridSizes,
} from '../../constants/CustomizeWidgets.constants';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { DataProduct } from '../../generated/entity/domains/dataProduct';
import { Tab } from '../../generated/system/ui/uiCustomization';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from '../CustomizePage/CustomizePageUtils';
import {
  DataProductDetailPageTabProps,
  getDataProductDetailTabs,
  getDataProductWidgetsFromKey,
} from '../DataProductUtils';
import i18n from '../i18next/LocalUtil';

type DataProductWidgetKeys =
  | DetailPageWidgetKeys.DESCRIPTION
  | DetailPageWidgetKeys.OWNERS
  | DetailPageWidgetKeys.TAGS
  | DetailPageWidgetKeys.GLOSSARY_TERMS
  | DetailPageWidgetKeys.DOMAIN
  | DetailPageWidgetKeys.CUSTOM_PROPERTIES
  | DetailPageWidgetKeys.EXPERTS;

class DataProductClassBase {
  defaultWidgetHeight: Record<DataProductWidgetKeys, number>;

  constructor() {
    this.defaultWidgetHeight = {
      [DetailPageWidgetKeys.DESCRIPTION]: 4,
      [DetailPageWidgetKeys.OWNERS]: 1.5,
      [DetailPageWidgetKeys.TAGS]: 2,
      [DetailPageWidgetKeys.GLOSSARY_TERMS]: 2,
      [DetailPageWidgetKeys.EXPERTS]: 2,
      [DetailPageWidgetKeys.DOMAIN]: 1.5,
      [DetailPageWidgetKeys.CUSTOM_PROPERTIES]: 4,
    };
  }

  public getDataProductDetailPageTabs(
    dataProductDetailsPageProps: DataProductDetailPageTabProps
  ): TabProps[] {
    return getDataProductDetailTabs(dataProductDetailsPageProps);
  }

  public getDataProductDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.DOCUMENTATION,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.INPUT_OUTPUT_PORTS,
      EntityTabs.ASSETS,
      EntityTabs.CONTRACT,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: tab === EntityTabs.DOCUMENTATION,
    }));
  }

  public getDefaultLayout(tab?: EntityTabs): WidgetConfig[] {
    if (tab && tab !== EntityTabs.DOCUMENTATION) {
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
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.TAGS],
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.GLOSSARY_TERMS],
        i: DetailPageWidgetKeys.GLOSSARY_TERMS,
        w: 2,
        x: 6,
        y: 3,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.CUSTOM_PROPERTIES],
        i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
        w: 2,
        x: 6,
        y: 5,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.EXPERTS],
        i: DetailPageWidgetKeys.EXPERTS,
        w: 2,
        x: 6,
        y: 5,
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
      {
        fullyQualifiedName: DetailPageWidgetKeys.EXPERTS,
        name: i18n.t('label.expert-plural'),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
    ];
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getDataProductWidgetsFromKey(widgetConfig);
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case DetailPageWidgetKeys.DESCRIPTION:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION];
      case DetailPageWidgetKeys.OWNERS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.OWNERS];
      case DetailPageWidgetKeys.TAGS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.TAGS];
      case DetailPageWidgetKeys.GLOSSARY_TERMS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.GLOSSARY_TERMS];
      case DetailPageWidgetKeys.EXPERTS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.EXPERTS];
      case DetailPageWidgetKeys.DOMAIN:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.DOMAIN];
      case DetailPageWidgetKeys.CUSTOM_PROPERTIES:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.CUSTOM_PROPERTIES];
      default:
        return 1;
    }
  }

  public getDummyData(): DataProduct {
    return {
      id: 'dummy-data-product',
      name: 'Sample Data Product',
      displayName: 'Sample Data Product',
      description: 'This is a sample data product for demonstration purposes',
      fullyQualifiedName: 'sample.dataProduct',
      version: 0.1,
      updatedAt: Date.now(),
      updatedBy: 'admin',
      owners: [],
      domains: [],
      href: '',
    } as DataProduct;
  }
}

const dataProductClassBase = new DataProductClassBase();

export default dataProductClassBase;
export { DataProductClassBase };
