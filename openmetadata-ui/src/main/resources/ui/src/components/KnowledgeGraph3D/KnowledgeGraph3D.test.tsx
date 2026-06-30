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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  Children,
  isValidElement,
  PropsWithChildren,
  ReactElement,
} from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../enums/entity.enum';
import { getEntityGraphData } from '../../rest/rdfAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import KnowledgeGraph3D from './KnowledgeGraph3D';
import { KnowledgeGraph3DSceneProps } from './KnowledgeGraph3D.interface';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../rest/rdfAPI', () => ({
  getEntityGraphData: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: () => ({
    preferences: { isSidebarCollapsed: false },
  }),
}));

// The Untitled-UI Select/Checkbox (react-aria) are impractical to drive in
// jsdom, so this lightweight mock renders native form controls the panels and
// controls can share. Selecting the focal node and a link is driven through
// the Scene mock below.
jest.mock('@openmetadata/ui-core-components', () => {
  const Button = ({
    children,
    ...props
  }: PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  );

  const ButtonGroup = ({ children }: PropsWithChildren) => (
    <div>{children}</div>
  );

  const ButtonGroupItem = ({ children }: PropsWithChildren) => (
    <div>{children}</div>
  );

  const Badge = ({ children }: PropsWithChildren) => <span>{children}</span>;

  const CloseButton = (props: Record<string, unknown>) => (
    <button data-testid="close-button" type="button" {...props} />
  );

  const Checkbox = ({
    isSelected,
    label,
    onChange,
  }: {
    isSelected?: boolean;
    label?: string;
    onChange?: (checked: boolean) => void;
  }) => (
    <label>
      <input
        checked={Boolean(isSelected)}
        type="checkbox"
        onChange={(event) => onChange?.(event.target.checked)}
      />
      {label}
    </label>
  );

  const SelectItem = (_props: { id: string; label: string }) => null;

  const Select = ({
    children,
    selectedKey,
    onSelectionChange,
    'aria-label': ariaLabel,
  }: PropsWithChildren<{
    selectedKey?: string;
    onSelectionChange?: (key: string) => void;
    'aria-label'?: string;
  }>) => {
    const items = Children.toArray(children).filter(
      isValidElement
    ) as ReactElement<{ id: string; label: string }>[];

    return (
      <select
        aria-label={ariaLabel}
        data-testid="kg3d-depth-select"
        value={selectedKey}
        onChange={(event) => onSelectionChange?.(event.target.value)}>
        {items.map((item) => (
          <option key={item.props.id} value={item.props.id}>
            {item.props.label}
          </option>
        ))}
      </select>
    );
  };

  Select.Item = SelectItem;

  return {
    Badge,
    Button,
    ButtonGroup,
    ButtonGroupItem,
    Checkbox,
    CloseButton,
    Select,
  };
});

jest.mock('./KnowledgeGraph3DScene', () => ({
  __esModule: true,
  default: (props: KnowledgeGraph3DSceneProps) => {
    return (
      <div data-testid="kg3d-scene">
        <span data-testid="kg3d-scene-node-count">
          {props.data.nodes.length}
        </span>
        <span data-testid="kg3d-scene-link-count">
          {props.data.links.length}
        </span>
        <button
          data-testid="kg3d-select-node"
          type="button"
          onClick={() => props.onSelectNode(props.data.nodes[0] ?? null)}>
          select-node
        </button>
        <button
          data-testid="kg3d-select-link"
          type="button"
          onClick={() => props.onSelectLink(props.data.links[0] ?? null)}>
          select-link
        </button>
      </div>
    );
  },
}));

