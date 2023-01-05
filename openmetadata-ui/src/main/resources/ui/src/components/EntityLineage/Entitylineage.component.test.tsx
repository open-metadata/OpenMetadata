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

import { findByTestId, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-test-renderer';
import { EntityType } from '../../enums/entity.enum';
import EntityLineage from './EntityLineage.component';

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

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
  entityType: EntityType.TABLE,
  loadNodeHandler: jest.fn(),
  addLineageHandler: jest.fn(),
  removeLineageHandler: jest.fn(),
  entityLineageHandler: jest.fn(),
};

const mockFlowData = {
  node: [
    {
      id: 'a4b21449-b03b-4527-b482-148f52f92ff2',
      sourcePosition: 'right',
      targetPosition: 'left',
      type: 'default',
      className: 'leaf-node core',
      data: {
        label: 'dim_address etl',
        isEditMode: false,
        columns: {},
        isExpanded: false,
      },
      position: {
        x: 0,
        y: 0,
      },
    },
  ],
  edge: [],
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
  getLoadingStatusValue: jest.fn().mockReturnValue(<p>Confirm</p>),
  getLayoutedElements: jest.fn().mockImplementation(() => mockFlowData),
  getLineageData: jest.fn().mockImplementation(() => mockFlowData),
  getModalBodyText: jest.fn(),
  onLoad: jest.fn(),
  onNodeContextMenu: jest.fn(),
  onNodeMouseEnter: jest.fn(),
  onNodeMouseLeave: jest.fn(),
  onNodeMouseMove: jest.fn(),
  getUniqueFlowElements: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/TableUtils', () => ({
  getEntityIcon: jest.fn(),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({
    userPermissions: [],
    isAdminUser: false,
  }),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  hasPermission: jest.fn().mockReturnValue(false),
}));

jest.mock('../EntityInfoDrawer/EntityInfoDrawer.component', () => {
  return jest.fn().mockReturnValue(<p>EntityInfoDrawerComponent</p>);
});

describe('Test EntityLineage Component', () => {
  it('Check if EntityLineage is rendering all the nodes', async () => {
    const { container } = render(<EntityLineage {...mockEntityLineageProp} />, {
      wrapper: MemoryRouter,
    });

    const lineageContainer = await findByTestId(container, 'lineage-container');
    const reactFlowElement = await findByTestId(container, 'rf__wrapper');

    expect(reactFlowElement).toBeInTheDocument();

    expect(lineageContainer).toBeInTheDocument();
  });

  it('Check if EntityLineage has deleted as true', async () => {
    act(() => {
      render(<EntityLineage {...mockEntityLineageProp} deleted />, {
        wrapper: MemoryRouter,
      });
    });

    const lineageContainer = screen.queryByTestId('lineage-container');
    const reactFlowElement = screen.queryByTestId('rf__wrapper');
    const deletedMessage = await screen.findByText(
      /Lineage data is not available for deleted entities/i
    );

    expect(deletedMessage).toBeInTheDocument();

    expect(reactFlowElement).not.toBeInTheDocument();

    expect(lineageContainer).not.toBeInTheDocument();
  });
});
