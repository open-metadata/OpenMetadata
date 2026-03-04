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
// RadioChangeEvent imported for type definitions
import { DataContractMode } from '../../../constants/DataContract.constants';
import ContractViewSwitchTab from './ContractViewSwitchTab.component';

const mockHandleModeChange = jest.fn();

describe('ContractViewSwitchTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render radio group with both options', () => {
      render(
        <ContractViewSwitchTab
          handleModeChange={mockHandleModeChange}
          mode={DataContractMode.UI}
        />
      );

      expect(
        screen.getByTestId('contract-view-switch-tab-yaml')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('contract-view-switch-tab-ui')
      ).toBeInTheDocument();
    });

    it('should render with correct CSS classes', () => {
      const { container } = render(
        <ContractViewSwitchTab
          handleModeChange={mockHandleModeChange}
          mode={DataContractMode.UI}
        />
      );

      const radioGroup = container.querySelector('.contract-mode-radio-group');

      expect(radioGroup).toBeInTheDocument();
      expect(radioGroup).toHaveClass('ant-radio-group-outline');
    });

    it('should render icons with correct attributes', () => {
      render(
        <ContractViewSwitchTab
          handleModeChange={mockHandleModeChange}
          mode={DataContractMode.UI}
        />
      );

      const yamlIcon = screen.getByTestId('contract-view-switch-tab-yaml');
      const uiIcon = screen.getByTestId('contract-view-switch-tab-ui');

      expect(yamlIcon).toHaveAttribute('height', '20');
      expect(yamlIcon).toHaveAttribute('width', '20');
      expect(uiIcon).toHaveAttribute('height', '20');
      expect(uiIcon).toHaveAttribute('width', '20');
    });
  });

  describe('Mode Selection', () => {
    it('should call handleModeChange when YAML mode is selected', () => {
      render(
        <ContractViewSwitchTab
          handleModeChange={mockHandleModeChange}
          mode={DataContractMode.UI}
        />
      );

      const yamlOption = screen
        .getByTestId('contract-view-switch-tab-yaml')
        .closest('label');
      yamlOption && fireEvent.click(yamlOption);

      expect(mockHandleModeChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            value: DataContractMode.YAML,
          }),
        })
      );
    });

    it('should call handleModeChange when UI mode is selected', () => {
      render(
        <ContractViewSwitchTab
          handleModeChange={mockHandleModeChange}
          mode={DataContractMode.YAML}
        />
      );

      const uiOption = screen
        .getByTestId('contract-view-switch-tab-ui')
        .closest('label');
      uiOption && fireEvent.click(uiOption);

      expect(mockHandleModeChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            value: DataContractMode.UI,
          }),
        })
      );
    });
  });

  describe('Radio Group Configuration', () => {
    it('should have button option type', () => {
      const { container } = render(
        <ContractViewSwitchTab
          handleModeChange={mockHandleModeChange}
          mode={DataContractMode.UI}
        />
      );

      const radioGroup = container.querySelector('.ant-radio-group-outline');

      expect(radioGroup).toBeInTheDocument();
    });

    it('should have correct number of options', () => {
      const { container } = render(
        <ContractViewSwitchTab
          handleModeChange={mockHandleModeChange}
          mode={DataContractMode.UI}
        />
      );

      const radioButtons = container.querySelectorAll(
        '.ant-radio-button-wrapper'
      );

      expect(radioButtons).toHaveLength(2);
    });
  });

  describe('Event Handling', () => {
    it('should pass the correct event object to handleModeChange', () => {
      render(
        <ContractViewSwitchTab
          handleModeChange={mockHandleModeChange}
          mode={DataContractMode.UI}
        />
      );

      const yamlOption = screen
        .getByTestId('contract-view-switch-tab-yaml')
        .closest('label');
      yamlOption && fireEvent.click(yamlOption);

      expect(mockHandleModeChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            value: DataContractMode.YAML,
          }),
        })
      );
    });
  });

  describe('Props Handling', () => {
    it('should handle different initial modes', () => {
      const { rerender, container } = render(
        <ContractViewSwitchTab
          handleModeChange={mockHandleModeChange}
          mode={DataContractMode.UI}
        />
      );

      let radioButtons = container.querySelectorAll('input[type="radio"]');

      // UI should be checked initially
      expect(radioButtons[0].closest('.ant-radio-button')).toHaveClass(
        'ant-radio-button-checked'
      );
      expect(radioButtons[1].closest('.ant-radio-button')).not.toHaveClass(
        'ant-radio-button-checked'
      );

      rerender(
        <ContractViewSwitchTab
          handleModeChange={mockHandleModeChange}
          mode={DataContractMode.YAML}
        />
      );

      radioButtons = container.querySelectorAll('input[type="radio"]');

      // YAML should be checked after rerender
      expect(radioButtons[0].closest('.ant-radio-button')).not.toHaveClass(
        'ant-radio-button-checked'
      );
      expect(radioButtons[1].closest('.ant-radio-button')).toHaveClass(
        'ant-radio-button-checked'
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper radio button roles', () => {
      render(
        <ContractViewSwitchTab
          handleModeChange={mockHandleModeChange}
          mode={DataContractMode.UI}
        />
      );

      const radioButtons = screen.getAllByRole('radio');

      expect(radioButtons).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should not crash when rendered with valid props', () => {
      expect(() => {
        render(
          <ContractViewSwitchTab
            handleModeChange={mockHandleModeChange}
            mode={DataContractMode.UI}
          />
        );
      }).not.toThrow();
    });
  });
});
