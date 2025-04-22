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
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import { getGlossaryWidgetFromKey } from '../GlossaryUtils';

class CustomizeGlossaryPageClassBase {
  defaultWidgetHeight = 2;
  defaultHeights: Record<keyof typeof GlossaryTermDetailPageWidgetKeys, number>;

  constructor() {
    this.defaultHeights = {
      HEADER: 1,
      DESCRIPTION: 2,
      TAGS: 2,
      DOMAIN: 1.5,
      CUSTOM_PROPERTIES: 4,
      TABS: 8,
      SYNONYMS: 2,
      RELATED_TERMS: 2,
      REFERENCES: 2,
      OWNER: 2,
      REVIEWER: 2,
      TERMS_TABLE: 7.5,
      EMPTY_WIDGET_PLACEHOLDER: 3,
    };
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
    if (!tab || tab === EntityTabs.TERMS) {
      return [
        {
          h:
            this.defaultHeights.DESCRIPTION +
            this.defaultHeights.TERMS_TABLE +
            0.3,
          i: DetailPageWidgetKeys.LEFT_PANEL,
          w: 6,
          x: 0,
          y: 0,
          children: [
            {
              h: this.defaultHeights.DESCRIPTION,
              i: DetailPageWidgetKeys.DESCRIPTION,
              w: 1,
              x: 0,
              y: 0,
              static: false,
            },
            {
              h: this.defaultHeights.TERMS_TABLE,
              i: GlossaryTermDetailPageWidgetKeys.TERMS_TABLE,
              w: 1,
              x: 0,
              y: 0,
              static: false,
            },
          ],
          static: true,
        },
        {
          h: this.defaultHeights.DOMAIN,
          i: DetailPageWidgetKeys.DOMAIN,
          w: 2,
          x: 6,
          y: 0,
        },
        {
          h: this.defaultHeights.OWNER,
          i: DetailPageWidgetKeys.OWNERS,
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
          i: DetailPageWidgetKeys.TAGS,
          w: 2,
          x: 6,
          y: 3,
          static: false,
        },
      ];
    }

    return [];
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getGlossaryWidgetFromKey(widgetConfig);
  }
}

const customizeGlossaryPageClassBase = new CustomizeGlossaryPageClassBase();

export default customizeGlossaryPageClassBase;
export { CustomizeGlossaryPageClassBase };
