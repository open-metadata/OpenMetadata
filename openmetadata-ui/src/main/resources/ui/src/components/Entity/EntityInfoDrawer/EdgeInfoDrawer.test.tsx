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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Edge } from 'reactflow';
import { MOCK_NODES_AND_EDGES } from '../../../mocks/Lineage.mock';
import EdgeInfoDrawer from './EdgeInfoDrawer.component';

jest.mock('../../../components/common/EntityDescription/DescriptionV1', () =>
  jest.fn().mockImplementation(({ onDescriptionUpdate }) => (
    <div data-testid="description-v1">
      DescriptionV1
      <button
        data-testid="update-description-button"
        onClick={() => onDescriptionUpdate('updatedHTML')}>
        Update Description
      </button>
    </div>
  ))
);

jest.mock('../../../utils/CommonUtils', () => ({
  getNameFromFQN: jest.fn().mockReturnValue('getNameFromFQN'),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('username'),
}));

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../Database/SchemaEditor/SchemaEditor', () => {
  return jest.fn().mockImplementation(() => <div>SchemaEditor.component</div>);
});

jest.mock('../../Modals/ModalWithQueryEditor/ModalWithQueryEditor', () => {
  return jest.fn().mockImplementation(() => <div>ModalWithQueryEditor</div>);
});

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Drawer: jest.fn().mockImplementation(({ children, title }) => (
    <div data-testid="drawer-component">
      Drawer
      <div data-testid="title">{title}</div>
      <div>{children}</div>
    </div>
  )),
}));

const mockOnEdgeDetailsUpdate = jest.fn();
const mockEdgeInfoDrawer = {
  edge: {
    id: 'edge-5c97531f-d164-4707-842e-af52e0c43e26-5d816d56-40a2-493f-ae9d-012f1cd337dd',
    source: '5c97531f-d164-4707-842e-af52e0c43e26',
    target: '5d816d56-40a2-493f-ae9d-012f1cd337dd',
    type: 'buttonedge',
    animated: false,
    style: {
      strokeWidth: '2px',
    },
    markerEnd: {
      type: 'arrowclosed',
    },
    data: {
      edge: {
        toEntity: {
          fqn: 'RedshiftProd.dev.demo_dbt_jaffle.customers',
          id: '5d816d56-40a2-493f-ae9d-012f1cd337dd',
          type: 'table',
        },
        pipeline: null,
        fromEntity: {
          fqn: 'RedshiftProd.dev.demo_dbt_jaffle.stg_orders',
          id: '5c97531f-d164-4707-842e-af52e0c43e26',
          type: 'table',
        },
        sqlQuery: null,
        description: null,
        source: 'DbtLineage',
        doc_id:
          '5c97531f-d164-4707-842e-af52e0c43e26-5d816d56-40a2-493f-ae9d-012f1cd337dd',
      },
      isColumnLineage: false,
      isPipelineRootNode: false,
    },
    selected: true,
  } as Edge,
  nodes: MOCK_NODES_AND_EDGES.nodes,
  visible: true,
  hasEditAccess: true,
  onEdgeDetailsUpdate: mockOnEdgeDetailsUpdate,
  onClose: jest.fn(),
};

describe('EdgeInfoDrawer Component', () => {
  it('should render the component', async () => {
    render(<EdgeInfoDrawer {...mockEdgeInfoDrawer} />);

    expect(await screen.findByTestId('title')).toHaveTextContent(
      'label.edge-information'
    );

    expect(await screen.findByTestId('description-v1')).toBeInTheDocument();
    expect(
      await screen.findByText('label.sql-uppercase-query')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('edit-sql')).toBeInTheDocument();
  });

  it('should render no query if no query is present', async () => {
    render(<EdgeInfoDrawer {...mockEdgeInfoDrawer} />);

    expect(
      await screen.findByText('server.no-query-available')
    ).toBeInTheDocument();
  });

  it('should render source of lineage', async () => {
    render(<EdgeInfoDrawer {...mockEdgeInfoDrawer} />);

    expect(await screen.findByText('label.lineage-source')).toBeInTheDocument();
    expect(await screen.findByText('dbt Lineage')).toBeInTheDocument();
  });

  it('should call onEdgeDetailsUpdate on update description', async () => {
    render(<EdgeInfoDrawer {...mockEdgeInfoDrawer} />);
    const updateDescriptionButton = await screen.findByTestId(
      'update-description-button'
    );
    await act(async () => {
      fireEvent.click(updateDescriptionButton);
    });

    expect(mockOnEdgeDetailsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        edge: expect.objectContaining({
          lineageDetails: expect.objectContaining({
            description: 'updatedHTML',
          }),
        }),
      })
    );
  });

  it('should not render edit SQL button if has no edit access', () => {
    render(<EdgeInfoDrawer {...mockEdgeInfoDrawer} hasEditAccess={false} />);

    expect(screen.queryByTestId('edit-sql')).not.toBeInTheDocument();
  });
});
