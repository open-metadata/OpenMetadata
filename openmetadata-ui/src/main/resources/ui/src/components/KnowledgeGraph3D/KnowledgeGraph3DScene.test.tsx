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

import { render } from '@testing-library/react';
import { KnowledgeGraph3DSceneProps } from './KnowledgeGraph3D.interface';
import KnowledgeGraph3DScene from './KnowledgeGraph3DScene';

jest.mock('./nodeRendering', () => ({
  buildNodeObject: jest.fn(),
  disposeTextureCaches: jest.fn(),
  NODE_LABEL_OBJECT_NAME: 'knowledge-graph-node-label',
}));

const mockChargeForce = {
  strength: jest.fn(),
};
const mockLinkForce = {
  distance: jest.fn(),
  strength: jest.fn(),
};
const mockD3Force = jest.fn((name: string) =>
  name === 'charge' ? mockChargeForce : mockLinkForce
);
const mockD3ReheatSimulation = jest.fn();
let mockForceGraphProps: { onEngineTick?: () => void } = {};
const mockGraphMethods = {
  camera: jest.fn(() => ({ position: { x: 0, y: 0, z: 1000 } })),
  cameraPosition: jest.fn(),
  d3Force: mockD3Force,
  d3ReheatSimulation: mockD3ReheatSimulation,
  refresh: jest.fn(),
  zoomToFit: jest.fn(),
};

jest.mock('react-force-graph-3d', () => {
  const React = jest.requireActual('react');
  const MockForceGraph = React.forwardRef(
    (props: Record<string, unknown>, ref: unknown) => {
      mockForceGraphProps = props;
      React.useImperativeHandle(ref, () => mockGraphMethods);

      return React.createElement('canvas', {
        'data-testid': 'force-graph-canvas',
      });
    }
  );

  return {
    __esModule: true,
    default: MockForceGraph,
  };
});

const PROPS: KnowledgeGraph3DSceneProps = {
  data: {
    nodes: [
      {
        id: 'table-1',
        name: 'customers',
        type: 'table',
        levels: ['asset'],
      },
    ],
    links: [],
  },
  focusNodeId: 'table-1',
  level: 'asset',
  gaps: false,
  selectedNodeId: null,
  selectedLinkKey: null,
  onSelectNode: jest.fn(),
  onSelectLink: jest.fn(),
  getNodeTooltip: jest.fn(),
  getLinkTooltip: jest.fn(),
  isFullscreen: false,
};

describe('KnowledgeGraph3DScene', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockForceGraphProps = {};
    mockLinkForce.distance.mockReturnValue(mockLinkForce);
    mockLinkForce.strength.mockReturnValue(mockLinkForce);
  });

  it('does not reheat the simulation before the force graph initializes its layout', () => {
    render(<KnowledgeGraph3DScene {...PROPS} />);

    expect(mockD3Force).toHaveBeenCalledWith('charge');
    expect(mockD3Force).toHaveBeenCalledWith('link');
    expect(mockD3ReheatSimulation).not.toHaveBeenCalled();
  });

  it('reheats the initialized simulation when graph data changes', () => {
    const { rerender } = render(<KnowledgeGraph3DScene {...PROPS} />);

    mockForceGraphProps.onEngineTick?.();
    rerender(
      <KnowledgeGraph3DScene
        {...PROPS}
        data={{
          nodes: [
            ...PROPS.data.nodes,
            {
              id: 'table-2',
              name: 'orders',
              type: 'table',
              levels: ['asset'],
            },
          ],
          links: [],
        }}
      />
    );

    expect(mockD3ReheatSimulation).toHaveBeenCalledTimes(1);
  });
});
