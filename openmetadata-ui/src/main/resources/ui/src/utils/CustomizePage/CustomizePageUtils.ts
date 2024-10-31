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
import { GlossaryTabs } from '../../enums/GlossaryPage.enum';
import { PageType } from '../../generated/system/ui/page';
import { Tab as CustomizeTab } from '../../generated/system/ui/uiCustomization';
import customizeGlossaryTermPageClassBase from '../CustomiseGlossaryTermPage/CustomizeGlossaryTermPage';
import customizeDetailPageClassBase from '../CustomizeDetailPage/CustomizeDetailPage';
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

export const getDefaultTabs = (pageType?: string) => {
  const commonTabs: CustomizeTab[] = [
    {
      displayName: 'Feeds & Tasks',
      name: GlossaryTabs.ACTIVITY_FEED,
      id: GlossaryTabs.ACTIVITY_FEED,
      layout: [],
      removable: false,
    },
    {
      id: GlossaryTabs.CUSTOM_PROPERTIES,
      name: GlossaryTabs.CUSTOM_PROPERTIES,
      displayName: 'Custom Property',
      layout: [],
      removable: false,
    },
  ];

  switch (pageType) {
    case PageType.GlossaryTerm:
      return [
        ...commonTabs,
        {
          id: GlossaryTabs.OVERVIEW,
          displayName: 'Overview',
          layout: [],
          name: GlossaryTabs.OVERVIEW,
          removable: false,
        },
        {
          id: GlossaryTabs.GLOSSARY_TERMS,
          displayName: 'Glossary Terms',
          layout: [],
          name: GlossaryTabs.GLOSSARY_TERMS,
          removable: false,
        },
        {
          id: GlossaryTabs.ASSETS,
          displayName: 'Assets',
          layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
            GlossaryTabs.ASSETS
          ),
          name: GlossaryTabs.ASSETS,
          removable: false,
        },
      ];
    case PageType.Table:
    default:
      return commonTabs;
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
