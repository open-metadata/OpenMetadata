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
import { GlossaryHeaderWidget } from '../../components/Glossary/GlossaryHeader/GlossaryHeaderWidget';
import { GlossaryTermDetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
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

class CustomizeGlossaryPageClassBase {
  defaultWidgetHeight = 2;
  detailWidgetMargin = 16;
  rowHeight = 100;
  maxGridSize = 4;
  defaultLayout: Array<WidgetConfig> = [];
  defaultHeights: Record<keyof typeof GlossaryTermDetailPageWidgetKeys, number>;
  widgets: ComponentMap;

  constructor() {
    this.defaultHeights = {
      HEADER: 1,
      DESCRIPTION: 2,
      TAGS: 2,
      DOMAIN: 1,
      CUSTOM_PROPERTIES: 3,
      TABS: 10,
      SYNONYMS: 1,
      RELATED_TERMS: 1,
      REFERENCES: 1,
      OWNER: 1,
      REVIEWER: 1,
      TERMS_TABLE: 6,
      EMPTY_WIDGET_PLACEHOLDER: 3,
    };

    this.defaultLayout = [
      {
        h: this.defaultHeights.HEADER,
        i: GlossaryTermDetailPageWidgetKeys.HEADER,
        w: 8,
        x: 0,
        y: 0,
        static: true,
      },
      {
        h: this.defaultHeights.TABS,
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
    };
  }

  protected updateDefaultLayoutLayout(layout: Array<WidgetConfig>) {
    this.defaultLayout = layout;
  }

  protected updateLandingPageWidgetDefaultHeights(obj: Record<string, number>) {
    this.defaultHeights = obj;
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
  ) {
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
      case 'HEADER':
        return this.defaultHeights.HEADER;
      case 'DESCRIPTION':
        return this.defaultHeights.DESCRIPTION;
      case 'TAGS':
        return this.defaultHeights.TAGS;
      case 'DOMAIN':
        return this.defaultHeights.DOMAIN;
      case 'CUSTOM_PROPERTIES':
        return this.defaultHeights.CUSTOM_PROPERTIES;
      case 'TABS':
        return this.defaultHeights.TABS;
      case 'SYNONYMS':
        return this.defaultHeights.SYNONYMS;
      case 'RELATED_TERMS':
        return this.defaultHeights.RELATED_TERMS;
      case 'REFERENCES':
        return this.defaultHeights.REFERENCES;
      case 'OWNER':
        return this.defaultHeights.OWNER;
      case 'REVIEWER':
        return this.defaultHeights.REVIEWER;
      default:
        return this.defaultWidgetHeight;
    }
  }

  public getDefaultWidgetForTab(tab: EntityTabs) {
    if (tab === EntityTabs.TERMS) {
      return [
        {
          h: this.defaultHeights.DESCRIPTION,
          i: GlossaryTermDetailPageWidgetKeys.DESCRIPTION,
          w: 6,
          x: 0,
          y: 0,
          static: false,
        },
        {
          h: this.defaultHeights.TERMS_TABLE,
          i: GlossaryTermDetailPageWidgetKeys.TERMS_TABLE,
          w: 6,
          x: 0,
          y: 0,
          static: false,
        },
        {
          h: this.defaultHeights.DOMAIN,
          i: GlossaryTermDetailPageWidgetKeys.DOMAIN,
          w: 2,
          x: 6,
          y: 0,
        },
        {
          h: this.defaultHeights.OWNER,
          i: GlossaryTermDetailPageWidgetKeys.OWNER,
          w: 2,
          x: 6,
          y: 1,
          static: false,
        },

        {
          h: this.defaultHeights.REVIEWER,
          i: GlossaryTermDetailPageWidgetKeys.REVIEWER,
          w: 2,
          x: 6,
          y: 2,
          static: false,
        },
        {
          h: this.defaultHeights.TAGS,
          i: GlossaryTermDetailPageWidgetKeys.TAGS,
          w: 2,
          x: 6,
          y: 3,
          static: false,
        },
      ];
    }

    return [];
  }
}

const customizeGlossaryPageClassBase = new CustomizeGlossaryPageClassBase();

export default customizeGlossaryPageClassBase;
export { CustomizeGlossaryPageClassBase };
