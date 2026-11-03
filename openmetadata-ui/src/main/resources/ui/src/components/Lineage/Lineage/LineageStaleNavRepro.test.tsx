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
import { render, waitFor } from '@testing-library/react';
import { ReactNode, useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ReactFlowInstance } from 'reactflow';
import { EntityType } from '../../../enums/entity.enum';
import { usePersistentStorage } from '../../../hooks/currentUserStore/useCurrentUserStore';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { getLineageDataByFQN } from '../../../rest/lineageAPI';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import { Lineage } from './Lineage';
import { useLineageHandlers } from './LineageHandlersContext';

// ELK is a third-party layout engine; positions are not what these tests check.
jest.mock('../../../utils/Lineage/Layout/ElkLayoutUtils', () => ({
  positionNodesUsingElk: jest.fn(async (nodes, edges) => ({ nodes, edges })),
}));

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

jest.mock('@openmetadata/ui-core-components', () => {
  type ChildrenProps = { children?: ReactNode };

  return {
    Button: ({
      children,
      'data-testid': dataTestId,
    }: ChildrenProps & { 'data-testid'?: string }) => (
      <button data-testid={dataTestId} type="button">
        {children}
      </button>
    ),
    Modal: ({ children }: ChildrenProps) => <>{children}</>,
    ModalOverlay: ({
      isOpen,
      children,
    }: ChildrenProps & { isOpen?: boolean }) =>
      isOpen ? <>{children}</> : null,
    SlideoutMenu: ({ children }: ChildrenProps) => <>{children}</>,
  };
});

const entityA = {
  id: 'id-a',
  name: 'entityA',
  fullyQualifiedName: 'svc.db.s.entityA',
} as SourceType;

const entityB = {
  id: 'id-b',
  name: 'entityB',
  fullyQualifiedName: 'svc.db.s.entityB',
} as SourceType;

const emptyResponse = {
  nodes: {},
  downstreamEdges: {},
  upstreamEdges: {},
};

// Build a lineage response for a root entity with a single downstream node, so
// the parsed lineage for two different entities is distinguishable and we can
// assert the stale graph is swapped out, not merged on top of.
const tableNode = (fqn: string, depth: number) => ({
  entity: {
    id: fqn,
    name: fqn,
    fullyQualifiedName: fqn,
    type: EntityType.TABLE,
    entityType: EntityType.TABLE,
    columns: [],
  },
  nodeDepth: depth,
});

const responseFor = (rootFqn: string, downstreamFqn: string) => ({
  nodes: {
    [rootFqn]: tableNode(rootFqn, 0),
    [downstreamFqn]: tableNode(downstreamFqn, 1),
  },
  downstreamEdges: {
    [downstreamFqn]: {
      fromEntity: {
        id: rootFqn,
        type: EntityType.TABLE,
        fullyQualifiedName: rootFqn,
      },
      toEntity: {
        id: downstreamFqn,
        type: EntityType.TABLE,
        fullyQualifiedName: downstreamFqn,
      },
    },
  },
  upstreamEdges: {},
});

const responseA = responseFor('svc.db.s.entityA', 'svc.db.s.downstreamA');
const responseB = responseFor('svc.db.s.entityB', 'svc.db.s.downstreamB');

const ReactFlowInitConsumer = () => {
  const { onInitReactFlow } = useLineageHandlers();

  useEffect(() => {
    onInitReactFlow({
      viewportInitialized: true,
      setCenter: jest.fn(),
      fitView: jest.fn(),
      getZoom: jest.fn(() => 1),
    } as unknown as ReactFlowInstance);
  }, [onInitReactFlow]);

  return null;
};

const renderLineage = (entity: SourceType, fqn: string) => (
  <MemoryRouter>
    <Lineage
      entity={entity}
      entityFqn={fqn}
      entityType={EntityType.TABLE}
      isPlatformLineage={false}>
      <ReactFlowInitConsumer />
    </Lineage>
  </MemoryRouter>
);

const parsedNodeFqns = () =>
  useLineageStore
    .getState()
    .entityLineage.nodes?.map((node) => node.fullyQualifiedName) ?? [];

const drawnNodeIds = () =>
  useLineageStore.getState().nodes.map((node) => node.id);

describe('Lineage stale navigation (same-type, no remount)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.search = '';
    useLineageStore.getState().reset();
  });

  afterEach(() => {
    usePersistentStorage.getState().clearUserPreference('admin');
  });

  it('refetches and clears the stale graph when navigating to a new entity of the same type without unmounting', async () => {
    (getLineageDataByFQN as jest.Mock).mockImplementation(
      (args: { fqn: string }) => {
        if (args.fqn === 'svc.db.s.entityA') {
          return Promise.resolve(responseA);
        }
        if (args.fqn === 'svc.db.s.entityB') {
          return Promise.resolve(responseB);
        }

        return Promise.resolve(emptyResponse);
      }
    );

    // Mount for entity A and let its lineage settle.
    const { rerender } = render(renderLineage(entityA, 'svc.db.s.entityA'));

    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: EntityType.TABLE,
          fqn: 'svc.db.s.entityA',
        })
      );
    });

    await waitFor(() =>
      expect(parsedNodeFqns()).toContain('svc.db.s.downstreamA')
    );
    await waitFor(() =>
      expect(drawnNodeIds()).toContain('svc.db.s.downstreamA')
    );

    // Navigate to entity B of the SAME type while <Lineage /> stays mounted
    // (React reuses the element across an intra-type route change). No unmount.
    rerender(renderLineage(entityB, 'svc.db.s.entityB'));

    // The fetch trigger effect must re-arm and request entity B's lineage.
    await waitFor(() => {
      expect(getLineageDataByFQN).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: EntityType.TABLE,
          fqn: 'svc.db.s.entityB',
        })
      );
    });

    // Entity A's graph is cleared and replaced with entity B's, not merged.
    await waitFor(() =>
      expect(parsedNodeFqns()).toContain('svc.db.s.downstreamB')
    );

    expect(parsedNodeFqns()).not.toContain('svc.db.s.downstreamA');

    // The canvas re-draws B's nodes rather than A's stale set.
    await waitFor(() =>
      expect(drawnNodeIds()).toContain('svc.db.s.downstreamB')
    );

    expect(drawnNodeIds()).not.toContain('svc.db.s.downstreamA');

    await waitFor(() => expect(useLineageStore.getState().loading).toBe(false));

    expect(useLineageStore.getState().init).toBe(true);
  });

  it('does not refetch when rerendered with the same entity identity (dedup preserved)', async () => {
    (getLineageDataByFQN as jest.Mock).mockResolvedValue(emptyResponse);

    const { rerender } = render(renderLineage(entityA, 'svc.db.s.entityA'));

    await waitFor(() => expect(getLineageDataByFQN).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useLineageStore.getState().loading).toBe(false));

    // Rerender the same mounted component with identical props: no new fetch.
    rerender(renderLineage(entityA, 'svc.db.s.entityA'));
    await waitFor(() => expect(useLineageStore.getState().loading).toBe(false));

    expect(getLineageDataByFQN).toHaveBeenCalledTimes(1);
  });
});
