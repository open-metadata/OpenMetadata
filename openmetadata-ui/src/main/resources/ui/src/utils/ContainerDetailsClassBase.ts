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

import { Layout } from 'react-grid-layout';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import { CONTAINER_DUMMY_DATA } from '../constants/Contianer.constants';
import {
  CUSTOM_PROPERTIES_WIDGET,
  DATA_PRODUCTS_WIDGET,
  DESCRIPTION_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  GridSizes,
  TAGS_WIDGET,
} from '../constants/CustomizeWidgets.constants';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { Container } from '../generated/entity/data/container';
import { Tab } from '../generated/system/ui/uiCustomization';
import { FeedCounts } from '../interface/feed.interface';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import {
  getContainerDetailPageTabs,
  getContainerWidgetsFromKey,
} from './ContainerDetailUtils';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import i18n from './i18next/LocalUtil';

export interface ContainerDetailPageTabProps {
  isDataModelEmpty: boolean;
  decodedContainerName: string;
  editLineagePermission: boolean;
  editCustomAttributePermission: boolean;
  viewAllPermission: boolean;
  feedCount: { totalCount: number };
  getEntityFeedCount: () => Promise<void>;
  handleFeedCount: (data: FeedCounts) => void;
  tab: EntityTabs;
  deleted: boolean;
  containerData: Container;
  fetchContainerDetail: (containerFQN: string) => Promise<void>;
  labelMap?: Record<EntityTabs, string>;
}

enum ContainerWidgetKeys {
  DESCRIPTION = DetailPageWidgetKeys.DESCRIPTION,
  CONTAINER_CHILDREN = DetailPageWidgetKeys.CONTAINER_CHILDREN,
  DATA_PRODUCTS = DetailPageWidgetKeys.DATA_PRODUCTS,
  TAGS = DetailPageWidgetKeys.TAGS,
  GLOSSARY_TERMS = DetailPageWidgetKeys.GLOSSARY_TERMS,
  CUSTOM_PROPERTIES = DetailPageWidgetKeys.CUSTOM_PROPERTIES,
}

class ContainerDetailsClassBase {
  defaultWidgetHeight: Record<ContainerWidgetKeys, number>;

  constructor() {
    this.defaultWidgetHeight = {
      [ContainerWidgetKeys.DESCRIPTION]: 2,
      [ContainerWidgetKeys.CONTAINER_CHILDREN]: 8,
      [ContainerWidgetKeys.DATA_PRODUCTS]: 2,
      [ContainerWidgetKeys.TAGS]: 2,
      [ContainerWidgetKeys.GLOSSARY_TERMS]: 2,
      [ContainerWidgetKeys.CUSTOM_PROPERTIES]: 4,
    };
  }

  public getContainerDetailPageTabs(
    tabProps: ContainerDetailPageTabProps
  ): TabProps[] {
    return getContainerDetailPageTabs(tabProps);
  }

  public getContainerDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.CHILDREN,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.LINEAGE,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: tab === EntityTabs.CHILDREN,
    }));
  }

  public getDefaultLayout(tab?: EntityTabs): Layout[] {
    if (tab && ![EntityTabs.CHILDREN, EntityTabs.SCHEMA].includes(tab)) {
      return [];
    }

    return [
      {
        h: this.defaultWidgetHeight[ContainerWidgetKeys.DESCRIPTION],
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[ContainerWidgetKeys.CONTAINER_CHILDREN],
        i: DetailPageWidgetKeys.CONTAINER_CHILDREN,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[ContainerWidgetKeys.DATA_PRODUCTS],
        i: DetailPageWidgetKeys.DATA_PRODUCTS,
        w: 2,
        x: 6,
        y: 1,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[ContainerWidgetKeys.TAGS],
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[ContainerWidgetKeys.GLOSSARY_TERMS],
        i: DetailPageWidgetKeys.GLOSSARY_TERMS,
        w: 2,
        x: 6,
        y: 3,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[ContainerWidgetKeys.CUSTOM_PROPERTIES],
        i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
        w: 2,
        x: 6,
        y: 6,
        static: false,
      },
    ];
  }

  public getDummyData(): Container {
    return CONTAINER_DUMMY_DATA;
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.CONTAINER_CHILDREN,
        name: i18n.t('label.children'),
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
    return getContainerWidgetsFromKey(widgetConfig);
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case DetailPageWidgetKeys.DESCRIPTION:
        return this.defaultWidgetHeight[ContainerWidgetKeys.DESCRIPTION];
      case DetailPageWidgetKeys.CONTAINER_CHILDREN:
        return this.defaultWidgetHeight[ContainerWidgetKeys.CONTAINER_CHILDREN];
      case DetailPageWidgetKeys.DATA_PRODUCTS:
        return this.defaultWidgetHeight[ContainerWidgetKeys.DATA_PRODUCTS];
      case DetailPageWidgetKeys.TAGS:
        return this.defaultWidgetHeight[ContainerWidgetKeys.TAGS];
      case DetailPageWidgetKeys.GLOSSARY_TERMS:
        return this.defaultWidgetHeight[ContainerWidgetKeys.GLOSSARY_TERMS];
      case DetailPageWidgetKeys.CUSTOM_PROPERTIES:
        return this.defaultWidgetHeight[ContainerWidgetKeys.CUSTOM_PROPERTIES];
      default:
        return 1;
    }
  }
}

const containerDetailsClassBase = new ContainerDetailsClassBase();

export default containerDetailsClassBase;
export { ContainerDetailsClassBase };
