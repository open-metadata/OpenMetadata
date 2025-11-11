/*
 *  Copyright 2023 Collate.
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

import { fireEvent, render, screen } from '@testing-library/react';
import ToggleExpandButton from './ToggleExpandButton';
import { ToggleExpandButtonProps } from './ToggleExpandButton.interface';

const mockToggleExpandAll = jest.fn();

const mockProps: ToggleExpandButtonProps = {
  expandedRowKeys: [],
  allRowKeys: ['key1', 'key2', 'key3'],
  toggleExpandAll: mockToggleExpandAll,
};

describe('ToggleExpandButton component', () => {
  it('ToggleExpandButton should render expand all text and icon when all rows are not expanded', () => {
    render(<ToggleExpandButton {...mockProps} />);

    expect(screen.getByTestId('toggle-expand-button')).toBeInTheDocument();
    expect(screen.getByTestId('expand-icon')).toBeInTheDocument();
    expect(screen.getByText('label.expand-all')).toBeInTheDocument();
  });

  it('ToggleExpandButton should render collapse all text and icon when all rows are expanded', () => {
    render(
      <ToggleExpandButton
        {...mockProps}
        expandedRowKeys={mockProps.allRowKeys}
      />
    );

    expect(screen.getByTestId('toggle-expand-button')).toBeInTheDocument();
    expect(screen.getByTestId('collapse-icon')).toBeInTheDocument();
    expect(screen.getByText('label.collapse-all')).toBeInTheDocument();
  });

  it('toggleExpandAll should be called on click of button', async () => {
    render(<ToggleExpandButton {...mockProps} />);

    const toggleButton = screen.getByTestId('toggle-expand-button');

    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(mockToggleExpandAll).toHaveBeenCalledTimes(1);
  });
});
