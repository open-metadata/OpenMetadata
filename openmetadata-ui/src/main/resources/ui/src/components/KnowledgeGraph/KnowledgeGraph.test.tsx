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

import { Graph } from '@antv/g6';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toPng } from 'html-to-image';
import React, { act } from 'react';
import { useLocation } from 'react-router-dom';
import { EntityReference } from '../../generated/entity/type';
import { downloadEntityGraph, getEntityGraphData } from '../../rest/rdfAPI';
import {
  applyInitialFocus,
  assignRadialPorts,
  computeELKPositions,
  computeELKRadialPositions,
  setupGraphEventHandlers,
  transformToG6Format,
} from '../../utils/KnowledgeGraph.utils';
import KnowledgeGraph from './KnowledgeGraph';
import {
  GraphData,
  GraphNode,
  KnowledgeGraphProps,
} from './KnowledgeGraph.interface';

jest.mock('@antv/g6', () => ({
  Graph: jest.fn().mockImplementation(() => ({
    render: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn(),
    fitView: jest.fn().mockResolvedValue(undefined),
    zoomTo: jest.fn(),
    getZoom: jest.fn().mockReturnValue(1),
    resize: jest.fn(),
    on: jest.fn(),
    setData: jest.fn(),
  })),
  ExtensionCategory: { NODE: 'node' },
  register: jest.fn(),
}));

jest.mock('@antv/g6-extension-react', () => ({ ReactNode: jest.fn() }));

jest.mock('../../rest/rdfAPI', () => ({
  getEntityGraphData: jest.fn(),
  downloadEntityGraph: jest.fn(),
}));

jest.mock('../../utils/KnowledgeGraph.utils', () => ({
  transformToG6Format: jest.fn(),
  setupGraphEventHandlers: jest.fn(),
  applyInitialFocus: jest.fn().mockResolvedValue(undefined),
  computeELKPositions: jest.fn().mockResolvedValue(new Map()),
  computeELKRadialPositions: jest.fn().mockResolvedValue(new Map()),
  assignRadialPorts: jest.fn().mockImplementation((nodes: unknown[]) => nodes),
  MAX_NODE_WIDTH: 280,
  NODE_HEIGHT: 36,
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn(() => ({
    search: '',
    pathname: '/',
    hash: '',
    state: null,
  })),
  useNavigate: jest.fn(() => mockNavigate),
}));

jest.mock('../../context/UntitledUIThemeProvider/theme-provider', () => ({
  useTheme: jest.fn(() => ({ brandColors: { primaryColor: '#1677ff' } })),
}));

jest.mock('../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: jest.fn(() => ({
    preferences: { isSidebarCollapsed: false },
  })),
}));

jest.mock('html-to-image', () => ({ toPng: jest.fn() }));

jest.mock('../../utils/EntityBreadcrumbUtils', () => ({
  getEntityBreadcrumbs: jest.fn(() => [
    { name: 'MyTable', url: '/table/MyTable', activeTitle: false },
  ]),
}));

jest.mock('../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => ({
  __esModule: true,
  default: jest.fn(({ children }: { children?: React.ReactNode }) => (
    <div data-testid="error-place-holder">{children}</div>
  )),
}));

jest.mock('../common/Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="loader" />),
}));

jest.mock('../common/TitleBreadcrumb/TitleBreadcrumb.component', () => ({
  __esModule: true,
  default: jest.fn(
    ({
      titleLinks,
    }: {
      titleLinks: Array<{ name: string; url: string; activeTitle: boolean }>;
    }) => (
      <nav data-testid="title-breadcrumb">
        {titleLinks.map((l) => (
          <span key={l.name}>{l.name}</span>
        ))}
      </nav>
    )
  ),
}));

jest.mock('../Explore/EntitySummaryPanel/EntitySummaryPanel.component', () => ({
  __esModule: true,
  default: jest.fn(({ handleClosePanel }: { handleClosePanel: () => void }) => (
    <div data-testid="entity-summary-panel">
      <button data-testid="close-panel" onClick={handleClosePanel}>
        Close
      </button>
    </div>
  )),
}));

