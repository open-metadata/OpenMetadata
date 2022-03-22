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

import {
  findByTestId,
  findByText,
  queryByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import EntityLineage from './EntityLineage.component';

/**
 * mock implementation of ResizeObserver
 */
window.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const mockLineageData = {
  entity: {
    id: 'efcc334a-41c8-483e-b779-464a88a7ece3',
    type: 'table',
    name: 'bigquery_gcp.shopify.raw_product_catalog',
    description: '1234',
    displayName: 'raw_product_catalog',
    href: 'http://localhost:8585/api/v1/tables/efcc334a-41c8-483e-b779-464a88a7ece3',
  },
  nodes: [
    {
      description: 'dim_address ETL pipeline',
      displayName: 'dim_address etl',
      id: 'c14d78eb-dc17-4bc4-b54b-227318116da3',
      type: 'pipeline',
      name: 'sample_airflow.dim_address_etl',
    },
    {
      description: '',
      displayName: 'deck.gl Demo',
      id: '7408172f-bd78-4c60-a270-f9d5ed1490ab',
      type: 'dashboard',
      name: 'sample_superset.10',
    },
    {
      description: '',
      displayName: 'dim_address',
      id: 'c3cb016a-dc6e-4d22-9aa5-be8b32999a6b',
      type: 'table',
      name: 'bigquery_gcp.shopify.dim_address',
    },
    {
      description: 'diim_location ETL pipeline',
      displayName: 'dim_location etl',
      id: 'bb1c2c56-9b0e-4f8e-920d-02819e5ee288',
      type: 'pipeline',
      name: 'sample_airflow.dim_location_etl',
    },
    {
      description: '',
      displayName: 'dim_api_client',
      id: 'abb6567e-fbd9-47d9-95f6-29a80a5a0a52',
      type: 'table',
      name: 'bigquery_gcp.shopify.dim_api_client',
    },
  ],
  upstreamEdges: [
    {
      fromEntity: 'c14d78eb-dc17-4bc4-b54b-227318116da3',
      toEntity: 'efcc334a-41c8-483e-b779-464a88a7ece3',
    },
    {
      fromEntity: 'bb1c2c56-9b0e-4f8e-920d-02819e5ee288',
      toEntity: '7408172f-bd78-4c60-a270-f9d5ed1490ab',
    },
    {
      fromEntity: '7408172f-bd78-4c60-a270-f9d5ed1490ab',
      toEntity: 'abb6567e-fbd9-47d9-95f6-29a80a5a0a52',
    },
  ],
  downstreamEdges: [
    {
      fromEntity: 'efcc334a-41c8-483e-b779-464a88a7ece3',
      toEntity: '7408172f-bd78-4c60-a270-f9d5ed1490ab',
    },
    {
      fromEntity: 'c14d78eb-dc17-4bc4-b54b-227318116da3',
      toEntity: 'c3cb016a-dc6e-4d22-9aa5-be8b32999a6b',
    },
    {
      fromEntity: '7408172f-bd78-4c60-a270-f9d5ed1490ab',
      toEntity: 'abb6567e-fbd9-47d9-95f6-29a80a5a0a52',
    },
  ],
};

const mockEntityLineageProp = {
  entityLineage: mockLineageData,
  lineageLeafNodes: {
    upStreamNode: [],
    downStreamNode: [],
  },
  isNodeLoading: {
    id: 'id1',
    state: false,
  },
  deleted: false,
  loadNodeHandler: jest.fn(),
  addLineageHandler: jest.fn(),
  removeLineageHandler: jest.fn(),
  entityLineageHandler: jest.fn(),
};

jest.mock('../../utils/EntityLineageUtils', () => ({
  dragHandle: jest.fn(),
  getDataLabel: jest
    .fn()
    .mockReturnValue(<span data-testid="lineage-entity">datalabel</span>),
  getDeletedLineagePlaceholder: jest
    .fn()
    .mockReturnValue(
      <p>Lineage data is not available for deleted entities.</p>
    ),
  getHeaderLabel: jest.fn().mockReturnValue(<p>Header label</p>),
  getLayoutedElements: jest.fn().mockReturnValue([]),
  getLineageData: jest.fn().mockReturnValue([]),
  getModalBodyText: jest.fn(),
  onLoad: jest.fn(),
  onNodeContextMenu: jest.fn(),
  onNodeMouseEnter: jest.fn(),
  onNodeMouseLeave: jest.fn(),
  onNodeMouseMove: jest.fn(),
}));

jest.mock('../../utils/TableUtils', () => ({
  getEntityIcon: jest.fn(),
}));

jest.mock('../../auth-provider/AuthProvider', () => ({
  useAuthContext: jest.fn().mockReturnValue({ isAuthDisabled: true }),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({
    userPermissions: {},
    isAdminUser: false,
  }),
}));

describe('Test EntityLineage Component', () => {
  it('Check if EntityLineage is rendering all the nodes', async () => {
    const { container } = render(<EntityLineage {...mockEntityLineageProp} />, {
      wrapper: MemoryRouter,
    });

    const lineageContainer = await findByTestId(container, 'lineage-container');
    const reactFlowElement = await findByTestId(
      container,
      'react-flow-component'
    );

    expect(reactFlowElement).toBeInTheDocument();

    expect(lineageContainer).toBeInTheDocument();
  });

  it('Check if EntityLineage has deleted as true', async () => {
    const { container } = render(
      <EntityLineage {...mockEntityLineageProp} deleted />,
      {
        wrapper: MemoryRouter,
      }
    );

    const lineageContainer = queryByTestId(container, 'lineage-container');
    const reactFlowElement = queryByTestId(container, 'react-flow-component');
    const deletedMessage = await findByText(
      container,
      /Lineage data is not available for deleted entities/i
    );

    expect(deletedMessage).toBeInTheDocument();

    expect(reactFlowElement).not.toBeInTheDocument();

    expect(lineageContainer).not.toBeInTheDocument();
  });
});
