/*
 *  Copyright 2025 Collate.
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
  FeatureSourceDataType,
  FeatureType,
  Mlmodel,
  MlModelServiceType,
} from '../generated/entity/data/mlmodel';

export const ML_MODEL_DUMMY_DATA: Mlmodel = {
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
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
            description:
              // eslint-disable-next-line max-len
              'The fact table captures the value of products sold or returned, as well as the values of other charges such as taxes and shipping costs. The sales table contains one row per order line item, one row per returned line item, and one row per shipping charge. Use this table when you need financial metrics.',
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
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_customer',
            description:
              // eslint-disable-next-line max-len
              'This is a raw customers table as represented in our online DB. This contains personal, shipping and billing addresses and details of the customer store and customer profile. This table is used to build our dimensional and fact tables',
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
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_customer',
            description:
              // eslint-disable-next-line max-len
              'This is a raw customers table as represented in our online DB. This contains personal, shipping and billing addresses and details of the customer store and customer profile. This table is used to build our dimensional and fact tables',
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
  },
  mlStore: {
    storage: 's3://path-to-pickle',
    imageRepository: 'https://docker.hub.com/image',
  },
  server: 'https://my-server.ai/',
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
  },
  dataProducts: [],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};
