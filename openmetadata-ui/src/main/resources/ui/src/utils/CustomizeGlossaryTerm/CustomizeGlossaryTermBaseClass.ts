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

import { lazy, type ComponentType } from 'react';
import withSuspenseFallback from '../../components/AppRouter/withSuspenseFallback';
import type { CustomizeTabWidgetProps } from '../../components/Customization/CustomizeTabWidget/CustomizeTabWidget';
import type { GlossaryHeaderProps } from '../../components/Glossary/GlossaryHeader/GlossaryHeader.interface';
import {
  CommonWidgetType,
  CUSTOM_PROPERTIES_WIDGET,
  DESCRIPTION_WIDGET,
  DOMAIN_WIDGET,
  KNOWLEDGE_ARTICLE_WIDGET,
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
import { getGlossaryTermWidgetFromKey } from '../GlossaryTerm/GlossaryTermWidgetUtils';
import { getGlossaryChildTermsForCustomization } from './CustomizeGlossaryTermPureUtils';

type ComponentMap = {
  [GlossaryTermDetailPageWidgetKeys.HEADER]: {
    component: ComponentType<GlossaryHeaderProps & WidgetCommonProps>;
    props: GlossaryHeaderProps & WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.TABS]: {
    component: ComponentType<WidgetCommonProps>;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.WORKFLOW_HISTORY]: {
    component: ComponentType<WidgetCommonProps>;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.DESCRIPTION]: {
    component: ComponentType<WidgetCommonProps>;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.TAGS]: {
    component: ComponentType<WidgetCommonProps>;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.DOMAIN]: {
    component: ComponentType<WidgetCommonProps>;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.CUSTOM_PROPERTIES]: {
    component: ComponentType<WidgetCommonProps>;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.SYNONYMS]: {
    component: ComponentType<WidgetCommonProps>;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.RELATED_TERMS]: {
    component: ComponentType<WidgetCommonProps>;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.REFERENCES]: {
    component: ComponentType<WidgetCommonProps>;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.OWNER]: {
    component: ComponentType<WidgetCommonProps>;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.REVIEWER]: {
    component: ComponentType<WidgetCommonProps>;
    props: WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER]: {
    component: ComponentType<WidgetCommonProps>;
    props: WidgetCommonProps;
  };
};

const CustomizeTabWidget = withSuspenseFallback(
  lazy(() =>
    import(
      '../../components/Customization/CustomizeTabWidget/CustomizeTabWidget'
    ).then((module) => ({ default: module.CustomizeTabWidget }))
  )
) as ComponentType<WidgetCommonProps>;

const GenericWidget = withSuspenseFallback(
  lazy(() =>
    import('../../components/Customization/GenericWidget/GenericWidget').then(
      (module) => ({ default: module.GenericWidget })
    )
  )
) as ComponentType<WidgetCommonProps>;

const GlossaryHeader = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/Glossary/GlossaryHeader/GlossaryHeader.component'
      )
  )
) as ComponentType<GlossaryHeaderProps & WidgetCommonProps>;

const GlossaryHeaderWidget = withSuspenseFallback(
  lazy(() =>
    import(
      '../../components/Glossary/GlossaryHeader/GlossaryHeaderWidget'
    ).then((module) => ({ default: module.GlossaryHeaderWidget }))
  )
) as ComponentType<{
  isGlossary?: boolean;
  widgetKey?: string;
}>;

const WIDGET_NAME_TO_KEY: Record<string, GlossaryTermDetailPageWidgetKeys> = {
  HEADER: GlossaryTermDetailPageWidgetKeys.HEADER,
  DESCRIPTION: GlossaryTermDetailPageWidgetKeys.DESCRIPTION,
  TAGS: GlossaryTermDetailPageWidgetKeys.TAGS,
  DOMAIN: GlossaryTermDetailPageWidgetKeys.DOMAIN,
  CUSTOM_PROPERTIES: GlossaryTermDetailPageWidgetKeys.CUSTOM_PROPERTIES,
  TABS: GlossaryTermDetailPageWidgetKeys.TABS,
  SYNONYMS: GlossaryTermDetailPageWidgetKeys.SYNONYMS,
  RELATED_TERMS: GlossaryTermDetailPageWidgetKeys.RELATED_TERMS,
  REFERENCES: GlossaryTermDetailPageWidgetKeys.REFERENCES,
  OWNER: GlossaryTermDetailPageWidgetKeys.OWNER,
  REVIEWER: GlossaryTermDetailPageWidgetKeys.REVIEWER,
  WORKFLOW_HISTORY: GlossaryTermDetailPageWidgetKeys.WORKFLOW_HISTORY,
};

const WIDGET_KEY_TO_HEIGHT_PROP: Record<
  string,
  keyof typeof GlossaryTermDetailPageWidgetKeys
> = {
  [GlossaryTermDetailPageWidgetKeys.HEADER]: 'HEADER',
  [GlossaryTermDetailPageWidgetKeys.DESCRIPTION]: 'DESCRIPTION',
  [GlossaryTermDetailPageWidgetKeys.TAGS]: 'TAGS',
  [GlossaryTermDetailPageWidgetKeys.DOMAIN]: 'DOMAIN',
  [GlossaryTermDetailPageWidgetKeys.CUSTOM_PROPERTIES]: 'CUSTOM_PROPERTIES',
  [GlossaryTermDetailPageWidgetKeys.TABS]: 'TABS',
  [GlossaryTermDetailPageWidgetKeys.SYNONYMS]: 'SYNONYMS',
  [GlossaryTermDetailPageWidgetKeys.RELATED_TERMS]: 'RELATED_TERMS',
  [GlossaryTermDetailPageWidgetKeys.REFERENCES]: 'REFERENCES',
  [GlossaryTermDetailPageWidgetKeys.OWNER]: 'OWNER',
  [GlossaryTermDetailPageWidgetKeys.REVIEWER]: 'REVIEWER',
  [GlossaryTermDetailPageWidgetKeys.WORKFLOW_HISTORY]: 'WORKFLOW_HISTORY',
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
  private _widgets?: ComponentMap;

  get widgets(): ComponentMap {
    if (!this._widgets) {
      this._widgets = {
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

    return this._widgets;
  }

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
    return (
      WIDGET_NAME_TO_KEY[widgetName] ??
      GlossaryTermDetailPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
    );
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
    const heightProp = WIDGET_KEY_TO_HEIGHT_PROP[widgetName];

    return heightProp
      ? this.detailPageWidgetDefaultHeights[heightProp]
      : this.defaultWidgetHeight;
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
            {
              h: this.detailPageWidgetDefaultHeights.RELATED_TERMS,
              i: GlossaryTermDetailPageWidgetKeys.RELATED_TERMS,
              w: 1,
              x: 0,
              y: 3,
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
      KNOWLEDGE_ARTICLE_WIDGET,
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
    return getGlossaryChildTermsForCustomization();
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getGlossaryTermWidgetFromKey(widgetConfig);
  }
}

const customizeGlossaryTermPageClassBase =
  new CustomizeGlossaryTermPageClassBase();

export default customizeGlossaryTermPageClassBase;
export { CustomizeGlossaryTermPageClassBase };
