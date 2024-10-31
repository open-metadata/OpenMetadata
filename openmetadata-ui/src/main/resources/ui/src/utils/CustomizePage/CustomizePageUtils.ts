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
import { PageType } from '../../generated/system/ui/page';
import { Tab } from '../../generated/system/ui/uiCustomization';
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
  const commonTabs: Tab[] = [
    {
      displayName: 'Feeds & Tasks',
      name: 'feeds-tasks',
      id: 'feeds-tasks',
      layout: [],
      removable: false,
    },
    {
      id: 'custom-property',
      name: 'custom-property',
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
          id: 'overview',
          displayName: 'Overview',
          layout: [],
          name: 'overview',
          removable: false,
        },
        {
          id: 'terms',
          displayName: 'Glossary Terms',
          layout: [],
          name: 'terms',
          removable: false,
        },
        {
          id: 'assets',
          displayName: 'Assets',
          layout: [],
          name: 'assets',
          removable: false,
        },
      ];
    case PageType.Table:
    default:
      return commonTabs;
  }
};
