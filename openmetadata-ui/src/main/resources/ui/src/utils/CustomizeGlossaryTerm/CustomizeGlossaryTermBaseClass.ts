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

import {
  CustomizeTabWidget,
  CustomizeTabWidgetProps,
} from '../../components/Customization/CustomizeTabWidget/CustomizeTabWidget';
import { GenericWidget } from '../../components/Customization/GenericWidget/GenericWidget';
import GlossaryHeader from '../../components/Glossary/GlossaryHeader/GlossaryHeader.component';
import { GlossaryHeaderProps } from '../../components/Glossary/GlossaryHeader/GlossaryHeader.interface';
import { GlossaryHeaderWidget } from '../../components/Glossary/GlossaryHeader/GlossaryHeaderWidget';
import {
  CommonWidgetType,
  CUSTOM_PROPERTIES_WIDGET,
  DESCRIPTION_WIDGET,
  DOMAIN_WIDGET,
  OWNER_WIDGET,
  REFERENCES_WIDGET,
  RELATED_TERMS_WIDGET,
  REVIEWER_WIDGET,
  SYNONYMS_WIDGET,
  TAGS_WIDGET,
  TERMS_TABLE_WIDGET,
} from '../../constants/CustomizeWidgets.constants';
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../pages/CustomizablePage/CustomizablePage.interface';
import { getGlossaryTermWidgetFromKey } from '../GlossaryTerm/GlossaryTermUtil';

type ComponentMap = {
  [GlossaryTermDetailPageWidgetKeys.HEADER]: {
    component: typeof GlossaryHeader;
    props: GlossaryHeaderProps & WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.TABS]: {
    component: typeof CustomizeTabWidget;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.WORKFLOW_HISTORY]: {
    component: typeof GenericWidget;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.DESCRIPTION]: {
    component: typeof GenericWidget;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.TAGS]: {
    component: typeof GenericWidget;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.DOMAIN]: {
    component: typeof GenericWidget;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.CUSTOM_PROPERTIES]: {
    component: typeof GenericWidget;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.SYNONYMS]: {
    component: typeof GenericWidget;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.RELATED_TERMS]: {
    component: typeof GenericWidget;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.REFERENCES]: {
    component: typeof GenericWidget;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.OWNER]: {
    component: typeof GenericWidget;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.REVIEWER]: {
    component: typeof GenericWidget;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER]: {
    component: typeof GenericWidget;
    props: WidgetCommonProps;
  };
};

class CustomizeGlossaryTermPageClassBase {
  defaultWidgetHeight = 2;
  detailPageWidgetMargin = 16;
  detailPageRowHeight = 100;
  detailPageMaxGridSize = 4;
  defaultLayout: Array<WidgetConfig> = [];
  detailPageWidgetDefaultHeights: Record<
    keyof typeof GlossaryTermDetailPageWidgetKeys,
    number
  >;
  widgets: ComponentMap;

