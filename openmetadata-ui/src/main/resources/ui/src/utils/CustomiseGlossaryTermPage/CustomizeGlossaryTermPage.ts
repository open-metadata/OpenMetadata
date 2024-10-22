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
} from '../../components/Glossary/CustomiseWidgets/CustomizeTabWidget/CustomizeTabWidget';
import { GenericWidget } from '../../components/Glossary/CustomiseWidgets/SynonymsWidget/GenericWidget';
import GlossaryHeader from '../../components/Glossary/GlossaryHeader/GlossaryHeader.component';
import { GlossaryHeaderProps } from '../../components/Glossary/GlossaryHeader/GlossaryHeader.interface';
import { GlossaryTermDetailPageWidgetKeys } from '../../enums/CustomiseDetailPage.enum';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../pages/CustomizablePage/CustomizablePage.interface';

type ComponentMap = {
  [GlossaryTermDetailPageWidgetKeys.HEADER]: {
    component: typeof GlossaryHeader;
    props: GlossaryHeaderProps & WidgetCommonProps;
  };
  [GlossaryTermDetailPageWidgetKeys.TABS]: {
    component: typeof CustomizeTabWidget;
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
      TAGS: 1,
      DOMAIN: 1,
      CUSTOM_PROPERTIES: 3,
      TABS: 1,
      SYNONYMS: 1,
      RELATED_TERMS: 1,
      REFERENCES: 1,
      OWNER: 1,
      REVIEWER: 1,
      EMPTY_WIDGET_PLACEHOLDER: 3,
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
      {
        h: this.detailPageWidgetDefaultHeights.DESCRIPTION,
        i: GlossaryTermDetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 2,
        static: false,
      },
      {
        h: this.detailPageWidgetDefaultHeights.CUSTOM_PROPERTIES,
        i: GlossaryTermDetailPageWidgetKeys.CUSTOM_PROPERTIES,
        w: 2,
        x: 6,
        y: 9,
        static: false,
      },
      {
        h: this.detailPageWidgetDefaultHeights.DOMAIN,
        i: GlossaryTermDetailPageWidgetKeys.DOMAIN,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      },
      {
        h: this.detailPageWidgetDefaultHeights.SYNONYMS,
        i: GlossaryTermDetailPageWidgetKeys.SYNONYMS,
        w: 3,
        x: 0,
        y: 4,
        static: false,
      },
      {
        h: this.detailPageWidgetDefaultHeights.RELATED_TERMS,
        i: GlossaryTermDetailPageWidgetKeys.RELATED_TERMS,
        w: 3,
        x: 3,
        y: 4,
        static: false,
      },
      {
        h: this.detailPageWidgetDefaultHeights.REFERENCES,
        i: GlossaryTermDetailPageWidgetKeys.REFERENCES,
        w: 3,
        x: 0,
        y: 5,
        static: false,
      },

      {
        h: this.detailPageWidgetDefaultHeights.TAGS,
        i: GlossaryTermDetailPageWidgetKeys.TAGS,
        w: 3,
        x: 3,
        y: 5,
        static: false,
      },
      {
        h: this.detailPageWidgetDefaultHeights.OWNER,
        i: GlossaryTermDetailPageWidgetKeys.OWNER,
        w: 2,
        x: 6,
        y: 3,
        static: false,
      },
      {
        h: this.detailPageWidgetDefaultHeights.REVIEWER,
        i: GlossaryTermDetailPageWidgetKeys.REVIEWER,
        w: 2,
        x: 6,
        y: 6,
        static: false,
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
      default:
        return GlossaryTermDetailPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER;
    }
  }

  /**
   *
   * @param string widgetKey
   * @returns React.FC<
    {
      isEditView?: boolean;
      widgetKey: string;
      handleRemoveWidget?: (widgetKey: string) => void;
      announcements: Thread[];
      followedData: EntityReference[];
      followedDataCount: number;
      isLoadingOwnedData: boolean;
    }
  >
   */
  public getWidgetsFromKey<T extends GlossaryTermDetailPageWidgetKeys>(
    widgetKey: T
  ): ComponentMap[T]['component'] {
    return this.widgets[widgetKey].component;
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case 'HEADER':
        return this.detailPageWidgetDefaultHeights.HEADER;
      case 'DESCRIPTION':
        return this.detailPageWidgetDefaultHeights.DESCRIPTION;
      case 'TAGS':
        return this.detailPageWidgetDefaultHeights.TAGS;
      case 'DOMAIN':
        return this.detailPageWidgetDefaultHeights.DOMAIN;
      case 'CUSTOM_PROPERTIES':
        return this.detailPageWidgetDefaultHeights.CUSTOM_PROPERTIES;
      case 'TABS':
        return this.detailPageWidgetDefaultHeights.TABS;
      case 'SYNONYMS':
        return this.detailPageWidgetDefaultHeights.SYNONYMS;
      case 'RELATED_TERMS':
        return this.detailPageWidgetDefaultHeights.RELATED_TERMS;
      case 'REFERENCES':
        return this.detailPageWidgetDefaultHeights.REFERENCES;
      case 'OWNER':
        return this.detailPageWidgetDefaultHeights.OWNER;
      case 'REVIEWER':
        return this.detailPageWidgetDefaultHeights.REVIEWER;
      default:
        return this.defaultWidgetHeight;
    }
  }
}

const customizeGlossaryTermPageClassBase =
  new CustomizeGlossaryTermPageClassBase();

export default customizeGlossaryTermPageClassBase;
export { CustomizeGlossaryTermPageClassBase };
