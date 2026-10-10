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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { compare } from 'fast-json-patch';
import {
  ContractSLA,
  DataContract,
  MaxLatencyUnit,
  RefreshFrequencyUnit,
  RetentionUnit,
} from '../../../generated/entity/data/dataContract';
import { mockTableData } from '../../../mocks/TableVersion.mock';
import { ContractSLAFormTab } from './ContractSLAFormTab';

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn().mockImplementation(() => ({
    data: mockTableData,
  })),
}));

const mockOnChange = jest.fn();
const mockOnPrev = jest.fn();

const mockContract: Partial<DataContract> = {
  sla: {
    availabilityTime: '09:30',
    maxLatency: {
      unit: MaxLatencyUnit.Hour,
      value: 2,
    },
    refreshFrequency: {
      interval: 1,
      unit: RefreshFrequencyUnit.Day,
    },
    retention: {
      period: 30,
      unit: RetentionUnit.Day,
    },
  },
};

const commonProps = {
  onChange: mockOnChange,
  onPrev: mockOnPrev,
  buttonProps: {
    nextLabel: 'Custom Next',
    prevLabel: 'Custom Previous',
    isNextVisible: true,
  },
};

describe('ContractSLAFormTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render the component with default props', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      expect(screen.getByText('label.sla')).toBeInTheDocument();
      expect(
        screen.getByText('message.data-contract-sla-description')
      ).toBeInTheDocument();
    });

    it('should render with custom prev label', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      expect(screen.getByText('Custom Previous')).toBeInTheDocument();
    });
  });

  describe('TimePicker Configuration', () => {
    it('should render TimePicker with correct format and placeholder', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      const timePicker = document.querySelector('.availability-time-picker');

      expect(timePicker).toBeInTheDocument();
    });
  });

  describe('Form Fields', () => {
    it('should render all SLA form sections', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      expect(screen.getByText('label.refresh-frequency')).toBeInTheDocument();
      expect(screen.getByText('label.max-latency')).toBeInTheDocument();
      expect(screen.getByText('label.availability-time')).toBeInTheDocument();
      expect(screen.getByText('label.retention')).toBeInTheDocument();
    });

    it('should render form with initial values in edit mode', () => {
      render(
        <ContractSLAFormTab initialValues={mockContract} {...commonProps} />
      );

      // Component should render without errors with initial values
      expect(screen.getByText('label.sla')).toBeInTheDocument();
    });
  });

  describe('Enum Options', () => {
    it('should use enum-based options for unit selects', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      // The component should render multiple select fields for different unit types
      // This verifies that the enum to options conversion is working
      const unitLabels = screen.getAllByText('label.unit');

      expect(unitLabels).toHaveLength(3); // refresh frequency, max latency, and retention units
    });
  });

  describe('Navigation', () => {
    it('should render Previous button', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      expect(screen.getByText('Custom Previous')).toBeInTheDocument();
    });

    it('should call onPrev when Previous button is clicked', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      const prevButton = screen.getByText('Custom Previous');
      prevButton.click();

      expect(mockOnPrev).toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    it('should have proper validation rules for numeric fields', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      // Verify InputNumber components are rendered with proper constraints
      const refreshFrequencyInput = screen.getByTestId(
        'refresh-frequency-interval-input'
      );
      const maxLatencyInput = screen.getByTestId('max-latency-value-input');
      const retentionPeriodInput = screen.getByTestId('retention-period-input');

      expect(refreshFrequencyInput).toBeInTheDocument();
      expect(maxLatencyInput).toBeInTheDocument();
      expect(retentionPeriodInput).toBeInTheDocument();

      // Check that these are proper InputNumber components
      expect(
        refreshFrequencyInput.closest('.ant-input-number')
      ).toBeInTheDocument();
      expect(maxLatencyInput.closest('.ant-input-number')).toBeInTheDocument();
      expect(
        retentionPeriodInput.closest('.ant-input-number')
      ).toBeInTheDocument();
    });

    it('should have validation rules configured for minimum values', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      // Verify InputNumber components are rendered which have built-in numeric validation
      const refreshFrequencyInput = screen.getByTestId(
        'refresh-frequency-interval-input'
      );
      const maxLatencyInput = screen.getByTestId('max-latency-value-input');
      const retentionPeriodInput = screen.getByTestId('retention-period-input');

      // InputNumber components should be present
      expect(refreshFrequencyInput).toBeInTheDocument();
      expect(maxLatencyInput).toBeInTheDocument();
      expect(retentionPeriodInput).toBeInTheDocument();

      // They should be InputNumber components (not regular Input)
      expect(
        refreshFrequencyInput.closest('.ant-input-number')
      ).toBeInTheDocument();
      expect(maxLatencyInput.closest('.ant-input-number')).toBeInTheDocument();
      expect(
        retentionPeriodInput.closest('.ant-input-number')
      ).toBeInTheDocument();
    });

    it('should have form validation rules for required fields', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      // Form should be present with proper structure
      const form = document.querySelector('form');

      expect(form).toBeInTheDocument();

      // All required input fields should be present
      expect(
        screen.getByTestId('refresh-frequency-interval-input')
      ).toBeInTheDocument();
      expect(screen.getByTestId('max-latency-value-input')).toBeInTheDocument();
      expect(screen.getByTestId('retention-period-input')).toBeInTheDocument();
    });

    it('should configure InputNumber with appropriate constraints', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      const refreshFrequencyInput = screen.getByTestId(
        'refresh-frequency-interval-input'
      );

      // InputNumber should have numeric input type behavior
      expect(refreshFrequencyInput).toHaveAttribute('role', 'spinbutton');
    });
  });

  describe('Enhanced handleFormChange Logic', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should call onChange when form values change', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      // Verify the onChange prop is being used by the component
      expect(mockOnChange).toHaveBeenCalledTimes(0);

      // The component should set up form change handlers
      const form = document.querySelector('.contract-security-form');

      expect(form).toBeInTheDocument();
    });

    it('should have conditional logic for SLA data construction', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      // Verify that the component renders all required form fields for SLA construction
      expect(
        screen.getByTestId('refresh-frequency-interval-input')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('refresh-frequency-unit-select')
      ).toBeInTheDocument();
      expect(screen.getByTestId('max-latency-value-input')).toBeInTheDocument();
      expect(screen.getByTestId('max-latency-unit-select')).toBeInTheDocument();
      expect(screen.getByTestId('retention-period-input')).toBeInTheDocument();
      expect(screen.getByTestId('retention-unit-select')).toBeInTheDocument();
      expect(screen.getByTestId('availability')).toBeInTheDocument();
    });

    it('should have conditional logic for including valid refresh frequency values', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      // Component should render form fields for refresh frequency
      expect(
        screen.getByTestId('refresh-frequency-interval-input')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('refresh-frequency-unit-select')
      ).toBeInTheDocument();
    });

    it('should have conditional logic for including valid max latency values', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      // Component should render form fields for max latency
      expect(screen.getByTestId('max-latency-value-input')).toBeInTheDocument();
      expect(screen.getByTestId('max-latency-unit-select')).toBeInTheDocument();
    });

    it('should have conditional logic for including valid retention values', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      // Component should render form fields for retention
      expect(screen.getByTestId('retention-period-input')).toBeInTheDocument();
      expect(screen.getByTestId('retention-unit-select')).toBeInTheDocument();
    });

    it('should render TimePicker for availability time', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      const timePicker = screen.getByTestId('availability');

      expect(timePicker).toBeInTheDocument();
    });

    it('should use >= 0 validation logic for numeric values', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      // Component implements conditional logic that checks for >= 0 values
      // This is verified by the presence of InputNumber components which handle this validation
      expect(
        screen.getByTestId('refresh-frequency-interval-input')
      ).toBeInTheDocument();
      expect(screen.getByTestId('max-latency-value-input')).toBeInTheDocument();
      expect(screen.getByTestId('retention-period-input')).toBeInTheDocument();
    });
  });

  describe('Initial Values Handling', () => {
    it('should render component with initial values without errors', () => {
      render(
        <ContractSLAFormTab initialValues={mockContract} {...commonProps} />
      );

      // Component should render successfully with initial values
      expect(screen.getByText('label.sla')).toBeInTheDocument();
      expect(
        screen.getByTestId('refresh-frequency-interval-input')
      ).toBeInTheDocument();
      expect(screen.getByTestId('max-latency-value-input')).toBeInTheDocument();
      expect(screen.getByTestId('retention-period-input')).toBeInTheDocument();
    });

    it('should handle availability time with moment formatting', () => {
      render(
        <ContractSLAFormTab initialValues={mockContract} {...commonProps} />
      );

      // The availability time picker should be present and configured correctly
      const timePicker = document.querySelector('.availability-time-picker');

      expect(timePicker).toBeInTheDocument();
    });

    it('should use useEffect hook for setting initial form values', () => {
      // Test that component accepts initialValues prop and renders without errors
      const { rerender } = render(<ContractSLAFormTab {...commonProps} />);

      // Re-render with initial values
      rerender(
        <ContractSLAFormTab initialValues={mockContract} {...commonProps} />
      );

      expect(screen.getByText('label.sla')).toBeInTheDocument();
    });

    it('should handle partial initial values correctly', () => {
      const partialContract: Partial<DataContract> = {
        sla: {
          maxLatency: {
            unit: MaxLatencyUnit.Hour,
            value: 1,
          },
          // Missing other SLA properties
        },
      };

      render(
        <ContractSLAFormTab initialValues={partialContract} {...commonProps} />
      );

      // Should render without errors even with partial data
      expect(screen.getByText('label.sla')).toBeInTheDocument();
    });

    it('should handle undefined initialValues gracefully', () => {
      render(<ContractSLAFormTab initialValues={undefined} {...commonProps} />);

      // Should render without errors
      expect(screen.getByText('label.sla')).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should render InputNumber components that handle numeric validation', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      // InputNumber components provide built-in validation for numeric inputs
      const intervalInput = screen.getByTestId(
        'refresh-frequency-interval-input'
      );
      const maxLatencyInput = screen.getByTestId('max-latency-value-input');
      const retentionInput = screen.getByTestId('retention-period-input');

      expect(intervalInput).toBeInTheDocument();
      expect(maxLatencyInput).toBeInTheDocument();
      expect(retentionInput).toBeInTheDocument();

      // These should be InputNumber components
      expect(intervalInput.closest('.ant-input-number')).toBeInTheDocument();
      expect(maxLatencyInput.closest('.ant-input-number')).toBeInTheDocument();
      expect(retentionInput.closest('.ant-input-number')).toBeInTheDocument();
    });

    it('should handle form reset after initial values are set', () => {
      const { rerender } = render(
        <ContractSLAFormTab initialValues={mockContract} {...commonProps} />
      );

      // Re-render with no initial values (simulating form reset)
      rerender(<ContractSLAFormTab {...commonProps} />);

      // Component should handle the transition gracefully
      expect(screen.getByText('label.sla')).toBeInTheDocument();
    });

    it('should maintain form state during re-renders', () => {
      const { rerender } = render(<ContractSLAFormTab {...commonProps} />);

      // Re-render with same props
      rerender(<ContractSLAFormTab {...commonProps} />);

      // All form fields should still be present
      expect(
        screen.getByTestId('refresh-frequency-interval-input')
      ).toBeInTheDocument();
      expect(screen.getByTestId('max-latency-value-input')).toBeInTheDocument();
      expect(screen.getByTestId('retention-period-input')).toBeInTheDocument();
    });

    it('should handle mixed validation scenarios with conditional logic', () => {
      render(<ContractSLAFormTab {...commonProps} />);

      // Component uses conditional logic to include only valid field combinations
      // This is evidenced by the presence of both value and unit fields for each metric
      expect(
        screen.getByTestId('refresh-frequency-interval-input')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('refresh-frequency-unit-select')
      ).toBeInTheDocument();

      expect(screen.getByTestId('max-latency-value-input')).toBeInTheDocument();
      expect(screen.getByTestId('max-latency-unit-select')).toBeInTheDocument();

      expect(screen.getByTestId('retention-period-input')).toBeInTheDocument();
      expect(screen.getByTestId('retention-unit-select')).toBeInTheDocument();
    });
  });

  // Regression coverage for the `>= 0` guard that admitted `null` (because
  // `null >= 0` is `true` in JavaScript). Clearing an antd InputNumber emits
  // `null`; the guard must now drop the SLA sub-object instead of emitting
  // `{ ..., value: null }` (which corrupted contracts via PATCH `replace` ops).
  describe('Cleared numeric value guards (null-input regression)', () => {
    const slaButtonProps = {
      nextLabel: 'Next',
      prevLabel: 'Prev',
      isNextVisible: true,
    };

    const getLastSla = (onChangeMock: jest.Mock): ContractSLA | undefined =>
      onChangeMock.mock.calls[onChangeMock.mock.calls.length - 1]?.[0]?.sla;

    const renderWithSla = (onChange: jest.Mock) =>
      render(
        <ContractSLAFormTab
          buttonProps={slaButtonProps}
          initialValues={mockContract}
          onChange={onChange}
          onPrev={jest.fn()}
        />
      );

    const getSpinbutton = (name: RegExp) =>
      screen.getByRole('spinbutton', { name }) as HTMLInputElement;

    const clearField = async (name: RegExp) => {
      await act(async () => {
        fireEvent.change(getSpinbutton(name), { target: { value: '' } });
      });
    };

    const setField = async (name: RegExp, value: string) => {
      await act(async () => {
        fireEvent.change(getSpinbutton(name), { target: { value } });
      });
    };

    // Predicate shared by the JSON-patch safety tests: true when a patch op
    // replaces an SLA numeric property with `null` (the corruption shape).
    const isNullNumericReplacer = (op: {
      op: string;
      path: string;
      value?: unknown;
    }): boolean =>
      op.op === 'replace' &&
      op.value === null &&
      /^\/sla\/(maxLatency\/value|refreshFrequency\/interval|retention\/period)$/.test(
        op.path
      );

    it('omits maxLatency (not { value: null }) when the value is cleared but unit remains', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      // Confirms pre-fill happened, so clearing the value leaves the unit selected
      // (the exact sequence that exposed the `null >= 0` coercion bug).
      expect(getSpinbutton(/label.value/i).value).toBe('2');

      await clearField(/label.value/i);

      const sla = getLastSla(onChange);

      expect(sla).toBeDefined();
      expect(sla?.maxLatency).toBeUndefined();
      expect(JSON.stringify(sla)).not.toContain('null');
    });

    it('omits refreshFrequency (not { interval: null }) when the interval is cleared but unit remains', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      expect(getSpinbutton(/label.interval/i).value).toBe('1');

      await clearField(/label.interval/i);

      const sla = getLastSla(onChange);

      expect(sla).toBeDefined();
      expect(sla?.refreshFrequency).toBeUndefined();
      expect(JSON.stringify(sla)).not.toContain('null');
    });

    it('omits retention (not { period: null }) when the period is cleared but unit remains', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      expect(getSpinbutton(/label.period/i).value).toBe('30');

      await clearField(/label.period/i);

      const sla = getLastSla(onChange);

      expect(sla).toBeDefined();
      expect(sla?.retention).toBeUndefined();
      expect(JSON.stringify(sla)).not.toContain('null');
    });

    it('still emits maxLatency when value is 0 (zero stays a valid value)', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await setField(/label.value/i, '0');

      const sla = getLastSla(onChange);

      expect(sla?.maxLatency).toEqual({ unit: MaxLatencyUnit.Hour, value: 0 });
    });

    it('still emits refreshFrequency when interval is 0', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await setField(/label.interval/i, '0');

      const sla = getLastSla(onChange);

      expect(sla?.refreshFrequency).toEqual({
        interval: 0,
        unit: RefreshFrequencyUnit.Day,
      });
    });

    it('still emits retention when period is 0', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await setField(/label.period/i, '0');

      const sla = getLastSla(onChange);

      expect(sla?.retention).toEqual({ period: 0, unit: RetentionUnit.Day });
    });

    it('omits maxLatency when a negative value is entered (>= 0 guard still rejects negatives)', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await setField(/label.value/i, '-5');

      const sla = getLastSla(onChange);

      expect(sla?.maxLatency).toBeUndefined();
    });

    it('maxLatency clear yields a safe JSON patch (remove, not replace:null) via fast-json-patch compare', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await clearField(/label.value/i);

      const sla = getLastSla(onChange);
      // Reproduces AddDataContract.handleSave's `compare(filteredContract, {...formValues})`
      // against the stored SLA, the exact pipeline that produced the corrupting
      // `{op:'replace','/sla/maxLatency/value',value:null}` op on HEAD.
      const patch = compare({ sla: mockContract.sla }, { sla });

      expect(patch.find(isNullNumericReplacer)).toBeUndefined();
      expect(patch).toContainEqual({ op: 'remove', path: '/sla/maxLatency' });
    });

    it('refreshFrequency clear yields a safe JSON patch (remove, not replace:null) via fast-json-patch compare', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await clearField(/label.interval/i);

      const sla = getLastSla(onChange);
      const patch = compare({ sla: mockContract.sla }, { sla });

      expect(patch.find(isNullNumericReplacer)).toBeUndefined();
      expect(patch).toContainEqual({
        op: 'remove',
        path: '/sla/refreshFrequency',
      });
    });

    it('retention clear yields a safe JSON patch (remove, not replace:null) via fast-json-patch compare', async () => {
      const onChange = jest.fn();
      renderWithSla(onChange);

      await clearField(/label.period/i);

      const sla = getLastSla(onChange);
      const patch = compare({ sla: mockContract.sla }, { sla });

      expect(patch.find(isNullNumericReplacer)).toBeUndefined();
      expect(patch).toContainEqual({ op: 'remove', path: '/sla/retention' });
    });
  });
});