  constructor() {
    this.detailPageWidgetDefaultHeights = {
      HEADER: 1,
      DESCRIPTION: 2,
      TAGS: 2,
      DOMAIN: 2,
      CUSTOM_PROPERTIES: 4,
      TABS: 10,
      SYNONYMS: 2,
      RELATED_TERMS: 2,
      REFERENCES: 2,
      OWNER: 2,
      REVIEWER: 2,
      TERMS_TABLE: 1,
      EMPTY_WIDGET_PLACEHOLDER: 3,
      WORKFLOW_HISTORY: 1,
    };

    this.defaultLayout = [
      {
        h: this.detailPageWidgetDefaultHeights.HEADER,
        i: GlossaryTermDetailPageWidgetKeys.HEADER,
        w: 8,
        x: 0,
        y: 0,
        static: true,
      },
      {
        h: this.detailPageWidgetDefaultHeights.TABS,
        i: GlossaryTermDetailPageWidgetKeys.TABS,
        w: 8,
        x: 0,
        y: 1,
        static: true,
      },
    ];

    this.widgets = {
      [GlossaryTermDetailPageWidgetKeys.HEADER]: {
        component: GlossaryHeader,
        props: {} as GlossaryHeaderProps & WidgetCommonProps,
      },
      [GlossaryTermDetailPageWidgetKeys.TABS]: {
        component: CustomizeTabWidget,
        props: {} as CustomizeTabWidgetProps,
      },
      [GlossaryTermDetailPageWidgetKeys.DESCRIPTION]: {
        component: GenericWidget,
        props: {} as WidgetCommonProps,
      },
      [GlossaryTermDetailPageWidgetKeys.TAGS]: {
        component: GenericWidget,
        props: {} as WidgetCommonProps,
      },
      [GlossaryTermDetailPageWidgetKeys.DOMAIN]: {
        component: GenericWidget,
        props: {} as WidgetCommonProps,
      },
      [GlossaryTermDetailPageWidgetKeys.CUSTOM_PROPERTIES]: {
        component: GenericWidget,
        props: {} as WidgetCommonProps,
      },
      [GlossaryTermDetailPageWidgetKeys.SYNONYMS]: {
        component: GenericWidget,
        props: {} as WidgetCommonProps,
      },
      [GlossaryTermDetailPageWidgetKeys.RELATED_TERMS]: {
        component: GenericWidget,
        props: {} as WidgetCommonProps,
      },
      [GlossaryTermDetailPageWidgetKeys.REFERENCES]: {
        component: GenericWidget,
        props: {} as WidgetCommonProps,
      },
      [GlossaryTermDetailPageWidgetKeys.OWNER]: {
        component: GenericWidget,
        props: {} as WidgetCommonProps,
      },
      [GlossaryTermDetailPageWidgetKeys.REVIEWER]: {
        component: GenericWidget,
        props: {} as WidgetCommonProps,
      },
      [GlossaryTermDetailPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER]: {
        component: GenericWidget,
        props: {} as WidgetCommonProps,
      },
      [GlossaryTermDetailPageWidgetKeys.WORKFLOW_HISTORY]: {
        component: GenericWidget,
        props: {} as WidgetCommonProps,
      },
    };
  }

  protected updateDefaultLayoutLayout(layout: Array<WidgetConfig>) {
    this.defaultLayout = layout;
  }

  protected updateLandingPageWidgetDefaultHeights(obj: Record<string, number>) {
    this.detailPageWidgetDefaultHeights = obj;
  }

  public getKeyFromWidgetName(
    widgetName: string
  ): GlossaryTermDetailPageWidgetKeys {
    switch (widgetName) {
      case 'HEADER':
        return GlossaryTermDetailPageWidgetKeys.HEADER;
      case 'DESCRIPTION':
        return GlossaryTermDetailPageWidgetKeys.DESCRIPTION;
      case 'TAGS':
        return GlossaryTermDetailPageWidgetKeys.TAGS;
      case 'DOMAIN':
        return GlossaryTermDetailPageWidgetKeys.DOMAIN;
      case 'CUSTOM_PROPERTIES':
        return GlossaryTermDetailPageWidgetKeys.CUSTOM_PROPERTIES;
      case 'TABS':
        return GlossaryTermDetailPageWidgetKeys.TABS;
      case 'SYNONYMS':
        return GlossaryTermDetailPageWidgetKeys.SYNONYMS;
      case 'RELATED_TERMS':
        return GlossaryTermDetailPageWidgetKeys.RELATED_TERMS;
      case 'REFERENCES':
        return GlossaryTermDetailPageWidgetKeys.REFERENCES;
      case 'OWNER':
        return GlossaryTermDetailPageWidgetKeys.OWNER;
      case 'REVIEWER':
        return GlossaryTermDetailPageWidgetKeys.REVIEWER;
      case 'WORKFLOW_HISTORY':
        return GlossaryTermDetailPageWidgetKeys.WORKFLOW_HISTORY;
      default:
        return GlossaryTermDetailPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER;
    }
  }

