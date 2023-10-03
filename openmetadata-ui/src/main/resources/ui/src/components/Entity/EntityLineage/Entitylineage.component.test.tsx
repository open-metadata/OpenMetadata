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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { MOCK_CHILD_MAP, MOCK_LINEAGE_DATA } from '../../../mocks/Lineage.mock';
import EntityLineage from './EntityLineage.component';

const mockEntityLineageProp = {
  deleted: false,
  entityType: EntityType.TABLE,
  hasEditAccess: true,
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

const mockPaginatedData = {
  nodes: [...mockFlowData.node],
  edges: [],
};

jest.mock('../../../utils/EntityLineageUtils', () => ({
  dragHandle: jest.fn(),
  getDeletedLineagePlaceholder: jest
    .fn()
    .mockReturnValue(
      <p>Lineage data is not available for deleted entities.</p>
    ),
  getHeaderLabel: jest.fn().mockReturnValue(<p>Header label</p>),
  getLoadingStatusValue: jest.fn().mockReturnValue(<p>Confirm</p>),
  getLayoutedElements: jest.fn().mockImplementation(() => mockFlowData),
  getLineageData: jest.fn().mockImplementation(() => mockFlowData),
  getPaginatedChildMap: jest.fn().mockImplementation(() => mockPaginatedData),
  getChildMap: jest.fn().mockImplementation(() => MOCK_CHILD_MAP),
  getModalBodyText: jest.fn(),
  onLoad: jest.fn(),
  onNodeContextMenu: jest.fn(),
  onNodeMouseEnter: jest.fn(),
  onNodeMouseLeave: jest.fn(),
  onNodeMouseMove: jest.fn(),
  getUniqueFlowElements: jest.fn().mockReturnValue([]),
  getParamByEntityType: jest.fn().mockReturnValue('entityFQN'),
}));

jest.mock('../../../rest/lineageAPI', () => ({
  getLineageByFQN: jest.fn().mockImplementation(() =>
    Promise.resolve({
      ...MOCK_LINEAGE_DATA,
    })
  ),
}));

jest.mock('../EntityInfoDrawer/EntityInfoDrawer.component', () => {
  return jest.fn().mockReturnValue(<p>EntityInfoDrawerComponent</p>);
});

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockPush,
  }),
}));

describe('Test EntityLineage Component', () => {
  it('Check if EntityLineage is rendering all the nodes', async () => {
    act(() => {
      render(<EntityLineage {...mockEntityLineageProp} />, {
        wrapper: MemoryRouter,
      });
    });

    const lineageContainer = await screen.findByTestId('lineage-container');
    const reactFlowElement = await screen.findByTestId('rf__wrapper');

    expect(lineageContainer).toBeInTheDocument();
    expect(reactFlowElement).toBeInTheDocument();
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

  it('should add fullscreen true in url on fullscreen button click', async () => {
    render(<EntityLineage {...mockEntityLineageProp} />, {
      wrapper: MemoryRouter,
    });

    const lineageContainer = await screen.findByTestId('lineage-container');
    const reactFlowElement = await screen.findByTestId('rf__wrapper');
    const fullscreenButton = await screen.getByTestId('full-screen');

    expect(lineageContainer).toBeInTheDocument();
    expect(reactFlowElement).toBeInTheDocument();

    act(() => {
      fireEvent.click(fullscreenButton);
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      search: 'fullscreen=true',
    });
  });

  it('should show breadcrumbs when URL has fullscreen=true', async () => {
    act(() => {
      render(
        <MemoryRouter
          initialEntries={[
            '/table/sample_data.ecommerce_db.shopify.raw_customer/lineage?fullscreen=true',
          ]}>
          <EntityLineage {...mockEntityLineageProp} />
        </MemoryRouter>
      );
    });
    const lineageContainer = await screen.findByTestId('lineage-container');
    const reactFlowElement = await screen.findByTestId('rf__wrapper');

    expect(lineageContainer).toBeInTheDocument();
    expect(reactFlowElement).toBeInTheDocument();

    const breadcrumbs = await screen.getByTestId('breadcrumb');

    expect(breadcrumbs).toBeInTheDocument();

    const mainRootElement = await screen.getByTestId('lineage-details');

    expect(mainRootElement).toHaveClass('full-screen-lineage');
  });
});
