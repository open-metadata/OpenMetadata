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
import { fireEvent, render, screen } from '@testing-library/react';
import { DataContractMode } from '../../../constants/DataContract.constants';
import ContractViewSwitchTab from './ContractViewSwitchTab.component';

const mockHandleModeChange = jest.fn();

const renderTab = (mode: DataContractMode) =>
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

  it('renders the UI and YAML options as a single-choice group', () => {
    renderTab(DataContractMode.UI);

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByTestId('contract-view-switch-tab-ui')).toBeVisible();
    expect(screen.getByTestId('contract-view-switch-tab-yaml')).toBeVisible();
  });

  it('marks the current mode as selected and follows prop changes', () => {
    const { rerender } = renderTab(DataContractMode.UI);

    expect(screen.getByTestId('contract-view-switch-tab-ui')).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByTestId('contract-view-switch-tab-yaml')).toHaveAttribute(
      'aria-checked',
      'false'
    );

    rerender(
      <ContractViewSwitchTab
        handleModeChange={mockHandleModeChange}
        mode={DataContractMode.YAML}
      />
    );

    expect(screen.getByTestId('contract-view-switch-tab-yaml')).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('reports the YAML mode when YAML is selected', () => {
    renderTab(DataContractMode.UI);

    fireEvent.click(screen.getByTestId('contract-view-switch-tab-yaml'));

    expect(mockHandleModeChange).toHaveBeenCalledWith(DataContractMode.YAML);
  });

  it('reports the UI mode when UI is selected', () => {
    renderTab(DataContractMode.YAML);

    fireEvent.click(screen.getByTestId('contract-view-switch-tab-ui'));

    expect(mockHandleModeChange).toHaveBeenCalledWith(DataContractMode.UI);
  });

  it('keeps a mode selected when the active option is clicked again', () => {
    renderTab(DataContractMode.UI);

    fireEvent.click(screen.getByTestId('contract-view-switch-tab-ui'));

    expect(mockHandleModeChange).not.toHaveBeenCalledWith(undefined);
    expect(screen.getByTestId('contract-view-switch-tab-ui')).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });
});