jest.mock('../OntologyExplorer/ExportGraphPanel', () => ({
  __esModule: true,
  default: jest.fn(
    ({
      onExportPng,
      onExportJsonLd,
      onExportTurtle,
    }: {
      onExportPng: () => void;
      onExportJsonLd: () => void;
      onExportTurtle: () => void;
    }) => (
      <div data-testid="export-graph-panel">
        <button data-testid="export-png" onClick={onExportPng}>
          PNG
        </button>
        <button data-testid="export-jsonld" onClick={onExportJsonLd}>
          JSONLD
        </button>
        <button data-testid="export-turtle" onClick={onExportTurtle}>
          Turtle
        </button>
      </div>
    )
  ),
  ExportFormat: {
    PNG: 'png',
    JSONLD: 'jsonld',
    TURTLE: 'turtle',
  },
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const R = require('react');

  const Box = ({
    children,
    ...p
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    R.createElement('div', p, children);

  const Typography = ({
    children,
    'data-testid': testId,
    ...p
  }: React.PropsWithChildren<{ 'data-testid'?: string }>) =>
    R.createElement('span', { 'data-testid': testId, ...p }, children);

  const Button = ({
    children,
    onPress,
    'data-testid': testId,
    ...p
  }: React.PropsWithChildren<{
    onPress?: () => void;
    'data-testid'?: string;
  }>) =>
    R.createElement(
      'button',
      { 'data-testid': testId, onClick: onPress, ...p },
      children
    );

  const Divider = () => R.createElement('hr', null);

  const CardContent = ({
    children,
    ...p
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    R.createElement('div', { 'data-testid': 'card-content', ...p }, children);

  const CardHeader = ({
    extra,
  }: {
    extra?: React.ReactNode;
    [key: string]: unknown;
  }) => R.createElement('div', { 'data-testid': 'card-header' }, extra);

  const Card = Object.assign(
    ({
      children,
      'data-testid': testId,
      ...p
    }: React.PropsWithChildren<{ 'data-testid'?: string }>) =>
      R.createElement('div', { 'data-testid': testId, ...p }, children),
    { Header: CardHeader, Content: CardContent }
  );

  const DropdownRoot = ({
    children,
    isOpen,
    onOpenChange,
  }: {
    children: React.ReactNode;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) =>
    R.createElement(
      'div',
      {
        'data-open': isOpen,
        'data-testid': 'dropdown-root',
        onClick: () => onOpenChange?.(!isOpen),
      },
      children
    );

  const DropdownPopover = ({ children }: { children: React.ReactNode }) =>
    R.createElement('div', { 'data-testid': 'dropdown-popover' }, children);

  const DropdownMenu = ({
    children,
    items,
    onSelectionChange,
  }: {
    children: (item: { id: string; label: string }) => React.ReactNode;
    items?: Array<{ id: string; label: string }>;
    onSelectionChange?: (keys: Set<string>) => void;
  }) =>
    R.createElement(
      'ul',
      {
        'data-testid': 'dropdown-menu',
        onClick: (e: React.MouseEvent<HTMLUListElement>) => {
          const id = (e.target as HTMLElement).dataset.id;
          if (id && onSelectionChange) {
            onSelectionChange(new Set([id]));
          }
        },
      },
      items?.map((item) =>
        R.createElement(
          'li',
          {
            key: item.id,
            'data-id': item.id,
            'data-testid': `menu-item-${item.id}`,
          },
          typeof children === 'function' ? children(item) : item.label
        )
      )
    );

  const DropdownItem = ({
    id,
    label,
  }: {
    id: string;
    label: string;
    showCheckbox?: boolean;
  }) => R.createElement('span', { 'data-item-id': id }, label);

  const Dropdown = {
    Root: DropdownRoot,
    Popover: DropdownPopover,
    Menu: DropdownMenu,
    Item: DropdownItem,
  };

  const SlideoutMenu = ({
    children,
    isOpen,
    onOpenChange,
  }: {
    children:
      | React.ReactNode
      | (({ close }: { close: () => void }) => React.ReactNode);
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    if (!isOpen) {
      return null;
    }

    const close = () => onOpenChange?.(false);

    return R.createElement(
      'div',
      { 'data-testid': 'slideout-menu' },
      R.createElement(
        'button',
        {
          'data-testid': 'slideout-dismiss',
          onClick: () => onOpenChange?.(false),
        },
        'Dismiss'
      ),
      typeof children === 'function' ? children({ close }) : children
    );
  };

  const Slider = ({
    value,
    onChange,
    'data-testid': testId,
  }: {
    value?: number[];
    onChange?: (val: number | number[]) => void;
    'data-testid'?: string;
  }) =>
    R.createElement('input', {
      type: 'range',
      'data-testid': testId,
      value: value?.[0] ?? 1,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange?.(Number(e.target.value)),
    });

  const TabsList = ({
    children,
    items,
  }: {
    children: (tab: { id: string; label: string }) => React.ReactNode;
    items?: Array<{ id: string; label: string }>;
  }) =>
    R.createElement(
      'div',
      { 'data-testid': 'tabs-list' },
      items?.map((tab) =>
        R.createElement(
          'span',
          { key: tab.id, 'data-tab-key': tab.id },
          typeof children === 'function' ? children(tab) : tab.label
        )
      )
    );

  const TabsItem = ({ id, label }: { id: string; label: string }) =>
    R.createElement('button', { 'data-tab-key': id }, label);

  const Tabs = Object.assign(
    ({
      children,
      selectedKey,
      onSelectionChange,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      selectedKey?: string;
      onSelectionChange?: (key: string) => void;
      'data-testid'?: string;
    }) =>
      R.createElement(
        'div',
        {
          'data-testid': testId,
          'data-selected': selectedKey,
          onClick: (e: React.MouseEvent<HTMLDivElement>) => {
            const key = (e.target as HTMLElement).dataset.tabKey;
            if (key) {
              onSelectionChange?.(key);
            }
          },
        },
        children
      ),
    { List: TabsList, Item: TabsItem }
  );

  const Tooltip = ({ children }: { children: React.ReactNode }) =>
    R.createElement('div', null, children);

  const TooltipTrigger = Button;

  return {
    Box,
    Typography,
    Button,
    Card,
    Divider,
    Dropdown,
    SlideoutMenu,
    Slider,
    Tabs,
    Tooltip,
    TooltipTrigger,
  };
});

const MockGraph = Graph as jest.MockedClass<typeof Graph>;
const mockNavigate = jest.fn();

function makeEntity(overrides: Partial<EntityReference> = {}): EntityReference {
  return {
    id: 'entity-123',
    name: 'my_table',
    fullyQualifiedName: 'db.schema.my_table',
    type: 'table',
    ...overrides,
  } as EntityReference;
}

function makeGraphData(overrides: Partial<GraphData> = {}): GraphData {
  return {
    nodes: [
      {
        id: 'entity-123',
        label: 'MyTable',
        type: 'table',
        fullyQualifiedName: 'db.schema.MyTable',
      },
      {
        id: 'node-b',
        label: 'OtherTable',
        type: 'table',
        fullyQualifiedName: 'db.schema.OtherTable',
      },
    ],
    edges: [{ from: 'entity-123', to: 'node-b', label: 'hasColumn' }],
    filterOptions: {
      entityTypes: [{ id: 'table', label: 'Table', count: 2 }],
      relationshipTypes: [{ id: 'hasColumn', label: 'hasColumn', count: 1 }],
    },
    ...overrides,
  } as GraphData;
}

function makeG6Data(overrides: Record<string, unknown> = {}) {
  return {
    nodes: [
      {
        id: 'entity-123',
        style: {},
        data: { label: 'MyTable', type: 'table' },
      },
    ],
    edges: [],
    ...overrides,
  };
}

function renderKG(props: Partial<KnowledgeGraphProps> = {}) {
  return render(
    <KnowledgeGraph
      depth={1}
      entity={makeEntity()}
      entityType="table"
      {...props}
    />
  );
}

async function waitForGraphInit() {
  await waitFor(() => expect(MockGraph).toHaveBeenCalled());
}

function getGraphInstance() {
  return MockGraph.mock.results[0]?.value as {
    render: jest.Mock;
    destroy: jest.Mock;
    fitView: jest.Mock;
    zoomTo: jest.Mock;
    getZoom: jest.Mock;
    resize: jest.Mock;
    on: jest.Mock;
    setData: jest.Mock;
  };
}

async function renderWithRadial() {
  const result = renderKG();
  await waitFor(() =>
    expect(screen.getByTestId('layout-tabs')).toBeInTheDocument()
  );
  const tabsEl = screen.getByTestId('layout-tabs');
  const radialBtn = tabsEl.querySelector('[data-tab-key="radial"]');
  if (radialBtn) {
    fireEvent.click(radialBtn);
  }

  return result;
}

describe('KnowledgeGraph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getEntityGraphData as jest.Mock).mockResolvedValue(makeGraphData());
    (transformToG6Format as jest.Mock).mockReturnValue(makeG6Data());
    (computeELKPositions as jest.Mock).mockResolvedValue(
      new Map([
        ['entity-123', { x: 100, y: 50 }],
        ['node-b', { x: 300, y: 50 }],
      ])
    );
    (computeELKRadialPositions as jest.Mock).mockResolvedValue(
      new Map([
        ['entity-123', { x: 200, y: 200 }],
        ['node-b', { x: 350, y: 100 }],
      ])
    );
    (applyInitialFocus as jest.Mock).mockResolvedValue(undefined);
    (assignRadialPorts as jest.Mock).mockImplementation(
      (nodes: unknown[]) => nodes
    );
    (useLocation as jest.Mock).mockReturnValue({
      search: '',
      pathname: '/',
      hash: '',
      state: null,
    });
  });

  describe('Initial render and data fetching', () => {
    it('shows a loading indicator on initial mount', () => {
      (getEntityGraphData as jest.Mock).mockReturnValue(new Promise(() => {}));
      renderKG();

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('calls getEntityGraphData with entityId, entityType, and depth', async () => {
      renderKG();
      await waitFor(() =>
        expect(getEntityGraphData).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: 'entity-123',
            entityType: 'table',
            depth: 1,
          })
        )
      );
    });

    it('renders knowledge-graph-container after successful data fetch', async () => {
      renderKG();
      await waitFor(() =>
        expect(
          screen.getByTestId('knowledge-graph-container')
        ).toBeInTheDocument()
      );
    });

    it('shows ErrorPlaceHolder when API returns empty nodes array', async () => {
      (getEntityGraphData as jest.Mock).mockResolvedValue(
        makeGraphData({ nodes: [], edges: [] })
      );
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('error-place-holder')).toBeInTheDocument()
      );
    });

    it('shows ErrorPlaceHolder when API returns graphData with no nodes', async () => {
      (getEntityGraphData as jest.Mock).mockResolvedValue(
        makeGraphData({ nodes: [], edges: [] })
      );
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('error-place-holder')).toBeInTheDocument()
      );
    });

    it('does not call getEntityGraphData when entity is undefined', async () => {
      render(<KnowledgeGraph entityType="table" />);
      await act(async () => {});

      expect(getEntityGraphData).not.toHaveBeenCalled();
    });

    it('shows no-entity message when entity prop is omitted and graphData is null', async () => {
      render(<KnowledgeGraph entityType="table" />);
      await waitFor(() =>
        expect(
          screen.getByText(/label\.no-entity-selected/i)
        ).toBeInTheDocument()
      );
    });
  });

  describe('Graph initialization', () => {
    it('instantiates Graph with the container div after data loads', async () => {
      renderKG();
      await waitForGraphInit();

      const callArgs = MockGraph.mock.calls[0][0];

      expect(callArgs.container).toBeInstanceOf(HTMLElement);
      expect(callArgs.animation).toBe(false);
    });

    it('calls transformToG6Format with the received graphData', async () => {
      renderKG();
      await waitFor(() =>
        expect(transformToG6Format).toHaveBeenCalledWith(
          expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({ id: 'entity-123' }),
            ]),
          })
        )
      );
    });

    it('calls computeELKPositions for dagre layout by default', async () => {
      renderKG();
      await waitFor(() => expect(computeELKPositions).toHaveBeenCalled());
    });

    it('calls setupGraphEventHandlers during graph setup', async () => {
      renderKG();
      await waitFor(() => expect(setupGraphEventHandlers).toHaveBeenCalled());
    });

    it('calls graph.render() after construction', async () => {
      renderKG();
      await waitForGraphInit();
      const gi = getGraphInstance();

      await waitFor(() => expect(gi.render).toHaveBeenCalled());
    });

    it('calls applyInitialFocus after render resolves', async () => {
      renderKG();
      await waitFor(() => expect(applyInitialFocus).toHaveBeenCalled());
    });

    it('hides loader after graph is ready', async () => {
      renderKG();
      await waitFor(() =>
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument()
      );
    });

    it('calls graph.destroy() on unmount', async () => {
      const { unmount } = renderKG();
      await waitForGraphInit();
      const gi = getGraphInstance();
      unmount();

      expect(gi.destroy).toHaveBeenCalled();
    });
  });

  describe('Radial layout path', () => {
    it('calls computeELKRadialPositions when layout is radial', async () => {
      await renderWithRadial();
      await waitFor(() => expect(computeELKRadialPositions).toHaveBeenCalled());
    });

    it('calls assignRadialPorts when layout is radial', async () => {
      await renderWithRadial();
      await waitFor(() => expect(assignRadialPorts).toHaveBeenCalled());
    });

    it('does NOT call computeELKPositions when layout is radial', async () => {
      renderKG();
      await waitFor(() => expect(computeELKPositions).toHaveBeenCalled());
      (computeELKPositions as jest.Mock).mockClear();

      const tabsEl = screen.getByTestId('layout-tabs');
      const radialBtn = tabsEl.querySelector('[data-tab-key="radial"]');
      if (radialBtn) {
        fireEvent.click(radialBtn);
      }

      await waitFor(() => expect(computeELKRadialPositions).toHaveBeenCalled());

      expect(computeELKPositions).not.toHaveBeenCalled();
    });
  });

  describe('Zoom controls', () => {
    it('handleZoomIn calls graph.zoomTo with increased zoom factor', async () => {
      renderKG();
      await waitForGraphInit();
      const gi = getGraphInstance();

      fireEvent.click(screen.getByTestId('zoom-in'));

      expect(gi.zoomTo).toHaveBeenCalledWith(
        1.2,
        expect.objectContaining({ duration: 300 })
      );
    });

    it('handleZoomOut calls graph.zoomTo with decreased zoom factor', async () => {
      renderKG();
      await waitForGraphInit();
      const gi = getGraphInstance();

      fireEvent.click(screen.getByTestId('zoom-out'));

      expect(gi.zoomTo).toHaveBeenCalledWith(
        0.8,
        expect.objectContaining({ duration: 300 })
      );
    });

    it('handleFit calls graph.fitView then graph.zoomTo', async () => {
      renderKG();
      await waitForGraphInit();
      const gi = getGraphInstance();

      fireEvent.click(screen.getByTestId('fit-screen'));

      await waitFor(() => {
        expect(gi.fitView).toHaveBeenCalled();
      });
    });
  });

  describe('Fullscreen toggle', () => {
    it('handleFullscreen navigates with fullscreen=true when not in fullscreen', async () => {
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('full-screen')).toBeInTheDocument()
      );
      fireEvent.click(screen.getByTestId('full-screen'));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          search: expect.stringContaining('fullscreen'),
        })
      );
    });

    it('handleFullscreen navigates with empty search when already in fullscreen', async () => {
      (useLocation as jest.Mock).mockReturnValue({
        search: '?fullscreen=true',
        pathname: '/',
        hash: '',
        state: null,
      });
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('exit-full-screen')).toBeInTheDocument()
      );
      fireEvent.click(screen.getByTestId('exit-full-screen'));

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ search: '' })
      );
    });

    it('shows TitleBreadcrumb when isFullscreen=true and entity has fullyQualifiedName', async () => {
      (useLocation as jest.Mock).mockReturnValue({
        search: '?fullscreen=true',
        pathname: '/',
        hash: '',
        state: null,
      });
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('title-breadcrumb')).toBeInTheDocument()
      );
    });

    it('does NOT show TitleBreadcrumb when not in fullscreen', async () => {
      renderKG();
      await waitFor(() =>
        expect(
          screen.getByTestId('knowledge-graph-container')
        ).toBeInTheDocument()
      );

      expect(screen.queryByTestId('title-breadcrumb')).not.toBeInTheDocument();
    });
  });

  describe('Depth change', () => {
    it('handleDepthChange updates selectedDepth and triggers re-fetch', async () => {
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('depth-slider')).toBeInTheDocument()
      );

      (getEntityGraphData as jest.Mock).mockClear();
      fireEvent.change(screen.getByTestId('depth-slider'), {
        target: { value: '3' },
      });

      await waitFor(() =>
        expect(getEntityGraphData).toHaveBeenCalledWith(
          expect.objectContaining({ depth: 3 })
        )
      );
    });
  });

  describe('Layout change', () => {
    it('handleLayoutChange updates layout from dagre to radial', async () => {
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('layout-tabs')).toBeInTheDocument()
      );

      expect(screen.getByTestId('layout-tabs')).toHaveAttribute(
        'data-selected',
        'dagre'
      );

      const radialBtn = screen
        .getByTestId('layout-tabs')
        .querySelector('[data-tab-key="radial"]');
      if (radialBtn) {
        fireEvent.click(radialBtn);
      }

      await waitFor(() =>
        expect(screen.getByTestId('layout-tabs')).toHaveAttribute(
          'data-selected',
          'radial'
        )
      );
    });
  });

  describe('Entity type filter', () => {
    it('handleEntityDropdownChange toggles entityDropdownOpen', async () => {
      renderKG();
      await waitFor(() =>
        expect(
          screen.getByTestId('knowledge-graph-container')
        ).toBeInTheDocument()
      );

      const dropdownRoots = screen.getAllByTestId('dropdown-root');

      expect(dropdownRoots[0]).toHaveAttribute('data-open', 'false');

      fireEvent.click(dropdownRoots[0]);

      expect(dropdownRoots[0]).toHaveAttribute('data-open', 'true');
    });

    it('handleEntityFilterChange updates entity filter text', async () => {
      renderKG();
      await waitFor(() =>
        expect(
          screen.getByTestId('knowledge-graph-container')
        ).toBeInTheDocument()
      );

      const inputs = screen.getAllByPlaceholderText('label.search');
      fireEvent.change(inputs[0], { target: { value: 'tab' } });

      expect(inputs[0]).toHaveValue('tab');
    });

    it('entity filter input stops keydown propagation', async () => {
      renderKG();
      await waitFor(() =>
        expect(
          screen.getByTestId('knowledge-graph-container')
        ).toBeInTheDocument()
      );

      const inputs = screen.getAllByPlaceholderText('label.search');
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
      });
      const spy = jest.spyOn(event, 'stopPropagation');
      inputs[0].dispatchEvent(event);

      expect(spy).toHaveBeenCalled();
    });

    it('handleEntityTypeSelectionChange updates selectedEntityTypes', async () => {
      renderKG();
      await waitFor(() => expect(getEntityGraphData).toHaveBeenCalledTimes(1));

      (getEntityGraphData as jest.Mock).mockClear();

      const menus = screen.getAllByTestId('dropdown-menu');
      const li = menus[0]?.querySelector('[data-id="table"]');
      if (li) {
        fireEvent.click(li);
      }

      await waitFor(() =>
        expect(getEntityGraphData).toHaveBeenCalledWith(
          expect.objectContaining({ entityTypes: ['table'] })
        )
      );
    });
  });

  describe('Relationship type filter', () => {
    it('handleRelationshipDropdownChange toggles relationshipDropdownOpen', async () => {
      renderKG();
      await waitFor(() =>
        expect(
          screen.getByTestId('knowledge-graph-container')
        ).toBeInTheDocument()
      );

      const dropdownRoots = screen.getAllByTestId('dropdown-root');

      expect(dropdownRoots[1]).toHaveAttribute('data-open', 'false');

      fireEvent.click(dropdownRoots[1]);

      expect(dropdownRoots[1]).toHaveAttribute('data-open', 'true');
    });

    it('handleRelationshipFilterChange updates relationship filter text', async () => {
      renderKG();
      await waitFor(() =>
        expect(
          screen.getByTestId('knowledge-graph-container')
        ).toBeInTheDocument()
      );

      const inputs = screen.getAllByPlaceholderText('label.search');
      fireEvent.change(inputs[1], { target: { value: 'has' } });

      expect(inputs[1]).toHaveValue('has');
    });

    it('relationship filter input stops keydown propagation', async () => {
      renderKG();
      await waitFor(() =>
        expect(
          screen.getByTestId('knowledge-graph-container')
        ).toBeInTheDocument()
      );

      const inputs = screen.getAllByPlaceholderText('label.search');
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
      });
      const spy = jest.spyOn(event, 'stopPropagation');
      inputs[1].dispatchEvent(event);

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Clear all filters', () => {
    it('hasActiveFilters is false in initial default state (no clear button)', async () => {
      renderKG();
      await waitFor(() =>
        expect(
          screen.getByTestId('knowledge-graph-container')
        ).toBeInTheDocument()
      );

      expect(screen.queryByText('label.clear-entity')).not.toBeInTheDocument();
    });

    it('shows clear-all button when hasActiveFilters is true (depth changed)', async () => {
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('depth-slider')).toBeInTheDocument()
      );

      fireEvent.change(screen.getByTestId('depth-slider'), {
        target: { value: '3' },
      });

      await waitFor(() =>
        expect(screen.getByText('label.clear-entity')).toBeInTheDocument()
      );
    });

    it('handleClearAll resets depth to prop value', async () => {
      renderKG({ depth: 1 });
      await waitFor(() =>
        expect(screen.getByTestId('depth-slider')).toBeInTheDocument()
      );

      fireEvent.change(screen.getByTestId('depth-slider'), {
        target: { value: '3' },
      });
      await waitFor(() =>
        expect(screen.getByText('label.clear-entity')).toBeInTheDocument()
      );

      (getEntityGraphData as jest.Mock).mockClear();
      fireEvent.click(screen.getByText('label.clear-entity'));

      await waitFor(() =>
        expect(screen.queryByText('label.clear-entity')).not.toBeInTheDocument()
      );
    });

    it('shows clear button when layout is radial', async () => {
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('layout-tabs')).toBeInTheDocument()
      );

      const radialBtn = screen
        .getByTestId('layout-tabs')
        .querySelector('[data-tab-key="radial"]');
      if (radialBtn) {
        fireEvent.click(radialBtn);
      }

      await waitFor(() =>
        expect(screen.getByText('label.clear-entity')).toBeInTheDocument()
      );
    });
  });

  describe('Export functionality', () => {
    it('handleExportPng calls toPng with the container element', async () => {
      (toPng as jest.Mock).mockResolvedValue('data:image/png;base64,abc123');
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('export-png')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-png'));
      });

      expect(toPng).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ backgroundColor: '#ffffff', pixelRatio: 2 })
      );
    });

    it('handleExportPng creates download anchor when toPng succeeds', async () => {
      (toPng as jest.Mock).mockResolvedValue('data:image/png;base64,abc');
      const createElementSpy = jest.spyOn(document, 'createElement');

      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('export-png')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-png'));
      });

      const anchors = createElementSpy.mock.results.filter(
        (r) => r.value instanceof HTMLAnchorElement
      );

      expect(anchors.length).toBeGreaterThan(0);
      expect(anchors[0].value.download).toBe('knowledge-graph.png');

      createElementSpy.mockRestore();
    });

    it('handleExportJsonLd calls downloadEntityGraph with format jsonld', async () => {
      (downloadEntityGraph as jest.Mock).mockResolvedValue(undefined);
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('export-jsonld')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-jsonld'));
      });

      expect(downloadEntityGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity-123',
          entityType: 'table',
          format: 'jsonld',
        })
      );
    });

    it('handleExportTurtle calls downloadEntityGraph with format turtle', async () => {
      (downloadEntityGraph as jest.Mock).mockResolvedValue(undefined);
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('export-turtle')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-turtle'));
      });

      expect(downloadEntityGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity-123',
          entityType: 'table',
          format: 'turtle',
        })
      );
    });

    it('handleExport omits entityTypes when selectedEntityTypes is empty', async () => {
      (downloadEntityGraph as jest.Mock).mockResolvedValue(undefined);
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('export-turtle')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-turtle'));
      });

      expect(downloadEntityGraph).toHaveBeenCalledWith(
        expect.objectContaining({ entityTypes: undefined })
      );
    });
  });

  describe('Selected node / slideout panel', () => {
    it('SlideoutMenu is not visible initially', async () => {
      renderKG();
      await waitFor(() =>
        expect(
          screen.getByTestId('knowledge-graph-container')
        ).toBeInTheDocument()
      );

      expect(screen.queryByTestId('slideout-menu')).not.toBeInTheDocument();
    });

    it('SlideoutMenu appears when setSelectedNode is called with a node that has FQN', async () => {
      let capturedCtx: { setSelectedNode?: (node: GraphNode | null) => void } =
        {};
      (setupGraphEventHandlers as jest.Mock).mockImplementation((ctx) => {
        capturedCtx = ctx;
      });

      renderKG();
      await waitFor(() => expect(setupGraphEventHandlers).toHaveBeenCalled());

      act(() => {
        capturedCtx.setSelectedNode?.({
          id: 'entity-123',
          label: 'MyTable',
          type: 'table',
          fullyQualifiedName: 'db.schema.MyTable',
        });
      });

      await waitFor(() =>
        expect(screen.getByTestId('slideout-menu')).toBeInTheDocument()
      );

      expect(screen.getByTestId('entity-summary-panel')).toBeInTheDocument();
    });

    it('handleClosePanel hides the slideout when close button is clicked', async () => {
      let capturedCtx: { setSelectedNode?: (node: GraphNode | null) => void } =
        {};
      (setupGraphEventHandlers as jest.Mock).mockImplementation((ctx) => {
        capturedCtx = ctx;
      });

      renderKG();
      await waitFor(() => expect(setupGraphEventHandlers).toHaveBeenCalled());

      act(() => {
        capturedCtx.setSelectedNode?.({
          id: 'entity-123',
          label: 'MyTable',
          type: 'table',
          fullyQualifiedName: 'db.schema.MyTable',
        });
      });

      await waitFor(() =>
        expect(screen.getByTestId('close-panel')).toBeInTheDocument()
      );

      fireEvent.click(screen.getByTestId('close-panel'));

      await waitFor(() =>
        expect(screen.queryByTestId('slideout-menu')).not.toBeInTheDocument()
      );
    });

    it('handleSlideoutClose called with false hides the panel', async () => {
      let capturedCtx: { setSelectedNode?: (node: GraphNode | null) => void } =
        {};
      (setupGraphEventHandlers as jest.Mock).mockImplementation((ctx) => {
        capturedCtx = ctx;
      });

      renderKG();
      await waitFor(() => expect(setupGraphEventHandlers).toHaveBeenCalled());

      act(() => {
        capturedCtx.setSelectedNode?.({
          id: 'entity-123',
          label: 'MyTable',
          type: 'table',
          fullyQualifiedName: 'db.schema.MyTable',
        });
      });

      await waitFor(() =>
        expect(screen.getByTestId('slideout-menu')).toBeInTheDocument()
      );

      fireEvent.click(screen.getByTestId('slideout-dismiss'));

      await waitFor(() =>
        expect(screen.queryByTestId('slideout-menu')).not.toBeInTheDocument()
      );
    });
  });

  describe('Refresh', () => {
    it('handleRefresh re-calls getEntityGraphData', async () => {
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('refresh')).toBeInTheDocument()
      );

      (getEntityGraphData as jest.Mock).mockClear();
      fireEvent.click(screen.getByTestId('refresh'));

      await waitFor(() => expect(getEntityGraphData).toHaveBeenCalledTimes(1));
    });
  });

  describe('Edge rendering', () => {
    it('renders hidden edge divs with data-edge-source and data-edge-target', async () => {
      renderKG();
      await waitFor(() =>
        expect(screen.getByTestId('knowledge-graph-edges')).toBeInTheDocument()
      );

      const edgeContainer = screen.getByTestId('knowledge-graph-edges');

      expect(
        edgeContainer.querySelector('[data-edge-source="entity-123"]')
      ).toBeInTheDocument();
      expect(
        edgeContainer.querySelector('[data-edge-target="node-b"]')
      ).toBeInTheDocument();
    });
  });

  describe('ResizeObserver', () => {
    it('calls graph.resize when ResizeObserver fires on the container', async () => {
      let resizeCallback: ResizeObserverCallback | null = null;

      (window.ResizeObserver as jest.Mock).mockImplementation(
        (cb: ResizeObserverCallback) => {
          resizeCallback = cb;

          return { observe: jest.fn(), disconnect: jest.fn() };
        }
      );

      renderKG();
      await waitForGraphInit();

      const gi = getGraphInstance();

      const canvas = screen.getByTestId('knowledge-graph-canvas');
      Object.defineProperty(canvas, 'offsetWidth', {
        value: 1200,
        configurable: true,
      });
      Object.defineProperty(canvas, 'offsetHeight', {
        value: 800,
        configurable: true,
      });

      act(() => {
        resizeCallback?.([], {} as ResizeObserver);
      });

      expect(gi.resize).toHaveBeenCalledWith(1200, 800);
    });

    it('disconnects ResizeObserver on unmount', async () => {
      const mockDisconnect = jest.fn();

      (window.ResizeObserver as jest.Mock).mockImplementation(
        (_cb: ResizeObserverCallback) => ({
          observe: jest.fn(),
          disconnect: mockDisconnect,
        })
      );

      const { unmount } = renderKG();
      await waitForGraphInit();
      unmount();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('calls graph.destroy() when the component unmounts', async () => {
      const { unmount } = renderKG();
      await waitForGraphInit();
      const gi = getGraphInstance();
      unmount();

      expect(gi.destroy).toHaveBeenCalled();
    });
  });
});
