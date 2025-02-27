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
import { TabProps } from '../../components/common/TabsLabel/TabsLabel.interface';
import {
  CUSTOM_PROPERTIES_WIDGET,
  DATA_PRODUCTS_WIDGET,
  DESCRIPTION_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  GridSizes,
  TAGS_WIDGET,
} from '../../constants/CustomizeWidgets.constants';
import { ML_MODEL_DUMMY_DATA } from '../../constants/MlModel.constants';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { Tab } from '../../generated/system/ui/uiCustomization';
import { FeedCounts } from '../../interface/feed.interface';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from '../CustomizePage/CustomizePageUtils';
import i18n from '../i18next/LocalUtil';
import {
  getMlModelDetailsPageTabs,
  getMlModelWidgetsFromKey,
} from '../MlModelDetailsUtils';

export interface MlModelDetailPageTabProps {
  feedCount: FeedCounts;
  activeTab: EntityTabs;
  editLineagePermission: boolean;
  editCustomAttributePermission: boolean;
  viewAllPermission: boolean;
  fetchMlModel: () => void;
  handleFeedCount: (data: FeedCounts) => void;
  mlModelDetail: Mlmodel;
  getMlHyperParameters: JSX.Element;
  getMlModelStore: JSX.Element;
  fetchEntityFeedCount: () => Promise<void>;
  labelMap: Record<EntityTabs, string>;
}

class MlModelDetailsClassBase {
  tabs = [];

  constructor() {
    this.tabs = [];
  }

  public getMlModelDetailPageTabs(
    mlModelDetailsPageProps: MlModelDetailPageTabProps
  ): TabProps[] {
    return getMlModelDetailsPageTabs(mlModelDetailsPageProps);
  }

  public getMlModelDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.OVERVIEW,
      EntityTabs.EXPRESSION,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.LINEAGE,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: tab === EntityTabs.OVERVIEW,
    }));
  }

  public getDefaultLayout(tab?: EntityTabs): Layout[] {
    if (tab && tab !== EntityTabs.OVERVIEW) {
      return [];
    }

    return [
      {
        h: 1,
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: 8,
        i: DetailPageWidgetKeys.ML_MODEL_FEATURES,
        w: 6,
        x: 0,
        y: 1,
        static: false,
      },
      {
        h: 1,
        i: DetailPageWidgetKeys.DATA_PRODUCTS,
        w: 2,
        x: 6,
        y: 1,
        static: false,
      },
      {
        h: 2,
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      },
      {
        h: 2,
        i: DetailPageWidgetKeys.GLOSSARY_TERMS,
        w: 2,
        x: 6,
        y: 3,
        static: false,
      },
      {
        h: 4,
        i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
        w: 2,
        x: 6,
        y: 5,
        static: false,
      },
    ];
  }
  public getDummyData(): Mlmodel {
    return ML_MODEL_DUMMY_DATA;
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      DATA_PRODUCTS_WIDGET,
      TAGS_WIDGET,
      GLOSSARY_TERMS_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.RELATED_METRICS,
        name: i18n.t('label.related-metrics'),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
      CUSTOM_PROPERTIES_WIDGET,
    ];
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getMlModelWidgetsFromKey(widgetConfig);
  }
}

const mlModelDetailsClassBase = new MlModelDetailsClassBase();

export default mlModelDetailsClassBase;
export { MlModelDetailsClassBase };
