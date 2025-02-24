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

import { TabProps } from '../../components/common/TabsLabel/TabsLabel.interface';
import {
  CUSTOM_PROPERTIES_WIDGET,
  DATA_PRODUCTS_WIDGET,
  DESCRIPTION_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  GridSizes,
  TAGS_WIDGET,
} from '../../constants/CustomizeWidgets.constants';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import {
  FeatureSourceDataType,
  FeatureType,
  Mlmodel,
  MlModelServiceType,
} from '../../generated/entity/data/mlmodel';
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
  fetchEntityFeedCount: () => void;
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

  public getDefaultLayout(tab?: EntityTabs) {
    if (tab && tab !== EntityTabs.OVERVIEW) {
      return [];
    }

    return [
      {
        h: 6,
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
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
        h: 2,
        i: DetailPageWidgetKeys.RELATED_METRICS,
        w: 2,
        x: 6,
        y: 4,
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
    return {
      id: '6ef964b1-edb7-4d7c-85f1-51845197206c',
      name: 'eta_predictions',
      fullyQualifiedName: 'mlflow_svc.eta_predictions',
      displayName: 'ETA Predictions',
      description: 'ETA Predictions Model',
      algorithm: 'Neural Network',
      mlFeatures: [
        {
          name: 'sales',
          dataType: FeatureType.Numerical,
          description: 'Sales amount',
          fullyQualifiedName: 'mlflow_svc.eta_predictions.sales',
          featureSources: [
            {
              name: 'gross_sales',
              dataType: FeatureSourceDataType.Integer,
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.fact_sale.gross_sales',
              dataSource: {
                id: '8cb6dbd3-1c4b-48c3-ab53-1e964f355d03',
                type: 'table',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.fact_sale',
                description:
                  // eslint-disable-next-line max-len
                  'The fact table captures the value of products sold or returned, as well as the values of other charges such as taxes and shipping costs. The sales table contains one row per order line item, one row per returned line item, and one row per shipping charge. Use this table when you need financial metrics.',
                href: 'http://sandbox-beta.open-metadata.org/api/v1/tables/8cb6dbd3-1c4b-48c3-ab53-1e964f355d03',
              },
              tags: [],
            },
          ],
        },
        {
          name: 'persona',
          dataType: FeatureType.Categorical,
          description: 'type of buyer',
          fullyQualifiedName: 'mlflow_svc.eta_predictions.persona',
          featureSources: [
            {
              name: 'membership',
              dataType: FeatureSourceDataType.String,
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.raw_customer.membership',
              dataSource: {
                id: '7de1572e-e66a-47b4-aec0-67366f1c56fb',
                type: 'table',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_customer',
                description:
                  // eslint-disable-next-line max-len
                  'This is a raw customers table as represented in our online DB. This contains personal, shipping and billing addresses and details of the customer store and customer profile. This table is used to build our dimensional and fact tables',
                href: 'http://sandbox-beta.open-metadata.org/api/v1/tables/7de1572e-e66a-47b4-aec0-67366f1c56fb',
              },
              tags: [],
            },
            {
              name: 'platform',
              dataType: FeatureSourceDataType.String,
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.raw_customer.platform',
              dataSource: {
                id: '7de1572e-e66a-47b4-aec0-67366f1c56fb',
                type: 'table',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_customer',
                description:
                  // eslint-disable-next-line max-len
                  'This is a raw customers table as represented in our online DB. This contains personal, shipping and billing addresses and details of the customer store and customer profile. This table is used to build our dimensional and fact tables',
                href: 'http://sandbox-beta.open-metadata.org/api/v1/tables/7de1572e-e66a-47b4-aec0-67366f1c56fb',
              },
              tags: [],
            },
          ],
          featureAlgorithm: 'PCA',
        },
      ],
      mlHyperParameters: [
        {
          name: 'regularisation',
          value: '0.5',
        },
        {
          name: 'random',
          value: 'hello',
        },
      ],
      target: 'ETA_time',
      dashboard: {
        id: '1faa74ba-9952-4591-aef2-9acfaf9c14d1',
        type: 'dashboard',
        name: 'eta_predictions_performance',
        fullyQualifiedName: 'sample_superset.eta_predictions_performance',
        description: '',
        displayName: 'ETA Predictions Performance',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/dashboards/1faa74ba-9952-4591-aef2-9acfaf9c14d1',
      },
      mlStore: {
        storage: 's3://path-to-pickle',
        imageRepository: 'https://docker.hub.com/image',
      },
      server: 'http://my-server.ai/',
      href: 'http://sandbox-beta.open-metadata.org/api/v1/mlmodels/6ef964b1-edb7-4d7c-85f1-51845197206c',
      owners: [],
      followers: [],
      tags: [],
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
        date: new Date('2025-02-22'),
      },
      version: 1.2,
      updatedAt: 1722587630921,
      updatedBy: 'harsh.s',
      service: {
        id: 'b8cbebe5-58f0-493e-81f9-ad76e7695164',
        type: 'mlmodelService',
        name: 'mlflow_svc',
        fullyQualifiedName: 'mlflow_svc',
        displayName: 'mlflow_svc',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/services/mlmodelServices/b8cbebe5-58f0-493e-81f9-ad76e7695164',
      },
      serviceType: MlModelServiceType.Mlflow,
      deleted: false,
      domain: {
        id: '761f0a12-7b08-4889-acc3-b8d4d11a7865',
        type: 'domain',
        name: 'domain.with.dot',
        fullyQualifiedName: '"domain.with.dot"',
        description: 'domain.with.dot',
        displayName: 'domain.with.dot',
        href: 'http://sandbox-beta.open-metadata.org/api/v1/domains/761f0a12-7b08-4889-acc3-b8d4d11a7865',
      },
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
