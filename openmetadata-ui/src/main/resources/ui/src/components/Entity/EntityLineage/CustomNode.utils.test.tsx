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
import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import { EntityLineageNodeType } from '../../../enums/entity.enum';
import {
  getCollapseHandle,
  getColumnHandle,
  getExpandHandle,
} from './CustomNode.utils';
import { EdgeTypeEnum } from './EntityLineage.interface';

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
        getExpandHandle(EdgeTypeEnum.DOWN_STREAM, jest.fn())
      );

      expect(getByRole('button')).toBeInTheDocument();
      expect(getByRole('button')).toHaveClass('react-flow__handle-right');
    });

    it('applies the correct class name for non-DOWN_STREAM direction', () => {
      const { getByRole } = render(
        getExpandHandle(EdgeTypeEnum.UP_STREAM, jest.fn())
      );

      expect(getByRole('button')).toHaveClass('react-flow__handle-left');
    });

    it('calls the onClickHandler when clicked', () => {
      const onClickHandler = jest.fn();
      const { getByRole } = render(
        getExpandHandle(EdgeTypeEnum.DOWN_STREAM, onClickHandler)
      );

      fireEvent.click(getByRole('button'));

      expect(onClickHandler).toHaveBeenCalled();
    });
  });

  describe('getCollapseHandle', () => {
    it('renders the collapse handle component correctly', () => {
      const onClickHandler = jest.fn();

      const { getByTestId } = render(
        getCollapseHandle(EdgeTypeEnum.DOWN_STREAM, onClickHandler)
      );

      const collapseHandle = getByTestId('downstream-collapse-handle');

      expect(collapseHandle).toBeInTheDocument();
      expect(collapseHandle).toHaveClass('react-flow__handle-right');
    });

    it('calls the onClickHandler when the collapse handle is clicked', () => {
      const onClickHandler = jest.fn();

      const { getByTestId } = render(
        getCollapseHandle(EdgeTypeEnum.UP_STREAM, onClickHandler)
      );

      const collapseHandle = getByTestId('upstream-collapse-handle');

      expect(collapseHandle).toHaveClass('react-flow__handle-left');

      fireEvent.click(collapseHandle);

      expect(onClickHandler).toHaveBeenCalledTimes(1);
    });
  });
});
