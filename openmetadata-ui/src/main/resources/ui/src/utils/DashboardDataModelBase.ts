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
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import {
  CUSTOM_PROPERTIES_WIDGET,
  DATA_PRODUCTS_WIDGET,
  DESCRIPTION_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  TAGS_WIDGET,
} from '../constants/CustomizeWidgets.constants';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { Tab } from '../generated/system/ui/page';
import { FeedCounts } from '../interface/feed.interface';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import { getDashboardDataModelDetailPageTabs } from './DashboardDetailsUtils';

export interface DashboardDataModelDetailPageTabProps {
  modelComponent: JSX.Element;
  feedCount: {
    totalCount: number;
  };
  activeTab: EntityTabs;
  handleFeedCount: (data: FeedCounts) => void;
  editLineagePermission: boolean;
  dataModelData: DashboardDataModel;
  dataModelPermissions: OperationPermission;
  deleted: boolean;
  handelExtensionUpdate: (
    dashboardDataModel: DashboardDataModel
  ) => Promise<void>;
  getEntityFeedCount: () => void;
  fetchDataModel: () => void;
}

class DashboardDataModelBase {
  constructor() {
    // Do nothing
  }

  public getDashboardDataModelDetailPageTabs(
    tabsProps: DashboardDataModelDetailPageTabProps
  ): TabProps[] {
    return getDashboardDataModelDetailPageTabs(tabsProps);
  }

  public getDashboardDataModelDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.MODEL,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.LINEAGE,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: [EntityTabs.MODEL].includes(tab),
    }));
  }

  public getDefaultLayout(tab: EntityTabs) {
    switch (tab) {
      case EntityTabs.MODEL:
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
            i: DetailPageWidgetKeys.DATA_MODEL,
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

  public getDummyData(): DashboardDataModel {
    return {
      id: '3519340b-7a36-45d1-abdf-348a5f1c582c',
      name: 'orders',
      displayName: 'Orders',
      fullyQualifiedName: 'sample_looker.model.orders',
      description: 'Orders explore from Sample Data',
      version: 0.1,
      updatedAt: 1697265260863,
      updatedBy: 'ingestion-bot',
      href: 'http://sandbox-beta.open-metadata.org/api/v1/dashboard/datamodels/3519340b-7a36-45d1-abdf-348a5f1c582c',
      owners: [],
      dataProducts: [],
      tags: [],
      deleted: false,
      followers: [],
      service: {
        id: '2d102aaa-e683-425c-a8bf-e4afa43dde99',
        type: 'dashboardService',
        name: 'sample_looker',
        fullyQualifiedName: 'sample_looker',
        displayName: 'sample_looker',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/services/dashboardServices/2d102aaa-e683-425c-a8bf-e4afa43dde99',
      },
      serviceType: 'Looker',
      dataModelType: 'LookMlExplore',
      // eslint-disable-next-line max-len
      sql: "SELECT CASE\n           WHEN stage_of_development = 'Pre-clinical' THEN '0. Pre-clinical'\n           WHEN stage_of_development = 'Phase I' THEN '1. Phase I'\n           WHEN stage_of_development = 'Phase I/II'\n                or stage_of_development = 'Phase II' THEN '2. Phase II or Combined I/II'\n           WHEN stage_of_development = 'Phase III' THEN '3. Phase III'\n           WHEN stage_of_development = 'Authorized' THEN '4. Authorized'\n       END AS clinical_stage,\n       COUNT(*) AS count\nFROM covid_vaccines\nGROUP BY CASE\n             WHEN stage_of_development = 'Pre-clinical' THEN '0. Pre-clinical'\n             WHEN stage_of_development = 'Phase I' THEN '1. Phase I'\n             WHEN stage_of_development = 'Phase I/II'\n                  or stage_of_development = 'Phase II' THEN '2. Phase II or Combined I/II'\n             WHEN stage_of_development = 'Phase III' THEN '3. Phase III'\n             WHEN stage_of_development = 'Authorized' THEN '4. Authorized'\n         END\nORDER BY count DESC\nLIMIT 10000\nOFFSET 0;\n",
      columns: [
        {
          name: '0. Pre-clinical',
          dataType: 'NUMERIC',
          dataTypeDisplay: 'numeric',
          description: "Vaccine Candidates in phase: 'Pre-clinical'",
          fullyQualifiedName: 'sample_looker.model.orders."0. Pre-clinical"',
          tags: [],
          ordinalPosition: 1,
        },
        {
          name: '2. Phase II or Combined I/II',
          dataType: 'NUMERIC',
          dataTypeDisplay: 'numeric',
          description:
            "Vaccine Candidates in phase: 'Phase II or Combined I/II'",
          fullyQualifiedName:
            'sample_looker.model.orders."2. Phase II or Combined I/II"',
          tags: [],
          ordinalPosition: 2,
        },
        {
          name: '1. Phase I',
          dataType: 'NUMERIC',
          dataTypeDisplay: 'numeric',
          description: "Vaccine Candidates in phase: 'Phase I'",
          fullyQualifiedName: 'sample_looker.model.orders."1. Phase I"',
          tags: [],
          ordinalPosition: 3,
        },
        {
          name: '3. Phase III',
          dataType: 'NUMERIC',
          dataTypeDisplay: 'numeric',
          description: "Vaccine Candidates in phase: 'Phase III'",
          fullyQualifiedName: 'sample_looker.model.orders."3. Phase III"',
          tags: [],
          ordinalPosition: 4,
        },
        {
          name: '4. Authorized',
          dataType: 'NUMERIC',
          dataTypeDisplay: 'numeric',
          description: "Vaccine Candidates in phase: 'Authorize'",
          fullyQualifiedName: 'sample_looker.model.orders."4. Authorized"',
          tags: [],
          ordinalPosition: 5,
        },
      ],
      domain: {
        id: '52fc9c67-78b7-42bf-8147-69278853c230',
        type: 'domain',
        name: 'Design',
        fullyQualifiedName: 'Design',
        description: "<p>Here' the description for Product Design</p>",
        displayName: 'Product Design ',
        inherited: true,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/domains/52fc9c67-78b7-42bf-8147-69278853c230',
      },
      votes: {
        upVotes: 0,
        downVotes: 0,
        upVoters: [],
        downVoters: [],
      },
    } as DashboardDataModel;
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,

      DATA_PRODUCTS_WIDGET,
      TAGS_WIDGET,
      GLOSSARY_TERMS_WIDGET,
      CUSTOM_PROPERTIES_WIDGET,
    ];
  }
}

const dashboardDataModelClassBase = new DashboardDataModelBase();

export default dashboardDataModelClassBase;
export { DashboardDataModelBase };
