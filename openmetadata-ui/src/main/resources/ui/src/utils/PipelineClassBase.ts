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
import {
  CUSTOM_PROPERTIES_WIDGET,
  DATA_PRODUCTS_WIDGET,
  DESCRIPTION_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  GridSizes,
  TAGS_WIDGET,
} from '../constants/CustomizeWidgets.constants';
import { PIPELINE_DUMMY_DATA } from '../constants/pipeline.constants';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { Pipeline } from '../generated/entity/data/pipeline';
import { Tab } from '../generated/system/ui/uiCustomization';
import { FeedCounts } from '../interface/feed.interface';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import i18n from './i18next/LocalUtil';
import {
  getPipelineDetailPageTabs,
  getPipelineWidgetsFromKey,
} from './PipelineDetailsUtils';

export interface PipelineDetailPageTabProps {
  feedCount: {
    totalCount: number;
  };
  getEntityFeedCount: () => Promise<void>;
  handleFeedCount: (data: FeedCounts) => void;
  onExtensionUpdate: (updatedPipeline: Pipeline) => Promise<void>;
  pipelineDetails: Pipeline;
  pipelineFQN: string;
  viewAllPermission: boolean;
  editLineagePermission: boolean;
  editCustomAttributePermission: boolean;
  deleted: boolean;
  tab: EntityTabs;
  fetchPipeline: () => void;
  labelMap?: Record<EntityTabs, string>;
}

enum PipelineWidgetKeys {
  DESCRIPTION = DetailPageWidgetKeys.DESCRIPTION,
  PIPELINE_TASKS = DetailPageWidgetKeys.PIPELINE_TASKS,
  DATA_PRODUCTS = DetailPageWidgetKeys.DATA_PRODUCTS,
  TAGS = DetailPageWidgetKeys.TAGS,
  GLOSSARY_TERMS = DetailPageWidgetKeys.GLOSSARY_TERMS,
  CUSTOM_PROPERTIES = DetailPageWidgetKeys.CUSTOM_PROPERTIES,
}

class PipelineClassBase {
  defaultWidgetHeight: Record<PipelineWidgetKeys, number>;

  constructor() {
    this.defaultWidgetHeight = {
      [PipelineWidgetKeys.DESCRIPTION]: 2,
      [PipelineWidgetKeys.PIPELINE_TASKS]: 8,
      [PipelineWidgetKeys.DATA_PRODUCTS]: 2,
      [PipelineWidgetKeys.TAGS]: 2,
      [PipelineWidgetKeys.GLOSSARY_TERMS]: 2,
      [PipelineWidgetKeys.CUSTOM_PROPERTIES]: 4,
    };
  }

  public getPipelineDetailPageTabs(
    tabProps: PipelineDetailPageTabProps
  ): TabProps[] {
    return getPipelineDetailPageTabs(tabProps);
  }

  public getPipelineDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.TASKS,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.EXECUTIONS,
      EntityTabs.LINEAGE,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: tab === EntityTabs.TASKS,
    }));
  }

  public getDefaultLayout(tab?: EntityTabs): Layout[] {
    if (tab && tab !== EntityTabs.TASKS) {
      return [];
    }

    return [
      {
        h: this.defaultWidgetHeight[PipelineWidgetKeys.DESCRIPTION],
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[PipelineWidgetKeys.PIPELINE_TASKS],
        i: DetailPageWidgetKeys.PIPELINE_TASKS,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[PipelineWidgetKeys.DATA_PRODUCTS],
        i: DetailPageWidgetKeys.DATA_PRODUCTS,
        w: 2,
        x: 6,
        y: 1,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[PipelineWidgetKeys.TAGS],
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[PipelineWidgetKeys.GLOSSARY_TERMS],
        i: DetailPageWidgetKeys.GLOSSARY_TERMS,
        w: 2,
        x: 6,
        y: 3,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[PipelineWidgetKeys.CUSTOM_PROPERTIES],
        i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
        w: 2,
        x: 6,
        y: 6,
        static: false,
      },
    ];
  }

  public getDummyData(): Pipeline {
    return PIPELINE_DUMMY_DATA;
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.PIPELINE_TASKS,
        name: i18n.t('label.schema'),
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
    return getPipelineWidgetsFromKey(widgetConfig);
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case DetailPageWidgetKeys.DESCRIPTION:
        return this.defaultWidgetHeight[PipelineWidgetKeys.DESCRIPTION];
      case DetailPageWidgetKeys.PIPELINE_TASKS:
        return this.defaultWidgetHeight[PipelineWidgetKeys.PIPELINE_TASKS];
      case DetailPageWidgetKeys.DATA_PRODUCTS:
        return this.defaultWidgetHeight[PipelineWidgetKeys.DATA_PRODUCTS];
      case DetailPageWidgetKeys.TAGS:
        return this.defaultWidgetHeight[PipelineWidgetKeys.TAGS];
      case DetailPageWidgetKeys.GLOSSARY_TERMS:
        return this.defaultWidgetHeight[PipelineWidgetKeys.GLOSSARY_TERMS];
      case DetailPageWidgetKeys.CUSTOM_PROPERTIES:
        return this.defaultWidgetHeight[PipelineWidgetKeys.CUSTOM_PROPERTIES];
      default:
        return 1;
    }
  }
}

const pipelineClassBase = new PipelineClassBase();

export default pipelineClassBase;
export { PipelineClassBase };
