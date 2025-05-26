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
import userEvent from '@testing-library/user-event';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { LineagePlatformView } from '../../../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import { LineageLayer } from '../../../../generated/settings/settings';
import LineageSearchSelect from './LineageSearchSelect';

const mockedNodes = [
  {
    data: {
      node: {
        fullyQualifiedName: 'test1',
        entityType: EntityType.TABLE,
        columns: [
          { fullyQualifiedName: 'column1' },
          { fullyQualifiedName: 'column2' },
        ],
      },
    },
    position: { x: 100, y: 100 },
  },
  {
    data: {
      node: {
        fullyQualifiedName: 'test2',
      },
    },
    position: { x: 200, y: 200 },
  },
  {
    data: {
      node: {
        fullyQualifiedName: 'test3',
      },
    },
    position: { x: 300, y: 300 },
  },
];

const mockNodeClick = jest.fn();
const mockColumnClick = jest.fn();
const mockReactFlowInstance = {
  setCenter: jest.fn(),
};

const defaultMockProps = {
  activeLayer: [LineageLayer.ColumnLevelLineage],
  nodes: mockedNodes,
  onNodeClick: mockNodeClick,
  onColumnClick: mockColumnClick,
  platformView: LineagePlatformView.None,
  reactFlowInstance: mockReactFlowInstance,
  zoomValue: 1,
  isEditMode: false,
  isPlatformLineage: false,
};

jest.mock('../../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn(),
}));

describe('LineageSearchSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLineageProvider as jest.Mock).mockImplementation(
      () => defaultMockProps
    );
  });

  it('should render select with options', async () => {
    const { container } = render(<LineageSearchSelect />);
    await waitFor(() => {
      expect(screen.getByTestId('lineage-search')).toBeInTheDocument();
    });

    await act(async () => {
      const selectElm = container.querySelector('.ant-select-selector');
      selectElm && userEvent.click(selectElm);
    });

    const option1 = await screen.findByTestId('option-test1');

    expect(option1).toBeInTheDocument();
  });

  it('should call onNodeClick and center the node', async () => {
    const { container } = render(<LineageSearchSelect />);
    await waitFor(() => {
      expect(screen.getByTestId('lineage-search')).toBeInTheDocument();
    });

    await act(async () => {
      const selectElm = container.querySelector('.ant-select-selector');
      selectElm && userEvent.click(selectElm);
    });

    const option1 = await screen.findByTestId('option-test1');

    expect(option1).toBeInTheDocument();

    fireEvent.click(option1);

    expect(mockNodeClick).toHaveBeenCalled();
    expect(mockReactFlowInstance.setCenter).toHaveBeenCalled();
  });

  it('should call onColumnClick', async () => {
    const { container } = render(<LineageSearchSelect />);
    await waitFor(() => {
      expect(screen.getByTestId('lineage-search')).toBeInTheDocument();
    });

    await act(async () => {
      const selectElm = container.querySelector('.ant-select-selector');
      selectElm && userEvent.click(selectElm);
    });

    const column = await screen.findByTestId('option-column1');

    expect(column).toBeInTheDocument();

    fireEvent.click(column);

    expect(mockColumnClick).toHaveBeenCalled();
  });

  it('should not render when platform lineage is enabled', () => {
    (useLineageProvider as jest.Mock).mockImplementation(() => ({
      ...defaultMockProps,
      isPlatformLineage: true,
    }));

    const { container } = render(<LineageSearchSelect />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should not render when platform view is not None', () => {
    (useLineageProvider as jest.Mock).mockImplementation(() => ({
      ...defaultMockProps,
      platformView: LineagePlatformView.Service,
    }));

    const { container } = render(<LineageSearchSelect />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should handle dropdown visibility change', async () => {
    const { container } = render(<LineageSearchSelect />);
    await waitFor(() => {
      expect(screen.getByTestId('lineage-search')).toBeInTheDocument();
    });

    // Open dropdown
    await act(async () => {
      const selectElm = container.querySelector('.ant-select-selector');
      selectElm && userEvent.click(selectElm);
    });

    // Close dropdown
    await act(async () => {
      const selectElm = container.querySelector('.ant-select-selector');
      selectElm && userEvent.click(selectElm);
    });

    // Verify search value is cleared
    const searchInput = container.querySelector(
      '.ant-select-selection-search-input'
    ) as HTMLInputElement;

    expect(searchInput?.value).toBe('');
  });
});