  /**
   *
   * @param string widgetKey
   * @returns React.FC<
    {
      
      widgetKey: string;
      
    }
  >
   */
  public getWidgetFromKey(widgetKey: string) {
    if (widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.HEADER)) {
      return GlossaryHeaderWidget;
    } else if (widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.TABS)) {
      return CustomizeTabWidget;
    } else {
      return GenericWidget;
    }
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case GlossaryTermDetailPageWidgetKeys.HEADER:
        return this.detailPageWidgetDefaultHeights.HEADER;
      case GlossaryTermDetailPageWidgetKeys.DESCRIPTION:
        return this.detailPageWidgetDefaultHeights.DESCRIPTION;
      case GlossaryTermDetailPageWidgetKeys.TAGS:
        return this.detailPageWidgetDefaultHeights.TAGS;
      case GlossaryTermDetailPageWidgetKeys.DOMAIN:
        return this.detailPageWidgetDefaultHeights.DOMAIN;
      case GlossaryTermDetailPageWidgetKeys.CUSTOM_PROPERTIES:
        return this.detailPageWidgetDefaultHeights.CUSTOM_PROPERTIES;
      case GlossaryTermDetailPageWidgetKeys.TABS:
        return this.detailPageWidgetDefaultHeights.TABS;
      case GlossaryTermDetailPageWidgetKeys.SYNONYMS:
        return this.detailPageWidgetDefaultHeights.SYNONYMS;
      case GlossaryTermDetailPageWidgetKeys.RELATED_TERMS:
        return this.detailPageWidgetDefaultHeights.RELATED_TERMS;
      case GlossaryTermDetailPageWidgetKeys.REFERENCES:
        return this.detailPageWidgetDefaultHeights.REFERENCES;
      case GlossaryTermDetailPageWidgetKeys.OWNER:
        return this.detailPageWidgetDefaultHeights.OWNER;
      case GlossaryTermDetailPageWidgetKeys.REVIEWER:
        return this.detailPageWidgetDefaultHeights.REVIEWER;
      case GlossaryTermDetailPageWidgetKeys.WORKFLOW_HISTORY:
        return this.detailPageWidgetDefaultHeights.WORKFLOW_HISTORY;

      default:
        return this.defaultWidgetHeight;
    }
  }

  public getDefaultWidgetForTab(tab: EntityTabs) {
    if (!tab || tab === EntityTabs.OVERVIEW) {
      return [
        {
          h: 7,
          i: DetailPageWidgetKeys.LEFT_PANEL,
          w: 6,
          x: 0,
          y: 0,
          children: [
            {
              h: this.detailPageWidgetDefaultHeights.DESCRIPTION,
              i: DetailPageWidgetKeys.DESCRIPTION,
              w: 1,
              x: 0,
              y: 0,
              static: false,
            },
            {
              h: this.detailPageWidgetDefaultHeights.SYNONYMS,
              i: GlossaryTermDetailPageWidgetKeys.SYNONYMS,
              w: 0.5,
              x: 0,
              y: 1,
              static: false,
            },
            {
              h: this.detailPageWidgetDefaultHeights.RELATED_TERMS,
              i: GlossaryTermDetailPageWidgetKeys.RELATED_TERMS,
              w: 0.5,
              x: 3,
              y: 1,
              static: false,
            },
            {
              h: this.detailPageWidgetDefaultHeights.REFERENCES,
              i: GlossaryTermDetailPageWidgetKeys.REFERENCES,
              w: 0.5,
              x: 0,
              y: 2,
              static: false,
            },
            {
              h: this.detailPageWidgetDefaultHeights.TAGS,
              i: DetailPageWidgetKeys.TAGS,
              w: 0.5,
              x: 3,
              y: 2,
              static: false,
            },
          ],
          static: true,
        },
        {
          h: this.detailPageWidgetDefaultHeights.WORKFLOW_HISTORY,
          i: GlossaryTermDetailPageWidgetKeys.WORKFLOW_HISTORY,
          w: 2,
          x: 6,
          y: 0,
          static: false,
        },
        {
          h: this.detailPageWidgetDefaultHeights.DOMAIN,
          i: DetailPageWidgetKeys.DOMAIN,
          w: 2,
          x: 6,
          y: 1,
          static: false,
        },
        {
          h: this.detailPageWidgetDefaultHeights.OWNER,
          i: GlossaryTermDetailPageWidgetKeys.OWNER,
          w: 2,
          x: 6,
          y: 2,
          static: false,
        },
        {
          h: this.detailPageWidgetDefaultHeights.REVIEWER,
          i: GlossaryTermDetailPageWidgetKeys.REVIEWER,
          w: 2,
          x: 6,
          y: 3,
          static: false,
        },
        {
          h: this.detailPageWidgetDefaultHeights.CUSTOM_PROPERTIES,
          i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
          w: 2,
          x: 6,
          y: 4,
          static: false,
        },
      ];
    }

    return [];
  }

  public getCommonWidgetList(isGlossary: boolean): CommonWidgetType[] {
    const commonWidgetList = [
      DESCRIPTION_WIDGET,
      TERMS_TABLE_WIDGET,
      DOMAIN_WIDGET,
      REFERENCES_WIDGET,
      REVIEWER_WIDGET,
      CUSTOM_PROPERTIES_WIDGET,
      TAGS_WIDGET,
    ];

    return isGlossary
      ? commonWidgetList
      : [
          ...commonWidgetList,
          OWNER_WIDGET,
          SYNONYMS_WIDGET,
          RELATED_TERMS_WIDGET,
        ];
  }

  public getGlossaryChildTerms() {
    return [
      {
        id: 'ea7c8380-34a9-4ea9-93ea-a812c0e838d6',
        name: 'Finance',
        displayName: 'Finance',
        description:
          'A finance department is the unit of a business responsible for obtaining and handling any monies on behalf of the organization',
        fullyQualifiedName: 'Business Department.Finance',
        glossary: {
          id: 'dae534b6-f5d1-4fc7-9ddf-0d1ec9df5c7e',
          type: 'glossary',
          name: 'Business Department',
          fullyQualifiedName: 'Business Department',
          description:
            'Businesses often have several departments that perform unique functions, allowing them to operate efficiently and successfully.',
          displayName: 'Business Department',
          deleted: false,
        },
        references: [],
        version: 0.9,
        updatedAt: 1727894458563,
        owners: [],
        status: 'Approved',
        deleted: false,
        mutuallyExclusive: false,
        childrenCount: 1,
      },
      {
        id: 'a8409ff4-b540-4ab0-9332-73f34125651c',
        name: 'FOO',
        displayName: '',
        description: 'VCASCAS',

        fullyQualifiedName: 'Business Department.FOO',
        synonyms: [],
        glossary: {
          id: 'dae534b6-f5d1-4fc7-9ddf-0d1ec9df5c7e',
          type: 'glossary',
          name: 'Business Department',
          fullyQualifiedName: 'Business Department',
          description:
            'Businesses often have several departments that perform unique functions, allowing them to operate efficiently and successfully.',
          displayName: 'Business Department',
          deleted: false,
        },
        references: [],
        version: 0.1,
        updatedAt: 1724662513442,
        updatedBy: 'teddy',
        owners: [],
        status: 'Approved',
        deleted: false,
        mutuallyExclusive: false,
        childrenCount: 0,
      },
      {
        id: '5c415db9-0927-4815-b31b-ae8247ea6b0a',
        name: 'Human resources',
        displayName: 'Human resources',
        description:
          'Human resources (HR) is the department in a company that handles all things related to employees.',

        fullyQualifiedName: 'Business Department.Human resources',
        synonyms: ['Manpower', 'Human capital'],
        glossary: {
          id: 'dae534b6-f5d1-4fc7-9ddf-0d1ec9df5c7e',
          type: 'glossary',
          name: 'Business Department',
          fullyQualifiedName: 'Business Department',
          description:
            'Businesses often have several departments that perform unique functions, allowing them to operate efficiently and successfully.',
          displayName: 'Business Department',
          deleted: false,
        },
        references: [],
        version: 0.2,
        updatedAt: 1701067069097,
        owners: [],
        status: 'Approved',
        deleted: false,
        mutuallyExclusive: false,
        childrenCount: 0,
      },
      {
        id: 'e866ee75-711a-4649-968d-3ea889bd75b8',
        name: 'Marketing',
        displayName: 'Marketing',
        description:
          'A marketing department is a division within a business that helps to promote its brand, products and services.',
        style: {},
        fullyQualifiedName: 'Business Department.Marketing',
        synonyms: ['Sell', 'Retails'],
        glossary: {
          id: 'dae534b6-f5d1-4fc7-9ddf-0d1ec9df5c7e',
          type: 'glossary',
          name: 'Business Department',
          fullyQualifiedName: 'Business Department',
          description:
            'Businesses often have several departments that perform unique functions, allowing them to operate efficiently and successfully.',
          displayName: 'Business Department',
          deleted: false,
        },
        references: [],
        version: 0.2,
        updatedAt: 1700558309238,
        owners: [],
        status: 'Rejected',
        deleted: false,
        mutuallyExclusive: false,
        childrenCount: 1,
      },
      {
        id: '288cfb46-a4c2-45a4-9dc0-321eac165812',
        name: 'test_business_term',
        displayName: 'Test Business Term',
        description: 'this is test_business_term',
        fullyQualifiedName: 'Business Department.test_business_term',
        version: 0.2,
        updatedAt: 1728547870161,
        owners: [],
        deleted: false,
        mutuallyExclusive: false,
      },
    ];
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getGlossaryTermWidgetFromKey(widgetConfig);
  }
}

const customizeGlossaryTermPageClassBase =
  new CustomizeGlossaryTermPageClassBase();

export default customizeGlossaryTermPageClassBase;
export { CustomizeGlossaryTermPageClassBase };
