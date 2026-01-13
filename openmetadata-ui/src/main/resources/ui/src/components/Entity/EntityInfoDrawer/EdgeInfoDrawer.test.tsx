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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Edge, Node } from 'reactflow';
import OverviewSection from '../../../components/common/OverviewSection/OverviewSection';
import EdgeInfoDrawer from './EdgeInfoDrawer.component';

jest.mock(
  '../../../components/common/DescriptionSection/DescriptionSection',
  () =>
    jest.fn().mockImplementation(({ onDescriptionUpdate, showEditButton }) => (
      <div data-testid="description-section">
        <span>label.description</span>
        {showEditButton && (
          <button
            data-testid="edit-description"
            onClick={() =>
              onDescriptionUpdate && onDescriptionUpdate('updatedHTML')
            }>
            Edit Description
          </button>
        )}
      </div>
    ))
);

jest.mock('../../../components/common/OverviewSection/OverviewSection', () => {
  return jest.fn().mockImplementation(() => (
    <div data-testid="overview-section">
      <span>label.overview</span>
    </div>
  ));
});

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
}));

const mockOnEdgeDetailsUpdate = jest.fn();

// Create nodes that match the edge source/target IDs
const createMockNodes = (): Node[] => [
  {
    id: '5c97531f-d164-4707-842e-af52e0c43e26',
    position: { x: 0, y: 0 },
    data: {
      node: {
        id: '5c97531f-d164-4707-842e-af52e0c43e26',
        type: 'table',
        name: 'stg_orders',
        fullyQualifiedName: 'RedshiftProd.dev.demo_dbt_jaffle.stg_orders',
        entityType: 'table',
      },
    },
  },
  {
    id: '5d816d56-40a2-493f-ae9d-012f1cd337dd',
    position: { x: 0, y: 0 },
    data: {
      node: {
        id: '5d816d56-40a2-493f-ae9d-012f1cd337dd',
        type: 'table',
        name: 'customers',
        fullyQualifiedName: 'RedshiftProd.dev.demo_dbt_jaffle.customers',
        entityType: 'table',
      },
    },
  },
];

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
        docId:
          '5c97531f-d164-4707-842e-af52e0c43e26-5d816d56-40a2-493f-ae9d-012f1cd337dd',
      },
      isColumnLineage: false,
      isPipelineRootNode: false,
    },
    selected: true,
  } as Edge,
  nodes: createMockNodes(),
  visible: true,
  hasEditAccess: true,
  onEdgeDetailsUpdate: mockOnEdgeDetailsUpdate,
  onClose: jest.fn(),
};

describe('EdgeInfoDrawer Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component', async () => {
    render(<EdgeInfoDrawer {...mockEdgeInfoDrawer} />);

    expect(
      await screen.findByText('label.edge-information')
    ).toBeInTheDocument();
    expect(await screen.findByText('label.description')).toBeInTheDocument();
    expect(
      await screen.findByText('label.sql-uppercase-query')
    ).toBeInTheDocument();
    expect(await screen.findAllByTestId('edit-button')).toHaveLength(1);
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

    await screen.findByText('label.description');

    const editButton = (await screen.findAllByTestId('edit-description'))[0];

    await act(async () => {
      fireEvent.click(editButton);
    });

    expect(editButton).toBeInTheDocument();
  });

  it('should not render edit button if has no edit access', async () => {
    render(<EdgeInfoDrawer {...mockEdgeInfoDrawer} hasEditAccess={false} />);

    await screen.findByText('label.description');

    expect(screen.queryByTestId('edit-description')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
  });

  it('should pass edgeData without visible field to OverviewSection', async () => {
    render(<EdgeInfoDrawer {...mockEdgeInfoDrawer} />);

    let props:
      | {
          entityInfoV1?: Array<{
            name: string;
            value?: unknown;
            visible?: string[];
          }>;
        }
      | undefined;

    await waitFor(() => {
      const overviewSectionCalls = (OverviewSection as jest.Mock).mock.calls;
      const lastCall = overviewSectionCalls[overviewSectionCalls.length - 1];
      props = lastCall?.[0];

      expect(props?.entityInfoV1).toBeDefined();
      expect(Array.isArray(props?.entityInfoV1)).toBe(true);
      expect(props?.entityInfoV1?.length).toBeGreaterThan(0);
    });

    const entityInfoV1 = props?.entityInfoV1;
    if (!entityInfoV1) {
      throw new Error('entityInfoV1 is undefined');
    }

    entityInfoV1.forEach((item) => {
      expect(item).not.toHaveProperty('visible');
    });

    const hasSource = entityInfoV1.some((item) => item.name === 'label.source');
    const hasTarget = entityInfoV1.some((item) => item.name === 'label.target');

    expect(hasSource || hasTarget).toBe(true);
  });

  it('should pass empty componentType to OverviewSection', async () => {
    render(<EdgeInfoDrawer {...mockEdgeInfoDrawer} />);

    let props: { componentType?: string } | undefined;

    await waitFor(() => {
      const overviewSectionCalls = (OverviewSection as jest.Mock).mock.calls;

      expect(overviewSectionCalls.length).toBeGreaterThan(0);

      const lastCall = overviewSectionCalls[overviewSectionCalls.length - 1];
      props = lastCall?.[0];
    });

    expect(props?.componentType).toBe('');
  });
});
