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
import { TabsProps } from 'antd';
import {
  CommonWidgetType,
  CUSTOM_PROPERTIES_WIDGET,
  DESCRIPTION_WIDGET,
  DOMAIN_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  TAGS_WIDGET,
} from '../../constants/CustomizeWidgets.constants';
import { EntityTabs } from '../../enums/entity.enum';
import { PageType } from '../../generated/system/ui/page';
import customizeGlossaryTermPageClassBase from '../CustomiseGlossaryTermPage/CustomizeGlossaryTermPage';
import customizeDetailPageClassBase from '../CustomizeDetailPage/CustomizeDetailPage';
import customizeGlossaryPageClassBase from '../CustomizeGlossaryPage/CustomizeGlossaryPage';
import customizeMyDataPageClassBase from '../CustomizeMyDataPageClassBase';

export const getDefaultLayout = (pageType: string) => {
  switch (pageType) {
    case PageType.GlossaryTerm:
      return customizeGlossaryTermPageClassBase.defaultLayout;
    case PageType.Table:
      return customizeDetailPageClassBase.defaultLayout;
    case PageType.LandingPage:
    default:
      return customizeMyDataPageClassBase.defaultLayout;
  }
};

export const getGlossaryTermDefaultTabs = () => {
  return [
    {
      id: EntityTabs.OVERVIEW,
      displayName: 'Overview',
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.OVERVIEW
      ),
      name: EntityTabs.OVERVIEW,
      removable: false,
      editable: true,
    },
    {
      id: EntityTabs.GLOSSARY_TERMS,
      displayName: 'Glossary Terms',
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.GLOSSARY_TERMS
      ),
      name: EntityTabs.GLOSSARY_TERMS,
      removable: false,
      editable: false,
    },
    {
      id: EntityTabs.ASSETS,
      displayName: 'Assets',
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.ASSETS
      ),
      name: EntityTabs.ASSETS,
      removable: false,
      editable: false,
    },
    {
      displayName: 'Activity Feeds & Tasks',
      name: EntityTabs.ACTIVITY_FEED,
      id: EntityTabs.ACTIVITY_FEED,
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.ACTIVITY_FEED
      ),
      removable: false,
      editable: false,
    },
    {
      id: EntityTabs.CUSTOM_PROPERTIES,
      name: EntityTabs.CUSTOM_PROPERTIES,
      displayName: 'Custom Property',
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.CUSTOM_PROPERTIES
      ),
      removable: false,
      editable: false,
    },
  ];
};

export const getGlossaryDefaultTabs = () => {
  return [
    {
      id: EntityTabs.TERMS,
      name: EntityTabs.TERMS,
      displayName: 'Terms',
      layout: customizeGlossaryPageClassBase.getDefaultWidgetForTab(
        EntityTabs.TERMS
      ),
      removable: false,
      editable: true,
    },
    {
      displayName: 'Activity Feeds & Tasks',
      name: EntityTabs.ACTIVITY_FEED,
      id: EntityTabs.ACTIVITY_FEED,
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.ACTIVITY_FEED
      ),
      removable: false,
      editable: false,
    },
  ];
};

export const getDefaultTabs = (pageType?: string) => {
  switch (pageType) {
    case PageType.GlossaryTerm:
      return getGlossaryTermDefaultTabs();
    case PageType.Glossary:
      return getGlossaryDefaultTabs();
    case PageType.Table:
    default:
      return [
        {
          id: EntityTabs.CUSTOM_PROPERTIES,
          name: EntityTabs.CUSTOM_PROPERTIES,
          displayName: 'Custom Property',
          layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
            EntityTabs.CUSTOM_PROPERTIES
          ),
          removable: false,
        },
      ];
  }
};

export const sortTabs = (tabs: TabsProps['items'], order: string[]) => {
  return [...(tabs ?? [])].sort((a, b) => {
    const orderA = order.indexOf(a.key!);
    const orderB = order.indexOf(b.key!);

    if (orderA !== -1 && orderB !== -1) {
      return orderA - orderB;
    }
    if (orderA !== -1) {
      return -1;
    }
    if (orderB !== -1) {
      return 1;
    }

    const ia = tabs?.indexOf(a) ?? 0;
    const ib = tabs?.indexOf(b) ?? 0;

    return ia - ib;
  });
};

export const getCustomizableWidgetByPage = (
  pageType: PageType
): CommonWidgetType[] => {
  switch (pageType) {
    case PageType.GlossaryTerm:
    case PageType.Glossary:
      return customizeGlossaryTermPageClassBase.getCommonWidgetList();

    case PageType.Table:
      return [
        DESCRIPTION_WIDGET,
        CUSTOM_PROPERTIES_WIDGET,
        DOMAIN_WIDGET,
        TAGS_WIDGET,
        GLOSSARY_TERMS_WIDGET,
      ];
    case PageType.LandingPage:
    default:
      return [];
  }
};
