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
import { EntityTags } from 'Models';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import {
  CUSTOM_PROPERTIES_WIDGET,
  DATA_PRODUCTS_WIDGET,
  DESCRIPTION_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  GridSizes,
  TAGS_WIDGET,
} from '../constants/CustomizeWidgets.constants';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { Tag } from '../generated/entity/classification/tag';
import {
  Dashboard,
  DashboardServiceType,
} from '../generated/entity/data/dashboard';
import { EntityReference } from '../generated/entity/type';
import { Tab } from '../generated/system/ui/page';
import { FeedCounts } from '../interface/feed.interface';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import { getDashboardDetailPageTabs } from './DashboardDetailsUtils';
import i18n from './i18next/LocalUtil';

export interface DashboardDetailsTabsProps {
  dashboardDetails: Dashboard;
  charts: EntityReference[];
  entityName: string;
  editDescriptionPermission: boolean;
  editTagsPermission: boolean;
  editGlossaryTermsPermission: boolean;
  editLineagePermission: boolean;
  editCustomAttributePermission: boolean;
  viewAllPermission: boolean;
  dashboardTags: Tag[];
  handleFeedCount: (data: FeedCounts) => void;
  onDescriptionUpdate: (value: string) => Promise<void>;
  onThreadLinkSelect: (value: string) => void;
  handleTagSelection: (selectedTags: EntityTags[]) => Promise<void>;
  onExtensionUpdate: (data: Dashboard) => Promise<void>;
  feedCount: FeedCounts;
  activeTab: EntityTabs;
  deleted: boolean;
  getEntityFeedCount: () => Promise<void>;
  fetchDashboard: () => void;
  labelMap: Record<EntityTabs, string>;
}

class DashboardDetailsClassBase {
  public getDashboardDetailPageTabs(
    tabsProps: DashboardDetailsTabsProps
  ): TabProps[] {
    return getDashboardDetailPageTabs(tabsProps);
  }

  public getDashboardDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.DETAILS,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.LINEAGE,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: tab === EntityTabs.DETAILS,
    }));
  }

  public getDefaultLayout(tab: EntityTabs) {
    switch (tab) {
      case EntityTabs.DETAILS:
        return [
          {
            h: 2,
            i: DetailPageWidgetKeys.DESCRIPTION,
            w: 6,
            x: 0,
            y: 0,
            static: false,
          },
          {
            h: 6,
            i: DetailPageWidgetKeys.CHARTS_TABLE,
            w: 6,
            x: 0,
            y: 2,
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
            y: 6,
            static: false,
          },
        ];

      default:
        return [];
    }
  }

  public getDummyData(): Dashboard {
    return {
      id: '574c383c-735f-44c8-abbb-355f87c8b19f',
      name: 'customers',
      displayName: 'Customers dashboard',
      fullyQualifiedName: 'SampleLookerService.customers',
      description: 'This is a sample Dashboard for Looker',
      version: 0.1,
      updatedAt: 1736493713236,
      updatedBy: 'admin',
      sourceUrl: 'http://localhost:808/looker/dashboard/1/',
      charts: [
        {
          id: '81cdc1f3-66ae-462f-bf3e-b5fbbfe7792f',
          type: 'chart',
          name: 'chart_1',
          fullyQualifiedName: 'SampleLookerService.chart_1',
          description: 'This is a sample Chart for Looker',
          displayName: 'Chart 1',
          deleted: false,
          href: 'http://test-argo.getcollate.io/api/v1/charts/81cdc1f3-66ae-462f-bf3e-b5fbbfe7792f',
        },
        {
          id: '6f5057aa-8d7c-41a7-ab93-76bf8ed2bc27',
          type: 'chart',
          name: 'chart_2',
          fullyQualifiedName: 'SampleLookerService.chart_2',
          description: 'This is a sample Chart for Looker',
          displayName: 'Chart 2',
          deleted: false,
          href: 'http://test-argo.getcollate.io/api/v1/charts/6f5057aa-8d7c-41a7-ab93-76bf8ed2bc27',
        },
      ],
      href: 'http://test-argo.getcollate.io/api/v1/dashboards/574c383c-735f-44c8-abbb-355f87c8b19f',
      owners: [],
      followers: [],
      tags: [],
      service: {
        id: 'fb4df3ed-75b9-45d3-a2df-da07785893d7',
        type: 'dashboardService',
        name: 'SampleLookerService',
        fullyQualifiedName: 'SampleLookerService',
        displayName: 'SampleLookerService',
        deleted: false,
        href: 'http://test-argo.getcollate.io/api/v1/services/dashboardServices/fb4df3ed-75b9-45d3-a2df-da07785893d7',
      },
      serviceType: DashboardServiceType.Looker,
      usageSummary: {
        dailyStats: {
          count: 0,
          percentileRank: 0,
        },
        weeklyStats: {
          count: 0,
          percentileRank: 0,
        },
        monthlyStats: {
          count: 0,
          percentileRank: 0,
        },
        date: new Date('2025-02-03'),
      },
      deleted: false,
      dataProducts: [],
      votes: {
        upVotes: 0,
        downVotes: 0,
        upVoters: [],
        downVoters: [],
      },
    };
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.CHARTS_TABLE,
        name: i18n.t('label.chart-plural'),
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
}

const dashboardDetailsClassBase = new DashboardDetailsClassBase();

export default dashboardDetailsClassBase;
export { DashboardDetailsClassBase };
