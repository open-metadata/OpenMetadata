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
import {
  CUSTOM_PROPERTIES_WIDGET,
  DATA_PRODUCTS_WIDGET,
  DESCRIPTION_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  GridSizes,
  TAGS_WIDGET,
} from '../../constants/CustomizeWidgets.constants';
import { SERVICE_DUMMY_DATA } from '../../constants/ServiceDetailPage.constants';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { Tab } from '../../generated/system/ui/uiCustomization';
import { ServicesType } from '../../interface/service.interface';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from '../CustomizePage/CustomizePageUtils';
import i18n from '../i18next/LocalUtil';
import { getServiceWidgetsFromKey } from './ServiceDetailsPage.util';

type ServiceWidgetKeys =
  | DetailPageWidgetKeys.DESCRIPTION
  | DetailPageWidgetKeys.SERVICE_ENTITY_TABLE
  | DetailPageWidgetKeys.DATA_PRODUCTS
  | DetailPageWidgetKeys.TAGS
  | DetailPageWidgetKeys.GLOSSARY_TERMS
  | DetailPageWidgetKeys.CUSTOM_PROPERTIES;

class ServiceDetailsClassBase {
  defaultWidgetHeight: Record<ServiceWidgetKeys, number>;

  constructor() {
    this.defaultWidgetHeight = {
      [DetailPageWidgetKeys.DESCRIPTION]: 2,
      [DetailPageWidgetKeys.SERVICE_ENTITY_TABLE]: 4,
      [DetailPageWidgetKeys.DATA_PRODUCTS]: 2,
      [DetailPageWidgetKeys.TAGS]: 2,
      [DetailPageWidgetKeys.GLOSSARY_TERMS]: 2,
      [DetailPageWidgetKeys.CUSTOM_PROPERTIES]: 4,
    };
  }

  public getServiceDetailPageTabsIds(): Tab[] {
    return [
      {
        id: EntityTabs.INSIGHTS,
        name: EntityTabs.INSIGHTS,
        displayName: getTabLabelFromId(EntityTabs.INSIGHTS),
        layout: [],
        editable: false,
      },
      {
        id: EntityTabs.DETAILS,
        name: EntityTabs.DETAILS,
        displayName: getTabLabelFromId(EntityTabs.DETAILS),
        layout: this.getDefaultLayout(EntityTabs.DETAILS),
        editable: true,
      },
      {
        id: EntityTabs.DATA_Model,
        name: EntityTabs.DATA_Model,
        displayName: getTabLabelFromId(EntityTabs.DATA_Model),
        layout: [],
        editable: false,
      },
      {
        id: EntityTabs.FILES,
        name: EntityTabs.FILES,
        displayName: getTabLabelFromId(EntityTabs.FILES),
        layout: [],
        editable: false,
      },
      {
        id: EntityTabs.SPREADSHEETS,
        name: EntityTabs.SPREADSHEETS,
        displayName: getTabLabelFromId(EntityTabs.SPREADSHEETS),
        layout: [],
        editable: false,
      },
      {
        id: EntityTabs.AGENTS,
        name: EntityTabs.AGENTS,
        displayName: getTabLabelFromId(EntityTabs.AGENTS),
        layout: [],
        editable: false,
      },
      {
        id: EntityTabs.CONNECTION,
        name: EntityTabs.CONNECTION,
        displayName: getTabLabelFromId(EntityTabs.CONNECTION),
        layout: [],
        editable: false,
      },
    ];
  }

  public getDefaultLayout(tab?: EntityTabs): WidgetConfig[] {
    if (tab && tab !== EntityTabs.DETAILS) {
      return [];
    }

    return [
      {
        h:
          this.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION] +
          this.defaultWidgetHeight[DetailPageWidgetKeys.SERVICE_ENTITY_TABLE] +
          0.5,
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
          {
            h: this.defaultWidgetHeight[
              DetailPageWidgetKeys.SERVICE_ENTITY_TABLE
            ],
            i: DetailPageWidgetKeys.SERVICE_ENTITY_TABLE,
            w: 1,
            x: 0,
            y: 1,
            static: false,
          },
        ],
        static: true,
      },
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.DATA_PRODUCTS],
        i: DetailPageWidgetKeys.DATA_PRODUCTS,
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
        y: 6,
        static: false,
      },
    ];
  }

  public getDummyData(): ServicesType {
    return SERVICE_DUMMY_DATA;
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.SERVICE_ENTITY_TABLE,
        name: i18n.t('label.entity-detail-plural', {
          entity: i18n.t('label.service'),
        }),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
      DATA_PRODUCTS_WIDGET,
      TAGS_WIDGET,
      GLOSSARY_TERMS_WIDGET,
      CUSTOM_PROPERTIES_WIDGET,
    ];
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getServiceWidgetsFromKey(widgetConfig);
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case DetailPageWidgetKeys.DESCRIPTION:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION];
      case DetailPageWidgetKeys.SERVICE_ENTITY_TABLE:
        return this.defaultWidgetHeight[
          DetailPageWidgetKeys.SERVICE_ENTITY_TABLE
        ];
      case DetailPageWidgetKeys.DATA_PRODUCTS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.DATA_PRODUCTS];
      case DetailPageWidgetKeys.TAGS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.TAGS];
      case DetailPageWidgetKeys.GLOSSARY_TERMS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.GLOSSARY_TERMS];
      case DetailPageWidgetKeys.CUSTOM_PROPERTIES:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.CUSTOM_PROPERTIES];
      default:
        return 1;
    }
  }
}

const serviceDetailsClassBase = new ServiceDetailsClassBase();

export default serviceDetailsClassBase;
