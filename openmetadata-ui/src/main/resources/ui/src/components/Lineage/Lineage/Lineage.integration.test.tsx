/*
 *  Copyright 2026 Collate.
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
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Node } from 'reactflow';
import { EntityType } from '../../../enums/entity.enum';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { useLineageStore } from '../../../hooks/useLineageStore';
import {
  getDataQualityLineage,
  getLineageDataByFQN,
} from '../../../rest/lineageAPI';
import tableClassBase from '../../../utils/TableClassBase';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import { LineageNodeType } from '../Lineage.interface';
import { Lineage } from './Lineage';
import { useLineageHandlers } from './LineageHandlersContext';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../rest/lineageAPI', () => ({
  getDataQualityLineage: jest.fn(),
  getLineageDataByFQN: jest.fn(),
  getPlatformLineage: jest.fn(),
  updateLineageEdge: jest.fn(),
  exportLineageAsync: jest.fn(),
}));

const mockLocation = { search: '', pathname: '/lineage' };
jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () =>
  jest.fn().mockImplementation(() => ({ ...mockLocation }))
);

jest.mock('../../Entity/EntityInfoDrawer/EdgeInfoDrawer.component', () => ({
  __esModule: true,
  default: () => <div data-testid="edge-info-drawer" />,
}));

jest.mock(
  '../../Entity/EntityLineage/AppPipelineModel/AddPipeLineModal',
  () => ({
    __esModule: true,
    default: () => <div data-testid="add-pipeline-modal" />,
  })
);

jest.mock('../../Entity/EntityLineage/EntityLineageSidebar.component', () => ({
  __esModule: true,
  default: () => <div data-testid="entity-lineage-sidebar" />,
}));

jest.mock('@openmetadata/ui-core-components', () => {
  type ChildrenProps = { children?: ReactNode };

  const DialogComponent = ({
    children,
    'data-testid': dataTestId,
  }: ChildrenProps & { 'data-testid'?: string }) => (
    <div data-testid={dataTestId} role="dialog">
      {children}
    </div>
  );
  DialogComponent.Header = ({ title }: { title?: ReactNode }) => (
    <div>{title}</div>
  );
  DialogComponent.Content = ({ children }: ChildrenProps) => (
    <div>{children}</div>
  );
  DialogComponent.Footer = ({ children }: ChildrenProps) => (
    <div>{children}</div>
  );

  return {
    Button: ({
      children,
      'data-testid': dataTestId,
    }: ChildrenProps & { 'data-testid'?: string }) => (
      <button data-testid={dataTestId} type="button">
        {children}
      </button>
    ),
    Dialog: DialogComponent,
    Modal: ({ children }: ChildrenProps) => <>{children}</>,
    ModalOverlay: ({
      isOpen,
      children,
    }: ChildrenProps & { isOpen?: boolean }) =>
      isOpen ? <>{children}</> : null,
    SlideoutMenu: ({ children }: ChildrenProps) => <>{children}</>,
  };
});

const entityFixture = {
  id: 'e1',
  name: 't1',
  fullyQualifiedName: 'svc.db.s.t1',
} as SourceType;

const LoadChildNodesConsumer = ({ node }: { node: LineageNodeType }) => {
  const { loadChildNodesHandler } = useLineageHandlers();

  return (
    <button
      data-testid="load-child-nodes"
      onClick={() =>
        loadChildNodesHandler(node, LineageDirection.Downstream, 1)
      }>
      Load Child Nodes
    </button>
  );
};

const nodeClickFixture: Node = {
  id: 'table1',
  type: 'default',
  position: { x: 0, y: 0 },
  data: {
    node: {
      id: 'table1',
      name: 'table1',
      fullyQualifiedName: 'table1',
      type: 'table',
    },
    isRootNode: false,
    fullyQualifiedName: 'table1',
  },
};

const NodeClickConsumer = () => {
  const { onNodeClick } = useLineageHandlers();

  return (
    <button
      data-testid="node-click"
      onClick={() => onNodeClick(nodeClickFixture)}>
      Click Node
    </button>
  );
};

const UpdateEntityDataConsumer = () => {
  const { updateEntityData } = useLineageHandlers();

  return (
    <button
      data-testid="update-entity"
      onClick={() =>
        updateEntityData(EntityType.TABLE, {
          id: 'e2',
          name: 't2',
          fullyQualifiedName: 'svc.db.s.t2',
        } as SourceType)
      }>
      Update Entity
    </button>
  );
};

describe('Lineage integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.search = '';
    useLineageStore.getState().reset();
  });

  it('fetches lineage data with the correct parameters on mount', async () => {
    (getLineageDataByFQN as jest.Mock).mockResolvedValue({
      nodes: {},
      downstreamEdges: {},
      upstreamEdges: {},
    });

    render(
      <MemoryRouter>
        <Lineage
          entity={entityFixture}
          entityFqn="svc.db.s.t1"
          entityType={EntityType.TABLE}
          isPlatformLineage={false}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: EntityType.TABLE,
          fqn: 'svc.db.s.t1',
          config: expect.objectContaining({
            downstreamDepth: 3,
            upstreamDepth: 3,
          }),
        })
      );
    });

    await waitFor(() => {
      expect(useLineageStore.getState().loading).toBe(false);
    });

    expect(getDataQualityLineage).not.toHaveBeenCalled();
  });

  it('loadChildNodesHandler fetches and merges the expanded subtree into the lineage', async () => {
    const nodeData = {
      name: 'table3',
      type: 'table',
      entityType: 'table',
      fullyQualifiedName: 'table3',
      id: 'table3',
      columns: [],
      downstreamExpandPerformed: false,
    } as unknown as LineageNodeType;

    const mockLineageResponse = {
      nodes: {
        table3: { entity: nodeData },
        table4: {
          entity: {
            id: 'table4',
            name: 'table4',
            entityType: 'table',
            fullyQualifiedName: 'table4',
            columns: [],
          },
        },
      },
      downstreamEdges: {
        'table3-table4': {
          fromEntity: { id: 'table3', type: 'table' },
          toEntity: { id: 'table4', type: 'table' },
        },
      },
      upstreamEdges: {},
    };

    (getLineageDataByFQN as jest.Mock).mockResolvedValue(mockLineageResponse);

    render(
      <MemoryRouter>
        <Lineage entityFqn="" isPlatformLineage={false}>
          <LoadChildNodesConsumer node={nodeData} />
        </Lineage>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('load-child-nodes'));

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalledWith(
        expect.objectContaining({
          fqn: 'table3',
          entityType: 'table',
          direction: LineageDirection.Downstream,
        })
      );
    });

    await waitFor(() => {
      expect(
        useLineageStore
          .getState()
          .entityLineage.nodes?.some((n) => n.fullyQualifiedName === 'table4')
      ).toBe(true);
    });
  });

  it('onNodeClick opens the drawer, selects the node and traces its connections', () => {
    render(
      <MemoryRouter>
        <Lineage entityFqn="" isPlatformLineage={false}>
          <NodeClickConsumer />
        </Lineage>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('node-click'));

    const state = useLineageStore.getState();

    expect(state.isDrawerOpen).toBe(true);
    expect(state.activeNode?.id).toBe('table1');
    expect(state.selectedNode).toEqual(nodeClickFixture.data.node);
    expect(state.tracedNodes.has('table1')).toBe(true);
  });

  it('updateEntityData imperatively syncs the entity context to the store', async () => {
    (getLineageDataByFQN as jest.Mock).mockResolvedValue({
      nodes: {},
      downstreamEdges: {},
      upstreamEdges: {},
    });

    render(
      <MemoryRouter>
        <Lineage entityFqn="" isPlatformLineage={false}>
          <UpdateEntityDataConsumer />
        </Lineage>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('update-entity'));

    const state = useLineageStore.getState();

    expect(state.entityFqn).toBe('svc.db.s.t2');
    expect(state.entityType).toBe(EntityType.TABLE);

    // updateEntityData also flips entityType away from `undefined`, which
    // re-arms the mount-fetch effect — let that settle so it isn't left
    // dangling across tests.
    await waitFor(() => {
      expect(useLineageStore.getState().loading).toBe(false);
    });
  });

  it('fetches lineage when switching from impact-analysis mode to lineage mode', async () => {
    mockLocation.search = '?mode=impact_analysis';
    (getLineageDataByFQN as jest.Mock).mockResolvedValue({
      nodes: {},
      downstreamEdges: {},
      upstreamEdges: {},
    });

    const { rerender } = render(
      <MemoryRouter>
        <Lineage
          entity={entityFixture}
          entityFqn="svc.db.s.t1"
          entityType={EntityType.TABLE}
          isPlatformLineage={false}
        />
      </MemoryRouter>
    );

    expect(getLineageDataByFQN).not.toHaveBeenCalled();

    mockLocation.search = '?mode=lineage';
    rerender(
      <MemoryRouter>
        <Lineage
          entity={entityFixture}
          entityFqn="svc.db.s.t1"
          entityType={EntityType.TABLE}
          isPlatformLineage={false}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: EntityType.TABLE,
          fqn: 'svc.db.s.t1',
        })
      );
    });

    await waitFor(() => {
      expect(useLineageStore.getState().loading).toBe(false);
    });
  });

  it('reuses already-fetched lineage when switching modes back and forth', async () => {
    mockLocation.search = '?mode=lineage';
    (getLineageDataByFQN as jest.Mock).mockResolvedValue({
      nodes: {},
      downstreamEdges: {},
      upstreamEdges: {},
    });

    const renderLineage = () => (
      <MemoryRouter>
        <Lineage
          entity={entityFixture}
          entityFqn="svc.db.s.t1"
          entityType={EntityType.TABLE}
          isPlatformLineage={false}
        />
      </MemoryRouter>
    );

    const { rerender } = render(renderLineage());

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(useLineageStore.getState().loading).toBe(false);
    });

    mockLocation.search = '?mode=impact_analysis';
    rerender(renderLineage());

    mockLocation.search = '?mode=lineage';
    rerender(renderLineage());

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalledTimes(1);
    });
  });

  const renderMounted = () =>
    render(
      <MemoryRouter>
        <Lineage
          entity={entityFixture}
          entityFqn="svc.db.s.t1"
          entityType={EntityType.TABLE}
          isPlatformLineage={false}
        />
      </MemoryRouter>
    );

  const emptyLineageResponse = {
    nodes: {},
    downstreamEdges: {},
    upstreamEdges: {},
  };

  it('seeds the store time filter from the URL and fetches with it', async () => {
    mockLocation.search = '?lineageStartTime=100&lineageEndTime=200';
    (getLineageDataByFQN as jest.Mock).mockResolvedValue(emptyLineageResponse);

    renderMounted();

    expect(useLineageStore.getState().timeFilter).toEqual({
      startTime: 100,
      endTime: 200,
    });

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalledWith(
        expect.objectContaining({ startTime: 100, endTime: 200 })
      );
    });
  });

  it('refetches with the new range when the store time filter changes', async () => {
    (getLineageDataByFQN as jest.Mock).mockResolvedValue(emptyLineageResponse);

    renderMounted();

    await waitFor(() => expect(getLineageDataByFQN).toHaveBeenCalledTimes(1));

    act(() => {
      useLineageStore.getState().setTimeFilter({ startTime: 5, endTime: 9 });
    });

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenLastCalledWith(
        expect.objectContaining({ startTime: 5, endTime: 9 })
      );
    });
  });

  it('refetches with the quick filter query when the store quick filters change', async () => {
    (getLineageDataByFQN as jest.Mock).mockResolvedValue(emptyLineageResponse);

    renderMounted();

    await waitFor(() => expect(getLineageDataByFQN).toHaveBeenCalledTimes(1));

    act(() => {
      useLineageStore.getState().setSelectedQuickFilters([
        {
          key: 'owners.displayName.keyword',
          label: 'Owner',
          value: [{ key: 'alice', label: 'alice' }],
        },
      ]);
    });

    await waitFor(() => {
      const lastCall = (getLineageDataByFQN as jest.Mock).mock.calls.at(-1)[0];

      expect(lastCall.queryFilter).toContain('alice');
    });
  });

  it('publishes data-quality lineage to the store', async () => {
    jest.spyOn(tableClassBase, 'getAlertEnableStatus').mockReturnValue(true);
    const dqResponse = { nodes: [{ id: 'dq-node' }], edges: [] };
    (getLineageDataByFQN as jest.Mock).mockResolvedValue(emptyLineageResponse);
    (getDataQualityLineage as jest.Mock).mockResolvedValue(dqResponse);

    renderMounted();

    act(() => {
      useLineageStore.setState({ isDQEnabled: true });
    });

    await waitFor(() => {
      expect(useLineageStore.getState().dataQualityLineage).toEqual(dqResponse);
    });
  });
});
