/*
 *  Copyright 2025 Collate.
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
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { DataContractMode } from '../../../constants/DataContract.constants';
import ContractViewSwitchTab from './ContractViewSwitchTab.component';

const mockHandleModeChange = jest.fn();

const renderSwitch = (mode: DataContractMode) =>
  render(
    <ContractViewSwitchTab
      handleModeChange={mockHandleModeChange}
      mode={mode}
    />
  );

describe('ContractViewSwitchTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a named option for each mode', () => {
    renderSwitch(DataContractMode.UI);

    expect(
      screen.getByRole('radio', { name: 'label.editor' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'label.code' })
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('contract-view-switch-tab-ui')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('contract-view-switch-tab-yaml')
    ).toBeInTheDocument();
  });

  it('marks the current mode as selected', () => {
    const { rerender } = renderSwitch(DataContractMode.UI);

    expect(screen.getByRole('radio', { name: 'label.editor' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'label.code' })).not.toBeChecked();

    rerender(
      <ContractViewSwitchTab
        handleModeChange={mockHandleModeChange}
        mode={DataContractMode.YAML}
      />
    );

    expect(screen.getByRole('radio', { name: 'label.code' })).toBeChecked();
  });

  // YAML is enum value 0, so a truthiness check would drop this selection.
  it('reports YAML when the code option is pressed', () => {
    renderSwitch(DataContractMode.UI);

    fireEvent.click(screen.getByRole('radio', { name: 'label.code' }));

    expect(mockHandleModeChange).toHaveBeenCalledWith(DataContractMode.YAML);
  });

  it('reports UI when the editor option is pressed', () => {
    renderSwitch(DataContractMode.YAML);

    fireEvent.click(screen.getByRole('radio', { name: 'label.editor' }));

    expect(mockHandleModeChange).toHaveBeenCalledWith(DataContractMode.UI);
  });

  it('keeps the current mode when its option is pressed again', () => {
    renderSwitch(DataContractMode.UI);

    fireEvent.click(screen.getByRole('radio', { name: 'label.editor' }));

    expect(mockHandleModeChange).not.toHaveBeenCalledWith(
      DataContractMode.YAML
    );
    expect(screen.getByRole('radio', { name: 'label.editor' })).toBeChecked();
  });
});
