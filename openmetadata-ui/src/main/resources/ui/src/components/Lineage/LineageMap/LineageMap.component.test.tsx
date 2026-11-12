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
import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode, useEffect } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import {
  LineageBand,
  LineageLens,
  LineageLevelKind,
  LineageScene,
  LineageSceneNode,
} from '../../../generated/api/lineage/lineageScene';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { getLineageScene } from '../../../rest/lineageAPI';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import LineageMap from './LineageMap.component';

const mockNavigate = jest.fn();
let mockSearch = '';
const mockFlowInstance = {
  getZoom: () => 1,
  setViewport: jest.fn(),
  fitBounds: jest.fn(),
  fitView: jest.fn(),
  setCenter: jest.fn(),
  zoomOut: jest.fn(),
  screenToFlowPosition: (point: { x: number; y: number }) => point,
  getIntersectingNodes: () => [],
};

// A stable t, as react-i18next gives: the map's effects depend on it.
const mockT = (key: string) => key;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () =>
  jest.fn(() => ({ pathname: '/lineage', search: mockSearch }))
);

jest.mock('../../../hooks/useDomainStore', () => ({
  useDomainStore: () => ({
    activeDomain: 'All Domains',
    isDomainRestricted: false,
  }),
}));

jest.mock('../Lineage/LineageHandlersContext', () => ({
  useLineageHandlers: () => ({ onNodeClick: jest.fn() }),
}));

jest.mock('../../../rest/lineageAPI', () => ({
  getLineageScene: jest.fn(),
  getLineageEdgeDetails: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showInfoToast: jest.fn(),
}));

// React Flow needs a measured DOM; the map's own decisions are what is tested.
jest.mock('reactflow', () => {
  const MockReactFlow = ({
    children,
    onInit,
    onWheel,
  }: {
    children?: ReactNode;
    onInit?: (instance: unknown) => void;
    onWheel?: (event: unknown) => void;
  }) => {
    useEffect(() => {
      onInit?.(mockFlowInstance);
    }, [onInit]);

    return (
      <div data-testid="react-flow" onWheel={onWheel}>
        {children}
      </div>
    );
  };

  return {
    __esModule: true,
    default: MockReactFlow,
    applyNodeChanges: (_changes: unknown, nodes: unknown) => nodes,
    Background: () => null,
    MiniMap: () => null,
    Panel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    ReactFlowProvider: ({ children }: { children?: ReactNode }) => (
      <>{children}</>
    ),
  };
});

jest.mock('../../../hooks/lineage/useUncontrolledNodeDrag', () => ({
  useUncontrolledNodeDrag: (
    nodes: unknown[],
    onNodesChange: (changes: unknown[]) => void
  ) => ({ nodes, onNodesChange }),
}));

jest.mock(
  '../../Entity/EntityLineage/CustomNodeV1.component',
  () => () => null
);

jest.mock(
  '../../Entity/EntityLineage/LineageControlButtons/LineageControlButtons',
  () => () => null
);

jest.mock(
  '../../Entity/EntityLineage/LineageLayers/LineageLayers',
  () => () => null
);

jest.mock('../Edges/CanvasLayerWrapper/CanvasLayerWrapper', () => ({
  CanvasLayerWrapper: () => null,
}));

jest.mock('../LineageSkeleton.component', () => () => (
  <div data-testid="lineage-skeleton" />
));

const FOCUS_FQN = 'svc.db.s.orders';

const tableNode = (
  fqn: string,
  overrides: Partial<LineageSceneNode> = {}
): LineageSceneNode => ({
  id: `table:${fqn}`,
  label: fqn.split('.').at(-1) ?? fqn,
  fullyQualifiedName: fqn,
  entityType: EntityType.TABLE,
  band: LineageBand.Asset,
  levelKind: LineageLevelKind.Table,
  isExpandable: true,
  ...overrides,
});

const sceneFor = (
  band: LineageBand,
  nodes: LineageSceneNode[],
  edges: LineageScene['edges'],
  lens = LineageLens.Service
): LineageScene => ({
  lens,
  band,
  focusFqn: FOCUS_FQN,
  focusEntityType: EntityType.TABLE,
  breadcrumb: [
    {
      id: 'root',
      band: LineageBand.Layer,
      label: 'All Services',
      levelKind: LineageLevelKind.Service,
    },
    {
      id: `table:${FOCUS_FQN}`,
      band,
      label: 'orders',
      fullyQualifiedName: FOCUS_FQN,
      entityType: EntityType.TABLE,
      levelKind: LineageLevelKind.Table,
    },
  ],
  nodes,
  edges,
});

const sceneWithLineage = (band = LineageBand.Asset, lens?: LineageLens) =>
  sceneFor(
    band,
    [
      tableNode(FOCUS_FQN, { band, isFocus: true, isOrigin: true }),
      tableNode('svc.db.s.fact_orders', { band }),
    ],
    [
      {
        id: 'orders-to-fact',
        band,
        from: `table:${FOCUS_FQN}`,
        to: 'table:svc.db.s.fact_orders',
      },
    ],
    lens
  );

const focusedTable = {
  id: 'orders-id',
  name: 'orders',
  fullyQualifiedName: FOCUS_FQN,
} as SourceType;

const renderMap = () => (
  <LineageMap
    isPlatformLineage
    entity={focusedTable}
    entityType={EntityType.TABLE}
    hasEditAccess={false}
  />
);

describe('LineageMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch = '';
    useLineageStore.getState().reset();
    document.cookie = 'lineageMapsOnboardingSeen=true; path=/';
  });

  it('says there is no lineage for a focused asset that has none', async () => {
    (getLineageScene as jest.Mock).mockResolvedValue(
      sceneFor(
        LineageBand.Asset,
        [tableNode(FOCUS_FQN, { isFocus: true, isOrigin: true })],
        []
      )
    );

    render(renderMap());

    expect(
      await screen.findByText('message.no-lineage-data-available')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('lineage-map-canvas')).not.toBeInTheDocument();
  });

  it('replaces a drawn scene with Reload when the next scene fails to load', async () => {
    (getLineageScene as jest.Mock).mockResolvedValueOnce(sceneWithLineage());

    const { rerender } = render(renderMap());

    expect(await screen.findByTestId('lineage-map-canvas')).toBeInTheDocument();

    (getLineageScene as jest.Mock).mockRejectedValueOnce(new Error('down'));
    mockSearch = `?lineageLens=${LineageLens.Domain}`;
    rerender(renderMap());

    const reload = await screen.findByRole('button', { name: 'label.reload' });

    expect(screen.queryByTestId('lineage-map-canvas')).not.toBeInTheDocument();

    (getLineageScene as jest.Mock).mockResolvedValueOnce(
      sceneWithLineage(LineageBand.Asset, LineageLens.Domain)
    );
    fireEvent.click(reload);

    expect(await screen.findByTestId('lineage-map-canvas')).toBeInTheDocument();
    expect(getLineageScene).toHaveBeenLastCalledWith(
      expect.objectContaining({ lens: LineageLens.Domain })
    );
  });
});
