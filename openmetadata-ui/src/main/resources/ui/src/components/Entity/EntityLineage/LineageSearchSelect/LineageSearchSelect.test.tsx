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
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEBOUNCE_TIMEOUT } from '../../../../constants/Lineage.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { LineageLayer } from '../../../../generated/settings/settings';
import { LineagePlatformView } from '../../../../hooks/lineage/types';
import { useLineageStore } from '../../../../hooks/useLineageStore';
import { useLineageHandlers } from '../../../Lineage/Lineage/LineageHandlersContext';
import LineageSearchSelect from './LineageSearchSelect';

const mockedNodes = [
  {
    data: {
      node: {
        fullyQualifiedName: 'test1',
        name: 'test1',
        entityType: EntityType.TABLE,
        columns: [
          { fullyQualifiedName: 'column1', name: 'column1' },
          { fullyQualifiedName: 'column2', name: 'column2' },
        ],
      },
    },
    position: { x: 100, y: 100 },
  },
  {
    data: {
      node: {
        fullyQualifiedName: 'test2',
        name: 'test2',
      },
    },
    position: { x: 200, y: 200 },
  },
  {
    data: {
      node: {
        fullyQualifiedName: 'test3',
        name: 'test3',
      },
    },
    position: { x: 300, y: 300 },
  },
];

const mockNodeClick = jest.fn();
const mockColumnClick = jest.fn();
// getNodes is what React Flow actually renders from. The nodes reaching this
// component through the provider are seeded at the origin, so the two disagree
// on purpose here -- that is the case the centring has to get right.
const mockReactFlowInstance = {
  setCenter: jest.fn(),
  getNodes: jest.fn(() => [
    {
      id: 'test1',
      position: { x: 640, y: 480 },
      data: { node: { fullyQualifiedName: 'test1' } },
    },
  ]),
};

// Default `useLineageStore` state, merged for both the single-object call
// (`useLineageStore()`) and the `useShallow` multi-field selector call the
// component makes. Individual tests override via `mockStoreImplementation`.
const mockDefaultStoreValue = {
  nodes: mockedNodes,
  reactFlowInstance: mockReactFlowInstance as
    | typeof mockReactFlowInstance
    | undefined,
  activeLayer: [LineageLayer.ColumnLevelLineage],
  platformView: LineagePlatformView.None,
  setPlatformView: jest.fn(),
  isPlatformLineage: false,
  setActiveLayer: jest.fn(),
  zoomValue: 1,
  setSelectedColumn: mockColumnClick,
};

const mockStoreImplementation =
  (overrides: Partial<typeof mockDefaultStoreValue> = {}) =>
  (selector?: (state: typeof mockDefaultStoreValue) => unknown) => {
    const state = { ...mockDefaultStoreValue, ...overrides };

    return selector ? selector(state) : state;
  };

jest.mock('../../../Lineage/Lineage/LineageHandlersContext', () => ({
  useLineageHandlers: jest.fn(),
}));

jest.mock('../../../../hooks/useLineageStore', () => ({
  useLineageStore: jest.fn((selector) =>
    selector ? selector(mockDefaultStoreValue) : mockDefaultStoreValue
  ),
}));

describe('LineageSearchSelect', () => {
  let user: ReturnType<typeof userEvent.setup>;

  const openDropdown = () => user.click(screen.getByRole('combobox'));

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
      delay: null,
    });
    (useLineageHandlers as jest.Mock).mockImplementation(() => ({
      onNodeClick: mockNodeClick,
    }));
    (useLineageStore as unknown as jest.Mock).mockImplementation(
      mockStoreImplementation()
    );
  });

  afterEach(() => jest.useRealTimers());

  it('should render select with options', async () => {
    render(<LineageSearchSelect />);

    expect(screen.getByTestId('lineage-search')).toBeInTheDocument();

    await openDropdown();

    expect(await screen.findByTestId('option-test1')).toBeInTheDocument();
    expect(screen.getByTestId('option-column1')).toBeInTheDocument();
  });

  it('should call onNodeClick and center the node', async () => {
    render(<LineageSearchSelect />);
    await openDropdown();
    await user.click(await screen.findByTestId('option-test1'));

    expect(mockNodeClick).toHaveBeenCalledWith(mockedNodes[0]);
    // The laid-out position from React Flow, not the origin the provider's copy
    // still carries: centring on (0,0) leaves the picked node off-viewport, and
    // onlyRenderVisibleElements then never draws it.
    expect(mockReactFlowInstance.setCenter).toHaveBeenCalledWith(
      640,
      480,
      expect.anything()
    );
  });

  it('should call onColumnClick', async () => {
    render(<LineageSearchSelect />);
    await openDropdown();
    await user.click(await screen.findByTestId('option-column1'));

    expect(mockColumnClick).toHaveBeenCalledWith('column1');
    expect(mockNodeClick).not.toHaveBeenCalled();
  });

  it('should filter options by typed text', async () => {
    render(<LineageSearchSelect />);
    await openDropdown();
    await screen.findByTestId('option-test1');
    await user.type(screen.getByRole('combobox'), 'column2');
    await act(async () => jest.advanceTimersByTime(DEBOUNCE_TIMEOUT));

    expect(screen.getByTestId('option-column2')).toBeInTheDocument();
    expect(screen.queryByTestId('option-test1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('option-column1')).not.toBeInTheDocument();
  });

  it('should show the selection and clear the column when the input is cleared', async () => {
    render(<LineageSearchSelect />);
    await openDropdown();
    await user.click(await screen.findByTestId('option-column1'));

    expect(screen.getByRole('combobox')).toHaveValue('column1');

    await user.clear(screen.getByRole('combobox'));

    expect(mockColumnClick).toHaveBeenLastCalledWith('');
  });

  it('should not render when platform lineage is enabled', () => {
    (useLineageStore as unknown as jest.Mock).mockImplementation(
      mockStoreImplementation({ isPlatformLineage: true })
    );

    const { container } = render(<LineageSearchSelect />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should not render when platform view is not None', () => {
    (useLineageStore as unknown as jest.Mock).mockImplementation(
      mockStoreImplementation({ platformView: LineagePlatformView.Service })
    );

    const { container } = render(<LineageSearchSelect />);

    expect(container).toBeEmptyDOMElement();
  });
});
