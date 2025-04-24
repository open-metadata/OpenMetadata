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
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  },
  { data: { node: { fullyQualifiedName: 'test2' } } },
  { data: { node: { fullyQualifiedName: 'test3' } } },
];

const mockNodeClick = jest.fn();
const mockColumnClick = jest.fn();

jest.mock('../../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn().mockImplementation(() => ({
    activeLayer: [LineageLayer.ColumnLevelLineage],
    nodes: mockedNodes,
    onNodeClick: mockNodeClick,
    onColumnClick: mockColumnClick,
    platformView: LineagePlatformView.None,
  })),
}));

describe('LineageSearchSelect', () => {
  it('should render select with options', async () => {
    const { container } = render(<LineageSearchSelect />);
    const selectElement = screen.getByTestId('lineage-search');

    expect(selectElement).toBeInTheDocument();

    await act(async () => {
      const selectElm = container.querySelector('.ant-select-selector');
      selectElm && userEvent.click(selectElm);
    });

    const option1 = screen.getByTestId('option-test1');

    expect(option1).toBeInTheDocument();
  });

  it('should call onNodeClick', async () => {
    const { container } = render(<LineageSearchSelect />);
    const selectElement = screen.getByTestId('lineage-search');

    expect(selectElement).toBeInTheDocument();

    await act(async () => {
      const selectElm = container.querySelector('.ant-select-selector');
      selectElm && userEvent.click(selectElm);
    });

    const option1 = screen.getByTestId('option-test1');

    expect(option1).toBeInTheDocument();

    fireEvent.click(option1);

    expect(mockNodeClick).toHaveBeenCalled();
  });

  it('should call onColumnClick', async () => {
    const { container } = render(<LineageSearchSelect />);
    const selectElement = screen.getByTestId('lineage-search');

    expect(selectElement).toBeInTheDocument();

    await act(async () => {
      const selectElm = container.querySelector('.ant-select-selector');
      selectElm && userEvent.click(selectElm);
    });

    const column = screen.getByTestId('option-column1');

    expect(column).toBeInTheDocument();

    fireEvent.click(column);

    expect(mockColumnClick).toHaveBeenCalled();
  });
});
