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

import { act, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  ThemeProvider,
  useTheme,
} from '../../context/UntitledUIThemeProvider/theme-provider';
import { KnowledgeGraph3DSceneProps } from './KnowledgeGraph3D.interface';
import KnowledgeGraph3DScene from './KnowledgeGraph3DScene';
import { buildNodeObject, disposeTextureCaches } from './nodeRendering';
import { Graph3DData } from './types';

interface MockForceGraphProps {
  graphData?: Graph3DData;
  height?: number;
  nodeThreeObject?: (node: Graph3DData['nodes'][number]) => unknown;
  width?: number;
  onEngineStop?: () => void;
  onEngineTick?: () => void;
}

const mockChargeStrength = jest.fn();
const mockLinkDistance = jest.fn();
const mockLinkStrength = jest.fn();
const mockChargeForce = { strength: mockChargeStrength };
const mockLinkForce = {
  distance: mockLinkDistance,
  strength: mockLinkStrength,
};
const mockCamera = { position: { x: Number.NaN, y: 0, z: 0 } };
const mockGraphMethods = {
  camera: jest.fn(() => mockCamera),
  cameraPosition: jest.fn(),
  d3Force: jest.fn((name: string) =>
    name === 'charge' ? mockChargeForce : mockLinkForce
  ),
  d3ReheatSimulation: jest.fn(),
  refresh: jest.fn(),
  renderer: jest.fn(),
  zoomToFit: jest.fn(),
};
let mockForceGraphProps: MockForceGraphProps = {};
let mockClientWidth = 800;
let mockClientHeight = 600;
let setSceneTheme: ReturnType<typeof useTheme>['setTheme'] | undefined;

jest.mock('react-force-graph-3d', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockForceGraph = React.forwardRef<unknown, MockForceGraphProps>(
    (props, ref) => {
      React.useImperativeHandle(ref, () => mockGraphMethods);
      mockForceGraphProps = props;

      return React.createElement('div', { 'data-testid': 'force-graph' });
    }
  );

  return { __esModule: true, default: MockForceGraph };
});

jest.mock('./nodeRendering', () => ({
  NODE_LABEL_OBJECT_NAME: 'knowledge-graph-node-label',
  buildNodeObject: jest.fn(),
  disposeTextureCaches: jest.fn(),
}));

const graphData = (): Graph3DData => ({
  nodes: [
    {
      id: 'table-1',
      levels: ['asset'],
      name: 'Customer Accounts',
      type: 'table',
    },
    {
      id: 'term-1',
      levels: ['asset'],
      name: 'Account',
      type: 'concept',
    },
  ],
  links: [
    {
      kind: 'ontology',
      label: 'Mapped to',
      levels: ['asset'],
      source: 'table-1',
      target: 'term-1',
    },
  ],
});

const sceneProps = (data: Graph3DData): KnowledgeGraph3DSceneProps => ({
  data,
  focusNodeId: 'table-1',
  gaps: false,
  getLinkTooltip: (link) => link.label,
  getNodeTooltip: (node) => node.name,
  isFullscreen: false,
  level: 'asset',
  selectedLinkKey: null,
  selectedNodeId: null,
  onSelectLink: jest.fn(),
  onSelectNode: jest.fn(),
});

const ThemeCapture = () => {
  setSceneTheme = useTheme().setTheme;

  return null;
};

const SceneThemeProvider = ({ children }: { children: ReactNode }) => (
  <ThemeProvider defaultTheme="light" storageKey="knowledge-graph-3d-test">
    <ThemeCapture />
    {children}
  </ThemeProvider>
);

const renderScene = (data: Graph3DData) =>
  render(<KnowledgeGraph3DScene {...sceneProps(data)} />, {
    wrapper: SceneThemeProvider,
  });

