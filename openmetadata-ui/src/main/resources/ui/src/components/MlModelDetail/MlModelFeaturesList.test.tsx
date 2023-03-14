/*
 *  Copyright 2022 Collate.
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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import MlModelFeaturesList from './MlModelFeaturesList';

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

jest.mock('../../utils/CommonUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('entityName'),
  getHtmlForNonAdminAction: jest.fn().mockReturnValue('admin action'),
}));

jest.mock('../../utils/GlossaryUtils', () => ({
  fetchGlossaryTerms: jest.fn(),
  getGlossaryTermlist: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/TableUtils', () => ({
  getEntityLink: jest.fn().mockReturnValue('entityLink'),
}));

jest.mock('../../utils/TagsUtils', () => ({
  getClassifications: jest.fn(),
  getTaglist: jest.fn().mockReturnValue([]),
  getTagDisplay: jest.fn(),
}));

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

jest.mock('../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor', () => ({
  ModalWithMarkdownEditor: jest
    .fn()
    .mockReturnValue(<p> ModalWithMarkdownEditor</p>),
}));

jest.mock('components/Tag/Tags/tags', () => {
  return jest.fn().mockImplementation(({ tag }) => <span>{tag}</span>);
});

const handleFeaturesUpdate = jest.fn();

const mockProp = {
  mlFeatures: mockData['mlFeatures'] as Mlmodel['mlFeatures'],
  handleFeaturesUpdate,
  permissions: DEFAULT_ENTITY_PERMISSION,
};

describe('Test MlModel feature list', () => {
  it('Should render MlModel feature list component', async () => {
    render(<MlModelFeaturesList {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const featureList = await screen.findByTestId('feature-list');

    expect(featureList).toBeInTheDocument();
  });

  it('Should render proper feature cards', async () => {
    render(<MlModelFeaturesList {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const featureList = await screen.findByTestId('feature-list');
    const salesFeatureCard = await screen.findByTestId('feature-card-sales');
    const personaFeatureCard = await screen.findByTestId(
      'feature-card-persona'
    );

    expect(featureList).toBeInTheDocument();
    expect(salesFeatureCard).toBeInTheDocument();
    expect(personaFeatureCard).toBeInTheDocument();
  });
});
