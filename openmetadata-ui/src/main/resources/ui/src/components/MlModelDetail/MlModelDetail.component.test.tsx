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

import { findByTestId, findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import MlModelDetailComponent from './MlModelDetail.component';

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
  version: 0.1,
  updatedAt: 1653370236642,
  updatedBy: 'anonymous',
  deleted: false,
};

const followMlModelHandler = jest.fn();
const unfollowMlModelHandler = jest.fn();
const descriptionUpdateHandler = jest.fn();
const setActiveTabHandler = jest.fn();
const tagUpdateHandler = jest.fn();
const updateMlModelFeatures = jest.fn();
const settingsUpdateHandler = jest.fn();

const mockProp = {
  mlModelDetail: mockData as Mlmodel,
  activeTab: 1,
  followMlModelHandler,
  unfollowMlModelHandler,
  descriptionUpdateHandler,
  setActiveTabHandler,
  tagUpdateHandler,
  updateMlModelFeatures,
  settingsUpdateHandler,
};

jest.mock('../ManageTab/ManageTab.component', () => {
  return jest.fn().mockReturnValue(<p data-testid="manage">ManageTab</p>);
});

jest.mock('../common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description</p>);
});

jest.mock('../common/entityPageInfo/EntityPageInfo', () => {
  return jest.fn().mockReturnValue(<p>EntityPageInfo</p>);
});

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

jest.mock('./MlModelFeaturesList', () => {
  return jest.fn().mockReturnValue(<p>MlModelFeaturesList</p>);
});

jest.mock('../common/TabsPane/TabsPane', () => {
  return jest.fn().mockReturnValue(<p data-testid="tabs">Tabs</p>);
});

jest.mock('../../utils/CommonUtils', () => {
  return {
    getEntityName: jest.fn().mockReturnValue('entityName'),
    getEntityPlaceHolder: jest.fn().mockReturnValue('entityPlaceholder'),
  };
});

jest.mock('../../utils/TableUtils', () => {
  return {
    getTagsWithoutTier: jest.fn().mockReturnValue([]),
    getTierTags: jest.fn().mockReturnValue(undefined),
  };
});

describe('Test MlModel entity detail component', () => {
  it('Should render detail component', async () => {
    const { container } = render(<MlModelDetailComponent {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const detailContainer = await findByTestId(container, 'mlmodel-details');
    const entityInfo = await findByText(container, /EntityPageInfo/i);
    const entityTabs = await findByTestId(container, 'tabs');
    const entityFeatureList = await findByText(
      container,
      /MlModelFeaturesList/i
    );
    const entityDescription = await findByText(container, /Description/i);

    expect(detailContainer).toBeInTheDocument();
    expect(entityInfo).toBeInTheDocument();
    expect(entityTabs).toBeInTheDocument();
    expect(entityFeatureList).toBeInTheDocument();
    expect(entityDescription).toBeInTheDocument();
  });

  it('Should render hyper parameter and ml store table for details tab', async () => {
    const { container } = render(
      <MlModelDetailComponent {...mockProp} activeTab={2} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const detailContainer = await findByTestId(container, 'mlmodel-details');
    const hyperMetereTable = await findByTestId(
      container,
      'hyperparameters-table'
    );

    const mlStoreTable = await findByTestId(container, 'model-store-table');

    expect(detailContainer).toBeInTheDocument();
    expect(hyperMetereTable).toBeInTheDocument();
    expect(mlStoreTable).toBeInTheDocument();
  });

  it('Should render manage component for manage tab', async () => {
    const { container } = render(
      <MlModelDetailComponent {...mockProp} activeTab={3} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const detailContainer = await findByTestId(container, 'mlmodel-details');
    const manageTab = await findByTestId(container, 'manage');

    expect(detailContainer).toBeInTheDocument();
    expect(manageTab).toBeInTheDocument();
  });
});
