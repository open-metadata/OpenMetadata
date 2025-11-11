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
import { fireEvent, render } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { EntityLineageNodeType } from '../../../enums/entity.enum';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { Column } from '../../../generated/entity/data/table';
import {
  getCollapseHandle,
  getColumnContent,
  getColumnHandle,
  getExpandHandle,
} from './CustomNode.utils';

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Skeleton: {
    Button: jest.fn().mockImplementation(() => <p data-testid="loader" />),
  },
}));

// Add mock before describe blocks
jest.mock('./TestSuiteSummaryWidget/TestSuiteSummaryWidget.component', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ isLoading }) =>
      isLoading ? (
        <p data-testid="loader" />
      ) : (
        <div data-testid="test-suite-summary" />
      )
    ),
}));

describe('Custom Node Utils', () => {
  it('getColumnHandle should return null when nodeType is NOT_CONNECTED', () => {
    const result = getColumnHandle(
      EntityLineageNodeType.NOT_CONNECTED,
      true,
      'test',
      '123'
    );

    expect(result).toBeNull();
  });

  it('getColumnHandle should render handles when nodeType is not NOT_CONNECTED', () => {
    const { getByTestId } = render(
      <ReactFlowProvider>
        <div data-testid="column-handle">
          {getColumnHandle('CONNECTED', true)}
        </div>
      </ReactFlowProvider>
    );

    expect(getByTestId('column-handle')).toBeInTheDocument();
  });

  describe('getExpandHandle', () => {
    it('renders a Button component', () => {
      const { getByRole } = render(
        getExpandHandle(LineageDirection.Downstream, jest.fn())
      );

      expect(getByRole('button')).toBeInTheDocument();
      expect(getByRole('button')).toHaveClass('lineage-expand-icon');
    });

    it('calls the onClickHandler when clicked', () => {
      const onClickHandler = jest.fn();
      const { getByRole } = render(
        getExpandHandle(LineageDirection.Downstream, onClickHandler)
      );

      fireEvent.click(getByRole('button'));

      expect(onClickHandler).toHaveBeenCalled();
    });
  });

  describe('getCollapseHandle', () => {
    it('renders the collapse handle component correctly', () => {
      const onClickHandler = jest.fn();

      const { getByTestId } = render(
        getCollapseHandle(LineageDirection.Downstream, onClickHandler)
      );

      const collapseHandle = getByTestId('downstream-collapse-handle');

      expect(collapseHandle).toBeInTheDocument();
      expect(collapseHandle).toHaveClass('react-flow__handle-right');
    });

    it('calls the onClickHandler when the collapse handle is clicked', () => {
      const onClickHandler = jest.fn();

      const { getByTestId } = render(
        getCollapseHandle(LineageDirection.Upstream, onClickHandler)
      );

      const collapseHandle = getByTestId('upstream-collapse-handle');

      expect(collapseHandle).toHaveClass('react-flow__handle-left');

      fireEvent.click(collapseHandle);

      expect(onClickHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('getColumnContent', () => {
    const mockColumn = {
      fullyQualifiedName: 'test.column',
      dataType: 'string',
      name: 'test column',
      constraint: 'NOT NULL',
    } as unknown as Column;
    const mockOnColumnClick = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should render basic column content', () => {
      const { getByTestId, getByText } = render(
        <ReactFlowProvider>
          {getColumnContent(
            mockColumn,
            false,
            true,
            mockOnColumnClick,
            false,
            false
          )}
        </ReactFlowProvider>
      );

      expect(getByTestId('column-test.column')).toBeInTheDocument();
      expect(getByText('test column')).toBeInTheDocument();
      expect(getByText('NOT NULL')).toBeInTheDocument();
    });

    it('should apply tracing class when isColumnTraced is true', () => {
      const { getByTestId } = render(
        <ReactFlowProvider>
          {getColumnContent(
            mockColumn,
            true,
            true,
            mockOnColumnClick,
            false,
            false
          )}
        </ReactFlowProvider>
      );

      expect(getByTestId('column-test.column')).toHaveClass(
        'custom-node-column-container'
      );
    });

    it('should render loading on TestSuiteSummaryWidget when showDataObservabilitySummary is true with isLoading true', () => {
      const mockSummary = {
        success: 1,
        failed: 0,
        aborted: 0,
        total: 1,
      };

      const { getAllByTestId } = render(
        <ReactFlowProvider>
          {getColumnContent(
            mockColumn,
            false,
            true,
            mockOnColumnClick,
            true,
            true,
            mockSummary
          )}
        </ReactFlowProvider>
      );

      expect(getAllByTestId('loader')).toHaveLength(2);
    });

    it('should render TestSuiteSummaryWidget when showDataObservabilitySummary is true', () => {
      const mockSummary = {
        success: 1,
        failed: 0,
        aborted: 0,
        total: 1,
      };

      const { getByTestId } = render(
        <ReactFlowProvider>
          {getColumnContent(
            mockColumn,
            false,
            true,
            mockOnColumnClick,
            true,
            false,
            mockSummary
          )}
        </ReactFlowProvider>
      );

      expect(getByTestId('test-suite-summary')).toBeInTheDocument();
    });

    it('should call onColumnClick when clicked', () => {
      const { getByTestId } = render(
        <ReactFlowProvider>
          {getColumnContent(
            mockColumn,
            false,
            true,
            mockOnColumnClick,
            false,
            false
          )}
        </ReactFlowProvider>
      );

      fireEvent.click(getByTestId('column-test.column'));

      expect(mockOnColumnClick).toHaveBeenCalledWith('test.column');
    });
  });
});
