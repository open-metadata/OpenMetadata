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
  FeatureSourceDataType,
  FeatureType,
  Mlmodel,
} from '../../../../generated/entity/data/mlmodel';

export const mockMlModelEntityDetails: Mlmodel = {
  id: 'e42a5d43-36fd-4636-ae89-5bcc6a61542e',
  name: 'eta_predictions',
  displayName: 'ETA Predictions',
  fullyQualifiedName: 'mlflow_svc.eta_predictions',
  description: 'ETA Predictions Model',
  version: 0.1,
  updatedAt: 1672627829904,
  updatedBy: 'admin',
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
            id: '148e01f8-817a-4094-aa39-970746e3427e',
            type: 'table',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
            description:
              'The fact table captures the value of products sold or returned.',
            href: 'http://openmetadata-server:8585/api/v1/tables/148e01f8-817a-4094-aa39-970746e3427e',
          },
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
            id: 'e2e27b89-9eda-441f-afe4-3c9b780e9e15',
            type: 'table',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_customer',
            description:
              'This is a raw customers table as represented in our online DB. ',
            href: 'http://openmetadata-server:8585/api/v1/tables/e2e27b89-9eda-441f-afe4-3c9b780e9e15',
          },
        },
        {
          name: 'platform',
          dataType: FeatureSourceDataType.String,
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_customer.platform',
          dataSource: {
            id: 'e2e27b89-9eda-441f-afe4-3c9b780e9e15',
            type: 'table',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_customer',
            description:
              'This is a raw customers table as represented in our online DB. This contains personal.',
            href: 'http://openmetadata-server:8585/api/v1/tables/e2e27b89-9eda-441f-afe4-3c9b780e9e15',
          },
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
  dashboard: {
    name: 'DashboardName',
    id: '4352345234534538992643452345',
    type: '',
  },
  target: 'ETA_time',
  mlStore: {
    storage: 's3://path-to-pickle',
    imageRepository: 'https://docker.hub.com/image',
  },
  service: {
    name: 'MLFlow',
    id: '43523452345345325423452345',
    type: '',
  },
  server: 'http://my-server.ai',
  tags: [],
  followers: [],
  href: 'http://openmetadata-server:8585/api/v1/mlmodels/e42a5d43-36fd-4636-ae89-5bcc6a61542e',
  deleted: false,
};

export const mockMlModelEntityDetails1: Mlmodel = {
  id: 'b849cc70-ceda-4f2a-8de2-022a5c7f78a6',
  name: 'forecast_sales',
  displayName: 'Sales Forecast Predictions',
  fullyQualifiedName: 'mlflow_svc.forecast_sales',
  description: 'Sales Forecast Predictions Model',
  version: 0.1,
  updatedAt: 1672627829947,
  updatedBy: 'admin',
  algorithm: 'Time Series',
  mlFeatures: [],
  mlHyperParameters: [],
  target: '',
  server: '',
  service: {
    name: 'MLFlow',
    id: '43523452345345325423452345',
    type: '',
  },
  tags: [],
  followers: [],
  href: 'http://openmetadata-server:8585/api/v1/mlmodels/b849cc70-ceda-4f2a-8de2-022a5c7f78a6',
  deleted: false,
};