jest.mock('../common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

const mockGetEntityGraphData = getEntityGraphData as jest.Mock;
const mockShowErrorToast = showErrorToast as jest.Mock;

const ENTITY = {
  id: 'entity-1',
  type: EntityType.TABLE,
  name: 'CUSTOMERS',
  fullyQualifiedName: 'sample.db.schema.CUSTOMERS',
};

const GRAPH_DATA = {
  nodes: [
    {
      id: 'entity-1',
      label: 'CUSTOMERS',
      type: 'table',
      fullyQualifiedName: 'sample.db.schema.CUSTOMERS',
    },
    { id: 'con-1', label: 'Customer', type: 'glossaryTerm' },
  ],
  edges: [{ from: 'entity-1', to: 'con-1', label: 'mappedTo' }],
};

const renderGraph = (): void => {
  render(
    <MemoryRouter>
      <KnowledgeGraph3D entity={ENTITY} entityType={EntityType.TABLE} />
    </MemoryRouter>
  );
};

describe('KnowledgeGraph3D', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the controls and the 3D scene once data loads', async () => {
    mockGetEntityGraphData.mockResolvedValue(GRAPH_DATA);

    renderGraph();

    expect(await screen.findByTestId('kg3d-scene')).toBeInTheDocument();
    expect(screen.getByText('label.relationship-plural')).toBeInTheDocument();
    expect(screen.getByText('label.reset-view')).toBeInTheDocument();
    expect(
      screen.getByText('label.highlight-coverage-gap-plural')
    ).toBeInTheDocument();
  });

  it('should show the empty placeholder when the graph has no nodes', async () => {
    mockGetEntityGraphData.mockResolvedValue({ nodes: [], edges: [] });

    renderGraph();

    await waitFor(() =>
      expect(
        screen.getByText('message.no-knowledge-graph-data')
      ).toBeInTheDocument()
    );

    expect(screen.queryByTestId('kg3d-scene')).not.toBeInTheDocument();
  });

  it('should render the no-entity placeholder and skip fetching when entity is missing', () => {
    render(
      <MemoryRouter>
        <KnowledgeGraph3D entityType={EntityType.TABLE} />
      </MemoryRouter>
    );

    expect(screen.getByText('label.no-entity-selected')).toBeInTheDocument();
    expect(mockGetEntityGraphData).not.toHaveBeenCalled();
  });

  it('should show an error toast when the fetch fails', async () => {
    mockGetEntityGraphData.mockRejectedValue(new Error('boom'));

    renderGraph();

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });

  it('should refetch with the new depth when the depth control changes', async () => {
    mockGetEntityGraphData.mockResolvedValue(GRAPH_DATA);

    renderGraph();

    await screen.findByTestId('kg3d-scene');

    expect(mockGetEntityGraphData.mock.calls[0][0]).toEqual({
      entityId: 'entity-1',
      entityType: EntityType.TABLE,
      depth: 1,
    });

    fireEvent.change(screen.getByTestId('kg3d-depth-select'), {
      target: { value: '3' },
    });

    await waitFor(() =>
      expect(mockGetEntityGraphData).toHaveBeenCalledTimes(2)
    );

    expect(mockGetEntityGraphData.mock.calls[1][0]).toEqual({
      entityId: 'entity-1',
      entityType: EntityType.TABLE,
      depth: 3,
    });
  });

  it('should add column-derived nodes when "Show columns" is toggled on', async () => {
    mockGetEntityGraphData.mockResolvedValue(GRAPH_DATA);

    render(
      <MemoryRouter>
        <KnowledgeGraph3D
          entity={{
            ...ENTITY,
            columns: [{ name: 'id' }, { name: 'email' }],
          }}
          entityType={EntityType.TABLE}
        />
      </MemoryRouter>
    );

    await screen.findByTestId('kg3d-scene');

    const baseNodeCount = Number(
      screen.getByTestId('kg3d-scene-node-count').textContent
    );
    const baseLinkCount = Number(
      screen.getByTestId('kg3d-scene-link-count').textContent
    );

    fireEvent.click(screen.getByLabelText('label.show-column-plural'));

    await waitFor(() =>
      expect(
        Number(screen.getByTestId('kg3d-scene-node-count').textContent)
      ).toBe(baseNodeCount + 2)
    );

    expect(
      Number(screen.getByTestId('kg3d-scene-link-count').textContent)
    ).toBe(baseLinkCount + 2);
  });

  it('should open the node panel then the edge panel on selection (mutually exclusive)', async () => {
    mockGetEntityGraphData.mockResolvedValue(GRAPH_DATA);

    renderGraph();

    await screen.findByTestId('kg3d-scene');

    fireEvent.click(screen.getByTestId('kg3d-select-node'));

    expect(
      await screen.findByText('message.mapped-to-business-ontology')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('kg3d-select-link'));

    expect(await screen.findByText('label.relationship')).toBeInTheDocument();
    expect(
      screen.queryByText('message.mapped-to-business-ontology')
    ).not.toBeInTheDocument();
  });
});