describe('KnowledgeGraph3DScene', () => {
  const originalClientWidth = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'clientWidth'
  );
  const originalClientHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'clientHeight'
  );

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => mockClientWidth,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => mockClientHeight,
    });
  });

  afterAll(() => {
    Object.defineProperty(
      HTMLElement.prototype,
      'clientWidth',
      originalClientWidth ?? { configurable: true, value: 0 }
    );
    Object.defineProperty(
      HTMLElement.prototype,
      'clientHeight',
      originalClientHeight ?? { configurable: true, value: 0 }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockChargeStrength.mockReturnValue(mockChargeForce);
    mockLinkDistance.mockReturnValue(mockLinkForce);
    mockLinkStrength.mockReturnValue(mockLinkForce);
    mockCamera.position = { x: Number.NaN, y: 0, z: 0 };
    mockForceGraphProps = {};
    mockClientWidth = 800;
    mockClientHeight = 600;
    localStorage.setItem('knowledge-graph-3d-test', 'light');
    setSceneTheme = undefined;
  });

  afterEach(() => {
    localStorage.removeItem('knowledge-graph-3d-test');
    document.documentElement.classList.remove('dark-mode');
    document.documentElement.style.removeProperty('color-scheme');
  });

  it('waits for a measured viewport before mounting the force graph', () => {
    mockClientWidth = 0;
    mockClientHeight = 0;

    renderScene(graphData());

    expect(screen.queryByTestId('force-graph')).not.toBeInTheDocument();
  });

  it('waits for finite layout coordinates before fitting and recovers the camera', () => {
    const data = graphData();
    const { unmount } = renderScene(data);

    expect(screen.getByTestId('force-graph')).toBeInTheDocument();
    expect(mockGraphMethods.d3ReheatSimulation).not.toHaveBeenCalled();
    expect(mockGraphMethods.zoomToFit).not.toHaveBeenCalled();

    data.nodes.forEach((node, index) => {
      node.x = index * 20;
      node.y = index * -10;
      node.z = index * 5;
    });
    act(() => mockForceGraphProps.onEngineTick?.());

    expect(mockChargeStrength).toHaveBeenCalled();
    expect(mockLinkDistance).toHaveBeenCalled();
    expect(mockLinkStrength).toHaveBeenCalled();
    expect(mockGraphMethods.d3ReheatSimulation).not.toHaveBeenCalled();
    expect(mockGraphMethods.cameraPosition).toHaveBeenCalledWith(
      { x: 0, y: 0, z: 160 },
      { x: 0, y: 0, z: 0 },
      0
    );
    expect(mockGraphMethods.zoomToFit).toHaveBeenCalledWith(700, 60);

    unmount();
  });

  it('reheats the initialized simulation when graph data changes', () => {
    const initialData = graphData();
    const { rerender } = renderScene(initialData);

    act(() => mockForceGraphProps.onEngineTick?.());
    const updatedData = graphData();
    updatedData.nodes.push({
      id: 'table-2',
      levels: ['asset'],
      name: 'Orders',
      type: 'table',
    });
    rerender(
      <KnowledgeGraph3DScene {...sceneProps(updatedData)} data={updatedData} />
    );

    expect(mockGraphMethods.d3ReheatSimulation).toHaveBeenCalledTimes(1);
  });

  it('rebuilds theme-sensitive presentation without resetting graph state', () => {
    const data = graphData();
    renderScene(data);
    const initialNodeObject = mockForceGraphProps.nodeThreeObject;
    jest.clearAllMocks();

    act(() => setSceneTheme?.('dark'));

    mockForceGraphProps.nodeThreeObject?.(data.nodes[0]);
    mockForceGraphProps.nodeThreeObject?.(data.nodes[1]);

    expect(disposeTextureCaches).toHaveBeenCalledTimes(1);
    expect(buildNodeObject).toHaveBeenCalledTimes(2);
    expect(mockGraphMethods.refresh).toHaveBeenCalledTimes(1);
    expect(mockForceGraphProps.nodeThreeObject).not.toBe(initialNodeObject);
    expect(mockForceGraphProps.graphData).toBe(data);
    expect(mockGraphMethods.d3ReheatSimulation).not.toHaveBeenCalled();
    expect(mockGraphMethods.cameraPosition).not.toHaveBeenCalled();
    expect(mockGraphMethods.zoomToFit).not.toHaveBeenCalled();
  });
});
