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
import InlineEdit from './InlineEdit.component';

const mockProps = {
  onCancel: jest.fn(),
  onSave: jest.fn(),
};

describe('InlineEdit component', () => {
  it('Component should render', async () => {
    render(
      <InlineEdit {...mockProps}>
        <input data-testid="children" />
      </InlineEdit>
    );

    expect(
      await screen.findByTestId('inline-edit-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('children')).toBeInTheDocument();
    expect(await screen.findByTestId('inline-cancel-btn')).toBeInTheDocument();
    expect(await screen.findByTestId('inline-save-btn')).toBeInTheDocument();
  });

  it('onCancel function should be called when cancel button is clicked', async () => {
    render(
      <InlineEdit {...mockProps}>
        <input data-testid="children" />
      </InlineEdit>
    );

    const cancelBtn = await screen.findByTestId('inline-cancel-btn');

    expect(cancelBtn).toBeInTheDocument();

    fireEvent.click(cancelBtn);

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('onSave function should be called when Save button is clicked', async () => {
    render(
      <InlineEdit {...mockProps}>
        <input data-testid="children" />
      </InlineEdit>
    );

    const saveBtn = await screen.findByTestId('inline-save-btn');

    expect(saveBtn).toBeInTheDocument();

    fireEvent.click(saveBtn);

    expect(mockProps.onSave).toHaveBeenCalled();
  });

  it('should show the loading when isLoading is true', async () => {
    render(
      <InlineEdit {...mockProps} isLoading>
        <input data-testid="children" />
      </InlineEdit>
    );

    const saveBtn = await screen.findByTestId('inline-save-btn');
    const cancelBtn = await screen.findByTestId('inline-cancel-btn');

    expect(saveBtn).toHaveClass('ant-btn-loading');

    expect(cancelBtn).toBeDisabled();
  });
});
