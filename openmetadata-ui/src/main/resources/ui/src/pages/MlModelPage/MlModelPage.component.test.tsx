/*
 *  Copyright 2021 Collate
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

import { findByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getMlModelByFQN } from '../../axiosAPIs/mlModelAPI';
import MlModelPageComponent from './MlModelPage.component';

const mockData = {
  id: 'b2374223-3725-4b05-abe7-d51566e5c317',
  name: 'eta_predictions',
  fullyQualifiedName: 'eta_predictions',
  displayName: 'ETA Predictions',
  description: 'ETA Predictions Model',
  algorithm: 'Neural Network',
  mlFeatures: [
    {
      name: 'sales',
      dataType: 'numerical',
      description: 'Sales amount',
      fullyQualifiedName: 'eta_predictions.sales',
      featureSources: [
        {
          name: 'gross_sales',
          dataType: 'integer',
          fullyQualifiedName: 'null.gross_sales',
          dataSource: {
            id: '848ab847-6346-45d4-b8ee-838f72cf80af',
            type: 'table',
            name: 'sample_data.ecommerce_db.shopify.fact_sale',
            description:
              'The fact table captures the value of products sold or returned.',
            href: 'http://localhost:8585/api/v1/tables/848ab847-6346-45d4-b8ee-838f72cf80af',
          },
        },
      ],
    },
    {
      name: 'persona',
      dataType: 'categorical',
      description: 'type of buyer',
      fullyQualifiedName: 'eta_predictions.persona',
      featureSources: [
        {
          name: 'membership',
          dataType: 'string',
          fullyQualifiedName: 'null.membership',
          dataSource: {
            id: '682eeaf6-87b1-4cd1-8373-8720ca180932',
            type: 'table',
            name: 'sample_data.ecommerce_db.shopify.raw_customer',
            description:
              'This is a raw customers table as represented in our online DB. This contains personal.',
            href: 'http://localhost:8585/api/v1/tables/682eeaf6-87b1-4cd1-8373-8720ca180932',
          },
        },
        {
          name: 'platform',
          dataType: 'string',
          fullyQualifiedName: 'null.platform',
          dataSource: {
            id: '682eeaf6-87b1-4cd1-8373-8720ca180932',
            type: 'table',
            name: 'sample_data.ecommerce_db.shopify.raw_customer',
            description:
              'This is a raw customers table as represented in our online DB.',
            href: 'http://localhost:8585/api/v1/tables/682eeaf6-87b1-4cd1-8373-8720ca180932',
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
  target: 'ETA_time',
  dashboard: {
    id: '3c20648f-373d-4ce4-8678-8058f06c6969',
    type: 'dashboard',
    name: 'eta_predictions_performance',
    fullyQualifiedName: 'sample_superset.eta_predictions_performance',
    description: '',
    displayName: 'ETA Predictions Performance',
    deleted: false,
    href: 'http://localhost:8585/api/v1/dashboards/3c20648f-373d-4ce4-8678-8058f06c6969',
  },
  mlStore: {
    storage: 's3://path-to-pickle',
    imageRepository: 'https://docker.hub.com/image',
  },
  server: 'http://my-server.ai',
  href: 'http://localhost:8585/api/v1/mlmodels/b2374223-3725-4b05-abe7-d51566e5c317',
  followers: [],
  tags: [],
  usageSummary: {
    dailyStats: {
      count: 0,
      percentileRank: 0.0,
    },
    weeklyStats: {
      count: 0,
      percentileRank: 0.0,
    },
    monthlyStats: {
      count: 0,
      percentileRank: 0.0,
    },
    date: '2022-05-24',
  },
  version: 0.1,
  updatedAt: 1653370236642,
  updatedBy: 'anonymous',
  deleted: false,
};

jest.mock('../../axiosAPIs/mlModelAPI', () => ({
  getMlModelByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockData })),
  patchMlModelDetails: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockData })),
  addFollower: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockData })),
  removeFollower: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockData })),
}));

jest.mock('../../components/MlModelDetail/MlModelDetail.component', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="mlmodel-details">MlModelDetails</div>);
});

describe('Test MlModel Entity Page', () => {
  it('Should render component', async () => {
    const { container } = render(<MlModelPageComponent />, {
      wrapper: MemoryRouter,
    });

    const mlModelDetailComponent = await findByTestId(
      container,
      'mlmodel-details'
    );

    expect(mlModelDetailComponent).toBeInTheDocument();
  });

  it('Should render error component if API fails', async () => {
    (getMlModelByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    const { container } = render(<MlModelPageComponent />, {
      wrapper: MemoryRouter,
    });

    const errorComponent = await findByTestId(container, 'error');

    expect(errorComponent).toBeInTheDocument();
  });
});
