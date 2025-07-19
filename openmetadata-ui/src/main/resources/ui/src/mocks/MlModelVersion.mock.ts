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

import { MlModelVersionProp } from '../components/MlModel/MlModelVersion/MlModelVersion.interface';
import {
  FeatureSourceDataType,
  FeatureType,
  MlModelServiceType,
} from '../generated/entity/data/mlmodel';
import { ENTITY_PERMISSIONS } from '../mocks/Permissions.mock';
import {
  mockBackHandler,
  mockDomain,
  mockOwner,
  mockTier,
  mockVersionHandler,
  mockVersionList,
} from '../mocks/VersionCommon.mock';

export const mockMlModelDetails = {
  id: '68b51299-dfd1-48ce-a00e-9611da93e7a3',
  name: 'eta_predictions',
  fullyQualifiedName: 'mlflow_svc.eta_predictions',
  displayName: 'ETA Predictions',
  description: 'ETA Predictions Model updated',
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
            id: '655888c1-6a55-4730-a0a2-f1aa287301e2',
            type: 'table',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
            description: '',
            href: 'http://openmetadata-server:8585/api/v1/tables/655888c1-6a55-4730-a0a2-f1aa287301e2',
          },
        },
      ],
    },
    {
      name: 'product',
      dataType: FeatureType.Numerical,
      fullyQualifiedName: 'mlflow_svc.eta_predictions.product',
      featureSources: [
        {
          name: 'gross_sales',
          dataType: FeatureSourceDataType.Integer,
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.fact_sale.gross_sales',
          dataSource: {
            id: '655888c1-6a55-4730-a0a2-f1aa287301e2',
            type: 'table',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
            description: '',
            href: 'http://openmetadata-server:8585/api/v1/tables/655888c1-6a55-4730-a0a2-f1aa287301e2',
          },
        },
      ],
    },
  ],
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
    date: new Date('2023-12-01'),
  },
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
    id: 'c995db51-0143-4561-9ea5-8cfabf401c48',
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
  server: 'http://my-server.ai',
  followers: [],
  tags: [],
  version: 0.2,
  updatedAt: 1689140045807,
  updatedBy: 'admin',
  service: {
    id: '0d546f38-8198-4444-9e84-9f203d598fe5',
    type: 'mlmodelService',
    name: 'mlflow_svc',
    fullyQualifiedName: 'mlflow_svc',
    deleted: false,
  },
  serviceType: MlModelServiceType.Mlflow,
  changeDescription: {
    fieldsAdded: [
      {
        name: 'mlFeatures',
        newValue: `[{"name":"sales","dataType":"numerical","description":"Sales amount update","fullyQualifiedName":"mlflow_svc.eta_predictions.sales",
          "featureSources":[{"name":"gross_sales","dataType":"integer","fullyQualifiedName":"sample_data.ecommerce_db.shopify.fact_sale.gross_sales",
          "dataSource":{"id":"655888c1-6a55-4730-a0a2-f1aa287301e2","type":"table","fullyQualifiedName":"sample_data.ecommerce_db.shopify.fact_sale",
          "description":"The.","href":"http://openmetadata-server:8585/api/v1/tables/655888c1-6a55-4730-a0a2-f1aa287301e2"}}]}]`,
      },
      {
        name: 'mlFeatures',
        newValue: `[{"name":"persona","dataType":"categorical","description":"type of buyer","fullyQualifiedName":"mlflow_svc.eta_predictions.persona",
          "featureSources":[{"name":"membership","dataType":"string","fullyQualifiedName":"sample_data.ecommerce_db.shopify.raw_customer.membership",
          "dataSource":{"id":"c37dae98-987b-4e09-b1d7-79155c83f0e4","type":"table","fullyQualifiedName":"sample_data.ecommerce_db.shopify.raw_customer",
          "description":"This","href":"http://openmetadata-server:8585/api/v1/tables/c37dae98-987b-4e09-b1d7-79155c83f0e4"}},
          {"name":"platform","dataType":"string","fullyQualifiedName":"sample_data.ecommerce_db.shopify.raw_customer.platform",
          "dataSource":{"id":"c37dae98-987b-4e09-b1d7-79155c83f0e4","type":"table","fullyQualifiedName":"sample_data.ecommerce_db.shopify.raw_customer",
          "description":"This","href":"http://openmetadata-server:8585/api/v1/tables/c37dae98-987b-4e09-b1d7-79155c83f0e4"}}],
          "featureAlgorithm":"PCA","tags":[{"tagFQN":"PII.Sensitive","source":"Classification","labelType":"Manual","state":"Confirmed"}]}]`,
      },
    ],
    fieldsUpdated: [
      {
        name: 'description',
        oldValue: 'ETA Predictions Model',
        newValue: 'ETA Predictions Model updated',
      },
    ],
    fieldsDeleted: [
      {
        name: 'mlFeatures',
        oldValue: `[{"name":"sales","dataType":"numerical","description":"Sales amount","fullyQualifiedName":"mlflow_svc.eta_predictions.sales",
          "featureSources":[{"name":"gross_sales","dataType":"integer","fullyQualifiedName":"sample_data.ecommerce_db.shopify.fact_sale.gross_sales",
          "dataSource":{"id":"655888c1-6a55-4730-a0a2-f1aa287301e2","type":"table","fullyQualifiedName":"sample_data.ecommerce_db.shopify.fact_sale",
          "description":"The","href":"http://openmetadata-server:8585/api/v1/tables/655888c1-6a55-4730-a0a2-f1aa287301e2"}}]}]`,
      },
      {
        name: 'mlFeatures',
        oldValue: `[{"name":"persona","dataType":"categorical","description":"type of buyer","fullyQualifiedName":"mlflow_svc.eta_predictions.persona",
          "featureSources":[{"name":"membership","dataType":"string","fullyQualifiedName":"sample_data.ecommerce_db.shopify.raw_customer.membership",
          "dataSource":{"id":"c37dae98-987b-4e09-b1d7-79155c83f0e4","type":"table","fullyQualifiedName":"sample_data.ecommerce_db.shopify.raw_customer",
          "description":"The","href":"http://openmetadata-server:8585/api/v1/tables/c37dae98-987b-4e09-b1d7-79155c83f0e4"}},
          {"name":"platform","dataType":"string","fullyQualifiedName":"sample_data.ecommerce_db.shopify.raw_customer.platform",
          "dataSource":{"id":"c37dae98-987b-4e09-b1d7-79155c83f0e4","type":"table","fullyQualifiedName":"sample_data.ecommerce_db.shopify.raw_customer",
          "description":"The","href":"http://openmetadata-server:8585/api/v1/tables/c37dae98-987b-4e09-b1d7-79155c83f0e4"}}],"featureAlgorithm":"PCA"}]`,
      },
    ],
    previousVersion: 0.1,
  },
  deleted: false,
};

export const mlModelVersionMockProps: MlModelVersionProp = {
  version: '0.3',
  currentVersionData: mockMlModelDetails,
  isVersionLoading: false,
  owners: mockOwner,
  domains: [mockDomain],
  dataProducts: [],
  tier: mockTier,
  slashedMlModelName: [],
  versionList: mockVersionList,
  deleted: false,
  backHandler: mockBackHandler,
  versionHandler: mockVersionHandler,
  entityPermissions: ENTITY_PERMISSIONS,
};
